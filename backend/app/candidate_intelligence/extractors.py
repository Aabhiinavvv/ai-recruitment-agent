from __future__ import annotations

import io
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import fitz
from docx import Document

from app.candidate_intelligence.schemas import (
    CandidateProfile,
    EducationEntry,
    EvidenceItem,
    ExperienceEntry,
    ExtractedSkill,
    PrivacyMetadata,
    ProjectEntry,
    ResumeNamedEntity,
    ReviewFlag,
)


SKILL_TERMS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "sql", "nosql",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
    "machine learning", "deep learning", "natural language processing", "nlp",
    "computer vision", "opencv", "llm", "large language models", "langchain",
    "langgraph", "rag", "prompt engineering", "hugging face", "transformers",
    "fastapi", "flask", "django", "react", "node.js", "express", "html", "css",
    "tailwind", "streamlit", "gradio", "docker", "kubernetes", "git", "github",
    "linux", "aws", "azure", "gcp", "postgresql", "mysql", "mongodb", "redis",
    "power bi", "tableau", "excel", "matplotlib", "seaborn", "spark", "hadoop",
    "airflow", "mlflow", "xgboost", "lightgbm", "statistics", "data analysis",
    "data visualization", "pyspark", "pydantic", "pytest", "rest api", "graphql",
    "websocket", "microservices", "html5", "css3", "figma", "flutter", "dart",
]
SKILL_ALIASES = {"sklearn": "scikit-learn", "js": "javascript", "ts": "typescript"}


def _extract_pdf(data: bytes) -> tuple[str, list[str], str, list[str]]:
    pages: list[str] = []
    with fitz.open(stream=data, filetype="pdf") as pdf:
        for page in pdf:
            pages.append(page.get_text("text") or "")
    text = "\n\n".join(pages).strip()
    warnings: list[str] = []
    parser = "pymupdf"
    if os.getenv("DOCLING_ENABLED", "false").lower() == "true":
        try:
            from docling.document_converter import DocumentConverter
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "resume.pdf"
                path.write_bytes(data)
                result = DocumentConverter().convert(str(path))
                docling_text = result.document.export_to_markdown().strip()
                if docling_text:
                    text = docling_text
                    parser = "docling+pymupdf"
        except ImportError:
            warnings.append("Docling is not installed; PyMuPDF was used.")
        except Exception as exc:
            warnings.append(f"Docling PDF enhancement failed; PyMuPDF fallback used ({type(exc).__name__}).")
    if sum(len(p.strip()) for p in pages) < 80 and len(text.strip()) < 80:
        ocr_pages = _try_paddle_ocr(data)
        if ocr_pages:
            pages = ocr_pages
            text = "\n\n".join(pages).strip()
            parser = "pymupdf+paddleocr"
        else:
            warnings.append(
                "Little readable text was found. OCR is unavailable or returned no text; "
                "check the scan or enable PaddleOCR."
            )
    elif sum(len(p.strip()) for p in pages) < 80 and parser.startswith("docling"):
        warnings.append(
            "Docling recovered text from this PDF, but PyMuPDF could not provide selectable page text; "
            "evidence excerpts may not include page numbers."
        )
    return text, pages, parser, warnings


def _try_paddle_ocr(pdf_bytes: bytes) -> list[str]:
    """Use PaddleOCR when installed; support the 2.x and 3.x Python interfaces."""
    try:
        import numpy as np
        from paddleocr import PaddleOCR
    except ImportError:
        return []

    pages: list[str] = []
    try:
        engine = PaddleOCR(use_textline_orientation=True, lang="en")
    except TypeError:
        try:
            engine = PaddleOCR(use_angle_cls=True, lang="en")
        except Exception:
            return []

    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf:
            for page in pdf:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                    pix.height, pix.width, pix.n
                )
                page_text: list[str] = []
                try:
                    prediction = engine.predict(input=image)
                    for item in prediction or []:
                        payload: Any = getattr(item, "json", item)
                        if callable(payload):
                            payload = payload()
                        if isinstance(payload, str):
                            import json
                            payload = json.loads(payload)
                        if isinstance(payload, dict):
                            payload = payload.get("res", payload)
                            page_text.extend(str(value) for value in payload.get("rec_texts", []))
                except (AttributeError, TypeError, ValueError):
                    result = engine.ocr(image, cls=True)
                    for block in result or []:
                        for line in block or []:
                            if line and len(line) > 1:
                                page_text.append(str(line[1][0]))
                pages.append("\n".join(page_text))
    except Exception:
        return []
    return pages if any(page.strip() for page in pages) else []


