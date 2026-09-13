import os
import tempfile
import logging
import time
from pathlib import Path
from typing import TYPE_CHECKING

import gridfs
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient

if TYPE_CHECKING:
    from multimodal_rag import MultimodalRag


logger = logging.getLogger(__name__)

load_dotenv()
app = FastAPI(title="PDF Nexus RAG Service")
rag = None


class HistoryMessage(BaseModel):
    role: str
    text: str


class AskRequest(BaseModel):
    fileId: str
    userId: str
    threadId: str
    question: str = Field(min_length=1)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=16)


class IngestRequest(BaseModel):
    file_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)


def get_rag():
    global rag
    if rag is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        # Keep startup/docs available even if optional extraction dependencies
        # are unavailable; they are only needed when RAG work is requested.
        from multimodal_rag import MultimodalRag
        rag = MultimodalRag(
            api_key=api_key,
            collection_name=os.getenv("CHROMA_COLLECTION", "pdf_nexus"),
            db_path=os.getenv("CHROMA_DB_PATH", "./chroma_db")
        )
    return rag


@app.get("/health")
def health():
    return {"success": True, "service": "pdf-nexus-rag"}


@app.post("/ask")
def ask(request: AskRequest):
    started_at = time.perf_counter()
    response_status = 500
    try:
        logger.info(
            "/ask received user_id=%s file_id=%s thread_id=%s history_messages=%d",
            request.userId, request.fileId, request.threadId, len(request.history)
        )
        answer = get_rag().invoke(
            question=request.question,
            chat_history=[message.model_dump() for message in request.history],
            user_id=request.userId,
            file_id=request.fileId
        )
        response_status = 200
        return {"success": True, "answer": answer}
    except Exception as error:
        if getattr(error, "is_gemini_rate_limit", False):
            retry_after = getattr(error, "retry_after", None)
            error_type = getattr(error, "error_type", "rate_limit_exceeded")
            response_status = 429
            logger.warning("/ask returning provider 429 type=%s retry_after=%s", error_type, retry_after)
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": str(error),
                    "message": str(error),
                    "error_type": error_type,
                    "retry_after": retry_after,
                },
            )
        logger.exception("/ask failed")
        raise HTTPException(status_code=500, detail="Unable to generate an answer") from error
    finally:
        logger.info(
            "/ask completed status=%s elapsed_ms=%d",
            response_status,
            (time.perf_counter() - started_at) * 1000,
        )


@app.post("/ingest")
def ingest(request: IngestRequest):
    if not ObjectId.is_valid(request.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")

    mongo_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DB_NAME")
    if not mongo_uri or not database_name:
        raise HTTPException(status_code=500, detail="MongoDB RAG configuration is incomplete")

    client = None
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
        db = client[database_name]
        file_id = ObjectId(request.file_id)
        file = db.fs.files.find_one({"_id": file_id})
        if not file:
            raise HTTPException(status_code=404, detail="PDF not found")
        if file.get("metadata", {}).get("userId") != request.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized file access")
        if file.get("contentType") not in (None, "application/pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        with tempfile.TemporaryDirectory(prefix="pdf-nexus-") as directory:
            temp_path = Path(directory) / "source.pdf"
            # The enclosing TemporaryDirectory removes the PDF and extracted
            # image assets whether ingestion succeeds or raises.
            grid_file = gridfs.GridFS(db, collection="fs").get(file_id)
            with temp_path.open("wb") as destination:
                destination.write(grid_file.read())
            logger.info("GridFS download completed for file_id=%s", request.file_id)
            get_rag().ingest_pdf(str(temp_path), request.user_id, request.file_id, file.get("filename", "document.pdf"), directory)
        return {"success": True, "file_id": request.file_id, "message": "PDF ingested successfully"}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("/ingest failed")
        raise HTTPException(status_code=500, detail="Unable to ingest PDF") from error
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
