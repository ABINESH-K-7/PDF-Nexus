import os
import logging
import mimetypes
import re
import time
import json
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from tqdm import tqdm
from typing import List

import nltk
from unstructured.partition.pdf import partition_pdf

from google import genai
from google.genai import types
import chromadb
from chromadb.config import Settings

from prompts import RAG_SYSTEM_PROMPT, IMAGE_SYSTEM_PROMPT


logger = logging.getLogger(__name__)
EMBEDDING_MODEL = "gemini-embedding-001"
# Keep a fixed vector size for both document and query storage/retrieval.
# Gemini Embedding uses Matryoshka representations, so a prefix is valid.
EMBEDDING_DIMENSIONS = 768
DEFAULT_GENERATION_MODEL = "gemini-3.6-flash"
# google-genai 2.23.0 defines attempts as the total number of requests,
# including the original one. Keep the interactive chat client at one attempt
# so its default 429/5xx exponential retry policy cannot delay /ask.
INTERACTIVE_GENERATION_RETRY_OPTIONS = types.HttpRetryOptions(attempts=1)
INTERACTIVE_GENERATION_HTTP_OPTIONS = types.HttpOptions(
    retry_options=INTERACTIVE_GENERATION_RETRY_OPTIONS,
)


class GeminiRateLimitError(RuntimeError):
    """A Gemini generation 429 that is returned to the interactive client."""

    is_gemini_rate_limit = True

    def __init__(self, retry_after: int | None = None, error_type: str = "rate_limit_exceeded"):
        self.retry_after = retry_after
        self.error_type = error_type
        message = (
            "Gemini API quota is currently exhausted. Please try again after the quota resets or increase the API quota."
            if error_type == "quota_exceeded"
            else "AI service is temporarily rate limited. Please try again shortly."
        )
        super().__init__(message)


class ImageSummaryRateLimitError(RuntimeError):
    """Signal that image summaries must stop after a Gemini HTTP 429."""


class FallbackGenerationError(RuntimeError):
    """A configured fallback provider could not produce a safe answer."""


class FallbackRateLimitError(RuntimeError):
    """A safe client-facing error for a fallback provider HTTP 429."""

    # app.py already maps rate-limit errors to a JSON HTTP 429 response.
    is_gemini_rate_limit = True
    error_type = "fallback_rate_limit_exceeded"
    retry_after = None

    def __init__(self):
        super().__init__(
            "Both the primary and fallback AI providers are temporarily unavailable."
        )


