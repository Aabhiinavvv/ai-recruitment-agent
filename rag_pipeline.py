"""
RAG Pipeline — Hybrid Retrieval for the Recruitment System
===========================================================
Implements:
  - Section-aware resume chunking
  - Contextual chunk enrichment (Anthropic-style)
  - BM25 sparse retrieval (rank-bm25)
  - FAISS dense retrieval (sentence-transformers)
  - Reciprocal Rank Fusion (RRF)
  - Cross-encoder reranking (sentence-transformers cross-encoder)
  - Multi-query rewriting (optional, requires LLM)

All heavy dependencies (sentence-transformers, rank-bm25) are imported lazily
so the module loads even if those packages are not installed — it degrades
gracefully to the keyword-only path already present in agents.py.
"""

from __future__ import annotations

import re
import math
import hashlib
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Resume section headings → canonical section names
RESUME_SECTION_ALIASES: dict[str, tuple[str, ...]] = {
    "skills": ("skill", "technology", "technical", "tools", "stack", "competenc"),
    "experience": ("experience", "employment", "work history", "professional", "career"),
    "projects": ("project", "portfolio", "open source", "side project"),
    "education": ("education", "academic", "qualification", "degree", "university"),
    "certifications": ("certification", "certificate", "training", "course", "credential"),
    "summary": ("summary", "objective", "profile", "about", "introduction"),
    "achievements": ("achievement", "award", "honour", "honor", "publication"),
}

SECTION_CHUNK_LIMIT = 600          # max chars per section chunk
CHUNK_OVERLAP_CHARS = 80           # overlap between adjacent chunks in same section
RRF_K = 60                         # RRF constant (standard value)
DEFAULT_RETRIEVAL_TOP_K = 20       # first-stage candidates
DEFAULT_RERANK_TOP_N = 5           # after reranking

# Embedding model (local, no API key needed)
SENTENCE_TRANSFORMER_MODEL = "all-MiniLM-L6-v2"
CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


# ---------------------------------------------------------------------------
# Data Types
# ---------------------------------------------------------------------------

class RecruitmentChunk:
    """A processed text chunk with metadata."""

    __slots__ = ("content", "contextualized", "section", "chunk_index", "doc_type", "metadata")

    def __init__(
        self,
        content: str,
        section: str = "general",
        chunk_index: int = 0,
        doc_type: str = "resume",
        metadata: dict | None = None,
    ):
        self.content = content
        self.section = section
        self.chunk_index = chunk_index
        self.doc_type = doc_type
        self.metadata = metadata or {}
        self.contextualized = content  # will be overwritten by _enrich_with_context

    @property
    def page_content(self) -> str:
        """LangChain-compatible attribute for retriever interop."""
        return self.contextualized

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "contextualized": self.contextualized,
            "section": self.section,
            "chunk_index": self.chunk_index,
            "doc_type": self.doc_type,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# 1. Section-Aware Chunking
# ---------------------------------------------------------------------------

def chunk_document(
    text: str,
    doc_type: str = "resume",
    chunk_size: int = SECTION_CHUNK_LIMIT,
    overlap: int = CHUNK_OVERLAP_CHARS,
) -> list[RecruitmentChunk]:
    """
    Split a document into RecruitmentChunks.

    For resumes: detects section boundaries and tags each chunk with the
    section it came from (skills, experience, education, projects, etc.).
    For other doc types: falls back to sliding-window character chunking.
    """
    if not text or not text.strip():
        return []

    if doc_type in ("resume",):
        return _section_aware_chunk(text, doc_type, chunk_size, overlap)
    return _sliding_window_chunk(text, doc_type, chunk_size, overlap)


def _detect_section(line: str) -> str | None:
    """Return the canonical section name if `line` is a section heading, else None."""
    normalized = re.sub(r"\s+", " ", line).strip().lower().strip(":|-– ")
    if len(normalized) > 50 or len(normalized) < 2:
        return None
    for section_name, aliases in RESUME_SECTION_ALIASES.items():
        if any(alias in normalized for alias in aliases):
            return section_name
    return None


