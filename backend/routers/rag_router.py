"""
Router: /api/rag
Endpoints for building, querying, and resetting the vector index.
"""

import asyncio
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from utils.vector_store import build_index, index_status, reset_index, get_all_chunks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rag", tags=["RAG Index"])


class BuildRequest(BaseModel):
    confirm: bool = True


@router.get("/status")
async def get_status() -> dict:
    """Return current index build status."""
    status = index_status()
    chunks = get_all_chunks() if not status["built"] else []
    return {
        **status,
        "chunk_count_preview": len(chunks) if chunks else status["chunk_count"],
    }


@router.post("/build")
async def build_rag_index() -> StreamingResponse:
    """
    Build the vector index by embedding all document chunks.
    Returns a Server-Sent Events stream with progress updates.
    """
    async def event_stream() -> AsyncGenerator[str, None]:
        chunks_done = 0
        total_chunks = 0

        async def on_progress(done: int, total: int) -> None:
            nonlocal chunks_done, total_chunks
            chunks_done = done
            total_chunks = total

        # Run build_index in background, stream progress
        build_task = asyncio.create_task(build_index(progress_callback=on_progress))

        while not build_task.done():
            await asyncio.sleep(0.5)
            pct = int((chunks_done / total_chunks) * 100) if total_chunks else 0
            yield (
                f"data: {{\"stage\":\"embedding\","
                f"\"done\":{chunks_done},"
                f"\"total\":{total_chunks},"
                f"\"pct\":{pct}}}\n\n"
            )

        try:
            count = await build_task
            yield f"data: {{\"stage\":\"done\",\"chunk_count\":{count}}}\n\n"
        except Exception as exc:
            logger.error("Index build failed: %s", exc)
            yield f"data: {{\"stage\":\"error\",\"message\":\"{str(exc)}\"}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/reset")
async def reset_rag_index() -> dict:
    """Reset (clear) the in-memory vector index."""
    reset_index()
    return {"status": "reset", "message": "Vector index cleared."}


@router.get("/chunks")
async def list_chunks(limit: int = 50) -> dict:
    """List document chunks (preview, no embeddings returned)."""
    chunks = get_all_chunks()
    return {
        "total": len(chunks),
        "chunks": [
            {
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "doc_type": c.doc_type,
                "title": c.title,
                "equipment_id": c.equipment_id,
                "content_preview": c.content[:200],
                "char_count": len(c.content),
            }
            for c in chunks[:limit]
        ],
    }
