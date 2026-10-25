"""Encrypted, consent-gated local memory shared across recruitment agents."""

import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import uuid
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from cryptography.fernet import Fernet, InvalidToken


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def memory_is_configured() -> bool:
    return bool(os.getenv("CANDIDATE_MEMORY_KEY"))


def _memory_config() -> tuple[Fernet, bytes, Path]:
    key = os.getenv("CANDIDATE_MEMORY_KEY")
    if not key:
        raise RuntimeError(
            "Persistent candidate memory is disabled. Configure CANDIDATE_MEMORY_KEY "
            "with a Fernet key before enabling candidate memory."
        )
    try:
        encoded_key = key.encode("ascii")
        cipher = Fernet(encoded_key)
        key_bytes = base64.urlsafe_b64decode(encoded_key)
        if len(key_bytes) != 32:
            raise ValueError
    except (ValueError, UnicodeEncodeError) as exc:
        raise RuntimeError(
            "CANDIDATE_MEMORY_KEY is invalid. Generate a Fernet key and configure it securely."
        ) from exc

    default_path = Path(__file__).resolve().parent / "data" / "organizational_memory.sqlite3"
    database_path = Path(os.getenv("CANDIDATE_MEMORY_DB", str(default_path))).expanduser()
    return cipher, key_bytes, database_path


def _normalized_email(email: str) -> str:
    if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email.strip()):
        raise ValueError("Enter a valid candidate email to access persistent memory.")
    return email.strip().casefold()


def _lookup_digest(email: str, key_bytes: bytes) -> str:
    lookup_key = hashlib.sha256(key_bytes + b"candidate-memory-lookup-v1").digest()
    return hmac.new(lookup_key, email.encode("utf-8"), hashlib.sha256).hexdigest()


def _connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.execute("PRAGMA secure_delete = ON")
    connection.execute("PRAGMA journal_mode = DELETE")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS candidate_memory (
            memory_id TEXT PRIMARY KEY,
            lookup_digest TEXT NOT NULL UNIQUE,
            encrypted_record BLOB NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    return connection


@contextmanager
def _connection(database_path: Path) -> Iterator[sqlite3.Connection]:
    with closing(_connect(database_path)) as connection:
        with connection:
            yield connection


def find_candidate_history(email: str) -> dict[str, Any] | None:
    normalized_email = _normalized_email(email)
    cipher, key_bytes, database_path = _memory_config()
    digest = _lookup_digest(normalized_email, key_bytes)
    with _connection(database_path) as connection:
        row = connection.execute(
            "SELECT memory_id, encrypted_record FROM candidate_memory WHERE lookup_digest = ?",
            (digest,),
        ).fetchone()
    if row is None:
        return None
    try:
        record = json.loads(cipher.decrypt(row[1]).decode("utf-8"))
    except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Candidate memory could not be decrypted or is corrupted.") from exc
    if record.get("memory_id") != row[0] or record.get("email") != normalized_email:
        raise RuntimeError("Candidate memory identity validation failed.")
    return record


def save_candidate_history(
    email: str,
    candidate: dict[str, Any],
    job: dict[str, Any],
    communications: list[dict[str, Any]] | None = None,
    activity: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if candidate.get("memory_consent") is not True:
        raise ValueError("Candidate consent is required before saving organizational memory.")
    normalized_email = _normalized_email(email)
    cipher, key_bytes, database_path = _memory_config()
    digest = _lookup_digest(normalized_email, key_bytes)
    candidate_snapshot = {
        key: value
        for key, value in candidate.items()
        if key not in {"organizational_memory", "memory_email"}
    }
    candidate_id = candidate_snapshot.get("candidate_id")
    related_activity = [
        event
        for event in (activity or [])
        if candidate_id and candidate_id in str(event.get("subject", ""))
    ]
    snapshot = {
        "job": job,
        "candidate": candidate_snapshot,
        "communications": [
            message
            for message in (communications or [])
            if message.get("candidate_id") == candidate_id
        ],
        "activity": related_activity,
    }
    serialized_snapshot = json.dumps(
        snapshot,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )

    with _connection(database_path) as connection:
        row = connection.execute(
            "SELECT memory_id, encrypted_record FROM candidate_memory WHERE lookup_digest = ?",
            (digest,),
        ).fetchone()
        if row is None:
            memory_id = str(uuid.uuid4())
            record = {
                "memory_id": memory_id,
                "email": normalized_email,
                "history": [],
            }
        else:
            memory_id = row[0]
            try:
                record = json.loads(cipher.decrypt(row[1]).decode("utf-8"))
            except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise RuntimeError("Candidate memory could not be decrypted or is corrupted.") from exc
            if record.get("email") != normalized_email:
                raise RuntimeError("Candidate memory identity validation failed.")

        history = record.setdefault("history", [])
        if not history or history[-1].get("snapshot_json") != serialized_snapshot:
            history.append(
                {
                    "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "snapshot_json": serialized_snapshot,
                }
            )
        record["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        encrypted_record = cipher.encrypt(
            json.dumps(record, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
        )
        connection.execute(
            """
            INSERT INTO candidate_memory (memory_id, lookup_digest, encrypted_record, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(lookup_digest) DO UPDATE SET
                encrypted_record = excluded.encrypted_record,
                updated_at = excluded.updated_at
            """,
            (memory_id, digest, encrypted_record, record["updated_at"]),
        )
    return record


def delete_candidate_history(email: str) -> bool:
    normalized_email = _normalized_email(email)
    _, key_bytes, database_path = _memory_config()
    digest = _lookup_digest(normalized_email, key_bytes)
    with _connection(database_path) as connection:
        cursor = connection.execute(
            "DELETE FROM candidate_memory WHERE lookup_digest = ?",
            (digest,),
        )
        deleted = cursor.rowcount > 0
        connection.commit()
        if deleted:
            connection.execute("VACUUM")
    return deleted