def _section_aware_chunk(
    text: str,
    doc_type: str,
    chunk_size: int,
    overlap: int,
) -> list[RecruitmentChunk]:
    """Split resume text into section-tagged chunks."""
    # Group lines by section
    sections: dict[str, list[str]] = {}
    section_order: list[str] = []
    current_section = "general"

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        detected = _detect_section(line)
        if detected:
            current_section = detected
            if detected not in sections:
                sections[detected] = []
                section_order.append(detected)
        else:
            if current_section not in sections:
                sections[current_section] = []
                if current_section not in section_order:
                    section_order.append(current_section)
            sections[current_section].append(line)

    chunks: list[RecruitmentChunk] = []
    global_idx = 0

    for section in section_order:
        lines = sections.get(section, [])
        if not lines:
            continue
        # Concatenate section lines into one block, then window-split
        block = "\n".join(lines)
        sub_chunks = _split_into_windows(block, chunk_size, overlap)
        for sub in sub_chunks:
            if sub.strip():
                chunks.append(
                    RecruitmentChunk(
                        content=sub,
                        section=section,
                        chunk_index=global_idx,
                        doc_type=doc_type,
                    )
                )
                global_idx += 1

    return chunks or [RecruitmentChunk(content=text[:chunk_size], doc_type=doc_type)]


def _sliding_window_chunk(
    text: str,
    doc_type: str,
    chunk_size: int,
    overlap: int,
) -> list[RecruitmentChunk]:
    """Generic sliding-window chunking for non-resume documents."""
    raw_chunks = _split_into_windows(text, chunk_size, overlap)
    return [
        RecruitmentChunk(content=c, section="general", chunk_index=i, doc_type=doc_type)
        for i, c in enumerate(raw_chunks)
        if c.strip()
    ]


def _split_into_windows(text: str, size: int, overlap: int) -> list[str]:
    """Character-level sliding window split."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
        if start >= len(text):
            break
    return chunks


# ---------------------------------------------------------------------------
# 2. Contextual Enrichment (Anthropic-style)
# ---------------------------------------------------------------------------

def enrich_chunks_with_context(
    chunks: list[RecruitmentChunk],
    doc_summary: str = "",
) -> list[RecruitmentChunk]:
    """
    Prepend a 1-2 sentence context stub to each chunk before embedding.
    This dramatically improves retrieval (Anthropic contextual retrieval, 2024).
    """
    doc_type_label = {
        "resume": "candidate resume",
        "jd": "job description",
        "policy": "company hiring policy document",
        "rubric": "interview evaluation rubric",
        "history": "previous hiring records",
    }

    for chunk in chunks:
        label = doc_type_label.get(chunk.doc_type, chunk.doc_type)
        section_hint = (
            f" This excerpt is from the '{chunk.section}' section."
            if chunk.section and chunk.section != "general"
            else ""
        )
        summary_hint = f" Document context: {doc_summary[:200]}." if doc_summary else ""
        prefix = (
            f"[Source: {label}{section_hint}{summary_hint}]\n"
        )
        chunk.contextualized = prefix + chunk.content

    return chunks


# ---------------------------------------------------------------------------
# 3. Embedding — SentenceTransformers (local) or Gemini (fallback)
# ---------------------------------------------------------------------------

def _get_sentence_transformer():
    """Load SentenceTransformer model lazily. Returns None if not installed."""
    try:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        return SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)
    except ImportError:
        return None


def embed_texts(texts: list[str], model=None) -> list[list[float]] | None:
    """
    Embed a list of texts using SentenceTransformer.
    Returns None if SentenceTransformers is not available.
    """
    if not texts:
        return []
    st_model = model or _get_sentence_transformer()
    if st_model is None:
        return None
    try:
        embeddings = st_model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return embeddings.tolist()
    except Exception as exc:
        print(f"[rag_pipeline] Embedding failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# 4. BM25 Sparse Retrieval
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer for BM25."""
    return re.findall(r"[a-zA-Z0-9#+.]{2,}", text.lower())


def build_bm25_index(chunks: list[RecruitmentChunk]):
    """Build a BM25 index from chunks. Returns (bm25_obj, chunks) or (None, chunks)."""
    try:
        from rank_bm25 import BM25Okapi  # noqa: PLC0415
        tokenized = [_tokenize(c.contextualized) for c in chunks]
        return BM25Okapi(tokenized), chunks
    except ImportError:
        return None, chunks


def bm25_retrieve(
    query: str,
    bm25_obj,
    chunks: list[RecruitmentChunk],
    top_k: int = DEFAULT_RETRIEVAL_TOP_K,
) -> list[tuple[int, float]]:
    """
    Returns list of (chunk_index, score) sorted descending by BM25 score.
    """
    if bm25_obj is None:
        return []
    tokens = _tokenize(query)
    scores = bm25_obj.get_scores(tokens)
    indexed = [(i, float(s)) for i, s in enumerate(scores)]
    indexed.sort(key=lambda x: x[1], reverse=True)
    return indexed[:top_k]


# ---------------------------------------------------------------------------
# 5. FAISS Dense Retrieval
# ---------------------------------------------------------------------------

