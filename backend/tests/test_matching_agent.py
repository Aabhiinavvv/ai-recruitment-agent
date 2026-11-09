from app.candidate_intelligence.schemas import (
    EvidenceItem,
    ExtractedSkill,
    ExperienceEntry,
    PrivacyMetadata,
)
from app.matching.engine import estimate_experience_months, match_candidate_batch
from app.matching.retrieval import retrieve_evidence
from app.matching.schemas import (
    CandidateMatchBatchRequest,
    CandidateMatchProfile,
    JobMatchContext,
)
from app.schemas import EvaluationRubric, RubricCriterion


def _profile(
    candidate_id: str,
    skills: list[str],
    evidence_text: list[tuple[str, str]],
    experience_dates: str | None = "Jan 2022 - Dec 2024",
) -> CandidateMatchProfile:
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
    skill_ids = [item.evidence_id for item in evidence if item.field == "skills"]
    experience_ids = [
        item.evidence_id for item in evidence if item.field == "work_experience"
    ]
    return CandidateMatchProfile(
        candidate_id=candidate_id,
        source_file=f"{candidate_id}.txt",
        skills=[
            ExtractedSkill(
                name=skill,
                confidence=0.9,
                evidence_ids=skill_ids[:1] if skill_ids else [],
            )
            for skill in skills
        ],
        work_experience=[
            ExperienceEntry(
                raw_entry="Software Engineer, Example Co",
                date_range=experience_dates,
                evidence_ids=experience_ids[:1],
            )
        ] if experience_dates else [],
        education=[],
        projects=[],
        evidence=evidence,
        field_confidence={"skills": 0.9 if skills else 0, "education": 0},
        extraction_status="parsed",
        review_flags=[],
    )


def _request(profiles: list[CandidateMatchProfile]) -> CandidateMatchBatchRequest:
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
        [
            ("skills", "Python"),
            ("work_experience", "First engineering role evidence"),
            ("work_experience", "Second engineering role evidence"),
        ],
        experience_dates=None,
    )
    profile.work_experience = [
        ExperienceEntry(
            raw_entry="First role",
            date_range="Jan 2022 - Dec 2023",
            evidence_ids=["EV-0002"],
        ),
        ExperienceEntry(
            raw_entry="Second role",
            date_range="Jan 2023 - Dec 2024",
            evidence_ids=["EV-0003"],
        ),
    ]
    assert estimate_experience_months(profile) == 36


def test_unparseable_experience_is_not_treated_as_zero():
    profile = _profile(
        "CAND-UNKNOWN",
        ["Python", "PyTorch", "SQL"],
        [
            ("skills", "Python PyTorch SQL"),
            ("projects", "Machine learning models deploy APIs"),
        ],
        experience_dates=None,
    )
    request = _request([profile])
    request.job.minimum_experience_months = 24
    result = match_candidate_batch(request).results[0]
    assert any("could not be calculated" in item.lower() for item in result.not_detected_or_unverified)


def test_matching_input_contract_excludes_direct_personal_identifiers():
    fields = set(CandidateMatchProfile.model_fields)
    assert "full_name" not in fields
    assert "email" not in fields
    assert "phone_numbers" not in fields
    assert "location" not in fields
    assert "profile_links" not in fields


def test_matching_retrieves_a_single_evidence_chunk_even_when_bm25_idf_is_negative():
    matches, method, coverage = retrieve_evidence(
        "machine learning deployment",
        [{"evidence_id": "EV-0001", "field": "projects", "text": "Machine learning APIs"}],
        top_k=5,
    )
    assert matches
    assert matches[0]["evidence_id"] == "EV-0001"
    assert method == "bm25"
    assert coverage > 0


def test_matching_requires_an_approved_job_rubric():
    values = _request([_profile("CAND-ONE", ["Python"], [("skills", "Python")])]).model_dump()
    values["job"]["approved_for_matching"] = False
    try:
        CandidateMatchBatchRequest.model_validate(values)
        raise AssertionError("Expected approved job validation to fail.")
    except ValueError as exc:
        assert "approved" in str(exc).lower()
