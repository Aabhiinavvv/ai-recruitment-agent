from __future__ import annotations

import json
import logging
import re
from uuid import uuid4

import httpx

from app.config import Settings, get_settings
from app.interview.schemas import (
    InterviewAnswerEvaluation,
    InterviewAnswerEvaluationResponse,
    InterviewAnswerRequest,
    InterviewPlanRequest,
    InterviewPlanResponse,
    InterviewQuestion,
    InterviewQuestionSet,
)

logger = logging.getLogger(__name__)

PROTECTED_CONTEXT = re.compile(
    r"\b(?:age|aged|young|old|gender|sex|male|female|race|racial|ethnic\w*|caste|"
    r"religion|marital|married|pregnan\w*|disabilit\w*|medical|health|"
    r"ulcerative|diagnos\w*|nationality|citizenship|family status|"
    r"political|union member|photo|appearance)\b",
    re.IGNORECASE,
)

QUESTION_SYSTEM_PROMPT = """You are an interview-planning assistant for a recruiter-supervised hiring platform.
Create a structured set of fair, job-related interview questions using only the supplied job context and rubric.
Return only JSON matching the supplied schema.

Rules:
- Ask about observable job skills, work samples, decisions, problem-solving, collaboration relevant to the role, and evidence.
- Never ask for age, sex, gender, race, caste, religion, nationality, disability, health, family or marital status, or other protected/personal information.
- Do not infer anything about the candidate. You are given no resume or candidate biography.
- Avoid trivia, trick questions, leading questions and unsupported assumptions.
- Include a concise rationale, competency and up to three useful follow-up probes for every question.
- Produce 4 to 8 varied questions appropriate to the interview round.
- Questions must be answerable without disclosing confidential information from a current or former employer.
- Do not score or recommend a hiring decision."""

EVALUATION_SYSTEM_PROMPT = """You are an evidence-focused interview answer review assistant.
Evaluate only the answer text against the supplied job-related competency and evidence expectations.
Return only JSON matching the supplied schema.

Rules:
- Score 1 to 5 using this scale: 1 = no relevant evidence; 2 = limited or vague evidence; 3 = adequate relevant evidence; 4 = strong specific evidence; 5 = exceptionally clear, specific and relevant evidence.
- A short answer is not automatically a poor answer. Do not reward verbosity, accent, grammar style, confidence, charisma or personality.
- Do not infer protected characteristics, health, disability, age, gender, race, religion, caste, nationality, family status or socioeconomic background.
- Do not judge emotion, eye contact, facial expression, voice, appearance, accent or non-verbal behaviour.
- Do not invent evidence. Any quoted excerpt must appear verbatim in the answer.
- Identify missing evidence fairly and suggest one job-related follow-up question.
- Do not infer honesty, culture fit or future performance.
- This is advisory analysis, not a hiring decision. Always keep human review mandatory."""


def _clean_job_context(value: str) -> tuple[str, list[str]]:
    """Remove complete sentences containing protected/personal selection context."""
    warnings: list[str] = []
    kept: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", value.strip()):
        if not sentence:
            continue
        if PROTECTED_CONTEXT.search(sentence):
            warnings.append(
                "A sentence was omitted from the model context because it referenced protected or personal information."
            )
            continue
        kept.append(sentence)
    return " ".join(kept), warnings


def _fallback_questions(request: InterviewPlanRequest) -> list[InterviewQuestion]:
    criteria = request.rubric_criteria
    questions: list[InterviewQuestion] = []
    question_types = {
        "technical": "technical",
        "behavioral": "behavioral",
        "role_specific": "role_specific",
        "hr": "behavioral",
    }
    base_type = question_types[request.interview_round]

    for index, criterion in enumerate(criteria[:6], start=1):
        evidence = criterion.evidence_to_look_for[:2]
        focus = ", ".join(evidence) if evidence else criterion.criterion
        questions.append(
            InterviewQuestion(
                question_id=f"Q{index}",
                question=(
                    f"Please describe a specific work, academic, or project example that demonstrates "
                    f"your experience with {criterion.criterion}. What was the situation, what actions "
                    f"did you personally take, and what was the observable result?"
                ),
                question_type=base_type,
                competency=criterion.criterion,
                rationale=f"Explores the approved rubric criterion: {criterion.criterion}.",
                follow_up_probes=[
                    f"What evidence or outcome supports your approach to {focus}?",
                    "What trade-off did you consider, and what would you change next time?",
                ],
            )
        )

    defaults = [
        (
            "Problem solving",
            "Tell me about a challenging problem relevant to this role. How did you break it down, evaluate options, and verify the result?",
        ),
        (
            "Practical application",
            "Walk me through how you would approach a realistic task from this role, including the first steps and how you would validate the outcome.",
        ),
        (
            "Collaboration",
            "Describe a work or project situation where you had to coordinate with others to deliver an outcome. What did you contribute and how was the work coordinated?",
        ),
        (
            "Learning and reflection",
            "Describe a relevant skill or tool you had to learn recently. How did you learn it and how did you check that you could use it effectively?",
        ),
        (
            "Role priorities",
            f"What would you clarify first before starting a new assignment as a {request.job_title}, and why?",
        ),
        (
            "Quality and trade-offs",
            "Describe how you balance delivery speed with correctness, reliability, or quality in a task relevant to this role.",
        ),
    ]
    for title, question in defaults:
        if len(questions) >= 6:
            break
        if any(item.competency.casefold() == title.casefold() for item in questions):
            continue
        questions.append(
            InterviewQuestion(
                question_id=f"Q{len(questions) + 1}",
                question=question,
                question_type=base_type,
                competency=title,
                rationale=f"Provides a consistent, job-related prompt for {title.lower()}.",
                follow_up_probes=[
                    "What was your individual contribution?",
                    "What observable result or evidence can you share?",
                ],
            )
        )
    return questions[:6]


