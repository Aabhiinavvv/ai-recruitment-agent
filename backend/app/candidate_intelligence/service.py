from __future__ import annotations

import hashlib
import uuid

from app.candidate_intelligence.extractors import build_candidate_profile, extract_document
from app.candidate_intelligence.schemas import CandidateIntelligenceBatchResponse, ResumeFileResult


MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES_PER_BATCH = 15
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


async def process_resume_batch(files, consent_confirmed: bool) -> CandidateIntelligenceBatchResponse:
    if not consent_confirmed:
        raise ValueError("Candidate consent must be confirmed before resume processing.")
    if not files:
        raise ValueError("Upload at least one resume.")
    if len(files) > MAX_FILES_PER_BATCH:
        raise ValueError(f"A batch can contain at most {MAX_FILES_PER_BATCH} files.")

    results: list[ResumeFileResult] = []
    seen_hashes: dict[str, str] = {}

    for upload in files:
        filename = upload.filename or "unnamed-resume"
        try:
            if not filename:
                raise ValueError("Filename is missing.")
            extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if extension not in ALLOWED_EXTENSIONS:
                raise ValueError("Unsupported file type. Allowed: PDF, DOCX, TXT.")
            data = await upload.read(MAX_FILE_BYTES + 1)
            if not data:
                raise ValueError("The uploaded file is empty.")
            if len(data) > MAX_FILE_BYTES:
                raise ValueError("File exceeds the 10 MB per-resume limit.")
            digest = hashlib.sha256(data).hexdigest()
            if digest in seen_hashes:
                results.append(ResumeFileResult(
                    file_name=filename,
                    success=False,
                    error=f"Duplicate file content detected; identical to {seen_hashes[digest]}.",
                ))
                continue
            seen_hashes[digest] = filename

            text, pages, parser, warnings = extract_document(data, filename)
            profile, profile_warnings = build_candidate_profile(
                text=text,
                pages=pages,
                filename=filename,
                candidate_id="CAND-" + uuid.uuid4().hex[:12].upper(),
                parser_used=parser,
                parser_warnings=warnings,
            )
            results.append(ResumeFileResult(
                file_name=filename,
                success=True,
                parser_used=parser,
                candidate_profile=profile,
                warnings=profile_warnings,
            ))
        except Exception as exc:
            results.append(ResumeFileResult(
                file_name=filename,
                success=False,
                error=str(exc) if isinstance(exc, ValueError) else (
                    f"Could not process this document ({type(exc).__name__})."
                ),
            ))
        finally:
            await upload.close()

    succeeded = sum(1 for result in results if result.success)
    return CandidateIntelligenceBatchResponse(
        processed_count=len(results),
        succeeded_count=succeeded,
        failed_count=len(results) - succeeded,
        consent_confirmed=True,
        results=results,
    )
