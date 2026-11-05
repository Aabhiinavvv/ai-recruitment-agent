import json
import logging

import httpx

from app.config import Settings
from app.schemas import JobDraftContent, JobRequirementInput

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Job Intelligence Agent in a recruiter-supervised hiring platform.
Convert a company's hiring brief into a precise, inclusive, evidence-based job specification and evaluation rubric.

Rules:
1. Use only facts present in the brief. Never invent salary, benefits, company achievements, work arrangements, qualifications, years of experience, or responsibilities.
2. Separate mandatory requirements from preferred requirements. Never silently promote a preferred skill to mandatory.
3. Make criteria job-related, observable, and assessable from application evidence or structured interviews.
4. Do not use protected or sensitive personal characteristics as selection criteria, including age, sex, gender, religion, caste, race, marital status, disability, family status, or health status. Flag questionable criteria for human review.
5. Do not decide whether a candidate is qualified. This is a job specification, not a candidate decision.
6. Keep the draft concise, accessible, and free of unsupported claims.
7. The rubric must contain 2 to 8 criteria with integer weights totaling exactly 100.
8. Return only the structured JSON object matching the supplied schema."""


async def generate_with_ollama(
    brief: JobRequirementInput,
    settings: Settings,
) -> JobDraftContent:
    """Generate schema-constrained JSON with a locally hosted Ollama model."""
    if not settings.llm_enabled:
        raise RuntimeError("LLM generation is disabled.")

    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": JobDraftContent.model_json_schema(),
        "options": {"temperature": 0.15},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Create a job specification and evaluation rubric from this brief. "
                    "Follow the JSON schema exactly.\n\n"
                    + json.dumps(brief.model_dump(), ensure_ascii=False)
                ),
            },
        ],
    }
    timeout = httpx.Timeout(
        connect=2.0,
        read=settings.ollama_timeout_seconds,
        write=10.0,
        pool=2.0,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ollama_base_url.rstrip('/')}/api/chat",
            json=payload,
        )
        response.raise_for_status()

    content = response.json().get("message", {}).get("content", "")
    if not content:
        raise ValueError("Ollama returned an empty message.")
    return JobDraftContent.model_validate_json(content)
