import tempfile
import unittest
from pathlib import Path

from recruitment_core.matching import CandidateProfile, JobCriteria, score_candidate
from recruitment_core.fairness import selection_rate_audit
from recruitment_core.memory import CandidateMemory


class MatchingTests(unittest.TestCase):
    def test_score_explains_missing_skills(self):
        candidate = CandidateProfile("c-1", ["Python", "SQL"], 1)
        job = JobCriteria("Data Analyst", ["Python", "SQL", "Power BI"], minimum_experience_years=2)
        result = score_candidate(candidate, job)
        self.assertGreaterEqual(result.score, 0)
        self.assertLessEqual(result.score, 100)
        self.assertEqual(result.missing_required_skills, ["Power BI"])
        self.assertTrue(result.review_required)
        self.assertIn("Power BI", result.explanation)

    def test_empty_skills(self):
        result = score_candidate(CandidateProfile("c-2"), JobCriteria("Intern"))
        self.assertEqual(result.score, 100.0)


class FairnessTests(unittest.TestCase):
    def test_selection_rate_audit(self):
        result = selection_rate_audit([
            {"audit_group": "A", "score": 90}, {"audit_group": "A", "score": 50},
            {"audit_group": "B", "score": 60}, {"audit_group": "B", "score": 70},
        ], threshold=75)
        self.assertEqual(result["selection_rates"]["A"], 0.5)
        self.assertEqual(result["selection_rates"]["B"], 0.0)


class MemoryTests(unittest.TestCase):
    def test_consent_and_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            memory = CandidateMemory(str(Path(directory) / "memory.sqlite3"))
            with self.assertRaises(PermissionError):
                memory.record("c-1", "ML Intern", ["Python"], "screened", consent=False)
            memory.record("c-1", "ML Intern", ["Python", "SQL"], "interviewed", consent=True)
            self.assertEqual(len(memory.history("c-1")), 1)
            self.assertEqual(memory.delete_candidate("c-1"), 1)
            self.assertEqual(memory.history("c-1"), [])


if __name__ == "__main__":
    unittest.main()
