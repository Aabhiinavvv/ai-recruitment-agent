"""Minimal consent-gated SQLite memory for structured candidate history.

Store pseudonymous IDs and job-relevant summaries, not raw resumes. Production
requires authentication, tenant isolation, encryption, retention and deletion
policies, access logging, and a documented lawful basis.
"""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


class CandidateMemory:
    def __init__(self, db_path: str = "data/candidate_memory.sqlite3"):
        self.db_path = db_path
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS candidate_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id TEXT NOT NULL,
                role_title TEXT NOT NULL,
                skills_json TEXT NOT NULL,
                outcome TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                consented INTEGER NOT NULL CHECK(consented = 1),
                created_at TEXT NOT NULL
            )""")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_history_candidate ON candidate_history(candidate_id, created_at)")

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def record(self, candidate_id: str, role_title: str, skills: List[str],
               outcome: str, consent: bool, notes: str = "") -> int:
        if not consent:
            raise PermissionError("Candidate-history memory requires explicit consent.")
        if not candidate_id.strip() or not role_title.strip():
            raise ValueError("candidate_id and role_title are required")
        timestamp = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO candidate_history(candidate_id, role_title, skills_json, outcome, notes, consented, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
                (candidate_id.strip(), role_title.strip(), json.dumps(sorted(set(skills))),
                 outcome.strip(), notes.strip(), timestamp),
            )
            return int(cursor.lastrowid)

    def history(self, candidate_id: str) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT role_title, skills_json, outcome, notes, created_at FROM candidate_history WHERE candidate_id = ? ORDER BY created_at DESC",
                (candidate_id.strip(),),
            ).fetchall()
        return [{"role_title": r[0], "skills": json.loads(r[1]), "outcome": r[2],
                 "notes": r[3], "created_at": r[4]} for r in rows]

    def delete_candidate(self, candidate_id: str) -> int:
        """Delete all stored history for a candidate."""
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM candidate_history WHERE candidate_id = ?", (candidate_id.strip(),))
            return int(cursor.rowcount)
