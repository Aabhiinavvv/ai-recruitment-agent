import re
import io
import json
import os
import tempfile
import ast
from concurrent.futures import ThreadPoolExecutor

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

import pypdf
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
load_dotenv()

class RecruitmentAgent:
    def __init__(self, api_key=None, cutoff_score=75, model=None):
        self.api_key = api_key
        self.cutoff_score = cutoff_score
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        self.resume_text = ""
        self.analysis_results = {}
        self.extracted_skills = []
        self.resume_weaknesses = []
        self.jd_text = ""
        self.resume_file_path = None
        self.improved_resume_path = None

    # ---------------- SAFE LLM ----------------
    def _get_llm(self):
        api_key = self.api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return None
        return ChatGoogleGenerativeAI(
            model=self.model,
            google_api_key=api_key,
            temperature=0.2,
        )

    # ---------------- FILE EXTRACTION ----------------
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
            name = file.name if hasattr(file, "name") else str(file)
            ext = name.split(".")[-1].lower()

            if ext == "pdf":
                return self.extract_text_from_pdf(file)
            elif ext == "txt":
                return self.extract_text_from_text(file)
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
                f"Job description:\n{jd_text}"
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

    def analyze_skills(self, text, skills):
        if not text or not skills:
            return {
                "overall_score": 0,
                "skill_scores": {},
                "missing_skills": [],
                "strengths": [],
                "improvement_areas": [],
                "selected": False,
            }

        vectorstore = self.create_vector_store(text)
        if not vectorstore:
            return {
                "overall_score": 0,
                "skill_scores": {},
                "missing_skills": skills,
                "strengths": [],
                "improvement_areas": skills,
                "selected": False,
            }

        scores = {}
        missing = []
        total = 0

        max_workers = int(os.getenv("MAX_SKILL_WORKERS", "2"))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(lambda s: self._score_skill(vectorstore, s), skills))

        for skill, score in results:
            scores[skill] = score
            total += score
            if score <= 5:
                missing.append(skill)

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

        weaknesses = []

        for skill in self.analysis_results.get("missing_skills", []):
            try:
                prompt = (
                    f"Analyze why this resume is weak in '{skill}'.\n"
                    f"Resume excerpt:\n{self.resume_text[:2000]}\n\n"
                    "Return ONLY valid JSON (no markdown, no extra text):\n"
                    '{"weakness":"...","suggestions":["...","...","..."],"example":"..."}'
                )
                response = llm.invoke(prompt).content.strip()
                response = re.sub(r"```(?:json)?|```", "", response).strip()
                data = json.loads(response)

                weaknesses.append({
                    "skill": skill,
                    "score": self.analysis_results.get("skill_scores", {}).get(skill, 0),
                    "details": data.get("weakness", ""),
                    "suggestions": data.get("suggestions", []),
                    "example": data.get("example", ""),
                })
            except Exception as e:
                print(f"Error analyzing weakness for {skill}: {e}")
                weaknesses.append({
                    "skill": skill,
                    "score": self.analysis_results.get("skill_scores", {}).get(skill, 0),
                    "details": "Could not analyze this weakness.",
                    "suggestions": [],
                    "example": "",
                })

        self.resume_weaknesses = weaknesses
        return weaknesses

    # ---------------- MAIN ANALYZE ----------------
    def analyze_resume(self, file, role=None, role_requirements=None, custom_jd=None):
        self.resume_text = self.extract_text(file)

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

        self.analysis_results = self.analyze_skills(self.resume_text, self.extracted_skills)
        self.analysis_results["weaknesses"] = self.analyze_resume_weaknesses()
        self.analysis_results["detailed_weaknesses"] = self.analysis_results["weaknesses"]

        return self.analysis_results

    # ---------------- Q&A ----------------
    def ask_question(self, question):
        try:
            if not self.resume_text:
                return "Please analyze a resume first."

            vectorstore = self.create_vector_store(self.resume_text)
            if not vectorstore:
                return "Unable to process resume for Q&A."

            chain = self._build_rag_chain(
                vectorstore,
                "You are a helpful assistant that answers questions about a candidate's resume. "
                "Use only the provided context to answer."
            )
            response = chain.invoke({"input": question})
            return response.get("answer", "")
        except Exception as e:
            print(f"Error in ask_question: {e}")
            return "Error answering question. Please try again."

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
