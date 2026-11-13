from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


InterviewRound = Literal["technical", "behavioral", "role_specific", "hr"]
RecruiterDecision = Literal["advance", "hold", "reject"]
QuestionType = Literal["technical", "behavioral", "situational", "role_specific"]
GenerationMode = Literal["ollama", "deterministic_fallback"]
EvaluationMode = Literal["ollama", "manual_review_fallback"]


class InterviewRubricCriterion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    criterion: str = Field(min_length=2, max_length=160)
    weight_percent: int = Field(ge=0, le=100)
    evidence_to_look_for: list[str] = Field(default_factory=list, max_length=8)


class InterviewPlanRequest(BaseModel):
    """PII-minimised inputs for a recruiter-authorised interview plan."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    candidate_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    interview_round: InterviewRound
    recruiter_approved: bool
    recruiter_decision: RecruiterDecision
    candidate_consent_confirmed: bool
    job_context: str = Field(default="", max_length=6000)
    rubric_criteria: list[InterviewRubricCriterion] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def validate_authorisation_and_context(self):
        if not self.recruiter_approved:
            raise ValueError("The job and interview rubric must be recruiter-approved.")
        if self.recruiter_decision != "advance":
            raise ValueError("Only candidates explicitly advanced by a recruiter can enter an interview.")
        if not self.candidate_consent_confirmed:
            raise ValueError("Candidate consent must be confirmed before processing interview information.")
        if not self.job_context.strip() and not self.rubric_criteria:
            raise ValueError("Provide an approved job context or evaluation rubric.")
        return self


class InterviewQuestion(BaseModel):
    question_id: str
    question: str = Field(min_length=10, max_length=1200)
    question_type: QuestionType
    competency: str = Field(min_length=2, max_length=160)
    rationale: str = Field(min_length=2, max_length=400)
    follow_up_probes: list[str] = Field(default_factory=list, max_length=3)


class InterviewQuestionSet(BaseModel):
    questions: list[InterviewQuestion] = Field(min_length=4, max_length=8)


class InterviewPlanResponse(BaseModel):
    session_id: str
    candidate_id: str
    job_title: str
    interview_round: InterviewRound
    questions: list[InterviewQuestion]
    generation_mode: GenerationMode
    model_name: str | None = None
    warnings: list[str] = Field(default_factory=list)
    status: Literal["prepared_for_recruiter_led_interview"] = "prepared_for_recruiter_led_interview"
    requires_human_review: Literal[True] = True
    audio_recording_enabled: Literal[False] = False
    video_recording_enabled: Literal[False] = False
    persistence_enabled: Literal[False] = False
    note: str = (
        "Question plan only. The recruiter conducts the interview. No audio/video is recorded "
        "and this prototype does not persist interview sessions."
    )


class InterviewAnswerRequest(BaseModel):
    """One text answer for job-related, consented recruiter review."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    session_id: str = Field(min_length=8, max_length=80)
    candidate_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    interview_round: InterviewRound
    question_id: str = Field(min_length=1, max_length=20)
    question: str = Field(min_length=10, max_length=1200)
    competency: str = Field(min_length=2, max_length=160)
    answer: str = Field(min_length=1, max_length=12000)
    evidence_to_look_for: list[str] = Field(default_factory=list, max_length=8)
    transcript_processing_consent_confirmed: bool

    @model_validator(mode="after")
    def validate_consent(self):
        if not self.transcript_processing_consent_confirmed:
            raise ValueError("Candidate consent is required before evaluating an interview response.")
        return self


class InterviewAnswerEvaluation(BaseModel):
    score: int = Field(ge=1, le=5)
    assessment: str = Field(min_length=2, max_length=1200)
    evidence_quotes: list[str] = Field(default_factory=list, max_length=3)
    strengths: list[str] = Field(default_factory=list, max_length=5)
    gaps: list[str] = Field(default_factory=list, max_length=5)
    follow_up_question: str = Field(default="", max_length=600)
    review_flags: list[str] = Field(default_factory=list, max_length=5)


class InterviewAnswerEvaluationResponse(BaseModel):
    session_id: str
    candidate_id: str
    question_id: str
    competency: str
    score: int | None = Field(default=None, ge=1, le=5)
    assessment: str
    evidence_quotes: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    follow_up_question: str = ""
    review_flags: list[str] = Field(default_factory=list)
    evaluation_mode: EvaluationMode
    model_name: str | None = None
    decision_status: Literal["pending_human_review"] = "pending_human_review"
    requires_human_review: Literal[True] = True
    automated_pass_reject: Literal[False] = False
