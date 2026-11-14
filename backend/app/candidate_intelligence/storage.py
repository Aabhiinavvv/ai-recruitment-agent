from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from app.candidate_intelligence.schemas import CandidateProfile


@contextmanager
def _database_connection() -> Iterator[sqlite3.Connection]:
    connection = _connect()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def _database_path() -> Path:
    configured_path = os.getenv("CANDIDATE_DATABASE_PATH")
    if configured_path:
        return Path(configured_path)
    return Path(__file__).resolve().parents[2] / "data" / "candidate_profiles.sqlite3"


def _connect() -> sqlite3.Connection:
    database_path = _database_path()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS candidate_profiles (
            candidate_id TEXT PRIMARY KEY,
            source_hash TEXT NOT NULL UNIQUE,
            source_file TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            profile_json TEXT NOT NULL
        )
        """
    )
    return connection


def get_candidate_by_hash(source_hash: str) -> tuple[CandidateProfile, str] | None:
    with _database_connection() as connection:
        row = connection.execute(
            "SELECT profile_json, uploaded_at FROM candidate_profiles WHERE source_hash = ?",
            (source_hash,),
        ).fetchone()
    if row is None:
        return None
    return CandidateProfile.model_validate_json(row["profile_json"]), row["uploaded_at"]


def save_candidate_profile(
    source_hash: str, profile: CandidateProfile
) -> tuple[CandidateProfile, str]:
    uploaded_at = datetime.now(UTC).isoformat()
    with _database_connection() as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO candidate_profiles
                (candidate_id, source_hash, source_file, uploaded_at, profile_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                profile.candidate_id,
                source_hash,
                profile.source_file,
                uploaded_at,
                profile.model_dump_json(),
            ),
        )
        row = connection.execute(
            "SELECT profile_json, uploaded_at FROM candidate_profiles WHERE source_hash = ?",
            (source_hash,),
        ).fetchone()
    if row is None:
        raise RuntimeError("The candidate profile could not be saved to the database.")
    return CandidateProfile.model_validate_json(row["profile_json"]), row["uploaded_at"]


def list_candidate_profiles() -> list[tuple[CandidateProfile, str]]:
    with _database_connection() as connection:
        rows = connection.execute(
            """
            SELECT profile_json, uploaded_at
            FROM candidate_profiles
            ORDER BY uploaded_at DESC, candidate_id DESC
            """
        ).fetchall()
    return [
        (CandidateProfile.model_validate_json(row["profile_json"]), row["uploaded_at"])
        for row in rows
    ]