async def _ollama_json(
    *,
    settings: Settings,
    system_prompt: str,
    user_payload: dict,
    json_schema: dict,
) -> str:
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": json_schema,
        "options": {"temperature": 0.15},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False),
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
    return content


async def create_interview_plan(
    request: InterviewPlanRequest,
    settings: Settings | None = None,
) -> InterviewPlanResponse:
    settings = settings or get_settings()
    safe_context, warnings = _clean_job_context(request.job_context)
    generation_mode = "deterministic_fallback"
    model_name: str | None = None
    questions: list[InterviewQuestion]

    if settings.llm_enabled:
        try:
            raw = await _ollama_json(
                settings=settings,
                system_prompt=QUESTION_SYSTEM_PROMPT,
                user_payload={
                    "job_title": request.job_title,
                    "interview_round": request.interview_round,
                    "approved_job_context": safe_context,
                    "approved_rubric": [
                        item.model_dump() for item in request.rubric_criteria
                    ],
                },
                json_schema=InterviewQuestionSet.model_json_schema(),
            )
            parsed = InterviewQuestionSet.model_validate_json(raw)
            questions = parsed.questions
            generation_mode = "ollama"
            model_name = settings.ollama_model
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning("Interview question generation fell back: %s", exc)
            warnings.append(
                "The local model was unavailable or returned invalid output. A deterministic question set was generated instead."
            )
            questions = _fallback_questions(request)
    else:
        questions = _fallback_questions(request)

    if generation_mode == "ollama":
        permitted_questions = [
            item for item in questions
            if not PROTECTED_CONTEXT.search(
                item.question + " " + " ".join(item.follow_up_probes)
            )
        ]
        if len(permitted_questions) < 4:
            warnings.append(
                "Model-generated questions included protected or personal topics and were replaced with the deterministic question set."
            )
            questions = _fallback_questions(request)
        else:
            questions = permitted_questions[:8]

    if not questions:
        questions = _fallback_questions(request)
    return InterviewPlanResponse(
        session_id="INT-" + uuid4().hex[:12].upper(),
        candidate_id=request.candidate_id,
        job_title=request.job_title,
        interview_round=request.interview_round,
        questions=questions,
        generation_mode=generation_mode,
        model_name=model_name,
        warnings=warnings,
    )


async def evaluate_interview_answer(
    request: InterviewAnswerRequest,
    settings: Settings | None = None,
) -> InterviewAnswerEvaluationResponse:
    settings = settings or get_settings()
    evaluation_mode = "manual_review_fallback"
    model_name: str | None = None
    safe_answer, answer_warnings = _clean_job_context(request.answer)

    try:
        if not settings.llm_enabled:
            raise RuntimeError("Local model evaluation is disabled.")
        if not safe_answer:
            raise RuntimeError("No job-related answer text remained after protected-context filtering.")
        raw = await _ollama_json(
            settings=settings,
            system_prompt=EVALUATION_SYSTEM_PROMPT,
            user_payload={
                "job_title": request.job_title,
                "interview_round": request.interview_round,
                "question": request.question,
                "competency": request.competency,
                "evidence_to_look_for": request.evidence_to_look_for,
                "candidate_answer": safe_answer,
            },
            json_schema=InterviewAnswerEvaluation.model_json_schema(),
        )
        evaluation = InterviewAnswerEvaluation.model_validate_json(raw)
        # Guard against fabricated evidence snippets: only verbatim answer excerpts pass.
        verified_quotes = [
            quote for quote in evaluation.evidence_quotes
            if quote and quote in safe_answer
        ][:3]
        if len(verified_quotes) != len(evaluation.evidence_quotes):
            evaluation.review_flags.append(
                "One or more model-provided evidence excerpts were not found verbatim in the answer and were removed."
            )
        evaluation.evidence_quotes = verified_quotes
        evaluation.review_flags.extend(answer_warnings)
        evaluation_mode = "ollama"
        model_name = settings.ollama_model
        score: int | None = evaluation.score
        assessment = evaluation.assessment
        strengths = evaluation.strengths
        gaps = evaluation.gaps
        follow_up = evaluation.follow_up_question
        review_flags = evaluation.review_flags
    except (httpx.HTTPError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("Interview answer evaluation requires manual review: %s", exc)
        score = None
        assessment = (
            "Automated evaluation was unavailable. Please assess the answer against the approved "
            "rubric and record evidence manually. No score has been generated."
        )
        verified_quotes = []
        strengths = []
        gaps = [
            "Human reviewer should identify which expected competency evidence is present.",
            "Human reviewer should note any material evidence gaps without inferring traits.",
        ]
        follow_up = (
            "Could you share a specific example or observable result that demonstrates "
            f"{request.competency}?"
        )
        review_flags = [
            "Manual recruiter assessment required; no automated score was produced.",
            *answer_warnings,
        ]

    return InterviewAnswerEvaluationResponse(
        session_id=request.session_id,
        candidate_id=request.candidate_id,
        question_id=request.question_id,
        competency=request.competency,
        score=score,
        assessment=assessment,
        evidence_quotes=verified_quotes,
        strengths=strengths,
        gaps=gaps,
        follow_up_question=follow_up,
        review_flags=review_flags,
        evaluation_mode=evaluation_mode,
        model_name=model_name,
    )
