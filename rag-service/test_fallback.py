import json
import os
import re
import sys
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from dotenv import load_dotenv

from multimodal_rag import (
    FallbackRateLimitError,
    GeminiRateLimitError,
    MultimodalRag,
)


class FallbackTests(unittest.TestCase):
    def make_rag(self):
        rag = object.__new__(MultimodalRag)
        rag.fallback_api_key = "test-key"
        rag.fallback_model = "provider-model"
        rag.fallback_base_url = "https://fallback.example/v1"
        rag.fallback_timeout_seconds = 12
        rag.fallback_configuration_error = None
        rag.generation_config = SimpleNamespace(temperature=0.7, top_p=0.95, max_output_tokens=100)
        return rag

    def test_openai_compatible_request_reuses_history_and_prompt(self):
        rag = self.make_rag()
        response = MagicMock()
        response.read.return_value = b'{"choices":[{"message":{"content":"fallback answer"}}]}'
        urlopen = MagicMock()
        urlopen.return_value.__enter__.return_value = response

        with patch("multimodal_rag.urllib.request.urlopen", urlopen):
            answer = rag._generate_answer_with_fallback(
                [{"role": "user", "text": "previous question"}],
                "RETRIEVED PDF CONTEXT: document evidence\nCURRENT QUESTION: current question",
            )

        self.assertEqual(answer, "fallback answer")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://fallback.example/v1/chat/completions")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["model"], "provider-model")
        self.assertEqual(payload["messages"][1]["content"], "previous question")
        self.assertIn("document evidence", payload["messages"][-1]["content"])

    def test_fallback_429_has_a_safe_distinct_error(self):
        rag = self.make_rag()
        rate_limited = urllib.error.HTTPError("https://fallback.example", 429, "Too Many Requests", {}, None)
        with patch("multimodal_rag.urllib.request.urlopen", side_effect=rate_limited):
            with self.assertRaises(FallbackRateLimitError) as raised:
                rag._generate_answer_with_fallback([], "prompt")

        self.assertEqual(raised.exception.error_type, "fallback_rate_limit_exceeded")
        self.assertNotIn("Too Many Requests", str(raised.exception))

    def test_gemini_429_uses_fallback_once_with_same_retrieval(self):
        rag = self.make_rag()
        rag.retrieve_similar_documents = MagicMock(return_value=["document evidence"])
        rag._generate_answer_with_gemini = MagicMock(side_effect=GeminiRateLimitError())
        rag._generate_answer_with_fallback = MagicMock(return_value="fallback answer")

        answer = rag.invoke(
            "current question",
            chat_history=[{"role": "user", "text": "previous question"}],
            user_id="user-1",
            file_id="file-1",
        )

        self.assertEqual(answer, "fallback answer")
        rag.retrieve_similar_documents.assert_called_once_with("current question", "user-1", "file-1")
        rag._generate_answer_with_gemini.assert_called_once()
        rag._generate_answer_with_fallback.assert_called_once()
        self.assertIn("document evidence", rag._generate_answer_with_fallback.call_args.args[1])


def _sanitized_message(value):
    """Keep provider diagnostics useful without emitting any credential-like text."""
    message = " ".join(str(value or "").split())
    message = re.sub(r"(?i)bearer\s+[^\s,;]+", "Bearer [REDACTED]", message)
    message = re.sub(r"\b(?:sk|sess)-[A-Za-z0-9_-]+", "[REDACTED]", message)
    return message[:500]


def _classify_fallback_error(status, error_type, error_code, error_param, message):
    """Classify standard OpenAI-compatible failures without provider-specific guesses."""
    values = " ".join(
        str(value or "").lower()
        for value in (error_type, error_code, error_param, message)
    )
    if status == 401 or "invalid_api_key" in values or "incorrect api key" in values:
        return "invalid API key"
    if status == 403 or "permission" in values or "project" in values:
        return "permission/project restriction"
    if "insufficient_quota" in values or "insufficient quota" in values or "billing" in values:
        return "insufficient quota / billing"
    if status == 429 or "rate_limit" in values or "rate limit" in values:
        return "rate limiting"
    if error_param == "model" or "model_not_found" in values or "invalid model" in values:
        return "invalid model"
    if status == 404 or "endpoint" in values or "not found" in values:
        return "invalid endpoint"
    return "unclassified provider error"


def run_live_diagnostic():
    """Make one explicit, credential-safe fallback request for local diagnostics."""
    load_dotenv(Path(__file__).with_name(".env"))
    api_key = os.getenv("FALLBACK_LLM_API_KEY", "").strip()
    model = os.getenv("FALLBACK_LLM_MODEL", "").strip()
    base_url = os.getenv("FALLBACK_LLM_BASE_URL", "").strip().rstrip("/")

    status = "not_requested"
    error_type = ""
    error_code = ""
    error_param = ""
    message = ""
    retry_after = ""
    classification = "configuration error"

    if api_key and model and base_url:
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "Reply with: diagnostic"}],
            "max_tokens": 5,
        }).encode("utf-8")
        request = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status = response.status
                classification = "success"
        except urllib.error.HTTPError as error:
            status = error.code
            retry_after = error.headers.get("Retry-After", "")
            try:
                body = json.loads(error.read().decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                body = {}
            provider_error = body.get("error", {}) if isinstance(body, dict) else {}
            if not isinstance(provider_error, dict):
                provider_error = {}
            error_type = str(provider_error.get("type") or "")
            error_code = str(provider_error.get("code") or "")
            error_param = str(provider_error.get("param") or "")
            message = _sanitized_message(provider_error.get("message"))
            classification = _classify_fallback_error(
                status, error_type, error_code, error_param, message
            )
        except (urllib.error.URLError, TimeoutError):
            status = "connection_or_timeout_error"
            classification = "connection or timeout error"
    else:
        message = "Fallback API key, model, or base URL is not configured."

    # Keep this intentionally fixed and credential-safe for copy/paste diagnostics.
    print(f"HTTP status: {status}")
    print(f"error.type: {error_type}")
    print(f"error.code: {error_code}")
    print(f"error.param: {error_param}")
    print(f"error.message: {message}")
    print(f"Retry-After: {retry_after}")
    print(f"classification: {classification}")


if __name__ == "__main__":
    if "--live-diagnostic" in sys.argv:
        run_live_diagnostic()
    else:
        unittest.main()