def build_faiss_index(chunks: list[RecruitmentChunk], st_model=None):
    """
    Build an in-memory FAISS index from chunk embeddings.
    Returns (index, embeddings_array, model) or (None, None, None).
    """
    try:
        import numpy as np  # noqa: PLC0415
        import faiss  # noqa: PLC0415

        model = st_model or _get_sentence_transformer()
        if model is None:
            return None, None, None

        texts = [c.contextualized for c in chunks]
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)  # inner product = cosine sim on normalized vecs
        index.add(embeddings.astype(np.float32))
        return index, embeddings, model
    except (ImportError, Exception) as exc:
        if "faiss" not in str(exc) and "sentence" not in str(exc):
            print(f"[rag_pipeline] FAISS index build failed: {exc}")
        return None, None, None


def faiss_retrieve(
    query: str,
    faiss_index,
    st_model,
    top_k: int = DEFAULT_RETRIEVAL_TOP_K,
) -> list[tuple[int, float]]:
    """
    Returns list of (chunk_index, score) sorted descending by cosine similarity.
    """
    if faiss_index is None or st_model is None:
        return []
    try:
        import numpy as np  # noqa: PLC0415
        q_vec = st_model.encode([query], normalize_embeddings=True)
        scores, indices = faiss_index.search(q_vec.astype(np.float32), top_k)
        return [(int(idx), float(score)) for idx, score in zip(indices[0], scores[0]) if idx >= 0]
    except Exception as exc:
        print(f"[rag_pipeline] FAISS retrieval failed: {exc}")
        return []


# ---------------------------------------------------------------------------
# 6. Reciprocal Rank Fusion (RRF)
# ---------------------------------------------------------------------------

def reciprocal_rank_fusion(
    *ranked_lists: list[tuple[int, float]],
    k: int = RRF_K,
    top_n: int = DEFAULT_RETRIEVAL_TOP_K,
) -> list[tuple[int, float]]:
    """
    Merge multiple ranked lists using Reciprocal Rank Fusion.

    Each input is a list of (doc_index, score) pairs sorted descending by score.
    Returns a merged list of (doc_index, rrf_score) sorted descending.

    Formula: RRF(d) = Σ 1 / (k + rank_i(d))
    """
    rrf_scores: dict[int, float] = {}
    for ranked in ranked_lists:
        for rank, (doc_idx, _) in enumerate(ranked, start=1):
            rrf_scores[doc_idx] = rrf_scores.get(doc_idx, 0.0) + 1.0 / (k + rank)

    merged = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return merged[:top_n]


# ---------------------------------------------------------------------------
# 7. Cross-Encoder Reranking
# ---------------------------------------------------------------------------

def rerank_with_cross_encoder(
    query: str,
    candidates: list[tuple[int, float]],
    chunks: list[RecruitmentChunk],
    top_n: int = DEFAULT_RERANK_TOP_N,
) -> list[RecruitmentChunk]:
    """
    Rerank top candidates using a cross-encoder (ms-marco-MiniLM-L-6-v2).
    Falls back to returning the top-n candidates unsorted if model not available.
    """
    if not candidates:
        return []

    top_chunks = [chunks[idx] for idx, _ in candidates if idx < len(chunks)]

    try:
        from sentence_transformers import CrossEncoder  # noqa: PLC0415
        cross_enc = CrossEncoder(CROSS_ENCODER_MODEL)
        pairs = [(query, c.contextualized) for c in top_chunks]
        scores = cross_enc.predict(pairs).tolist()
        scored = sorted(zip(top_chunks, scores), key=lambda x: x[1], reverse=True)
        return [chunk for chunk, _ in scored[:top_n]]
    except (ImportError, Exception) as exc:
        if "CrossEncoder" not in str(exc) and "sentence" not in str(exc):
            print(f"[rag_pipeline] Cross-encoder reranking failed: {exc}")
        # Fallback: return in RRF order
        return top_chunks[:top_n]


# ---------------------------------------------------------------------------
# 8. Multi-Query Rewriting (optional, requires LLM)
# ---------------------------------------------------------------------------

def rewrite_query(query: str, llm) -> list[str]:
    """
    Generate 3 alternative phrasings of the query to expand BM25+dense recall.
    Returns [original_query] if LLM is unavailable or fails.
    """
    if llm is None:
        return [query]
    try:
        prompt = (
            "Generate 3 alternative phrasings of the following search query "
            "for a resume/job-description matching system. "
            "Return ONLY a JSON list of 3 strings, nothing else.\n\n"
            f"Original query: {query}"
        )
        response = llm.invoke(prompt).content
        import json  # noqa: PLC0415
        cleaned = re.sub(r"```(?:json)?|```", "", response).strip()
        variants = json.loads(cleaned)
        if isinstance(variants, list) and variants:
            return [query] + [str(v) for v in variants[:3]]
    except Exception:
        pass
    return [query]


