import unittest

from agent_runtime import (
    AgentToolRegistry,
    execute_bounded_plan,
    execute_candidate_preparation,
    plan_candidate_preparation,
)


class FakeAgent:
    def generate_coding_challenge(self, **arguments):
        return {
            "title": f"{arguments['difficulty']} challenge",
            "prompt": "Implement a bounded queue.",
        }

    def evaluate_coding_submission(self, **_arguments):
        return {"score": 84, "correctness": "Good"}

    def generate_round_interview_questions(self, **arguments):
        return [f"{arguments['round_name']} question"]

    def evaluate_interview_round(self, **_arguments):
        return {"evidence": "Candidate described a project.", "strengths": []}

    def build_hr_decision_brief(self, **_arguments):
        return {"pros": ["Relevant evidence"], "cons": []}


class AgentRuntimeTests(unittest.TestCase):
    def test_plan_refuses_to_make_a_recruiter_decision(self):
        plan = plan_candidate_preparation(
            {
                "decision_status": "Pending recruiter review",
            },
            {"job_title": "Engineer", "requirements": "Python"},
        )
        self.assertEqual(plan, [])

    def test_plan_generates_and_reflects_on_coding_challenge(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "decision_status": "Coding round pending",
            "current_round": "coding",
            "rounds": {"coding": {}},
        }
        result = execute_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python\nSQL"},
            FakeAgent(),
        )

        self.assertEqual(result["status"], "completed")
        self.assertTrue(result["trace"][0]["reflection"]["passed"])
        self.assertEqual(
            candidate["rounds"]["coding"]["challenge"]["title"],
            "Medium challenge",
        )
        self.assertEqual(
            result["trace"][0]["tool"],
            "generate_coding_challenge",
        )

    def test_plan_evaluates_candidate_submission_but_does_not_advance_them(self):
        candidate = {
            "decision_status": "Coding round pending",
            "current_round": "coding",
            "rounds": {
                "coding": {
                    "challenge": {"title": "Queue"},
                    "candidate_submission": "def queue(): pass",
                }
            },
        }
        result = execute_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python"},
            FakeAgent(),
        )

        self.assertEqual(result["trace"][0]["tool"], "evaluate_coding_submission")
        self.assertEqual(candidate["rounds"]["coding"]["evaluation"]["score"], 84)
        self.assertTrue(candidate["rounds"]["coding"]["submitted"])
        self.assertEqual(candidate["decision_status"], "Coding round pending")

    def test_plan_reflects_on_interview_evidence(self):
        candidate = {
            "decision_status": "Technical round pending",
            "current_round": "technical",
            "rounds": {
                "technical": {
                    "questions": ["Describe an API."],
                    "answers": ["I built one."],
                }
            },
        }
        result = execute_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python, APIs"},
            FakeAgent(),
        )

        self.assertEqual(result["trace"][0]["tool"], "evaluate_interview_round")
        self.assertIn("evidence", candidate["rounds"]["technical"]["evaluation"])

    def test_plan_generates_questions_for_next_interview_round(self):
        candidate = {
            "decision_status": "Technical round pending",
            "current_round": "technical",
            "rounds": {"technical": {}},
        }
        result = execute_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python\nAPIs"},
            FakeAgent(),
        )

        self.assertEqual(
            result["trace"][0]["tool"],
            "generate_round_interview_questions",
        )
        self.assertEqual(
            candidate["rounds"]["technical"]["questions"],
            ["technical question"],
        )
        self.assertEqual(candidate["rounds"]["technical"]["answers"], [""])

    def test_plan_generates_hr_brief_only_after_final_round_gate(self):
        candidate = {
            "decision_status": "Final recruiter decision pending",
            "rounds": {},
        }
        plan = plan_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python"},
            prior_work_context=[{"role": "Earlier role"}],
        )
        self.assertEqual(plan[0]["tool"], "build_hr_decision_brief")
        self.assertEqual(
            plan[0]["arguments"]["prior_work_context"],
            [{"role": "Earlier role"}],
        )
        result = execute_candidate_preparation(
            candidate,
            {"job_title": "Engineer", "requirements": "Python"},
            FakeAgent(),
        )
        self.assertEqual(result["status"], "completed")
        self.assertEqual(candidate["hr_decision_brief"]["pros"], ["Relevant evidence"])

    def test_executor_restricts_tools_and_reflects_on_invalid_result(self):
        tools = AgentToolRegistry()
        tools.register("bad_tool", lambda: [])

        result = execute_bounded_plan(
            [{"tool": "bad_tool", "arguments": {}, "expected_result": "non_empty_dict"}],
            tools,
        )
        self.assertEqual(result["status"], "failed")
        self.assertFalse(result["trace"][0]["reflection"]["passed"])
        with self.assertRaisesRegex(ValueError, "not in the allowlist"):
            tools.execute("delete_candidate", {})
        with self.assertRaisesRegex(ValueError, "reflection contract"):
            execute_bounded_plan(
                [{"tool": "bad_tool", "arguments": {}, "expected_result": {}}],
                tools,
            )
        with self.assertRaisesRegex(ValueError, "execution limit"):
            execute_bounded_plan(
                [
                    {"tool": "bad_tool", "arguments": {}},
                    {"tool": "bad_tool", "arguments": {}},
                ],
                tools,
                max_steps=1,
            )

    def test_executor_reports_tool_failure_in_trace(self):
        tools = AgentToolRegistry()

        def fail_action():
            raise RuntimeError("model unavailable")

        tools.register("failing_tool", fail_action)
        result = execute_bounded_plan(
            [{"tool": "failing_tool", "arguments": {}}],
            tools,
        )

        self.assertEqual(result["status"], "failed")
        self.assertIn("model unavailable", result["trace"][0]["reflection"]["message"])


if __name__ == "__main__":
    unittest.main()
