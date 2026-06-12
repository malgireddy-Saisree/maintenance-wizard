from pathlib import Path
"""
Vector Store — RAG retrieval engine.

Responsibilities:
  1. Chunk documents into overlapping segments
  2. Embed chunks via Azure OpenAI Embeddings API
  3. Store vectors in-memory (numpy arrays)
  4. Hybrid retrieval: semantic cosine similarity + keyword boost + equipment filter
"""

import asyncio
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from data.document_corpus import Document, get_all_documents
from utils.azure_client import get_embedding

logger = logging.getLogger(__name__)

# ── Chunking config ───────────────────────────────────────────────────────

CHUNK_SIZE = 600        # characters
CHUNK_OVERLAP = 120     # character overlap between consecutive chunks


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    doc_type: str
    title: str
    content: str
    equipment_id: Optional[str]
    metadata: dict = field(default_factory=dict)


@dataclass
class ScoredChunk:
    chunk: Chunk
    score: float
    semantic_score: float
    keyword_boost: float
    equip_boost: float

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk.chunk_id,
            "doc_id": self.chunk.doc_id,
            "doc_type": self.chunk.doc_type,
            "title": self.chunk.title,
            "content": self.chunk.content,
            "equipment_id": self.chunk.equipment_id,
            "score": round(self.score, 4),
            "semantic_score": round(self.semantic_score, 4),
        }


# ── In-memory index ───────────────────────────────────────────────────────

_index: list[tuple[Chunk, np.ndarray]] = []   # (chunk, embedding)
_index_built = False
_index_building = False


def index_status() -> dict:
    return {
        "built": _index_built,
        "building": _index_building,
        "chunk_count": len(_index),
        "doc_count": len(get_all_documents()),
    }


def reset_index() -> None:
    global _index, _index_built, _index_building
    _index = []
    _index_built = False
    _index_building = False
    logger.info("Vector index reset.")


# ── Chunking ──────────────────────────────────────────────────────────────

