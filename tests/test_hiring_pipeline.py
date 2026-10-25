import unittest
import json
import sys
from datetime import date, timedelta
from types import ModuleType

from agents import RecruitmentAgent
from hiring_pipeline import (
    append_audit_event,
    build_candidate_profile_sources,
    build_workforce_graph,
    create_interview_invitation_draft,
    create_document_validation_plan,
    create_onboarding_plan,
    create_offer_letter_draft,
    create_rejection_message_draft,
    create_verification_plan,
    rank_candidates,
    summarize_hiring_funnel,
    record_final_hiring_decision,
    record_recruiter_decision,
    record_round_decision,
    update_verification_check,
    update_document_validation_check,
    update_onboarding_task,
)


class HiringPipelineTests(unittest.TestCase):
    def test_candidate_profile_sources_only_accept_https_and_do_not_fetch_links(self):
        sources = build_candidate_profile_sources(
            github_url="https://github.com/example/project",
            linkedin_url="https://www.linkedin.com/in/example",
            candidate_submitted_work="Built a volunteer scheduling tool.",
            university="Example University",
            referral="Candidate-reported: Alex",
        )

        self.assertEqual(
            [source["source_ref"] for source in sources],
            [
                "github",
                "linkedin",
                "candidate_submitted_work",
                "candidate_university",
                "candidate_referral",
            ],
        )
        self.assertIn("not accessed or verified", sources[0]["content"])
        with self.assertRaisesRegex(ValueError, "valid HTTPS URL"):
            build_candidate_profile_sources(github_url="javascript:alert(1)")

    def test_workforce_graph_links_company_role_skills_projects_affiliation_and_outcomes(self):
        graph = build_workforce_graph(
            {"company_name": "Example Co", "job_title": "Backend Engineer"},
            [
                {
                    "candidate_id": "Candidate 001",
                    "overall_score": 99,
                    "skill_scores": {"Python": 8},
                    "digital_profile_sources": [
                        {
                            "source_ref": "candidate_submitted_work",
                            "content": "Payments API\nVolunteer scheduling app",
                        },
                        {
                            "source_ref": "candidate_university",
                            "content": "Example University",
                        },
                        {
                            "source_ref": "candidate_referral",
                            "content": "Candidate-reported: Alex",
                        },
                    ],
                    "rounds": {"technical": {"decision": "pass"}},
                }
            ],
        )

        self.assertIn("Example Co", graph["dot"])
        self.assertIn("Backend Engineer", graph["dot"])
        self.assertIn("Python", graph["dot"])
        self.assertIn("Payments API", graph["dot"])
        self.assertIn("Example University", graph["dot"])
        self.assertIn("Candidate-reported: Alex", graph["dot"])
        self.assertIn("Technical round: pass", graph["dot"])
        self.assertEqual(graph["candidate_count"], 1)
        self.assertTrue(graph["performance_data_available"] is False)

    def test_workforce_graph_uses_persistent_identity_for_cross_role_memory(self):
        graph = build_workforce_graph(
            {
                "company_name": "Example Co",
                "job_title": "Platform Engineer",
            },
            [
                {
                    "candidate_id": "Candidate a1b2c3d4",
                    "skill_scores": {"Kubernetes": 7},
                    "organizational_memory": {
                        "memory_id": "a1b2c3d4-0000-0000-0000-000000000000",
                        "history": [
                            {
                                "snapshot_json": json.dumps(
                                    {
                                        "job": {
                                            "company_name": "Example Co",
                                            "job_title": "Backend Engineer",
                                        },
                                        "candidate": {
                                            "candidate_id": "Candidate 001",
                                            "skill_scores": {"Python": 8},
                                            "rounds": {},
                                        },
                                    }
                                )
                            }
                        ],
                    },
                }
            ],
        )

        self.assertIn("Backend Engineer", graph["dot"])
        self.assertIn("Platform Engineer", graph["dot"])
        self.assertEqual(graph["candidate_count"], 1)

    def test_hiring_funnel_summary_reports_recorded_counts_and_missing_sources(self):
        summary = summarize_hiring_funnel(
            [
                {
                    "decision_status": "Technical round pending",
                    "recruiter_decision": "advance",
                    "rounds": {"coding": {"decision": "pass"}},
                },
                {
                    "decision_status": "Not proceeding (recruiter decision)",
                    "recruiter_decision": "not_proceeding",
                    "rounds": {"coding": {"decision": "not_proceeding"}},
                },
                {
                    "decision_status": "Hired by recruiter",
                    "recruiter_decision": "advance",
                    "source": "LinkedIn",
                    "rounds": {
                        "coding": {"decision": "pass"},
                        "technical": {"decision": "pass"},
                        "hr": {"decision": "pass"},
                    },
                },
            ]
        )

        self.assertEqual(summary["screened"], 3)
        self.assertEqual(summary["advanced_after_screening"], 2)
        self.assertEqual(summary["not_proceeding_total"], 1)
        self.assertEqual(summary["hired"], 1)
        self.assertEqual(summary["screen_to_advance_rate_percent"], 66.7)
        self.assertEqual(summary["interview_rounds"]["coding"]["passed"], 2)
        self.assertEqual(summary["interview_rounds"]["coding"]["not_proceeding"], 1)
        self.assertTrue(summary["recruiting_source_data_available"])
        self.assertFalse(summary["market_salary_data_available"])

    def test_hiring_funnel_summary_handles_empty_candidate_set(self):
        summary = summarize_hiring_funnel([])

        self.assertEqual(summary["screened"], 0)
        self.assertIsNone(summary["screen_to_advance_rate_percent"])
        self.assertFalse(summary["recruiting_source_data_available"])

    def _offer_details(self, **overrides):
        details = {
            "candidate": {
                "candidate_id": "Candidate 001",
                "decision_status": "Hired by recruiter",
            },
            "job_title": "Backend Engineer",
            "candidate_name": "Example Candidate",
            "company_name": "Example Company",
            "annual_salary_lpa": 16,
            "joining_date": (date.today() + timedelta(days=30)).isoformat(),
            "documents": ["Relevant education certificates"],
            "salary_budget": "Up to ₹18 LPA",
            "budget_confirmed": True,
        }
        details.update(overrides)
        return details

    def _verification_candidate(self):
        return {
            "candidate_id": "Candidate 001",
            "decision_status": "Hired by recruiter",
        }

    def test_verification_plan_requires_hire_offer_acceptance_and_consent(self):
        checks = ["education", "employment"]
        with self.assertRaisesRegex(ValueError, "approve the hire"):
            create_verification_plan(
                {"candidate_id": "Candidate 001", "decision_status": "Final recruiter decision pending"},
                checks,
                offer_accepted=True,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "issued and accepted"):
            create_verification_plan(
                self._verification_candidate(),
                checks,
                offer_accepted=False,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "consent"):
            create_verification_plan(
                self._verification_candidate(),
                checks,
                offer_accepted=True,
                candidate_consent=False,
            )

    def test_verification_statuses_require_plan_and_follow_allowed_transitions(self):
        with self.assertRaisesRegex(ValueError, "consented verification plan"):
            update_verification_check(
                self._verification_candidate(),
                "education",
                "Verified",
            )

        candidate = create_verification_plan(
            self._verification_candidate(),
            ["education", "references"],
            offer_accepted=True,
            candidate_consent=True,
        )
        with self.assertRaisesRegex(ValueError, "Cannot change"):
            update_verification_check(candidate, "education", "Verified")

        candidate = update_verification_check(candidate, "education", "Requested")
        with self.assertRaisesRegex(ValueError, "1,000 characters"):
            update_verification_check(
                candidate,
                "education",
                "Requested",
                notes="x" * 1001,
            )
        candidate = update_verification_check(candidate, "education", "Verified", "Provider confirmed.")
        self.assertEqual(candidate["decision_status"], "Hired by recruiter")
        self.assertEqual(candidate["verification"]["status"], "In progress")
        self.assertEqual(
            candidate["verification"]["checks"]["education"]["status"],
            "Verified",
        )
        candidate = update_verification_check(candidate, "references", "Not applicable")
        self.assertEqual(candidate["verification"]["status"], "Checks completed")
        with self.assertRaisesRegex(ValueError, "Cannot change"):
            update_verification_check(candidate, "education", "Needs review")

    def test_verification_plan_rejects_unknown_checks_and_duplicates(self):
        with self.assertRaisesRegex(ValueError, "at least one"):
            create_verification_plan(
                self._verification_candidate(),
                [],
                offer_accepted=True,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "supported verification"):
            create_verification_plan(
                self._verification_candidate(),
                ["unknown"],
                offer_accepted=True,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "supported verification"):
            create_verification_plan(
                self._verification_candidate(),
                [["education"]],
                offer_accepted=True,
                candidate_consent=True,
            )
        candidate = create_verification_plan(
            self._verification_candidate(),
            ["education"],
            offer_accepted=True,
            candidate_consent=True,
        )
        with self.assertRaisesRegex(ValueError, "already exists"):
            create_verification_plan(
                candidate,
                ["education"],
                offer_accepted=True,
                candidate_consent=True,
            )

    def test_document_validation_plan_requires_offer_acceptance_and_consent(self):
        candidate = self._verification_candidate()
        with self.assertRaisesRegex(ValueError, "issued and accepted"):
            create_document_validation_plan(
                candidate,
                ["degree"],
                offer_accepted=False,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "consent"):
            create_document_validation_plan(
                candidate,
                ["degree"],
                offer_accepted=True,
                candidate_consent=False,
            )

    def test_aadhaar_validation_requires_compliant_integration_confirmation(self):
        candidate = self._verification_candidate()
        with self.assertRaisesRegex(ValueError, "Aadhaar validation requires"):
            create_document_validation_plan(
                candidate,
                ["aadhaar"],
                offer_accepted=True,
                candidate_consent=True,
            )

        candidate = create_document_validation_plan(
            candidate,
            ["aadhaar", "pan", "degree"],
            offer_accepted=True,
            candidate_consent=True,
            aadhaar_compliant_integration_confirmed=True,
        )
        self.assertEqual(candidate["document_validation"]["status"], "In progress")
        self.assertEqual(
            set(candidate["document_validation"]["checks"]),
            {"aadhaar", "pan", "degree"},
        )

    def test_document_validation_statuses_are_tracked_without_affecting_hire(self):
        candidate = create_document_validation_plan(
            self._verification_candidate(),
            ["degree"],
            offer_accepted=True,
            candidate_consent=True,
        )
        candidate = update_document_validation_check(
            candidate,
            "degree",
            "Requested",
        )
        candidate = update_document_validation_check(
            candidate,
            "degree",
            "Verified",
        )

        self.assertEqual(candidate["decision_status"], "Hired by recruiter")
        self.assertEqual(candidate["document_validation"]["status"], "Checks completed")
        self.assertEqual(
            candidate["document_validation"]["checks"]["degree"]["status"],
            "Verified",
        )
        self.assertEqual(
            candidate["document_validation"]["checks"]["degree"]["notes"],
            "",
        )
        with self.assertRaisesRegex(ValueError, "document validation plan"):
            update_document_validation_check(
                self._verification_candidate(),
                "degree",
                "Verified",
            )

    def test_onboarding_plan_requires_hire_accepted_offer_and_candidate_consent(self):
        with self.assertRaisesRegex(ValueError, "approve the hire"):
            create_onboarding_plan(
                {"candidate_id": "Candidate 001", "decision_status": "Final recruiter decision pending"},
                offer_accepted=True,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "formally issued and accepted"):
            create_onboarding_plan(
                self._verification_candidate(),
                offer_accepted=False,
                candidate_consent=True,
            )
        with self.assertRaisesRegex(ValueError, "consent"):
            create_onboarding_plan(
                self._verification_candidate(),
                offer_accepted=True,
                candidate_consent=False,
            )

    def test_onboarding_plan_creates_six_reviewable_tasks_without_provisioning(self):
        candidate = create_onboarding_plan(
            self._verification_candidate(),
            offer_accepted=True,
            candidate_consent=True,
        )

        tasks = candidate["onboarding"]["tasks"]
        self.assertEqual(
            set(tasks),
            {"email", "slack", "laptop", "payroll", "training", "documents"},
        )
        self.assertEqual(candidate["onboarding"]["status"], "Draft — approval required")
        self.assertTrue(
            all(task["status"] == "Draft — approval required" for task in tasks.values())
        )
        self.assertNotIn("email_account", candidate)

        with self.assertRaisesRegex(ValueError, "already exists"):
            create_onboarding_plan(
                candidate,
                offer_accepted=True,
                candidate_consent=True,
            )

    def test_onboarding_task_status_transitions_and_completion_are_recruiter_controlled(self):
        candidate = create_onboarding_plan(
            self._verification_candidate(),
            offer_accepted=True,
            candidate_consent=True,
        )
        with self.assertRaisesRegex(ValueError, "Cannot change onboarding task"):
            update_onboarding_task(candidate, "email", "Completed")

        candidate = update_onboarding_task(
            candidate,
            "email",
            "Approved — integration required",
        )
        self.assertEqual(candidate["onboarding"]["status"], "Draft — approval required")
        candidate = update_onboarding_task(candidate, "email", "In progress")
        candidate = update_onboarding_task(candidate, "email", "Completed")
        self.assertEqual(candidate["decision_status"], "Hired by recruiter")
        self.assertEqual(candidate["onboarding"]["status"], "Draft — approval required")

        for task in ("slack", "laptop", "payroll", "training", "documents"):
            candidate = update_onboarding_task(candidate, task, "Not applicable")
        self.assertEqual(candidate["onboarding"]["status"], "Completed")

    def test_onboarding_notes_are_limited(self):
        candidate = create_onboarding_plan(
            self._verification_candidate(),
            offer_accepted=True,
            candidate_consent=True,
        )
        with self.assertRaisesRegex(ValueError, "under 500 characters"):
            update_onboarding_task(
                candidate,
                "payroll",
                "Draft — approval required",
                notes="x" * 501,
            )

    def test_offer_draft_requires_recruiter_approved_hire_and_salary_confirmation(self):
        with self.assertRaisesRegex(ValueError, "approve the hire"):
            create_offer_letter_draft(
                **self._offer_details(
                    candidate={
                        "candidate_id": "Candidate 001",
                        "decision_status": "Final recruiter decision pending",
                    }
                )
            )
        with self.assertRaisesRegex(ValueError, "compensation band"):
            create_offer_letter_draft(
                **self._offer_details(budget_confirmed=False)
            )

    def test_offer_draft_rejects_salary_above_budget(self):
        with self.assertRaisesRegex(ValueError, "exceeds the salary budget"):
            create_offer_letter_draft(
                **self._offer_details(annual_salary_lpa=18.5)
            )
        with self.assertRaisesRegex(ValueError, "positive number"):
            create_offer_letter_draft(
                **self._offer_details(annual_salary_lpa=float("nan"))
            )

    def test_offer_draft_validates_future_joining_date_and_required_details(self):
        with self.assertRaisesRegex(ValueError, "must be in the future"):
            create_offer_letter_draft(
                **self._offer_details(
                    joining_date=(date.today() - timedelta(days=1)).isoformat()
                )
            )
        with self.assertRaisesRegex(ValueError, "must be in the future"):
            create_offer_letter_draft(
                **self._offer_details(joining_date=date.today().isoformat())
            )
        with self.assertRaisesRegex(ValueError, "Candidate name and company name"):
            create_offer_letter_draft(
                **self._offer_details(candidate_name="", company_name="")
            )
        with self.assertRaisesRegex(ValueError, "document"):
            create_offer_letter_draft(**self._offer_details(documents=[]))
        with self.assertRaisesRegex(ValueError, "document"):
            create_offer_letter_draft(**self._offer_details(documents=["  "]))

    def test_offer_draft_contains_compensation_date_documents_and_draft_status(self):
        offer = create_offer_letter_draft(**self._offer_details())

        self.assertEqual(offer["status"], "Draft — not approved or issued")
        self.assertEqual(offer["annual_salary_lpa"], 16)
        self.assertEqual(offer["documents"], ["Relevant education certificates"])
        self.assertIn("INR 16 LPA", offer["letter"])
        self.assertIn(offer["joining_date"], offer["letter"])
        self.assertIn("NOT ISSUED", offer["letter"])
        self.assertIn("Relevant education certificates", offer["letter"])

    def test_recruiter_advance_starts_coding_round_and_rounds_need_human_decisions(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "decision_status": "Pending recruiter review",
        }
        candidate = record_recruiter_decision(candidate, "advance")
        self.assertEqual(candidate["decision_status"], "Coding round pending")

        candidate = record_round_decision(candidate, "coding", "pass", "Reviewed code evidence.")
        self.assertEqual(candidate["decision_status"], "Technical round pending")
        self.assertEqual(candidate["rounds"]["coding"]["recruiter_notes"], "Reviewed code evidence.")

        candidate = record_round_decision(candidate, "technical", "pass")
        self.assertEqual(candidate["decision_status"], "HR round pending")
        candidate = record_round_decision(candidate, "hr", "pass")
        self.assertEqual(candidate["decision_status"], "Final recruiter decision pending")
        candidate = record_final_hiring_decision(candidate, "hire", "Approved.")
        self.assertEqual(candidate["decision_status"], "Hired by recruiter")

    def test_round_rejection_stops_progress_and_final_decision_is_not_automatic(self):
        candidate = record_recruiter_decision(
            {"candidate_id": "Candidate 001", "decision_status": "Pending recruiter review"},
            "advance",
        )
        rejected = record_round_decision(candidate, "coding", "not_proceeding", "Recruiter decision.")
        self.assertEqual(rejected["decision_status"], "Not proceeding (recruiter decision)")
        with self.assertRaises(ValueError):
            record_final_hiring_decision(candidate, "hire")
        with self.assertRaises(ValueError):
            record_round_decision(rejected, "technical", "pass")

    def test_groq_provider_initializes_chat_groq_with_selected_model(self):
        captured = {}

        class FakeChatGroq:
            def __init__(self, **kwargs):
                captured.update(kwargs)

        fake_module = ModuleType("langchain_groq")
        fake_module.ChatGroq = FakeChatGroq
        previous_module = sys.modules.get("langchain_groq")
        sys.modules["langchain_groq"] = fake_module
        try:
            agent = RecruitmentAgent(
                api_key="test-key",
                model="llama-test-model",
                provider="Groq",
            )
            llm = agent._get_llm()
        finally:
            if previous_module is None:
                del sys.modules["langchain_groq"]
            else:
                sys.modules["langchain_groq"] = previous_module

        self.assertIsInstance(llm, FakeChatGroq)
        self.assertEqual(captured["model"], "llama-test-model")
        self.assertEqual(captured["groq_api_key"], "test-key")

    def test_employee_hr_answer_is_grounded_and_validates_citations(self):
        class EmployeeAnswerModel:
            def __init__(self, response):
                self.response = response
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                return type(
                    "Response",
                    (),
                    {"content": json.dumps(self.response)},
                )()

        documents = [
            {"name": "Leave Policy.pdf", "text": "Employees receive 20 days of annual leave."}
        ]
        model = EmployeeAnswerModel(
            {
                "answer": "The policy provides 20 days of annual leave.",
                "sources": ["Leave Policy.pdf"],
                "needs_hr_follow_up": False,
            }
        )
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model

        answer = agent.answer_employee_hr_question(
            "How much annual leave is provided?",
            documents,
        )

        self.assertEqual(answer["sources"], ["Leave Policy.pdf"])
        self.assertFalse(answer["needs_hr_follow_up"])
        self.assertIn("only the approved source documents", model.prompt)
        self.assertIn("Leave Policy.pdf", model.prompt)

    def test_employee_hr_answer_rejects_invalid_inputs_and_unapproved_citations(self):
        agent = RecruitmentAgent(api_key="unused")
        with self.assertRaisesRegex(ValueError, "under 1,000 characters"):
            agent.answer_employee_hr_question(
                "x" * 1001,
                [{"name": "Policy.txt", "text": "Policy"}],
            )
        with self.assertRaisesRegex(ValueError, "10,000-character"):
            agent.answer_employee_hr_question(
                "Question",
                [{"name": "Large policy.txt", "text": "x" * 10_001}],
            )

        class InvalidCitationModel:
            def invoke(self, _prompt):
                return type(
                    "Response",
                    (),
                    {
                        "content": json.dumps(
                            {
                                "answer": "A claim.",
                                "sources": ["Unknown policy.pdf"],
                                "needs_hr_follow_up": False,
                            }
                        )
                    },
                )()

        agent._get_llm = lambda: InvalidCitationModel()
        with self.assertRaisesRegex(ValueError, "invalid HR answer or source citation"):
            agent.answer_employee_hr_question(
                "Question",
                [{"name": "Policy.txt", "text": "Policy"}],
            )

    def test_coding_challenge_is_generated_for_requested_difficulty(self):
        class ChallengeModel:
            def __init__(self):
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                response = {
                    "title": "Build a rate limiter",
                    "prompt": "Implement a token bucket.",
                    "input_format": "Requests with timestamps",
                    "output_format": "Allowed or denied",
                    "constraints": "Expected O(1) updates",
                    "examples": [{"input": "request", "output": "allowed"}],
                    "evaluation_criteria": ["correctness"],
                    "starter_code": "def allow(): pass",
                }
                return type("Response", (), {"content": json.dumps(response)})()

        model = ChallengeModel()
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model

        challenge = agent.generate_coding_challenge(
            "Backend Engineer",
            ["Python", "APIs"],
            "Hard",
            "Prior answer handled edge cases.",
        )

        self.assertEqual(challenge["title"], "Build a rate limiter")
        self.assertIn("do not use a fixed question bank", model.prompt)
        self.assertIn("Difficulty: Hard", model.prompt)

    def test_hr_decision_brief_uses_evidence_and_constrains_readiness_prediction(self):
        class BriefModel:
            def __init__(self):
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                brief = {
                    "pros": ["Candidate described relevant Python API work."],
                    "cons": ["No production-scale example was provided."],
                    "role_related_risks": ["Distributed systems experience needs follow-up."],
                    "salary_recommendation": {
                        "guidance": "Use the approved role band.",
                        "basis": "Budget is up to ₹18 LPA; confirm internal equity.",
                    },
                    "joining_readiness": {
                        "status": "uncertain",
                        "evidence": ["Candidate did not state a notice period."],
                    },
                }
                return type("Response", (), {"content": json.dumps(brief)})()

        model = BriefModel()
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model

        brief = agent.build_hr_decision_brief(
            role="Backend Engineer",
            required_skills=["Python", "APIs"],
            salary_budget="Up to ₹18 LPA",
            candidate_evidence={"hr": {"notice_period": "not provided"}},
            prior_work_context=[
                {
                    "role": "Platform Engineer",
                    "resume_project_and_skill_evidence": "Built internal APIs.",
                }
            ],
        )

        self.assertEqual(brief["joining_readiness"]["status"], "uncertain")
        self.assertIn("never generate a numeric joining probability", model.prompt.lower())
        self.assertIn("Built internal APIs.", model.prompt)
        self.assertIn("recruiter follow-up only", model.prompt)
        self.assertIn("Up to ₹18 LPA", model.prompt)
        self.assertNotIn("hire/reject", brief)

    def test_hr_decision_brief_rejects_invalid_joining_probability_status(self):
        class BriefModel:
            def invoke(self, _prompt):
                brief = {
                    "pros": [],
                    "cons": [],
                    "role_related_risks": [],
                    "salary_recommendation": {"guidance": "Use range", "basis": "Budget"},
                    "joining_readiness": {"status": "82%", "evidence": []},
                }
                return type("Response", (), {"content": json.dumps(brief)})()

        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: BriefModel()
        with self.assertRaisesRegex(ValueError, "Joining readiness"):
            agent.build_hr_decision_brief("Engineer", ["Python"], "To be confirmed", {})

    def test_hiring_intelligence_is_structured_and_warns_against_unsupported_claims(self):
        class IntelligenceModel:
            def __init__(self):
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                output = {
                    "recommendations": [
                        {
                            "title": "Track source effectiveness",
                            "action": "Record each applicant's authorized sourcing channel.",
                            "rationale": "The current funnel does not identify where applicants came from.",
                            "supporting_evidence": ["Recruiting source data is unavailable."],
                            "confidence": "low",
                            "data_needed": ["Candidate source for each application."],
                        }
                    ]
                }
                return type("Response", (), {"content": json.dumps(output)})()

        model = IntelligenceModel()
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model
        result = agent.generate_hiring_intelligence(
            {"job_title": "Backend Engineer"},
            {"screened": 2, "recruiting_source_data_available": False},
        )

        self.assertEqual(result["recommendations"][0]["confidence"], "low")
        self.assertIn("Do not claim causation", model.prompt)
        self.assertIn("Do not recommend preferring or avoiding universities", model.prompt)

    def test_hiring_intelligence_rejects_malformed_recommendations(self):
        class InvalidModel:
            def invoke(self, _prompt):
                return type(
                    "Response",
                    (),
                    {
                        "content": json.dumps(
                            {"recommendations": [{"title": "Incomplete"}]}
                        )
                    },
                )()

        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: InvalidModel()
        with self.assertRaisesRegex(ValueError, "invalid hiring recommendation"):
            agent.generate_hiring_intelligence({}, {})

    def test_hiring_intelligence_rejects_institution_targeting(self):
        class InstitutionModel:
            def invoke(self, _prompt):
                recommendation = {
                    "title": "Target IIIT graduates",
                    "action": "Prioritize candidates from IIIT.",
                    "rationale": "School prestige predicts performance.",
                    "supporting_evidence": ["No valid evidence."],
                    "confidence": "high",
                    "data_needed": [],
                }
                return type(
                    "Response",
                    (),
                    {
                        "content": json.dumps(
                            {"recommendations": [recommendation]}
                        )
                    },
                )()

        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: InstitutionModel()
        with self.assertRaisesRegex(ValueError, "educational institution"):
            agent.generate_hiring_intelligence({}, {})

    def test_candidate_digital_profile_requires_valid_evidence_citations(self):
        class ProfileModel:
            def __init__(self):
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                profile = {
                    "evidence": [
                        {
                            "claim": "Resume describes Python API work.",
                            "source_refs": ["resume"],
                            "limitations": "Candidate-submitted information; not independently verified.",
                        }
                    ],
                }
                return type("Response", (), {"content": json.dumps(profile)})()

        model = ProfileModel()
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model
        profile = agent.build_candidate_digital_profile(
            [
                {
                    "source_type": "Resume",
                    "source_ref": "resume",
                    "content": "Python API projects",
                }
            ],
        )

        self.assertIn("[resume]", profile["summary"])
        self.assertIn("page was not accessed", model.prompt)
        self.assertIn("not a score", model.prompt)

    def test_candidate_digital_profile_rejects_unknown_citations(self):
        class ProfileModel:
            def invoke(self, _prompt):
                profile = {
                    "evidence": [
                        {
                            "claim": "Strong contributor.",
                            "source_refs": ["unknown"],
                            "limitations": "",
                        }
                    ],
                }
                return type("Response", (), {"content": json.dumps(profile)})()

        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: ProfileModel()
        with self.assertRaisesRegex(ValueError, "unsupported or uncited"):
            agent.build_candidate_digital_profile(
                [{"source_ref": "resume", "content": "Resume text"}],
            )

    def test_ranking_reports_local_matching_when_model_scoring_fails(self):
        class BrokenModel:
            def invoke(self, _prompt):
                raise RuntimeError("model unavailable")

        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: BrokenModel()

        result = agent.analyze_skills(
            "Python projects and services",
            ["Python"],
            keyword_text="Python projects and services",
        )

        self.assertEqual(result["assessment_method"], "Local resume text matching")

    def test_resume_screening_normalizes_requirements_and_returns_extracted_evidence(self):
        class UploadedText:
            name = "candidate.txt"

            def getvalue(self):
                return (
                    b"Experience\nBuilt Python services for 20,000 users.\n"
                    b"Projects\nCreated a Python API.\nEducation\nBSc Computer Science"
                )

        agent = RecruitmentAgent()
        agent._get_llm = lambda: None

        result = agent.screen_candidate_resume(
            UploadedText(),
            [" Python ", "python", "APIs"],
        )

        self.assertEqual(result["job_requirements"], ["Python", "APIs"])
        self.assertEqual(
            result["extracted_information"]["experience"],
            ["Built Python services for 20,000 users."],
        )
        self.assertEqual(
            result["skill_evidence"]["Python"]["quote"],
            "Built Python services for 20,000 users.",
        )
        self.assertIn("requirements_without_evidence", result["screening_explanation"])
        self.assertEqual(agent._text_cache, {})

    def test_llm_skill_score_requires_an_exact_quote_and_integer_in_range(self):
        class ScoringModel:
            def __init__(self, response):
                self.response = response

            def invoke(self, _prompt):
                return type("Response", (), {"content": json.dumps(self.response)})()

        resume = "Experience:\nBuilt Python services for 20,000 users."
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: ScoringModel({
            "Python": {
                "score": 9,
                "evidence": "Built Python services",
                "explanation": "Built production services.",
            }
        })
        valid = agent.analyze_skills(resume, ["Python"])
        self.assertEqual(valid["skill_scores"]["Python"], 9)
        self.assertEqual(valid["skill_evidence"]["Python"]["quote"], "Built Python services")

        agent._get_llm = lambda: ScoringModel({
            "Python": {"score": 11, "evidence": "Built Python services"}
        })
        out_of_range = agent.analyze_skills(resume, ["Python"])
        self.assertEqual(out_of_range["assessment_method"], "Local resume text matching")

        agent._get_llm = lambda: ScoringModel({
            "Python": {"score": 9, "evidence": "Developed many Python applications"}
        })
        unsupported = agent.analyze_skills(resume, ["Python"])
        self.assertEqual(unsupported["assessment_method"], "Local resume text matching")
        self.assertEqual(
            unsupported["skill_evidence"]["Python"]["quote"],
            "Built Python services for 20,000 users.",
        )

    def test_skill_matching_does_not_match_a_substring_of_another_skill(self):
        agent = RecruitmentAgent()
        self.assertEqual(agent._keyword_skill_score("JavaScript development", "Java"), 0)
        self.assertEqual(agent._find_skill_evidence("JavaScript development", "Java"), "")

    def test_job_description_uses_the_provided_hiring_brief(self):
        class DraftModel:
            def __init__(self):
                self.prompt = ""

            def invoke(self, prompt):
                self.prompt = prompt
                return type("Response", (), {"content": "Backend Engineer JD draft"})()

        model = DraftModel()
        agent = RecruitmentAgent(api_key="unused")
        agent._get_llm = lambda: model

        draft = agent.generate_job_description(
            job_title="Backend Engineer",
            headcount=3,
            salary_budget="₹18 LPA",
            location="Bangalore",
            timeline="30 days",
            requirements="Python, APIs",
        )

        self.assertEqual(draft, "Backend Engineer JD draft")
        self.assertIn("Bangalore", model.prompt)
        self.assertIn("Python, APIs", model.prompt)
        self.assertIn("do not invent", model.prompt)

    def test_screening_does_not_retain_uploaded_resume_text_in_agent_cache(self):
        class UploadedText:
            name = "candidate.txt"

            def getvalue(self):
                return b"Python projects and services"

        agent = RecruitmentAgent()
        agent._get_llm = lambda: None

        result = agent.screen_candidate_resume(UploadedText(), ["Python"])

        self.assertEqual(result["decision_status"], "Pending recruiter review")
        self.assertEqual(agent._text_cache, {})

    def test_rank_uses_job_score_and_preserves_stable_ties(self):
        candidates = [
            {"candidate_id": "Candidate 002", "overall_score": 80},
            {"candidate_id": "Candidate 001", "overall_score": 80},
            {"candidate_id": "Candidate 003", "overall_score": 65},
        ]

        ranked = rank_candidates(candidates)

        self.assertEqual(
            [candidate["candidate_id"] for candidate in ranked],
            ["Candidate 001", "Candidate 002", "Candidate 003"],
        )

    def test_candidate_progression_requires_an_explicit_recruiter_decision(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "overall_score": 94,
            "decision_status": "Pending recruiter review",
        }

        advanced = record_recruiter_decision(candidate, "advance")

        self.assertEqual(advanced["decision_status"], "Coding round pending")
        self.assertEqual(advanced["recruiter_decision"], "advance")
        self.assertEqual(candidate["decision_status"], "Pending recruiter review")

    def test_recruiter_decision_cannot_be_overwritten(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "decision_status": "Not proceeding (recruiter decision)",
        }

        with self.assertRaises(ValueError):
            record_recruiter_decision(candidate, "advance")

    def test_audit_log_identifies_actor_without_storing_resume_content(self):
        events = append_audit_event([], "AI screened resume against job skills", "Backend: Candidate 001")

        self.assertEqual(events[0]["actor"], "AI workflow")
        self.assertEqual(events[0]["subject"], "Backend: Candidate 001")
        self.assertNotIn("resume", events[0]["subject"].lower())

    def test_invitation_draft_requires_recruiter_approval_and_contact_authorization(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "recruiter_decision": "advance",
        }
        with self.assertRaisesRegex(ValueError, "authorized"):
            create_interview_invitation_draft(
                candidate,
                "Backend Engineer",
                "candidate@example.com",
                "Monday 10:00 IST",
                "Video interview",
            )

        with self.assertRaisesRegex(ValueError, "advance"):
            create_interview_invitation_draft(
                {"candidate_id": "Candidate 002", "recruiter_decision": "pending"},
                "Backend Engineer",
                "candidate@example.com",
                "Monday 10:00 IST",
                "Video interview",
                contact_authorized=True,
            )

    def test_invitation_draft_is_not_marked_sent_or_scheduled(self):
        draft = create_interview_invitation_draft(
            {
                "candidate_id": "Candidate 001",
                "recruiter_decision": "advance",
            },
            "Backend Engineer",
            "candidate@example.com",
            "2026-11-02 10:00-12:00 IST",
            "Phone interview",
            round_name="coding",
            phone="+91 9876543210",
            candidate_name="Alex",
            contact_authorized=True,
        )

        self.assertEqual(draft["status"], "Draft — not sent or scheduled")
        self.assertIn("Alex", draft["body"])
        self.assertIn("2026-11-02", draft["body"])
        self.assertIn("coding round", draft["body"].lower())
        self.assertEqual(draft["candidate_phone"], "+91 9876543210")

    def test_phone_interview_requires_phone_and_valid_contact_fields(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "recruiter_decision": "advance",
        }
        with self.assertRaisesRegex(ValueError, "phone number"):
            create_interview_invitation_draft(
                candidate,
                "Backend Engineer",
                "candidate@example.com",
                "Monday 10:00 IST",
                "Phone interview",
                contact_authorized=True,
            )
        with self.assertRaisesRegex(ValueError, "valid"):
            create_interview_invitation_draft(
                candidate,
                "Backend Engineer",
                "not-an-email",
                "Monday 10:00 IST",
                "Video interview",
                contact_authorized=True,
            )

    def test_rejection_draft_requires_recruiter_decision_and_is_never_sent(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "decision_status": "Not proceeding (recruiter decision)",
        }
        draft = create_rejection_message_draft(
            candidate,
            "Backend Engineer",
            "candidate@example.com",
            phone="+91 9876543210",
            candidate_name="Alex",
            contact_authorized=True,
        )
        self.assertEqual(draft["status"], "Draft — not sent or scheduled")
        self.assertIn("will not be moving forward", draft["body"])
        self.assertIn("recruiting team", draft["call_script"])

        with self.assertRaisesRegex(ValueError, "not-proceeding"):
            create_rejection_message_draft(
                {"candidate_id": "Candidate 002", "decision_status": "Pending recruiter review"},
                "Backend Engineer",
                "candidate@example.com",
                contact_authorized=True,
            )


if __name__ == "__main__":
    unittest.main()