class MultimodalRag:
    def __init__(self, api_key: str, collection_name: str, db_path: str = "./chroma_db"):
        self.api_key = api_key
        self.db_path = db_path
        self.collection_name = collection_name

        # Chroma 1.5.9's Rust local backend is the supported persistent option
        # for this Python 3.13 Windows environment. SegmentAPI requires an
        # unavailable hnswlib build for this interpreter.
        chroma_settings = Settings(
            chroma_api_impl="chromadb.api.rust.RustBindingsAPI",
            is_persistent=True,
            persist_directory=db_path,
            anonymized_telemetry=False,
            allow_reset=True,
        )
        self.client = chromadb.Client(chroma_settings)
        logger.info(
            "[CHROMA] client initialized impl=%s persist_directory=%s",
            self.client.get_settings().chroma_api_impl,
            db_path,
        )

        # One current Google GenAI client is shared by embedding, RAG, and image
        # summarization. gemini-3.6-flash is available to this API key for
        # generateContent.
        self.gemini_client = genai.Client(api_key=self.api_key)
        self.embedding_client = self.gemini_client
        # Image and interactive generation use a one-attempt client. This
        # prevents SDK-level 429 retries from multiplying image API calls.
        self.generation_client = genai.Client(
            api_key=self.api_key,
            http_options=INTERACTIVE_GENERATION_HTTP_OPTIONS,
        )
        self.image_client = self.generation_client
        logger.info("[GENERATION] retry attempts=1")
        logger.info("[GENERATION] automatic 429 retry disabled")
        self.generation_model = os.getenv(
            "GEMINI_GENERATION_MODEL", DEFAULT_GENERATION_MODEL
        )
        self.max_image_summaries = self._read_max_image_summaries()
        logger.info("[IMAGE] max_image_summaries=%d", self.max_image_summaries)
        self.generation_config = types.GenerateContentConfig(
            temperature=0.7,
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
            response_mime_type="text/plain",
        )
        self.fallback_api_key = os.getenv("FALLBACK_LLM_API_KEY", "").strip()
        self.fallback_model = os.getenv("FALLBACK_LLM_MODEL", "").strip()
        self.fallback_base_url = os.getenv(
            "FALLBACK_LLM_BASE_URL", "https://api.openai.com/v1"
        ).strip().rstrip("/")
        try:
            self.fallback_timeout_seconds = float(
                os.getenv("FALLBACK_LLM_TIMEOUT_SECONDS", "30")
            )
        except ValueError:
            self.fallback_timeout_seconds = 30.0
            logger.warning("[FALLBACK] invalid timeout; using 30 seconds")
        if self.fallback_timeout_seconds <= 0:
            self.fallback_timeout_seconds = 30.0
            logger.warning("[FALLBACK] non-positive timeout; using 30 seconds")
        self.fallback_configuration_error = self._fallback_configuration_error()
        if self.fallback_configuration_error:
            logger.info("[FALLBACK] configured=false")
            logger.warning("[FALLBACK] configuration error=%s", self.fallback_configuration_error)
        else:
            logger.info("[FALLBACK] configured=true")
            logger.info("[FALLBACK] base_url=%s", self.fallback_base_url)
            logger.info("[FALLBACK] model=%s", self.fallback_model)

    @staticmethod
    def _read_max_image_summaries() -> int:
        """Read a non-negative image-summary cap; an unset value is never unlimited."""
        raw_value = os.getenv("MAX_IMAGE_SUMMARIES", "10")
        try:
            return max(0, int(raw_value))
        except ValueError:
            logger.warning(
                "[IMAGE] invalid MAX_IMAGE_SUMMARIES=%r; using safe default 10",
                raw_value,
            )
            return 10

    def _fallback_configuration_error(self) -> str | None:
        """Validate only local configuration; never make a provider request here."""
        if not self.fallback_api_key:
            return "FALLBACK_LLM_API_KEY is not configured"
        if not self.fallback_model:
            return "FALLBACK_LLM_MODEL is not configured"
        placeholder_models = {"YOUR_FALLBACK_MODEL", "YOUR_MODEL", "PLACEHOLDER"}
        if self.fallback_model.upper() in placeholder_models:
            return "FALLBACK_LLM_MODEL is a placeholder, not a provider model"
        parsed_url = urlparse(self.fallback_base_url)
        if parsed_url.scheme not in ("http", "https") or not parsed_url.netloc:
            return "FALLBACK_LLM_BASE_URL must be an absolute http(s) API base URL"
        if parsed_url.query or parsed_url.fragment or parsed_url.path.rstrip("/").endswith("chat/completions"):
            return "FALLBACK_LLM_BASE_URL must be the API base URL, not /chat/completions"
        return None

    def delete_collection(self) -> None:
        """Safely delete the collection and its metadata"""
        try:
            self.client.delete_collection(self.collection_name)
        except Exception as e:
            print(f"Error deleting collection: {str(e)}")

    def summarise_image(self, image_path: str) -> str | None:
        """Generate one image summary with exactly one Gemini request."""
        try:
            mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
            image_part = types.Part.from_bytes(
                data=Path(image_path).read_bytes(), mime_type=mime_type
            )
            chat_session = self.image_client.chats.create(
                model=self.generation_model,
                config=types.GenerateContentConfig(
                    system_instruction=IMAGE_SYSTEM_PROMPT,
                    temperature=self.generation_config.temperature,
                    top_p=self.generation_config.top_p,
                    top_k=self.generation_config.top_k,
                    max_output_tokens=self.generation_config.max_output_tokens,
                    response_mime_type=self.generation_config.response_mime_type,
                ),
            )
            response = chat_session.send_message(
                [image_part, "Analyze the provided image and generate a concise, detailed summary."]
            )
            if not response.text:
                raise RuntimeError("Gemini returned an empty image summary")
            return response.text
        except Exception as error:
            if self._is_rate_limit_error(error):
                # Do not spend the remaining image budget retrying a quota error.
                raise ImageSummaryRateLimitError() from error
            logger.warning("[IMAGE] failed to summarize image: %s", error)
            return None

    def process_pdf(self, pdf_path: str, asset_dir: str) -> List[str]:
        """Extract content using only the caller-provided temporary workspace."""
        os.makedirs(asset_dir, exist_ok=True)
        try:
            print("Parsing PDF...")
            logger.info("PDF extraction started")
            parsed_pdf = partition_pdf(
                pdf_path,
                extract_images_in_pdf=True,
                extract_image_block_output_dir=asset_dir,
                infer_table_structure=True,
                max_characters=4000,
                new_after_n_chars=3800,
                combine_text_under_n_chars=2000
            )

            print("Processing images and creating summaries...")
            logger.info("PDF extraction completed: %d elements", len(parsed_pdf))
            data_to_embed = self.replace_image_with_summary(parsed_pdf)

            print("Creating chunks...")
            data_by_page = self.group_data_by_page(data_to_embed)
            chunks = self.create_chunks(data_by_page)

            return chunks
        except Exception as e:
            print(f"Error processing PDF: {str(e)}")
            raise

    def ingest_pdf(self, pdf_path: str, user_id: str, file_id: str, document_name: str = None, asset_dir: str = None) -> None:
        """Ingest PDF with improved error handling and metadata tracking"""
        try:
            chunks = self.process_pdf(pdf_path, asset_dir or os.path.dirname(pdf_path))
            chunks = [chunk for chunk in chunks if chunk["content"].strip()]
            if not chunks:
                raise ValueError("The PDF does not contain extractable content")
            print("Creating embeddings...")
            logger.info("Embedding started for %d chunks", len(chunks))

            collection = self.client.get_or_create_collection(
                name=self.collection_name
            )

            # Create embeddings with PDF metadata
            embeddings = [self.get_query_embedding(chunk["content"]) for chunk in chunks]
            logger.info("Embedding completed for %d chunks", len(embeddings))
            pdf_name = document_name or os.path.basename(pdf_path)

            # Re-ingesting the same user's PDF replaces its previous chunks.
            collection.delete(where={"$and": [{"user_id": user_id}, {"file_id": file_id}]})

            logger.info("ChromaDB storage started")
            collection.add(
                ids=[f"{user_id}_{file_id}_chunk_{i}" for i in range(len(chunks))],
                documents=[chunk["content"] for chunk in chunks],
                embeddings=embeddings,
                metadatas=[{
                    "user_id": user_id,
                    "file_id": file_id,
                    "pdf_name": pdf_name,
                    "document_name": pdf_name,
                    "page_number": chunk["page_number"],
                    "content_type": chunk["content_type"],
                    "chunk_number": index
                } for index, chunk in enumerate(chunks)]
            )

            logger.info("ChromaDB storage completed")
            print("PDF ingested successfully")
        except Exception as e:
            print(f"Error ingesting PDF: {str(e)}")
            raise

    def replace_image_with_summary(self, parsed_pdf):
        data_to_embed = [parsed_object.to_dict() for parsed_object in parsed_pdf]
        image_indexes = [
            index for index, data in enumerate(data_to_embed)
            if data.get("type") == "Image"
        ]
        images_found = len(image_indexes)
        max_summaries = self.max_image_summaries
        logger.info(
            "[IMAGE] total_images=%d max_image_summaries=%d",
            images_found,
            max_summaries,
        )

        # Favor page coverage with a small, deterministic selection: choose one
        # image per page first, then fill any remaining slots in document order.
        selected_indexes = []
        selected_pages = set()
        for index in image_indexes:
            page_number = data_to_embed[index].get("metadata", {}).get("page_number")
            if page_number not in selected_pages:
                selected_indexes.append(index)
                selected_pages.add(page_number)
        selected_indexes.extend(index for index in image_indexes if index not in selected_indexes)
        selected_indexes = selected_indexes[:max_summaries]

        summaries_created = 0
        quota_exhausted = False
        logger.info("Image summarization started")
        for summary_number, index in enumerate(selected_indexes, start=1):
            parsed_object = data_to_embed[index]
            image_path = parsed_object.get("metadata", {}).get("image_path")
            logger.info("[IMAGE] summarizing image %d/%d", summary_number, len(selected_indexes))
            if not image_path:
                logger.warning("[IMAGE] skipping image without an extracted image_path")
                continue
            try:
                summary = self.summarise_image(image_path)
            except ImageSummaryRateLimitError:
                quota_exhausted = True
                logger.warning("[IMAGE] Gemini 429 encountered; stopping image summarization")
                logger.warning("[IMAGE] Continuing ingestion without remaining image summaries")
                break
            if summary:
                parsed_object["image_summary"] = summary
                summaries_created += 1

        summaries_skipped = images_found - summaries_created
        if images_found > len(selected_indexes) and not quota_exhausted:
            logger.info("[IMAGE] image summary limit reached; skipping remaining images")
        logger.info("[IMAGE] summaries_created=%d", summaries_created)
        logger.info("[IMAGE] summaries_skipped=%d", summaries_skipped)
        return data_to_embed

    def group_data_by_page(self, data_to_embed):
        data_by_page = [[]]
        cur_page_number = 1

        for data in data_to_embed:
            if data['type'] == 'Footer':
                continue
            if data['metadata']['page_number'] != cur_page_number:
                cur_page_number += 1
                data_by_page.append([])
            data_by_page[-1].append(data)

        return data_by_page

    def create_chunks(self, data_by_page):
        chunks = []
        for page_number, page in enumerate(data_by_page, start=1):
            chunk_text = []
            types = []
            for data in page:
                types.append(data["type"])
                if data['type'] == "Image":
                    # Images live only in the ingestion temporary directory.
                    # Persist their Gemini description, never a dead local path.
                    text = data.get('image_summary', '')
                else:
                    text = data.get('text', '')
                if text:
                    chunk_text.append(text)
            content_type = "image" if any(
                data.get("type") == "Image" and data.get("image_summary")
                for data in page
            ) else "table" if "Table" in types else "text"
            chunks.append({
                "content": "\n".join(chunk_text),
                "page_number": page_number,
                "content_type": content_type
            })
        return chunks

    def get_query_embedding(self, query):
        """Return one stable Gemini embedding for document and query text."""
        result = self.embedding_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query,
        )
        if not result.embeddings or not result.embeddings[0].values:
            raise RuntimeError("Gemini returned an empty embedding")
        values = result.embeddings[0].values
        if len(values) < EMBEDDING_DIMENSIONS:
            raise RuntimeError(
                f"Gemini returned {len(values)} dimensions; expected at least "
                f"{EMBEDDING_DIMENSIONS}"
            )
        return values[:EMBEDDING_DIMENSIONS]

    def remove_pdf_from_chromadb(self, pdf_name):
        """Removes all chunks related to a PDF from ChromaDB."""
        collection = self.client.get_collection(name=self.collection_name)
        documents = collection.get()

        # Identify document IDs related to the PDF
        doc_ids_to_remove = [
            doc_id for doc_id, metadata in zip(documents['ids'], documents['metadatas'])
            if metadata.get("pdf_name") == pdf_name
        ]

        if doc_ids_to_remove:
            collection.delete(ids=doc_ids_to_remove)
            print(
                f"Removed {len(doc_ids_to_remove)} chunks related to {pdf_name} from ChromaDB.")

    def retrieve_similar_documents(self, query_text, user_id, file_id, top_k=3):
        started_at = time.perf_counter()
        logger.info("[ASK] retrieval started")
        try:
            collection = self.client.get_collection(name=self.collection_name)
            logger.info("[CHROMA] collection loaded collection=%s", self.collection_name)
            query_embedding = self.get_query_embedding(query_text)
            logger.info("Question embedding completed")
            logger.info("[CHROMA] query started collection=%s", self.collection_name)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where={"$and": [{"user_id": user_id}, {"file_id": file_id}]}
            )
            documents = [doc for doc in results['documents'][0]]
            logger.info("[CHROMA] query completed collection=%s", self.collection_name)
            logger.info("[CHROMA] retrieved_chunks=%d", len(documents))
            return documents
        except Exception as error:
            logger.exception(
                "[CHROMA] ERROR type=%s message=%s",
                type(error).__name__,
                error,
            )
            raise RuntimeError("RAG retrieval failed") from error
        finally:
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            logger.info("[ASK] retrieval elapsed_ms=%.1f", elapsed_ms)

    def prompt_builder(self, context, question):
        return f"""RETRIEVED PDF CONTEXT (from the currently selected PDF only):
{context}

CURRENT QUESTION:
{question}
"""

    @staticmethod
    def _is_rate_limit_error(error: Exception) -> bool:
        """Recognize Gemini RESOURCE_EXHAUSTED / HTTP 429 generation errors."""
        status_code = getattr(error, "code", None) or getattr(error, "status_code", None)
        error_text = str(error).upper()
        return status_code == 429 or "RESOURCE_EXHAUSTED" in error_text or "429" in error_text

    @staticmethod
    def _rate_limit_error_type(error: Exception) -> str:
        """Separate a daily/project quota exhaustion from a short rate limit."""
        error_text = str(error).upper()
        quota_signals = (
            "QUOTA_EXCEEDED",
            "DAILY QUOTA",
            "PER DAY",
            "QUOTA LIMIT: 0",
            "LIMIT: 0",
        )
        return "quota_exceeded" if any(signal in error_text for signal in quota_signals) else "rate_limit_exceeded"

    @staticmethod
    def _retry_after_seconds(error: Exception) -> int | None:
        """Extract Gemini retryDelay values such as `retryDelay: 51s`."""
        def find_retry_delay(value):
            if isinstance(value, dict):
                for key, nested_value in value.items():
                    if key.lower().replace("_", "") == "retrydelay":
                        return nested_value
                    found = find_retry_delay(nested_value)
                    if found is not None:
                        return found
            elif isinstance(value, (list, tuple)):
                for nested_value in value:
                    found = find_retry_delay(nested_value)
                    if found is not None:
                        return found
            return None

        retry_delay = find_retry_delay(getattr(error, "details", None))
        if retry_delay is not None:
            structured_match = re.fullmatch(r"(\d+(?:\.\d+)?)s?", str(retry_delay))
            if structured_match:
                return max(1, int(float(structured_match.group(1))))

        error_text = str(error)
        match = re.search(
            r"retry(?:_|\s)?delay[\"':=\s]+[\"']?(\d+(?:\.\d+)?)s?",
            error_text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        return max(1, int(float(match.group(1))))

    def _generation_config(self):
        return types.GenerateContentConfig(
            system_instruction=RAG_SYSTEM_PROMPT,
            temperature=self.generation_config.temperature,
            top_p=self.generation_config.top_p,
            top_k=self.generation_config.top_k,
            max_output_tokens=self.generation_config.max_output_tokens,
            response_mime_type=self.generation_config.response_mime_type,
        )

    def _generate_answer_with_gemini(self, history, prompt):
        """Make exactly one interactive Gemini generation request."""
        generation_started_at = time.perf_counter()
        try:
            logger.info("[GENERATION] provider=gemini")
            logger.info("[GENERATION] Gemini started")
            logger.info("[GENERATION] Gemini model=%s", self.generation_model)
            chat_session = self.generation_client.chats.create(
                model=self.generation_model,
                config=self._generation_config(),
                history=history,
            )
            response = chat_session.send_message(prompt)
            if not response.text:
                raise RuntimeError("Gemini returned an empty answer")
            logger.info("[GENERATION] Gemini returned status=200")
            logger.info("[GENERATION] Gemini call returned")
            logger.info(
                "[GENERATION] elapsed_ms=%d",
                (time.perf_counter() - generation_started_at) * 1000,
            )
            return response.text
        except Exception as error:
            elapsed_ms = (time.perf_counter() - generation_started_at) * 1000
            status_code = getattr(error, "code", None) or getattr(error, "status_code", None)
            logger.warning("[GENERATION] Gemini APIError")
            logger.warning("[GENERATION] code=%s", status_code)
            logger.warning("[GENERATION] elapsed_ms=%d", elapsed_ms)
            if not self._is_rate_limit_error(error):
                raise

            retry_after = self._retry_after_seconds(error)
            error_type = self._rate_limit_error_type(error)
            logger.warning("[ASK] Gemini rate limit detected type=%s", error_type)
            logger.info("[ASK] retry_after=%s", retry_after)
            raise GeminiRateLimitError(retry_after, error_type) from error

    def _generate_answer_with_fallback(self, chat_history, prompt):
        """Use one OpenAI-compatible request with the same RAG prompt/history."""
        if self.fallback_configuration_error:
            logger.warning("[FALLBACK] unavailable: %s", self.fallback_configuration_error)
            raise FallbackGenerationError("fallback is not configured")

        messages = [{"role": "system", "content": RAG_SYSTEM_PROMPT}]
        messages.extend(
            {
                "role": "assistant" if message["role"] == "ai" else "user",
                "content": message["text"],
            }
            for message in chat_history
            if message.get("role") in ("user", "ai") and message.get("text")
        )
        messages.append({"role": "user", "content": prompt})
        payload = json.dumps({
            "model": self.fallback_model,
            "messages": messages,
            "temperature": self.generation_config.temperature,
            "top_p": self.generation_config.top_p,
            "max_tokens": self.generation_config.max_output_tokens,
        }).encode("utf-8")
        request = urllib.request.Request(
            f"{self.fallback_base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.fallback_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        fallback_started_at = time.perf_counter()
        try:
            logger.info("[FALLBACK] provider=openai-compatible")
            logger.info("[FALLBACK] request_started=true")
            with urllib.request.urlopen(request, timeout=self.fallback_timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
            choices = body.get("choices") if isinstance(body, dict) else None
            answer = (
                choices[0].get("message", {}).get("content")
                if isinstance(choices, list) and choices and isinstance(choices[0], dict)
                else None
            )
            if not isinstance(answer, str) or not answer.strip():
                raise FallbackGenerationError("fallback returned an empty answer")
            logger.info("[FALLBACK] HTTP status=200")
            logger.info(
                "[FALLBACK] elapsed_ms=%d",
                (time.perf_counter() - fallback_started_at) * 1000,
            )
            return answer.strip()
        except FallbackGenerationError:
            raise
        except urllib.error.HTTPError as error:
            logger.warning("[FALLBACK] HTTP status=%d", error.code)
            if error.code == 429:
                logger.warning("[FALLBACK] provider_rate_limited=true")
                raise FallbackRateLimitError() from error
            if error.code in (401, 403):
                logger.warning("[FALLBACK] authentication_or_configuration_error=true")
                reason = "fallback authentication or configuration error"
            elif error.code == 404:
                logger.warning("[FALLBACK] endpoint_or_model_not_found=true")
                reason = "fallback endpoint or model not found"
            elif error.code in (408, 500, 502, 503):
                reason = "fallback provider is temporarily unavailable"
            else:
                reason = "fallback provider request failed"
            raise FallbackGenerationError(reason) from error
        except urllib.error.URLError as error:
            logger.warning("[FALLBACK] connection_failed=true type=%s", type(error.reason).__name__)
            raise FallbackGenerationError("fallback connection failed") from error
        except TimeoutError as error:
            logger.warning("[FALLBACK] timeout=true")
            raise FallbackGenerationError("fallback request timed out") from error
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            logger.warning("[FALLBACK] invalid_json_response=true")
            raise FallbackGenerationError("fallback returned invalid JSON") from error

    def invoke(self, question, chat_history=None, user_id=None, file_id=None):

        try:
            if not user_id or not file_id:
                raise ValueError("user_id and file_id are required for retrieval")
            retrieval_started_at = time.perf_counter()
            context = self.retrieve_similar_documents(question, user_id, file_id)
            logger.info(
                "RAG retrieval completed elapsed_ms=%d",
                (time.perf_counter() - retrieval_started_at) * 1000,
            )

            history = [
                types.Content(
                    role="model" if message["role"] == "ai" else "user",
                    parts=[types.Part.from_text(text=message["text"])],
                )
                for message in (chat_history or [])
                if message.get("role") in ("user", "ai") and message.get("text")
            ]
            logger.info("[ASK] history_count=%d", len(history))
            logger.info("[ASK] retrieved_chunks=%d", len(context))
            prompt = self.prompt_builder(context, question)
            try:
                logger.info("[ASK] generation_started=true")
                return self._generate_answer_with_gemini(history, prompt)
            except GeminiRateLimitError as gemini_error:
                logger.warning("[GENERATION] Gemini returned 429")
                logger.info("[GENERATION] switching_to_fallback=true")
                try:
                    answer = self._generate_answer_with_fallback(chat_history or [], prompt)
                    logger.info("[GENERATION] final provider=fallback")
                    logger.info("[GENERATION] final answer length=%d", len(answer))
                    return answer
                except FallbackGenerationError as fallback_error:
                    # Fallback failure must not hide the actionable Gemini 429.
                    logger.warning("[GENERATION] fallback failed reason=%s", fallback_error)
                    logger.info("[ASK] returning 429 without blocking")
                    raise gemini_error

                except FallbackRateLimitError:
                    # The fallback response has a distinct, safe 429 payload.
                    raise

        except (GeminiRateLimitError, FallbackRateLimitError):
            raise
        except Exception as e:
            logger.exception("RAG answer generation failed")
            raise
