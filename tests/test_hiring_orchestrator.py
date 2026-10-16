import unittest

from recruitment_core.orchestrator import run_hiring_workflow


class HiringOrchestratorTests(unittest.TestCase):
    def test_graph_runs_specialist_steps_and_keeps_human_review(self):
        job = {
            "id": "JOB-1",
            "title": "Data Analyst",
            "required_skills": ["Python", "SQL"],
            "preferred_skills": ["Power BI"],
            "min_exp": 1,
        }
        candidates = [
            {"ID": "c-1", "Candidate": "Candidate One", "Skills": "Python, SQL, Power BI", "Experience": 2},
            {"ID": "c-2", "Candidate": "Candidate Two", "Skills": "Python", "Experience": 0},
        ]
        result = run_hiring_workflow(job, candidates)
        self.assertEqual(result["status"], "pending_recruiter_review")
        self.assertTrue(result["summary"]["human_approval_required"])
        self.assertEqual(len(result["matches"]), 2)
        self.assertGreaterEqual(result["matches"][0]["score"], result["matches"][1]["score"])
        self.assertTrue(result["interview_plan"])
        self.assertTrue(result["verification_plan"])
        self.assertEqual(result["matches"][0]["decision"], "Pending human review")

    def test_missing_job_criteria_is_flagged(self):
        result = run_hiring_workflow({"title": "Unspecified"}, [])
        self.assertEqual(result["status"], "needs_job_criteria")
        self.assertTrue(result["summary"]["errors"])


if __name__ == "__main__":
    unittest.main()