def _split_into_chunks(doc: Document) -> list[Chunk]:
    text = doc.content
    chunks: list[Chunk] = []
    start = 0
    idx = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))

        # Try to end at a sentence boundary
        if end < len(text):
            for sep in ("\n", ". "):
                pos = text.rfind(sep, start + CHUNK_SIZE // 2, end)
                if pos != -1:
                    end = pos + len(sep)
                    break

        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append(Chunk(
                chunk_id=f"{doc.id}::c{idx}",
                doc_id=doc.id,
                doc_type=doc.type,
                title=doc.title,
                content=chunk_text,
                equipment_id=doc.equipment_id,
                metadata=doc.metadata,
            ))
            idx += 1

        # Always advance by at least (CHUNK_SIZE - CHUNK_OVERLAP) characters
        next_start = end - CHUNK_OVERLAP
        if next_start <= start:
            next_start = start + max(1, CHUNK_SIZE - CHUNK_OVERLAP)
        start = next_start

    return chunks


def get_all_chunks() -> list[Chunk]:
    return [chunk for doc in get_all_documents() for chunk in _split_into_chunks(doc)]


# ── Index building ────────────────────────────────────────────────────────

CACHE_DIR = Path(__file__).parent.parent / "rag_cache"

def _cache_path():
    return CACHE_DIR / "index.pkl"


def try_load_cached_index() -> bool:
    """Load persisted index from disk on startup. Returns True if loaded."""
    global _index, _index_built
    cache = _cache_path()
    if not cache.exists():
        return False
    try:
        import pickle
        with open(cache, "rb") as f:
            data = pickle.load(f)
        _index = [(Chunk(**c) if isinstance(c, dict) else c, np.array(e, dtype=np.float32))
                  for c, e in data]
        _index_built = True
        logger.info("VectorStore | loaded cached index: %d chunks", len(_index))
        return True
    except Exception as exc:
        logger.warning("VectorStore | cache load failed: %s", exc)
        return False


def _save_index():
    """Persist current index to disk."""
    try:
        import pickle
        CACHE_DIR.mkdir(exist_ok=True)
        data = [(
            {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "doc_type": c.doc_type,
             "title": c.title, "content": c.content, "equipment_id": c.equipment_id,
             "metadata": c.metadata},
            e.tolist()
        ) for c, e in _index]
        with open(_cache_path(), "wb") as f:
            import pickle
            pickle.dump(data, f)
        logger.info("VectorStore | index saved to disk (%d chunks)", len(_index))
    except Exception as exc:
        logger.warning("VectorStore | cache save failed: %s", exc)


async def build_index(progress_callback=None) -> int:
    """
    Embed all document chunks and store in memory.
    progress_callback(done, total) called after each embedding.
    """
    global _index, _index_built, _index_building

    if _index_building:
        logger.warning("Index build already in progress.")
        return 0

    _index_building = True
    _index_built = False
    _index = []

    chunks = get_all_chunks()
    total = len(chunks)
    logger.info("Building vector index: %d chunks from %d documents.", total, len(get_all_documents()))

    for i, chunk in enumerate(chunks):
        embed_input = f"{chunk.title}\n\n{chunk.content}"
        embedding = await get_embedding(embed_input)
        _index.append((chunk, np.array(embedding, dtype=np.float32)))

        if progress_callback:
            await progress_callback(i + 1, total)

        # Throttle to avoid rate limits (120 ms between calls)
        if i < total - 1:
            await asyncio.sleep(0.12)

    _index_built = True
    _index_building = False
    logger.info("Vector index built: %d chunks indexed.", len(_index))
    _save_index()
    return len(_index)


# ── Retrieval ─────────────────────────────────────────────────────────────

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


async def retrieve(
    query: str,
    top_k: int = 5,
    equipment_id: Optional[str] = None,
    doc_type_filter: Optional[str] = None,
    min_score: float = 0.20,
) -> list[ScoredChunk]:
    """
    Pure semantic retrieval with optional equipment and type filters.
    """
    if not _index_built:
        raise RuntimeError("Vector index not built. Call build_index() first.")

    query_vec = np.array(await get_embedding(query), dtype=np.float32)
    query_terms = [t.lower() for t in query.split() if len(t) > 3]

    results: list[ScoredChunk] = []

    for chunk, vec in _index:
        # Equipment filter: include general docs (no equipment_id) always
        if equipment_id and chunk.equipment_id not in (None, equipment_id):
            continue
        if doc_type_filter and chunk.doc_type != doc_type_filter:
            continue

        sem_score = _cosine_similarity(query_vec, vec)
        if sem_score < min_score:
            continue

        results.append(ScoredChunk(
            chunk=chunk,
            score=sem_score,
            semantic_score=sem_score,
            keyword_boost=0.0,
            equip_boost=0.0,
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:top_k]


async def hybrid_retrieve(
    query: str,
    top_k: int = 5,
    equipment_id: Optional[str] = None,
    doc_type_filter: Optional[str] = None,
    min_semantic_score: float = 0.18,
) -> list[ScoredChunk]:
    """
    Hybrid retrieval: semantic cosine similarity
    + keyword term boost (up to +0.20)
    + equipment relevance boost (+0.10)
    """
    if not _index_built:
        raise RuntimeError("Vector index not built. Call build_index() first.")

    query_vec = np.array(await get_embedding(query), dtype=np.float32)
    query_terms = [t.lower() for t in query.split() if len(t) > 3]

    results: list[ScoredChunk] = []

    for chunk, vec in _index:
        if equipment_id and chunk.equipment_id not in (None, equipment_id):
            continue
        if doc_type_filter and chunk.doc_type != doc_type_filter:
            continue

        sem_score = _cosine_similarity(query_vec, vec)
        if sem_score < min_semantic_score:
            continue

        # Keyword boost
        chunk_text_lower = (chunk.title + " " + chunk.content).lower()
        matched = sum(1 for t in query_terms if t in chunk_text_lower)
        kw_boost = min(0.20, matched * 0.04)

        # Equipment relevance boost
        eq_boost = 0.10 if (equipment_id and chunk.equipment_id == equipment_id) else 0.0

        total_score = sem_score + kw_boost + eq_boost

        results.append(ScoredChunk(
            chunk=chunk,
            score=total_score,
            semantic_score=sem_score,
            keyword_boost=kw_boost,
            equip_boost=eq_boost,
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:top_k]
