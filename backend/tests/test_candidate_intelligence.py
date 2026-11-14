import io

import pytest
from fastapi import FastAPI, UploadFile
from fastapi.testclient import TestClient

from app.candidate_intelligence.extractors import (
    build_candidate_profile,
    extract_document,
)
from app.candidate_intelligence.router import router as candidate_intelligence_router
from app.candidate_intelligence.service import process_resume_batch
from app.candidate_intelligence.storage import list_candidate_profiles

SAMPLE = """Asha Sharma
Machine Learning Engineer | Pune
asha.sharma@example.com | +91 98765 43210

SUMMARY
Machine learning engineer with experience building Python and PyTorch models.

SKILLS
Python, PyTorch, SQL, FastAPI, Docker, scikit-learn

EXPERIENCE
ML Engineer, Example Labs | Jan 2023 - Present
Built an NLP classification model using PyTorch.

EDUCATION
B.Tech Computer Science, Example University | 2022

PROJECTS
Resume parser using Python and FastAPI
"""


@pytest.fixture(autouse=True)
def isolate_candidate_database(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "CANDIDATE_DATABASE_PATH", str(tmp_path / "candidate_profiles.sqlite3")
    )


def test_candidate_profile_has_evidence_and_privacy_redaction():
    pages = [SAMPLE]
    profile, warnings = build_candidate_profile(
        SAMPLE, pages, "asha_resume.txt", "CAND-TEST", "utf-8-text", []
    )
    assert profile.full_name == "Asha Sharma"
    assert profile.email == "asha.sharma@example.com"
    assert {skill.name for skill in profile.skills} >= {"python", "pytorch", "sql"}
    assert profile.evidence
    assert all(item.source_file == "asha_resume.txt" for item in profile.evidence)
    assert "[EMAIL_ADDRESS]" in profile.privacy.redacted_resume_text
    assert profile.privacy.redaction_applied is True


def test_plain_text_parser():
    text, pages, parser, warnings = extract_document(SAMPLE.encode(), "resume.txt")
    assert "Asha Sharma" in text
    assert pages == [text]
    assert parser == "utf-8-text"


def test_unsupported_type_is_rejected():
    with pytest.raises(ValueError, match="Unsupported file type"):
        extract_document(b"hello", "resume.jpg")


@pytest.mark.asyncio
async def test_batch_processes_multiple_files_and_rejects_duplicate_content():
    files = [
        UploadFile(filename="first.txt", file=io.BytesIO(SAMPLE.encode())),
        UploadFile(filename="duplicate.txt", file=io.BytesIO(SAMPLE.encode())),
        UploadFile(filename="bad.exe", file=io.BytesIO(b"not a resume")),
    ]
    result = await process_resume_batch(files, consent_confirmed=True)
    assert result.processed_count == 3
    assert result.succeeded_count == 1
    assert result.failed_count == 2
    assert result.results[0].candidate_profile is not None
    assert "Duplicate" in (result.results[1].error or "")


@pytest.mark.asyncio
async def test_batch_requires_consent():
    with pytest.raises(ValueError, match="consent"):
        await process_resume_batch(
            [UploadFile(filename="resume.txt", file=io.BytesIO(SAMPLE.encode()))],
            consent_confirmed=False,
        )


@pytest.mark.asyncio
async def test_batch_saves_profiles_and_reuses_identical_resume():
    first_upload = UploadFile(filename="asha_resume.txt", file=io.BytesIO(SAMPLE.encode()))
    first_result = await process_resume_batch([first_upload], consent_confirmed=True)
    saved_records = list_candidate_profiles()

    assert first_result.succeeded_count == 1
    assert len(saved_records) == 1
    assert saved_records[0][0].full_name == "Asha Sharma"
    assert saved_records[0][0].skills
    assert saved_records[0][0].evidence

    app = FastAPI()
    app.include_router(candidate_intelligence_router)
    response = TestClient(app).get("/api/v1/candidate-intelligence/resumes")
    assert response.status_code == 200
    assert response.json()[0]["candidate_profile"]["full_name"] == "Asha Sharma"

    repeated_upload = UploadFile(filename="asha_resume.txt", file=io.BytesIO(SAMPLE.encode()))
    repeated_result = await process_resume_batch([repeated_upload], consent_confirmed=True)

    assert repeated_result.succeeded_count == 1
    assert repeated_result.results[0].candidate_profile.candidate_id == saved_records[0][0].candidate_id
    assert len(list_candidate_profiles()) == 1
