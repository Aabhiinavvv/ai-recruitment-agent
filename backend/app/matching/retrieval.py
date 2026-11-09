from __future__ import annotations

import os
import re
from functools import lru_cache
from typing import Any

from rank_bm25 import BM25Okapi


STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
    "is", "it", "of", "on", "or", "the", "to", "with", "will", "must",
    "should", "candidate", "candidates", "evidence", "look", "looking",
    "demonstrate", "demonstrates", "relevant", "role", "work", "working",
    "example", "examples", "ability", "abilities", "strong", "good",
}


def tokenize(value: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", value.casefold())
    return [token for token in tokens if token not in STOP_WORDS and len(token) > 1]


@lru_cache(maxsize=1)
def _semantic_model():
    if os.getenv("MATCHING_SEMANTIC_ENABLED", "false").lower() != "true":
        return None
    from sentence_transformers import SentenceTransformer
    model_name = os.getenv("MATCHING_EMBEDDING_MODEL", "BAAI/bge-m3")
    return SentenceTransformer(model_name)


@lru_cache(maxsize=1)
def _reranker_model():
    if os.getenv("MATCHING_RERANKER_ENABLED", "false").lower() != "true":
        return None
    from sentence_transformers import CrossEncoder
    model_name = os.getenv("MATCHING_RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
    return CrossEncoder(model_name)


def retrieve_evidence(
    query: str,
    chunks: list[dict[str, Any]],
    top_k: int = 5,
) -> tuple[list[dict[str, Any]], str, float]:
    """Retrieve source evidence with BM25 and optional BGE semantic retrieval.

    Lexical coverage is reported separately from semantic ranking. A semantic match
    can surface a relevant excerpt, but it never proves a skill by itself.
    """
    query_tokens = tokenize(query)
    usable = [chunk for chunk in chunks if tokenize(chunk.get("text", ""))]
    if not query_tokens or not usable:
        return [], "bm25", 0.0

    corpus_tokens = [tokenize(chunk["text"]) for chunk in usable]
    bm25 = BM25Okapi(corpus_tokens)
    bm25_scores = bm25.get_scores(query_tokens)

    # BM25's IDF may be negative in tiny corpora (e.g. one resume chunk).
    # Use token overlap as a relevance floor rather than dropping every result.
    query_set = set(query_tokens)
    lexical_order = [
        index for index in sorted(
            range(len(usable)),
            key=lambda index: (float(bm25_scores[index]), -index),
            reverse=True,
        )
        if query_set.intersection(corpus_tokens[index])
    ]
    selected_indices = lexical_order[:top_k]
    retrieval_method = "bm25"

    try:
        model = _semantic_model()
    except Exception:
        model = None
    if model is not None:
        try:
            embeddings = model.encode(
                [query] + [chunk["text"] for chunk in usable],
                normalize_embeddings=True,
                convert_to_numpy=True,
            )
            similarities = embeddings[1:] @ embeddings[0]
            semantic_order = sorted(
                range(len(usable)),
                key=lambda index: (float(similarities[index]), -index),
                reverse=True,
            )
            # Reciprocal Rank Fusion merges lexical and semantic orders.
            rrf_scores: dict[int, float] = {}
            for rank, index in enumerate(lexical_order, start=1):
                rrf_scores[index] = rrf_scores.get(index, 0.0) + 1 / (60 + rank)
            for rank, index in enumerate(semantic_order[:top_k], start=1):
                rrf_scores[index] = rrf_scores.get(index, 0.0) + 1 / (60 + rank)
            selected_indices = [
                index for index, _ in sorted(
                    rrf_scores.items(), key=lambda item: item[1], reverse=True
                )
            ][:top_k]
            retrieval_method = "bm25+rrf+bge-m3"
        except Exception:
            retrieval_method = "bm25"

    selected = [usable[index] for index in selected_indices]
    try:
        reranker = _reranker_model()
    except Exception:
        reranker = None
    if reranker is not None and selected:
        try:
            pairs = [(query, item["text"]) for item in selected]
            scores = reranker.predict(pairs)
            selected = [
                item for _, item in sorted(
                    zip(scores, selected),
                    key=lambda pair: float(pair[0]),
                    reverse=True,
                )
            ]
            retrieval_method += "+bge-reranker"
        except Exception:
            pass

    observed_terms = {
        token for item in selected for token in tokenize(item.get("text", ""))
    }
    lexical_coverage = len(query_set & observed_terms) / len(query_set)
    return selected[:top_k], retrieval_method, lexical_coverage
