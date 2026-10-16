"""SQLite persistence for requisitions, pipeline records, verification status and audit events.

This local store is a prototype and is not production multi-tenant storage.
Production must add authenticated access, tenant isolation, encryption, retention,
backups, and a formal privacy/security review.
"""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RecruitmentStore:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or __import__("os")..getenv("HIREOS_DB_PATH", "data/hireos.sqlite3")
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS jobs (job_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS candidates (candidate_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)"
            )
            connection.execute(
                """CREATE TABLE IF NOT EXISTS verification_requests (
                    request_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL
                )"""
            )
            connection.execute(
                """CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    subject_ref TEXT NOT NULL,
                    details TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )"""
            )

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def load_jobs(self) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT payload_json FROM jobs ORDER BY updated_at DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def save_job(self, payload: Mapping[str, Any]) -> None:
        job_id = str(payload.get("id") or "").strip()
        if not job_id:
            raise ValueError("Job payload requires an id")
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO jobs(job_id, payload_json, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(job_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at",
                (job_id, json.dumps(dict(payload), ensure_ascii=False), _now()),
            )

    def update_job_status(self, job_id: str, status: str) -> bool:
        with self._connect() as connection:
            row = connection.execute("SELECT payload_json FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                return False
            payload = json.loads(row[0])
            payload["status"] = status
            connection.execute(
                "UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?",
                (json.dumps(payload, ensure_ascii=False), _now(), job_id),
            )
        return True

    def load_candidates(self) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT payload_json FROM candidates ORDER BY updated_at DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def save_candidate(self, payload: Mapping[str, Any]) -> None:
        candidate_id = str(payload.get("ID") or payload.get("Candidate ID") or payload.get("Candidate") or "").strip()
        if not candidate_id:
            raise ValueError("Candidate payload requires a stable ID or display name")
        candidate = dict(payload)
        candidate.setdefault("ID", candidate_id)
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO candidates(candidate_id, payload_json, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(candidate_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at",
                (candidate_id, json.dumps(candidate, ensure_ascii=False), _now()),
            )

    def save_verification(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        record = dict(payload)
        record.setdefault("request_id", str(uuid.uuid4()))
        record.setdefault("Requested", datetime.now().strftime("%Y-%m-%d %H:%M"))
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO verification_requests(request_id, payload_json, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(request_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at",
                (str(record["request_id"]), json.dumps(record, ensure_ascii=False), _now()),
            )
        return record

    def load_verifications(self) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT payload_json FROM verification_requests ORDER BY updated_at DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def log_event(self, message: str, actor: str = "recruiter", event_type: str = "workflow", subject_ref: str = "") -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO audit_events(event_type, actor, subject_ref, details, created_at) VALUES (?, ?, ?, ?, ?)",
                (event_type, actor, subject_ref, message, _now()),
            )

    def load_events(self, limit: int = 50) -> List[str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT details FROM audit_events ORDER BY id DESC LIMIT ?", (int(limit),)
            ).fetchall()
        return [row[0] for row in rows]
