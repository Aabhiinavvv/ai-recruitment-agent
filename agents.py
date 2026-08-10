import re
import io
import json
import os
import ast
import hashlib
import tempfile
import smtplib
import urllib.request
import urllib.parse
import ssl
from email.message import EmailMessage

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

import pypdf
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
load_dotenv()

MAX_RESUME_CHARS_FOR_SCORING = 3600
MAX_SKILLS_FOR_FAST_ANALYSIS = 14
MAX_JD_CHARS_FOR_SKILL_EXTRACTION = 5000
MAX_RESUME_CHARS_FOR_WEAKNESS = 3500
MAX_RESUME_CHARS_FOR_QA = 4500

class RecruitmentAgent:
    def __init__(self, api_key=None, cutoff_score=75, model=None):
        self.api_key = api_key
        self.cutoff_score = cutoff_score
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        self.resume_text = ""
        self.resume_profile = ""
        self.analysis_results = {}
        self.extracted_skills = []
        self.resume_weaknesses = []
        self.jd_text = ""
        self.resume_file_path = None
        self.improved_resume_path = None
        self.vectorstore = None
        self._resume_signature = None
        self._text_cache = {}
        self._vectorstore_signature = None
        self._llm = None
        self._llm_config = None
        self.alert_email_to = os.getenv("ALERT_EMAIL_TO") or os.getenv("EMAIL_ALERT_TO")
        self.alert_email_from = os.getenv("ALERT_EMAIL_FROM") or os.getenv("EMAIL_ALERT_FROM")
        self.alert_smtp_host = os.getenv("ALERT_SMTP_HOST") or os.getenv("EMAIL_SMTP_HOST")
        self.alert_smtp_port = int(os.getenv("ALERT_SMTP_PORT") or os.getenv("EMAIL_SMTP_PORT") or 587)
        self.alert_smtp_username = os.getenv("ALERT_SMTP_USERNAME") or os.getenv("EMAIL_SMTP_USERNAME")
        self.alert_smtp_password = os.getenv("ALERT_SMTP_PASSWORD") or os.getenv("EMAIL_SMTP_PASSWORD")
        self.alert_telegram_token = os.getenv("ALERT_TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
        self.alert_telegram_chat = os.getenv("ALERT_TELEGRAM_CHAT_ID") or os.getenv("TELEGRAM_CHAT_ID")
        self.alert_webhook_url = os.getenv("ALERT_WEBHOOK_URL") or os.getenv("WHATSAPP_WEBHOOK_URL")

    def _get_llm(self):
        api_key = self.api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return None
        config = (api_key, self.model)
        if self._llm is None or self._llm_config != config:
            self._llm = ChatGoogleGenerativeAI(
                model=self.model,
                google_api_key=api_key,
                temperature=0.2,
                max_output_tokens=1024,
            )
            self._llm_config = config
        return self._llm

    def _parse_json_response(self, response_text, default):
        try:
            cleaned = re.sub(r"```(?:json)?|```", "", str(response_text)).strip()
            return json.loads(cleaned)
        except Exception:
            try:
                match = re.search(r"(\{.*\}|\[.*\])", str(response_text), re.DOTALL)
                if match:
                    return json.loads(match.group(0))
            except Exception:
                pass
        return default

    # ---------------- FILE EXTRACTION ----------------
    def _get_file_signature(self, file):
        try:
            name = file.name if hasattr(file, "name") else str(file)
            if hasattr(file, "getvalue"):
                content = file.getvalue()
            else:
                with open(file, "rb") as f:
                    content = f.read()
            digest = hashlib.sha256(content).hexdigest()
            return f"{name}:{digest}"
        except Exception:
            return None

    def extract_text_from_pdf(self, file):
        try:
            if hasattr(file, "getvalue"):
                reader = pypdf.PdfReader(io.BytesIO(file.getvalue()))
            else:
                reader = pypdf.PdfReader(file)

            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text.strip()

        except Exception as e:
            print(f"Error extracting PDF: {e}")
            return ""

    def extract_text_from_text(self, file):
        try:
            if hasattr(file, "getvalue"):
                return file.getvalue().decode("utf-8").strip()
            else:
                with open(file, "r", encoding="utf-8") as f:
                    return f.read().strip()
        except Exception as e:
            print(f"Error extracting text file: {e}")
            return ""

    def extract_text(self, file):
        try:
            signature = self._get_file_signature(file)
            if signature and signature in self._text_cache:
                return self._text_cache[signature]

            name = file.name if hasattr(file, "name") else str(file)
            ext = name.split(".")[-1].lower()

            if ext == "pdf":
                text = self.extract_text_from_pdf(file)
            elif ext == "txt":
                text = self.extract_text_from_text(file)
            else:
                text = ""

            if signature:
                self._text_cache[signature] = text
            return text
        except Exception as e:
            print(f"Error extracting text: {e}")

        return ""

    # ---------------- SKILL EXTRACTION FROM JD ----------------
    def extract_skills_from_jd(self, jd_text):
        llm = self._get_llm()
        if not llm or not jd_text:
            return []
        try:
            prompt = (
                "Extract the key skills required for the job from the following job description.\n"
                "Return ONLY a valid Python list of strings, no explanation, no markdown.\n\n"
                f"Job description:\n{jd_text[:MAX_JD_CHARS_FOR_SKILL_EXTRACTION]}"
            )
            response = llm.invoke(prompt).content
            match = re.search(r"\[.*\]", response, re.DOTALL)
            if match:
                parsed = ast.literal_eval(match.group(0))
                if isinstance(parsed, list):
                    return [str(s).strip() for s in parsed if s]
        except Exception as e:
            print(f"Error extracting skills from JD: {e}")
        return []

    # ---------------- VECTOR STORE ----------------
    def create_vector_store(self, text):
        try:
            if not text:
                return None
            signature = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if self.vectorstore is not None and self._vectorstore_signature == signature:
                return self.vectorstore

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_text(text)
            if not chunks:
                return None
            api_key = self.api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                return None
            embeddings = GoogleGenerativeAIEmbeddings(
                model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
                google_api_key=api_key,
            )
            vectorstore = FAISS.from_texts(chunks, embeddings)
            self.vectorstore = vectorstore
            self._vectorstore_signature = signature
            return vectorstore
        except Exception as e:
            print(f"Error creating vector store: {e}")
        return None

    # ---------------- BUILD RAG CHAIN (no langchain.chains) ----------------
    def _build_rag_chain(self, vectorstore, system_prompt: str):
        """Build a retrieval chain using LCEL — no langchain.chains needed."""
        llm = self._get_llm()
        retriever = vectorstore.as_retriever()

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt + "\n\nContext:\n{context}"),
            ("human", "{input}"),
        ])

        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        # LCEL chain: retrieve → format → prompt → llm → parse
        chain = (
            {
                "context": retriever | format_docs,
                "input": RunnablePassthrough(),
            }
            | prompt
            | llm
            | StrOutputParser()
        )

        # Wrap so callers can still do chain.invoke({"input": ...})
        # and get back {"answer": "..."}
        class ChainWrapper:
            def __init__(self, chain):
                self._chain = chain

            def invoke(self, input_dict):
                answer = self._chain.invoke(input_dict.get("input", ""))
                return {"answer": answer}

        return ChainWrapper(chain)

    # ---------------- SKILL SCORING ----------------
    def _score_skill(self, vectorstore, skill):
        try:
            chain = self._build_rag_chain(
                vectorstore,
                "You are a resume analyst. Answer questions about the candidate's skills based on the resume."
            )
            response = chain.invoke({
                "input": (
                    f"Rate the candidate's proficiency in '{skill}' out of 10. "
                    "Reply with a single integer between 0 and 10 only."
                )
            })
            text = response.get("answer", "")
            match = re.search(r"\d+", str(text))
            score = int(match.group()) if match else 0
            return skill, min(score, 10)
        except Exception:
            return skill, 0

    def _keyword_skill_score(self, text, skill):
        text_lower = text.lower()
        words = [w for w in re.split(r"[^a-zA-Z0-9+#.]+", skill.lower()) if len(w) > 1]
        if not words:
            return 0
        matched = sum(1 for word in words if word in text_lower)
        if skill.lower() in text_lower:
            return 8
        if matched == len(words):
            return 7
        if matched:
            return 4
        return 0

    def _build_resume_profile(self, text, skills):
        """Create a small, readable resume summary without making an LLM request."""
        if not text:
            return ""

        section_aliases = {
            "skills": ("skill", "technology", "technical"),
            "experience": ("experience", "employment", "work history", "professional"),
            "projects": ("project", "portfolio"),
            "education": ("education", "academic", "qualification"),
            "certifications": ("certification", "certificate", "training"),
        }
        section_limits = {
            "skills": 700,
            "experience": 1500,
            "projects": 800,
            "education": 350,
            "certifications": 300,
            "other": 450,
        }
        section_order = ("skills", "experience", "projects", "education", "certifications", "other")
        grouped = {section: [] for section in section_order}
        current_section = "other"
        skill_terms = {
            term.lower() for skill in skills
            for term in re.findall(r"[A-Za-z0-9+#.]{2,}", skill)
        }

        for raw_line in text.splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if not line:
                continue
            normalized = line.lower().strip(": -|")
            heading = next(
                (name for name, aliases in section_aliases.items()
                 if len(normalized) <= 45 and any(alias in normalized for alias in aliases)),
                None,
            )
            if heading:
                current_section = heading
                continue
            grouped[current_section].append(line)

        profile_parts = []
        for section in section_order:
            lines = grouped[section]
            if not lines:
                continue
            limit = section_limits[section]
            selected = []
            used = 0
            for line in lines:
                line_lower = line.lower()
                relevant = section == "skills" or any(term in line_lower for term in skill_terms)
                meaningful = relevant or bool(re.search(r"\b\d+(?:%|\+)?\b", line)) or line.startswith(("-", "•", "*"))
                if not meaningful and selected:
                    continue
                remaining = limit - used
                if remaining <= 0:
                    break
                selected_line = line[:remaining]
                selected.append(selected_line)
                used += len(selected_line) + 1
            if selected:
                profile_parts.append(f"{section.title()}:\n" + "\n".join(selected))

        profile = "\n\n".join(profile_parts)
        return profile[:MAX_RESUME_CHARS_FOR_SCORING] or text[:MAX_RESUME_CHARS_FOR_SCORING]

    def analyze_skills(self, text, skills, keyword_text=None):
        if not text or not skills:
            return {
                "overall_score": 0,
                "skill_scores": {},
                "missing_skills": [],
                "strengths": [],
                "improvement_areas": [],
                "selected": False,
            }

        scores = {}
        keyword_text = keyword_text or text
        llm = self._get_llm()
        llm_scored_skills = skills[:MAX_SKILLS_FOR_FAST_ANALYSIS]

        if llm:
            try:
                prompt = (
                    "Score this resume against the required skills. "
                    "Use evidence from the resume only. "
                    "Return ONLY valid JSON where each key is exactly one skill name "
                    "and each value is an integer from 0 to 10.\n\n"
                    f"Required skills:\n{json.dumps(llm_scored_skills)}\n\n"
                    f"Resume:\n{text[:MAX_RESUME_CHARS_FOR_SCORING]}"
                )
                parsed = self._parse_json_response(llm.invoke(prompt).content, {})
                if isinstance(parsed, dict):
                    for skill in llm_scored_skills:
                        try:
                            scores[skill] = max(0, min(10, int(parsed.get(skill, 0))))
                        except Exception:
                            scores[skill] = 0
            except Exception as e:
                print(f"Batch skill scoring failed: {e}")

        if not scores:
            scores = {skill: self._keyword_skill_score(keyword_text, skill) for skill in skills}
        else:
            for skill in skills:
                if skill not in scores:
                    scores[skill] = self._keyword_skill_score(keyword_text, skill)

        missing = [skill for skill, score in scores.items() if score <= 5]
        total = sum(scores.values())

        overall = int((total / (10 * len(skills))) * 100) if skills else 0
        strengths = [s for s, v in scores.items() if v >= 7]
        selected = overall >= self.cutoff_score

        return {
            "overall_score": overall,
            "skill_scores": scores,
            "missing_skills": missing,
            "strengths": strengths,
            "improvement_areas": missing if not selected else [],
            "selected": selected,
        }

    # ---------------- WEAKNESS ANALYSIS ----------------
    def analyze_resume_weaknesses(self):
        llm = self._get_llm()
        if not llm or not self.analysis_results:
            return []

        missing_skills = self.analysis_results.get("missing_skills", [])
        if not missing_skills:
            self.resume_weaknesses = []
            return []

        weaknesses = []
        try:
            prompt = (
                "Analyze the resume weaknesses for the missing or weak skills. "
                "Return ONLY valid JSON as a list. Each item must contain: "
                'skill, weakness, suggestions, example.\n\n'
                f"Skills:\n{json.dumps(missing_skills)}\n\n"
                f"Resume excerpt:\n{self.resume_text[:MAX_RESUME_CHARS_FOR_WEAKNESS]}"
            )
            data = self._parse_json_response(llm.invoke(prompt).content, [])
            if not isinstance(data, list):
                data = []

            by_skill = {
                str(item.get("skill", "")).lower(): item
                for item in data
                if isinstance(item, dict)
            }

            for skill in missing_skills:
                item = by_skill.get(skill.lower(), {})
                weaknesses.append({
                    "skill": skill,
                    "score": self.analysis_results.get("skill_scores", {}).get(skill, 0),
                    "details": item.get("weakness", "Add clearer resume evidence for this skill."),
                    "suggestions": item.get("suggestions", []),
                    "example": item.get("example", ""),
                })
        except Exception as e:
            print(f"Batch weakness analysis failed: {e}")
            for skill in missing_skills:
                weaknesses.append({
                    "skill": skill,
                    "score": self.analysis_results.get("skill_scores", {}).get(skill, 0),
                    "details": "Add clearer resume evidence for this skill.",
                    "suggestions": [],
                    "example": "",
                })

        self.resume_weaknesses = weaknesses
        return weaknesses

    # ---------------- AI INTERVIEW HELPERS ----------------
    def generate_interview_question(self, role=None):
        llm = self._get_llm()
        if llm:
            try:
                prompt = (
                    "Generate one practical interview question for a candidate. "
                    "Return only the question text."
                )
                if role:
                    prompt += f" The role is {role}."
                question = str(llm.invoke(prompt).content).strip()
                if question:
                    return question
            except Exception as e:
                print(f"Interview question generation failed: {e}")

        defaults = [
            "Tell me about a project where you solved a difficult problem.",
            "What would you do if a production issue appeared during deployment?",
            "Describe a time you had to learn a new technology quickly.",
        ]
        return defaults[0]

    def build_interview_snapshot(self, question, answer, result=None, motion_alert=None, voice_answer=None):
        return {
            "question": question,
            "answer": answer,
            "voice_answer": voice_answer or answer,
            "result": result or {},
            "motion_alert": motion_alert,
        }

    def evaluate_interview_answer(self, question, answer):
        llm = self._get_llm()
        if llm and answer:
            try:
                prompt = (
                    "Evaluate the interview answer strictly and briefly. "
                    "Return ONLY valid JSON with keys: score, feedback, strengths, improvement. "
                    f"Question: {question}\nAnswer: {answer}"
                )
                parsed = self._parse_json_response(llm.invoke(prompt).content, {})
                if isinstance(parsed, dict):
                    score = parsed.get("score", 0)
                    if isinstance(score, str):
                        try:
                            score = int(re.search(r"\d+", score).group())
                        except Exception:
                            score = 0
                    return {
                        "score": max(0, min(10, int(score))),
                        "feedback": str(parsed.get("feedback") or "Good effort, please add more specifics."),
                        "strengths": parsed.get("strengths") or [],
                        "improvement": parsed.get("improvement") or "Add a concrete example and a measurable outcome.",
                    }
            except Exception as e:
                print(f"Interview answer evaluation failed: {e}")

        text = " ".join(str(answer or "").lower().split())
        score = 2
        if len(text) > 20:
            score += 2
        if any(word in text for word in ["i", "have", "built", "worked", "developed", "led", "designed", "used"]):
            score += 2
        if any(word in text for word in ["team", "project", "customer", "data", "python", "api", "cloud", "deploy", "test"]):
            score += 2
        if len(text.split()) > 12:
            score += 2
        score = max(0, min(10, score))
        feedback = "Good attempt. Add a concrete example and explain the impact of your contribution."
        if score >= 7:
            feedback = "Strong answer. It is specific and shows relevant experience."
        elif score <= 3:
            feedback = "This answer is too brief. Add more detail about your actions and the outcome."
        return {
            "score": score,
            "feedback": feedback,
            "strengths": ["Relevant experience mentioned"],
            "improvement": "Include a specific project example, your role, and the measurable result.",
        }

    def detect_motion(self, frame_before, frame_after):
        if not frame_before or not frame_after:
            return 0.0
        try:
            from PIL import Image
            import io

            img1 = Image.open(io.BytesIO(frame_before)).convert("L")
            img2 = Image.open(io.BytesIO(frame_after)).convert("L")
            if img1.size != img2.size:
                return 100.0

            data1 = list(img1.getdata())
            data2 = list(img2.getdata())
            diff = sum(abs(a - b) for a, b in zip(data1, data2)) / max(1, len(data1))
            return round(min(100.0, diff / 2.55), 2)
        except Exception:
            hash1 = hashlib.sha256(frame_before).hexdigest()
            hash2 = hashlib.sha256(frame_after).hexdigest()
            return 100.0 if hash1 != hash2 else 0.0

    def send_alert(self, reason, details):
        message = f"AI Interview Alert: {reason}\n\n{details}"
        results = []

        if self.alert_email_to and self.alert_email_from and self.alert_smtp_host:
            try:
                msg = EmailMessage()
                msg["Subject"] = "AI Interview Alert"
                msg["From"] = self.alert_email_from
                msg["To"] = self.alert_email_to
                msg.set_content(message)
                context = ssl.create_default_context()
                with smtplib.SMTP(self.alert_smtp_host, self.alert_smtp_port) as server:
                    if self.alert_smtp_username and self.alert_smtp_password:
                        server.starttls(context=context)
                        server.login(self.alert_smtp_username, self.alert_smtp_password)
                    server.send_message(msg)
                results.append("email")
            except Exception as e:
                print(f"Email alert failed: {e}")

        if self.alert_telegram_token and self.alert_telegram_chat:
            try:
                payload = urllib.parse.urlencode({"chat_id": self.alert_telegram_chat, "text": message})
                req = urllib.request.Request(
                    f"https://api.telegram.org/bot{self.alert_telegram_token}/sendMessage",
                    data=payload.encode("utf-8"),
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status < 400:
                        results.append("telegram")
            except Exception as e:
                print(f"Telegram alert failed: {e}")

        if self.alert_webhook_url:
            try:
                data = json.dumps({"text": message}).encode("utf-8")
                req = urllib.request.Request(self.alert_webhook_url, data=data, method="POST")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status < 400:
                        results.append("webhook")
            except Exception as e:
                print(f"Webhook alert failed: {e}")

        return results

    def detect_repeated_motion(self, motion_scores, threshold=12.0, repeated_count=2):
        if not motion_scores:
            return {
                "suspicious": False,
                "motion_score": 0.0,
                "repeated_spikes": 0,
            }

        recent_scores = [float(score) for score in motion_scores[-6:]]
        high_scores = [score for score in recent_scores if score >= threshold]
        repeated_spikes = len(high_scores)
        suspicious = repeated_spikes >= repeated_count or max(recent_scores) >= 25.0
        return {
            "suspicious": suspicious,
            "motion_score": round(max(recent_scores), 2),
            "repeated_spikes": repeated_spikes,
        }

    def flag_suspicious_behavior(self, frame_before, frame_after, context=None):
        motion_score = self.detect_motion(frame_before, frame_after)
        suspicious = motion_score > 8.0
        if suspicious:
            self.send_alert(
                "Suspicious movement detected",
                f"The interview camera detected a motion score of {motion_score:.2f}. Context: {context or 'Unknown'}",
            )
        return {
            "suspicious": suspicious,
            "motion_score": motion_score,
        }

    # ---------------- MAIN ANALYZE ----------------
    def analyze_resume(self, file, role=None, role_requirements=None, custom_jd=None):
        new_signature = self._get_file_signature(file)
        self.resume_text = self.extract_text(file)
        if new_signature != self._resume_signature:
            self.vectorstore = None
            self._vectorstore_signature = None
        self._resume_signature = new_signature
        self.resume_weaknesses = []

        try:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".txt", mode="w", encoding="utf-8"
            ) as tmp:
                tmp.write(self.resume_text)
                self.resume_file_path = tmp.name
        except Exception:
            pass

        if custom_jd:
            if hasattr(custom_jd, "name"):
                self.jd_text = self.extract_text(custom_jd)
            else:
                self.jd_text = str(custom_jd)
            self.extracted_skills = self.extract_skills_from_jd(self.jd_text)
        else:
            self.extracted_skills = role_requirements or []

        self.resume_profile = self._build_resume_profile(
            self.resume_text, self.extracted_skills
        )
        self.analysis_results = self.analyze_skills(
            self.resume_profile,
            self.extracted_skills,
            keyword_text=self.resume_text,
        )
        self.analysis_results["weaknesses"] = []
        self.analysis_results["detailed_weaknesses"] = []
        self.analysis_results["analysis_note"] = (
            "Fast analysis sends Gemini a compact resume profile and uses local keyword scoring for the rest. "
            "Generate detailed weakness analysis only when needed."
        )

        return self.analysis_results

    def generate_detailed_weaknesses(self):
        weaknesses = self.analyze_resume_weaknesses()
        if self.analysis_results is not None:
            self.analysis_results["weaknesses"] = weaknesses
            self.analysis_results["detailed_weaknesses"] = weaknesses
        return weaknesses

    # ---------------- Q&A ----------------
    def _select_resume_context(self, question):
        """Choose relevant resume passages locally, avoiding a slow embedding API call."""
        if len(self.resume_text) <= MAX_RESUME_CHARS_FOR_QA:
            return self.resume_text

        chunks = RecursiveCharacterTextSplitter(
            chunk_size=1200, chunk_overlap=150
        ).split_text(self.resume_text)
        keywords = {
            word.lower() for word in re.findall(r"[A-Za-z0-9+#.]{3,}", question)
        }

        def relevance(chunk):
            chunk_lower = chunk.lower()
            return sum(keyword in chunk_lower for keyword in keywords)

        ranked = sorted(enumerate(chunks), key=lambda item: (-relevance(item[1]), item[0]))
        selected = []
        total_chars = 0
        for _, chunk in ranked:
            if total_chars + len(chunk) > MAX_RESUME_CHARS_FOR_QA:
                continue
            selected.append(chunk)
            total_chars += len(chunk)
            if total_chars >= MAX_RESUME_CHARS_FOR_QA:
                break
        return "\n\n".join(selected) or self.resume_text[:MAX_RESUME_CHARS_FOR_QA]

    def ask_question(self, question):
        try:
            if not self.resume_text:
                return "Please analyze a resume first."
            llm = self._get_llm()
            if not llm:
                return "Gemini is not configured. Add a valid API key and try again."

            context = self._select_resume_context(question)
            prompt = (
                "Answer the question using only the resume context below. "
                "If the resume does not contain the answer, say so clearly. "
                "Keep the answer concise.\n\n"
                f"Resume context:\n{context}\n\nQuestion: {question}"
            )
            return str(llm.invoke(prompt).content).strip()
        except Exception as e:
            print(f"Error in ask_question: {e}")
            return "Unable to answer right now. Please verify your Gemini API key and try again."

    # ---------------- INTERVIEW QUESTIONS ----------------
    def generate_interview_questions(self, question_types, difficulty, num_questions=5):
        llm = self._get_llm()
        if not llm:
            return []

        try:
            context = ""
            if self.resume_text:
                context = f"\nResume excerpt:\n{self.resume_text[:1500]}\n"
            if self.extracted_skills:
                context += f"\nKey skills: {', '.join(self.extracted_skills[:15])}\n"
            if self.analysis_results:
                context += f"\nStrengths: {', '.join(self.analysis_results.get('strengths', []))}\n"
                context += f"\nAreas to probe: {', '.join(self.analysis_results.get('missing_skills', []))}\n"

            prompt = (
                f"Generate exactly {num_questions} interview questions.\n"
                f"Difficulty: {difficulty}\n"
                f"Question types to include: {', '.join(question_types)}\n"
                f"{context}\n"
                "Format each question as a tuple on its own line:\n"
                '("Question Type", "Full question text")\n'
                "Return only the tuples, nothing else."
                )            

            response = llm.invoke(prompt).content

            questions = []
            pattern = r'\(\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
            matches = re.findall(pattern, response, re.DOTALL)

            for q_type, q_text in matches:
                matched_type = next(
                    (t for t in question_types if t.lower() in q_type.lower()),
                    q_type.strip()
                )
                questions.append((matched_type, q_text.strip()))

            if not questions:
                for line in response.split("\n"):
                    line = line.strip()
                    if line:
                        questions.append(("General", line))

            return questions[:num_questions]

        except Exception as e:
            print(f"Error generating interview questions: {e}")
            return []

    # ---------------- IMPROVE RESUME ----------------
    def improve_resume(self, areas, role=None):
        llm = self._get_llm()
        if not llm:
            return {area: {"description": "LLM unavailable.", "specific": []} for area in areas}

        try:
            weakness_context = ""
            if self.resume_weaknesses:
                lines = []
                for w in self.resume_weaknesses:
                    lines.append(f"- {w['skill']}: {w['details']}")
                    for s in w.get("suggestions", []):
                        lines.append(f"  • {s}")
                weakness_context = "Identified weaknesses:\n" + "\n".join(lines)

            prompt = (
                f"The candidate is targeting the role: {role or 'not specified'}.\n"
                f"Resume excerpt:\n{self.resume_text[:2000]}\n\n"
                f"{weakness_context}\n\n"
                f"For each of the following improvement areas, provide structured advice.\n"
                f"Areas: {', '.join(areas)}\n\n"
                "Return ONLY valid JSON (no markdown) with this structure:\n"
                "{\n"
                '  "Area Name": {\n'
                '    "description": "What needs improvement",\n'
                '    "specific": ["action 1", "action 2", "action 3"]\n'
                "  }\n"
                "}"
            )
            response = llm.invoke(prompt).content.strip()
            response = re.sub(r"```(?:json)?|```", "", response).strip()

            try:
                improvements = json.loads(response)
            except json.JSONDecodeError:
                improvements = {}

            for area in areas:
                if area not in improvements:
                    improvements[area] = {
                        "description": f"General improvement needed in {area}.",
                        "specific": ["Review and enhance this section."],
                    }

            return improvements

        except Exception as e:
            print(f"Error in improve_resume: {e}")
            return {
                area: {"description": "Error generating suggestions.", "specific": []}
                for area in areas
            }

    # ---------------- IMPROVED RESUME ----------------
    def get_improved_resume(self, role="", highlight_skills=""):
        llm = self._get_llm()
        if not llm:
            return None

        try:
            if isinstance(highlight_skills, str) and highlight_skills.strip():
                if len(highlight_skills) > 100:
                    skills_to_highlight = self.extract_skills_from_jd(highlight_skills)
                    if not skills_to_highlight:
                        skills_to_highlight = [s.strip() for s in highlight_skills.split(",") if s.strip()]
                else:
                    skills_to_highlight = [s.strip() for s in highlight_skills.split(",") if s.strip()]
            elif isinstance(highlight_skills, list):
                skills_to_highlight = highlight_skills
            else:
                skills_to_highlight = []

            if not skills_to_highlight and self.analysis_results:
                skills_to_highlight = (
                    self.analysis_results.get("missing_skills", []) +
                    self.analysis_results.get("strengths", [])
                )

            weakness_context = ""
            if self.resume_weaknesses:
                lines = [f"- {w['skill']}: {w['details']}" for w in self.resume_weaknesses]
                weakness_context = "Weaknesses to address:\n" + "\n".join(lines)

            prompt = (
                f"Rewrite and improve the following resume for the role: {role or 'not specified'}.\n"
                f"Skills to highlight (in priority order): {', '.join(skills_to_highlight)}\n"
                f"{weakness_context}\n\n"
                "Instructions:\n"
                "1. Add quantifiable achievements where possible.\n"
                "2. Strategically highlight the listed skills for ATS scanning.\n"
                "3. Use clear section headings and professional formatting.\n"
                "4. Use industry-standard terminology.\n"
                "5. Return only the improved resume text, no explanations.\n\n"
                f"Original resume:\n{self.resume_text}"
            )

            improved = llm.invoke(prompt).content.strip()

            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".txt", mode="w", encoding="utf-8"
            ) as f:
                f.write(improved)
                self.improved_resume_path = f.name

            return self.improved_resume_path

        except Exception as e:
            print(f"Error generating improved resume: {e}")
            return None

    # ---------------- CLEANUP ----------------
    def cleanup(self):
        for path_attr in ("resume_file_path", "improved_resume_path"):
            path = getattr(self, path_attr, None)
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print(f"Cleanup error for {path}: {e}")