def _extract_docx(data: bytes) -> tuple[str, list[str], str, list[str]]:
    document = Document(io.BytesIO(data))
    parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    text = "\n".join(parts)
    warnings: list[str] = []
    parser = "python-docx"
    if os.getenv("DOCLING_ENABLED", "false").lower() == "true":
        try:
            from docling.document_converter import DocumentConverter
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "resume.docx"
                path.write_bytes(data)
                result = DocumentConverter().convert(str(path))
                docling_text = result.document.export_to_markdown().strip()
                if docling_text:
                    text = docling_text
                    parser = "docling"
        except ImportError:
            warnings.append("Docling is not installed; python-docx was used.")
        except Exception as exc:
            warnings.append(f"Docling enhancement failed; python-docx fallback used ({type(exc).__name__}).")
    return text, [text], parser, warnings


def extract_document(data: bytes, filename: str) -> tuple[str, list[str], str, list[str]]:
    extension = Path(filename).suffix.lower()
    if extension == ".pdf":
        return _extract_pdf(data)
    if extension == ".docx":
        return _extract_docx(data)
    if extension == ".txt":
        text = data.decode("utf-8-sig", errors="replace")
        return text, [text], "utf-8-text", []
    raise ValueError("Unsupported file type. Upload PDF, DOCX or TXT files.")


