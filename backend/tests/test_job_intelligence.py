import pytest

from app.agent import JobIntelligenceAgent, _find_review_flags, _normalise_brief
from app.config import Settings
from app.schemas import JobRequirementInput


@pytest.fixture
def agent():
    return JobIntelligenceAgent(
        Settings(
            llm_enabled=False,
            frontend_origins=["http://localhost:3000"],
        )
    )


@pytest.mark.asyncio
async def test_generates_draft_and_rubric_weights_total_100(agent):
    brief = JobRequirementInput(
        company_name="Example Labs",
        job_title="Machine Learning Engineer",
        location="Bengaluru",
        workplace_type="hybrid",
        headcount=2,
        employment_type="full_time",
        seniority="Mid-level",
        requirements="Python, PyTorch, SQL, model deployment",
    )
    result = await agent.draft(brief)

    assert result.status == "draft_ready"
    assert result.job_description_markdown
    assert "Machine Learning Engineer" in result.job_description_markdown
    assert result.rubric is not None
    assert sum(item.weight_percent for item in result.rubric.criteria) == 100
    assert result.generation_mode == "template_fallback"
    assert result.requires_company_approval is True


@pytest.mark.asyncio
async def test_missing_critical_requirements_requests_clarification(agent):
    brief = JobRequirementInput(job_title="Software Engineer")
    result = await agent.draft(brief)

    assert result.status == "needs_clarification"
    assert result.job_description_markdown is None
    assert result.clarification_questions
    assert result.generation_mode == "not_generated"


def test_skill_text_is_split_and_deduplicated():
    brief = JobRequirementInput(
        job_title="Backend Engineer",
        requirements="Python, SQL\nPython; Docker",
    )
    normalized = _normalise_brief(brief)
    assert normalized.required_skills == ["Python", "SQL", "Docker"]


def test_sensitive_criteria_are_flagged_for_human_review():
    brief = JobRequirementInput(
        job_title="Sales Executive",
        requirements="Female only, excellent communication",
    )
    flags = _find_review_flags(brief)
    assert flags
    assert flags[0].category == "Potentially sensitive selection criterion"


@pytest.mark.asyncio
async def test_missing_location_is_non_blocking(agent):
    brief = JobRequirementInput(
        job_title="Data Analyst",
        requirements="SQL, Power BI, Excel",
    )
    result = await agent.draft(brief)

    assert result.status == "draft_ready"
    assert any("location" in question.lower() for question in result.clarification_questions)
