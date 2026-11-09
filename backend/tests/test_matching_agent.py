from app.candidate_intelligence.schemas import (
    CandidateProfile, EvidenceItem, ExtractedSkill, PrivacyMetadata, ReviewFlag,
)
from app.matching.engine import estimate_experience_months, match_candidate_batch
from app.matching.schemas import CandidateMatchBatchRequest, JobMatchContext
from app.schemas import EvaluationRubric, RubricCriterion


def _profile(
    candidate_id: str,
    skills: list[str],
    evidence_text: list[tuple[str, str]],
    experience_dates: str | None = "Jan 2022 - Dec 2024",
    name: str = "Candidate Example",
) -> CandidateProfile:
    evidence = [
        EvidenceItem(
            evidence_id=f"EV-{index:04d}",
            field=field,
            quote=quote,
            source_file=f"{candidate_id}.txt",
            page_number=1,
        )
        for index, (field, quote) in enumerate(evidence_text, start=1)
    ]
    skill_ids = [
        item.evidence_id for item in evidence if item.field == "skills"
    ]
    experience_ids = [
        item.evidence_id for item in evidence if item.field == "work_experience"
    ]
    return CandidateProfile(
        candidate_id=candidate_id,
        source_file=f"{candidate_id}.txt",
        full_name=name,
        email=f"{candidate_id.lower()}@example.com",
        skills=[
            ExtractedSkill(
                name=skill,
                confidence=0.9,
                evidence_ids=skill_ids[:1] if skill_ids else [],
            )
            for skill in skills
        ],
        work_experience=[
            {
                "raw_entry": "Software Engineer, Example Co",
                "date_range": experience_dates,
                "evidence_ids": experience_ids[:1],
            }
        ] if experience_dates else [],
        education=[],
        evidence=evidence,
        field_confidence={"skills": 0.9 if skills else 0, "education": 0},
        extraction_status="parsed",
        review_flags=[],
        nlp_engine="regex-rules",
        privacy=PrivacyMetadata(
            redaction_applied=False,
            redacted_entities=[],
            redaction_engine="regex-fallback",
            redacted_resume_text="Candidate resume content [EMAIL_ADDRESS]",
        ),
    )


def _request(profiles: list[CandidateProfile]) -> CandidateMatchBatchRequest:
    return CandidateMatchBatchRequest(
        job=JobMatchContext(
            job_id="JOB-ML-001",
            job_title="Machine Learning Engineer",
            approved_for_matching=True,
            required_skills=["Python", "PyTorch", "SQL"],
            preferred_skills=["Docker"],
            responsibilities=["Build machine learning models and deploy APIs"],
            rubric=EvaluationRubric(
                criteria=[
                    RubricCriterion(
                        criterion="Evidence of required job-related skills",
                        weight_percent=60,
                        evidence_to_look_for=["Python", "PyTorch", "SQL"],
                    ),
                    RubricCriterion(
                        criterion="Relevant project evidence",
                        weight_percent=40,
                        evidence_to_look_for=["machine learning models", "deploy APIs"],
                    ),
                ]
            ),
        ),
        candidates=profiles,
    )


def test_matching_ranks_profiles_using_evidence_and_shows_coverage():
    strong = _profile(
        "CAND-STRONG",
        ["Python", "PyTorch", "SQL", "Docker"],
        [
            ("skills", "Python PyTorch SQL Docker"),
            ("projects", "Built machine learning models and deployed inference APIs."),
        ],
    )
    partial = _profile(
        "CAND-PARTIAL",
        ["Python"],
        [
            ("skills", "Python"),
            ("projects", "Built a basic web dashboard."),
        ],
    )
    result = match_candidate_batch(_request([partial, strong]))

    assert result.processed_candidates == 2
    assert result.results[0].candidate_id == "CAND-STRONG"
    assert result.results[0].evidence_alignment_index is not None
    assert result.results[0].evidence_coverage_percent == 100
    assert result.results[0].recruiter_decision == "pending_review"
    assert result.results[1].required_skill_matches[1].status == "not_detected"
    assert result.results[1].rank == 2


def test_experience_months_unions_overlapping_date_ranges():
    profile = _profile(
        "CAND-DATES",
        ["Python"],
        [("skills", "Python"), ("work_experience", "Engineering work evidence")],
        experience_dates="Jan 2022 - Dec 2024",
    )
    assert estimate_experience_months(profile) == 36


def test_identifying_information_does_not_change_match_index():
    first = _profile(
        "CAND-ONE",
        ["Python", "PyTorch", "SQL"],
        [("skills", "Python PyTorch SQL"), ("projects", "Machine learning models deploy APIs")],
        name="Alex Candidate",
    )
    second = _profile(
        "CAND-TWO",
        ["Python", "PyTorch", "SQL"],
        [("skills", "Python PyTorch SQL"), ("projects", "Machine learning models deploy APIs")],
        name="Sam Candidate",
    )
    results = match_candidate_batch(_request([first, second])).results
    assert results[0].evidence_alignment_index == results[1].evidence_alignment_index


def test_unparseable_experience_is_not_treated_as_zero():
    profile = _profile(
        "CAND-UNKNOWN",
        ["Python", "PyTorch", "SQL"],
        [("skills", "Python PyTorch SQL"), ("projects", "Machine learning models deploy APIs")],
        experience_dates=None,
    )
    request = _request([profile])
    request.job.minimum_experience_months = 24
    result = match_candidate_batch(request).results[0]
    assert any("could not be calculated" in item.lower() for item in result.not_detected_or_unverified)


def test_matching_requires_an_approved_job_rubric():
    values = _request([_profile("CAND-ONE", ["Python"], [("skills", "Python")])]).model_dump()
    values["job"]["approved_for_matching"] = False
    try:
        CandidateMatchBatchRequest.model_validate(values)
        raise AssertionError("Expected approved job validation to fail.")
    except ValueError as exc:
        assert "approved" in str(exc).lower()