# ---------------------------------------------------------------------------
# 9. HybridRetriever — unified interface
# ---------------------------------------------------------------------------

class HybridRetriever:
    """
    Drop-in retriever combining BM25 + FAISS with RRF + cross-encoder reranking.

    Usage:
        retriever = HybridRetriever.from_text(resume_text, doc_type="resume")
        docs = retriever.get_relevant_documents("Python machine learning experience")
        # docs is a list of RecruitmentChunk objects (with .page_content attribute)
    """

    def __init__(
        self,
        chunks: list[RecruitmentChunk],
        bm25_obj=None,
        faiss_index=None,
        st_model=None,
        top_k: int = DEFAULT_RETRIEVAL_TOP_K,
        rerank_top_n: int = DEFAULT_RERANK_TOP_N,
    ):
        self.chunks = chunks
        self._bm25 = bm25_obj
        self._faiss = faiss_index
        self._model = st_model
        self.top_k = top_k
        self.rerank_top_n = rerank_top_n

    @classmethod
    def from_text(
        cls,
        text: str,
        doc_type: str = "resume",
        doc_summary: str = "",
        top_k: int = DEFAULT_RETRIEVAL_TOP_K,
        rerank_top_n: int = DEFAULT_RERANK_TOP_N,
    ) -> "HybridRetriever":
        """Build a HybridRetriever from raw document text."""
        chunks = chunk_document(text, doc_type)
        chunks = enrich_chunks_with_context(chunks, doc_summary)

        # Try to build SentenceTransformer model once (shared for BM25 tokenizer + FAISS)
        st_model = _get_sentence_transformer()

        bm25_obj, _ = build_bm25_index(chunks)
        faiss_index, _, _ = build_faiss_index(chunks, st_model)

        return cls(
            chunks=chunks,
            bm25_obj=bm25_obj,
            faiss_index=faiss_index,
            st_model=st_model,
            top_k=top_k,
            rerank_top_n=rerank_top_n,
        )

    def get_relevant_documents(
        self,
        query: str,
        llm=None,
    ) -> list[RecruitmentChunk]:
        """
        Main retrieval entry point.
        Returns top rerank_top_n chunks most relevant to the query.
        """
        if not self.chunks:
            return []

        # Optional: multi-query expansion
        queries = rewrite_query(query, llm) if llm else [query]

        # Gather BM25 and FAISS results for each query variant
        all_bm25: list[tuple[int, float]] = []
        all_faiss: list[tuple[int, float]] = []

        for q in queries:
            all_bm25.extend(bm25_retrieve(q, self._bm25, self.chunks, self.top_k))
            all_faiss.extend(faiss_retrieve(q, self._faiss, self._model, self.top_k))

        # De-duplicate by keeping best score per doc
        all_bm25 = _dedup_scores(all_bm25)
        all_faiss = _dedup_scores(all_faiss)

        # If both are empty fall back to first N chunks
        if not all_bm25 and not all_faiss:
            return self.chunks[:self.rerank_top_n]

        # RRF fusion
        fused = reciprocal_rank_fusion(all_bm25, all_faiss, top_n=self.top_k)

        # Cross-encoder reranking
        return rerank_with_cross_encoder(query, fused, self.chunks, self.rerank_top_n)

    def get_context_string(self, query: str, llm=None) -> str:
        """Convenience: retrieve and format as a single context string for an LLM prompt."""
        docs = self.get_relevant_documents(query, llm)
        return "\n\n---\n\n".join(d.page_content for d in docs)


def _dedup_scores(scored: list[tuple[int, float]]) -> list[tuple[int, float]]:
    """Keep the highest score per doc index."""
    best: dict[int, float] = {}
    for idx, score in scored:
        if idx not in best or score > best[idx]:
            best[idx] = score
    return sorted(best.items(), key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# 10. Convenience helper for agents.py
# ---------------------------------------------------------------------------

def build_hybrid_retriever(
    text: str,
    doc_type: str = "resume",
    doc_summary: str = "",
) -> HybridRetriever:
    """
    Build and return a HybridRetriever for the given text.
    This is the primary entry point used by RecruitmentAgent.
    """
    return HybridRetriever.from_text(text, doc_type, doc_summary)


def get_relevant_context(
    query: str,
    text: str,
    doc_type: str = "resume",
    doc_summary: str = "",
    llm=None,
) -> str:
    """
    One-shot helper: build retriever + retrieve + format as string.
    Useful for quick integration without caching a retriever object.
    """
    retriever = build_hybrid_retriever(text, doc_type, doc_summary)
    return retriever.get_context_string(query, llm)