def _redact_pii(text: str) -> tuple[str, list[str], str]:
    """Prefer Presidio when enabled; always retain a regex safety fallback."""
    if os.getenv("PRESIDIO_ENABLED", "false").lower() == "true":
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_anonymizer import AnonymizerEngine
            analyzer = AnalyzerEngine()
            results = analyzer.analyze(text=text, language="en")
            redacted = AnonymizerEngine().anonymize(text=text, analyzer_results=results)
            entities = sorted({item.entity_type for item in results})
            return redacted.text, entities, "presidio"
        except ImportError:
            pass
        except Exception:
            pass

    rules = [
        ("EMAIL_ADDRESS", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
        ("PHONE_NUMBER", re.compile(r"(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}(?!\d)")),
    ]
    redacted = text
    detected: list[str] = []
    for entity, pattern in rules:
        if pattern.search(redacted):
            detected.append(entity)
            redacted = pattern.sub(f"[{entity}]", redacted)
    return redacted, detected, "regex-fallback"


def _spacy_entities(text: str) -> tuple[list[tuple[str, str]], str, str | None]:
    """Optional spaCy NER. No model download happens automatically."""
    model_name = os.getenv("SPACY_MODEL", "en_core_web_sm")
    try:
        import spacy
        nlp = spacy.load(model_name, disable=["parser", "tagger", "lemmatizer"])
        doc = nlp(text[:100000])
        found: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for entity in doc.ents:
            if entity.label_ in {"ORG", "GPE", "LOC", "DATE"}:
                key = (entity.text.strip(), entity.label_)
                if key[0] and key not in seen:
                    seen.add(key)
                    found.append(key)
        return found[:60], f"spacy:{model_name}", None
    except ImportError:
        return [], "regex-rules", "spaCy is not installed; deterministic extraction rules were used."
    except OSError:
        return [], "regex-rules", f"spaCy model '{model_name}' is not installed; deterministic rules were used."
    except Exception as exc:
        return [], "regex-rules", f"spaCy was unavailable ({type(exc).__name__}); deterministic rules were used."


def _normalise_text(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value).strip()


def _section_lines(text: str, section_names: list[str]) -> list[str]:
    lines = text.splitlines()
    active = False
    out: list[str] = []
    known_headers = {
        "experience", "work experience", "professional experience", "employment",
        "education", "academic background", "projects", "personal projects",
        "skills", "technical skills", "certifications", "summary", "profile",
        "professional summary", "objective", "contact",
    }
    wanted = {name.lower() for name in section_names}
    for line in lines:
        clean = line.strip(" \t•|:-")
        lowered = clean.lower()
        is_header = lowered in known_headers or (
            len(clean) <= 50 and clean.isupper() and any(ch.isalpha() for ch in clean)
        )
        if is_header:
            active = lowered in wanted
            continue
        if active and clean:
            out.append(clean)
    return out


def build_candidate_profile(
    text: str,
    pages: list[str],
    filename: str,
    candidate_id: str,
    parser_used: str,
    parser_warnings: list[str],
) -> tuple[CandidateProfile, list[str]]:
    if len(text.strip()) < 40:
        raise ValueError("Not enough readable text was extracted from this resume.")

    evidence: list[EvidenceItem] = []

    def add_evidence(field: str, quote: str, page_number: int | None = None) -> str:
        clean_quote = _normalise_text(quote)[:500]
        # Evidence should not re-expose direct contact identifiers from surrounding text.
        clean_quote = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[EMAIL_ADDRESS]", clean_quote, flags=re.I)
        clean_quote = re.sub(r"(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}(?!\d)", "[PHONE_NUMBER]", clean_quote)
        if len(clean_quote) < 2:
            return ""
        evidence_id = f"EV-{len(evidence) + 1:04d}"
        evidence.append(EvidenceItem(
            evidence_id=evidence_id, field=field, quote=clean_quote,
            source_file=filename, page_number=page_number,
        ))
        return evidence_id

    def evidence_for(field: str, value: str) -> list[str]:
        needle = value.strip()
        if not needle:
            return []
        for page_index, page_text in enumerate(pages, start=1):
            match = re.search(re.escape(needle), page_text, re.I)
            if match:
                quote = page_text[max(0, match.start() - 100): min(len(page_text), match.end() + 100)]
                return [add_evidence(field, quote, page_index)]
        match = re.search(re.escape(needle), text, re.I)
        if match:
            quote = text[max(0, match.start() - 100): min(len(text), match.end() + 100)]
            return [add_evidence(field, quote)]
        return []

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email_match = re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", text, re.I)
    email = email_match.group(0).lower() if email_match else None
    phone_pattern = re.compile(
        r"(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}(?!\d)"
    )
    phones = list(dict.fromkeys(
        re.sub(r"\s+", " ", m.group(0)).strip()
        for m in phone_pattern.finditer(text)
        if len(re.sub(r"\D", "", m.group(0))) >= 10
    ))[:4]
    if email:
        add_evidence("email", email_match.group(0))
    for phone in phones:
        evidence_for("phone_numbers", phone)

    full_name: str | None = None
    for line in lines[:6]:
        candidate = re.sub(r"\s+", " ", line).strip(" |•")
        if (
            2 <= len(candidate.split()) <= 4 and len(candidate) <= 60
            and not re.search(r"@|https?://|\d|resume|curriculum vitae|phone|email", candidate, re.I)
            and all(re.fullmatch(r"[A-Za-z][A-Za-z.'-]*", part) for part in candidate.split())
        ):
            full_name = candidate
            add_evidence("full_name", candidate)
            break

    location = None
    location_match = re.search(r"(?im)^\s*(?:location|based in|address)\s*[:\-]\s*([^\n|]{2,80})", text)
    if location_match:
        location = _normalise_text(location_match.group(1))
        add_evidence("location", location_match.group(0))

    profile_links = list(dict.fromkeys(re.findall(
        r"https?://(?:www\.)?(?:github\.com|linkedin\.com|gitlab\.com|behance\.net|portfolio\.[\w.-]+)[^\s,)]*",
        text, re.I
    )))[:12]
    for link in profile_links:
        evidence_for("profile_links", link)

    summary_lines = _section_lines(text, ["summary", "profile", "professional summary", "objective"])
    summary = " ".join(summary_lines[:6])[:1200] if summary_lines else None
    if summary:
        add_evidence("summary", " ".join(summary_lines[:3]))

    skills: list[ExtractedSkill] = []
    for term in SKILL_TERMS:
        pattern = re.compile(r"(?<![a-z0-9+#])" + re.escape(term.lower()) + r"(?![a-z0-9+#])", re.I)
        match = pattern.search(text)
        if match:
            canonical = SKILL_ALIASES.get(term, term)
            if any(item.name.lower() == canonical for item in skills):
                continue
            quote = text[max(0, match.start() - 65):min(len(text), match.end() + 65)]
            ev_id = add_evidence("skills", quote)
            skills.append(ExtractedSkill(name=canonical, confidence=0.88, evidence_ids=[ev_id] if ev_id else []))

    experience_lines = _section_lines(text, ["experience", "work experience", "professional experience", "employment"])
    experience: list[ExperienceEntry] = []
    for item in experience_lines[:30]:
        compact = _normalise_text(item)
        if len(compact) < 4:
            continue
        dates = re.search(
            r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*(?:-|–|to)\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b|\b\d{4}\s*(?:-|–|to)\s*(?:Present|Current|\d{4})\b",
            compact, re.I
        )
        ev = add_evidence("work_experience", compact)
        experience.append(ExperienceEntry(raw_entry=compact[:500], date_range=dates.group(0) if dates else None, evidence_ids=[ev] if ev else []))

    education_lines = _section_lines(text, ["education", "academic background"])
    education: list[EducationEntry] = []
    for item in education_lines[:20]:
        compact = _normalise_text(item)
        if len(compact) < 3:
            continue
        ev = add_evidence("education", compact)
        education.append(EducationEntry(raw_entry=compact[:500], evidence_ids=[ev] if ev else []))

    project_lines = _section_lines(text, ["projects", "personal projects"])
    projects: list[ProjectEntry] = []
    for item in project_lines[:30]:
        compact = _normalise_text(item)
        if len(compact) < 5:
            continue
        ev = add_evidence("projects", compact)
        projects.append(ProjectEntry(details=compact[:500], evidence_ids=[ev] if ev else []))

    certification_lines = _section_lines(text, ["certifications"])
    certifications = list(dict.fromkeys(
        _normalise_text(item).strip("•- ") for item in certification_lines[:20]
        if len(_normalise_text(item)) > 3
    ))

    named_entities_raw, nlp_engine, nlp_warning = _spacy_entities(text)
    named_entities: list[ResumeNamedEntity] = []
    for entity_text, label in named_entities_raw:
        ev = evidence_for("named_entity", entity_text)
        named_entities.append(ResumeNamedEntity(text=entity_text, label=label, evidence_ids=ev))

    redacted_text, entities, redaction_engine = _redact_pii(text)
    warnings = list(parser_warnings)
    if nlp_warning:
        warnings.append(nlp_warning)

    flags: list[ReviewFlag] = []
    if not full_name:
        flags.append(ReviewFlag(code="NAME_NOT_DETECTED", message="Name could not be confidently identified.", severity="warning"))
    if not email:
        flags.append(ReviewFlag(code="EMAIL_NOT_DETECTED", message="No email address was detected.", severity="warning"))
    if not skills:
        flags.append(ReviewFlag(code="SKILLS_NOT_DETECTED", message="No skills from the built-in vocabulary were detected; review the source resume.", severity="review"))
    if parser_used.startswith("pymupdf") and not text.strip():
        flags.append(ReviewFlag(code="LOW_TEXT_EXTRACTION", message="The PDF appears to contain no readable text.", severity="review"))
    if not experience_lines:
        flags.append(ReviewFlag(code="EXPERIENCE_SECTION_NOT_DETECTED", message="No recognisable work-experience section was found.", severity="info"))
    if not education_lines:
        flags.append(ReviewFlag(code="EDUCATION_SECTION_NOT_DETECTED", message="No recognisable education section was found.", severity="info"))

    field_confidence = {
        "full_name": 0.95 if full_name else 0.0,
        "email": 0.99 if email else 0.0,
        "phone_numbers": 0.90 if phones else 0.0,
        "location": 0.90 if location else 0.0,
        "skills": 0.85 if skills else 0.0,
        "work_experience": 0.80 if experience else 0.0,
        "education": 0.80 if education else 0.0,
        "projects": 0.75 if projects else 0.0,
    }
    profile = CandidateProfile(
        candidate_id=candidate_id, source_file=filename, full_name=full_name, email=email,
        phone_numbers=phones, location=location,
        headline=lines[1][:160] if len(lines) > 1 and not re.search(r"@|https?://", lines[1]) else None,
        summary=summary, skills=skills, work_experience=experience, education=education,
        projects=projects, certifications=certifications, profile_links=profile_links,
        named_entities=named_entities, nlp_engine=nlp_engine, evidence=evidence,
        field_confidence=field_confidence,
        extraction_status="needs_review" if flags else "parsed", review_flags=flags,
        privacy=PrivacyMetadata(
            redaction_applied=bool(entities), redacted_entities=entities,
            redaction_engine=redaction_engine, redacted_resume_text=redacted_text[:30000],
        ),
    )
    if len(text) > 30000:
        warnings.append("Extracted resume text was truncated to 30,000 characters for profile metadata.")
    return profile, warnings
