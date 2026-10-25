import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet

from organizational_memory import (
    delete_candidate_history,
    find_candidate_history,
    save_candidate_history,
)


class OrganizationalMemoryTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "memory.sqlite3"
        self.environment = patch.dict(
            os.environ,
            {
                "CANDIDATE_MEMORY_KEY": Fernet.generate_key().decode("ascii"),
                "CANDIDATE_MEMORY_DB": str(self.database_path),
            },
        )
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp_dir.cleanup()

    def test_candidate_history_is_encrypted_and_shared_across_roles(self):
        candidate = {
            "candidate_id": "Candidate 001",
            "candidate_name": "Private Candidate",
            "decision_status": "Not proceeding (recruiter decision)",
            "memory_consent": True,
            "rounds": {
                "technical": {
                    "answers": ["Built payment reconciliation services."],
                    "evaluation": {"strengths": ["Python experience"]},
                }
            },
        }
        first = save_candidate_history(
            "Candidate@example.test",
            candidate,
            {"job_title": "Backend Engineer"},
            communications=[
                {"candidate_id": "Candidate 001", "body": "Rejection draft"}
            ],
            activity=[
                {"subject": "Backend Engineer: Candidate 001", "action": "Recruiter decision"}
            ],
        )
        found = find_candidate_history("candidate@EXAMPLE.test")

        self.assertEqual(found["memory_id"], first["memory_id"])
        self.assertEqual(len(found["history"]), 1)
        self.assertIn("Built payment reconciliation services", found["history"][0]["snapshot_json"])
        database_bytes = self.database_path.read_bytes()
        self.assertNotIn(b"Private Candidate", database_bytes)
        self.assertNotIn(b"Candidate@example.test", database_bytes)

        returning_candidate = {
            **candidate,
            "candidate_id": "Candidate 002",
            "decision_status": "Pending recruiter review",
        }
        second = save_candidate_history(
            "candidate@example.test",
            returning_candidate,
            {"job_title": "Platform Engineer"},
        )

        self.assertEqual(second["memory_id"], first["memory_id"])
        self.assertEqual(len(second["history"]), 2)
        snapshots = [entry["snapshot_json"] for entry in second["history"]]
        self.assertIn("Backend Engineer", snapshots[0])
        self.assertIn("Platform Engineer", snapshots[1])

    def test_memory_requires_candidate_consent_and_supports_manual_deletion(self):
        with self.assertRaisesRegex(ValueError, "Candidate consent"):
            save_candidate_history(
                "candidate@example.test",
                {"candidate_id": "Candidate 001", "memory_consent": False},
                {"job_title": "Backend Engineer"},
            )

        save_candidate_history(
            "candidate@example.test",
            {"candidate_id": "Candidate 001", "memory_consent": True},
            {"job_title": "Backend Engineer"},
        )
        self.assertTrue(delete_candidate_history("candidate@example.test"))
        self.assertIsNone(find_candidate_history("candidate@example.test"))
        self.assertFalse(delete_candidate_history("candidate@example.test"))

    def test_memory_refuses_to_operate_without_encryption_key(self):
        with patch.dict(os.environ, {"CANDIDATE_MEMORY_KEY": ""}):
            with self.assertRaisesRegex(RuntimeError, "Persistent candidate memory is disabled"):
                find_candidate_history("candidate@example.test")

    def test_memory_rejects_invalid_email(self):
        with self.assertRaisesRegex(ValueError, "valid candidate email"):
            find_candidate_history("not-an-email")


if __name__ == "__main__":
    unittest.main()
