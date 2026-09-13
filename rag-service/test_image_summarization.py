import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from multimodal_rag import ImageSummaryRateLimitError, MultimodalRag


class ParsedElement:
    def __init__(self, element_type, page_number, image_path=None, text=""):
        self.data = {
            "type": element_type,
            "text": text,
            "metadata": {"page_number": page_number},
        }
        if image_path:
            self.data["metadata"]["image_path"] = image_path

    def to_dict(self):
        return self.data.copy() | {"metadata": self.data["metadata"].copy()}


class ImageSummaryLimitTests(unittest.TestCase):
    def make_rag(self, limit):
        rag = object.__new__(MultimodalRag)
        rag.max_image_summaries = limit
        return rag

    def test_limit_caps_image_calls_and_keeps_text(self):
        rag = self.make_rag(2)
        calls = []
        rag.summarise_image = lambda path: calls.append(path) or f"summary {path}"
        elements = [
            ParsedElement("Image", 1, "one.jpg"),
            ParsedElement("NarrativeText", 1, text="preserved text"),
            ParsedElement("Image", 2, "two.jpg"),
            ParsedElement("Image", 3, "three.jpg"),
        ]

        result = rag.replace_image_with_summary(elements)

        self.assertEqual(calls, ["one.jpg", "two.jpg"])
        self.assertEqual(result[0]["image_summary"], "summary one.jpg")
        self.assertNotIn("image_summary", result[3])
        self.assertEqual(rag.create_chunks(rag.group_data_by_page(result))[0]["content"], "summary one.jpg\npreserved text")

    def test_429_stops_all_remaining_image_calls(self):
        rag = self.make_rag(10)
        calls = []

        def quota_error(path):
            calls.append(path)
            raise ImageSummaryRateLimitError()

        rag.summarise_image = quota_error
        result = rag.replace_image_with_summary([
            ParsedElement("Image", 1, "one.jpg"),
            ParsedElement("NarrativeText", 1, text="text still ingests"),
            ParsedElement("Image", 2, "two.jpg"),
        ])

        self.assertEqual(calls, ["one.jpg"])
        self.assertEqual(rag.create_chunks(rag.group_data_by_page(result))[0]["content"], "text still ingests")

    def test_real_image_summary_429_is_not_retried(self):
        rag = self.make_rag(10)
        sent_messages = []

        class FailingSession:
            def send_message(self, message):
                sent_messages.append(message)
                raise RuntimeError("429 RESOURCE_EXHAUSTED")

        rag.image_client = SimpleNamespace(
            chats=SimpleNamespace(create=lambda **kwargs: FailingSession())
        )
        rag.generation_model = "test-model"
        rag.generation_config = SimpleNamespace(
            temperature=0.7, top_p=0.95, top_k=40,
            max_output_tokens=100, response_mime_type="text/plain",
        )
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "test.jpg"
            image_path.write_bytes(b"not a real image; the mocked client never inspects it")
            with self.assertRaises(ImageSummaryRateLimitError):
                rag.summarise_image(str(image_path))

        self.assertEqual(len(sent_messages), 1)

    def test_zero_limit_makes_no_image_calls(self):
        rag = self.make_rag(0)
        rag.summarise_image = lambda path: self.fail("Gemini must not be called")
        rag.replace_image_with_summary([ParsedElement("Image", 1, "one.jpg")])

    def test_environment_default_and_zero_limit(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MAX_IMAGE_SUMMARIES", None)
            self.assertEqual(MultimodalRag._read_max_image_summaries(), 10)
        with patch.dict(os.environ, {"MAX_IMAGE_SUMMARIES": "0"}):
            self.assertEqual(MultimodalRag._read_max_image_summaries(), 0)


if __name__ == "__main__":
    unittest.main()
