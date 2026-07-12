import time
import cv2
import numpy as np
import streamlit as st
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase
import av

def display_header():
    st.title("🤖 Recruitment Agent")
    st.markdown("AI-powered resume analysis and interview preparation tool.")

def setup_sidebar():
    with st.sidebar:
        st.header("⚙️ Configuration")
        api_key = st.text_input(
            "Gemini API Key",
            type="password",
            placeholder="Leave blank to use .env",
        )
        gemini_model = st.selectbox(
            "Gemini Model",
            ["gemini-2.5-flash", "gemini-2.5-pro"],
            index=0,
        )
        st.markdown("---")
        cutoff_score = st.slider("Selection Cutoff Score", min_value=0, max_value=100, value=75)
    return {
        "gemini_api_key": api_key,
        "gemini_model": gemini_model,
        "cutoff_score": cutoff_score,
    }

def create_tabs():
    return st.tabs([
        "📄 Resume Analysis",
        "💬 Q&A",
        "🎯 Interview Questions",
        "✍️ Resume Improvement",
        "⬆️ Improved Resume",
        "🎤 AI Interview"
    ])

def role_selection_section(role_requirements):
    st.subheader("Job Role Selection")
    roles = list(role_requirements.keys())
    role = st.selectbox("Select Job Role", roles)
    custom_jd = st.file_uploader("Or upload a custom Job Description (optional)", type=["pdf", "txt"])
    return role, custom_jd

def resume_upload_section():
    st.subheader("Upload Resume")
    return st.file_uploader("Upload Resume (PDF or TXT)", type=["pdf", "txt"])

def display_analysis_result(result, type="primary"):
    if not result:
        return

    score = result.get("overall_score", 0)
    selected = result.get("selected", False)

    st.markdown("---")
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Overall Score", f"{score}%")
    with col2:
        if selected:
            st.success("✅ Selected")
        else:
            st.error("❌ Not Selected")

    analysis_note = result.get("analysis_note")
    if analysis_note:
        st.caption(analysis_note)

    skill_scores = result.get("skill_scores", {})
    if skill_scores:
        st.subheader("Skill Scores")
        for skill, score in skill_scores.items():
            st.progress(score / 10, text=f"{skill}: {score}/10")

    strengths = result.get("strengths", [])
    if strengths:
        st.subheader("💪 Strengths")
        for s in strengths:
            st.markdown(f"- ✅ {s}")

    missing = result.get("missing_skills", [])
    if missing:
        st.subheader("⚠️ Missing / Weak Skills")
        for s in missing:
            st.markdown(f"- ❌ {s}")

    weaknesses = result.get("detailed_weaknesses", [])
    if weaknesses:
        st.subheader("🔍 Detailed Weakness Analysis")
        for w in weaknesses:
            with st.expander(f"{w['skill']} (Score: {w.get('score', 0)}/10)"):
                st.markdown(f"**Issue:** {w.get('details', '')}")
                suggestions = w.get("suggestions", [])
                if suggestions:
                    st.markdown("**Suggestions:**")
                    for s in suggestions:
                        st.markdown(f"- {s}")
                example = w.get("example", "")
                if example:
                    st.markdown(f"**Example addition:** `{example}`")

def resume_qa_section(has_resume, ask_question_func):
    st.subheader("💬 Ask Questions About the Resume")
    question = st.text_input("Enter your question")
    if st.button("Ask") and question:
        with st.spinner("Thinking..."):
            answer = ask_question_func(question)
        st.markdown(f"**Answer:** {answer}")

def interview_question_section(has_resume, generate_question_func):
    st.subheader("🎯 Generate Interview Questions")

    question_types = st.multiselect(
        "Question Types",
        ["Technical", "Behavioral", "Situational", "Coding"],
        default=["Technical", "Behavioral"]
    )
    difficulty = st.selectbox("Difficulty", ["Easy", "Medium", "Hard"])
    num_questions = st.slider("Number of Questions", 1, 10, 5)

    if st.button("Generate Questions"):
        questions = generate_question_func(question_types, difficulty, num_questions)
        if questions:
            for i, (q_type, q_text) in enumerate(questions, 1):
                with st.expander(f"Q{i}. [{q_type}]"):
                    st.markdown(q_text)
        else:
            st.warning("No questions generated. Please try again.")

def resume_improvement_section(has_resume, improve_resume_func):
    st.subheader("✍️ Resume Improvement Suggestions")

    improvement_areas = st.multiselect(
        "Select areas to improve",
        ["Skills Highlighting", "Work Experience", "Education", "Summary", "Formatting"],
        default=["Skills Highlighting", "Work Experience"]
    )
    target_role = st.text_input("Target Role (optional)")

    if st.button("Get Improvement Suggestions"):
        improvements = improve_resume_func(improvement_areas, target_role)
        if improvements:
            for area, details in improvements.items():
                with st.expander(f"📌 {area}"):
                    st.markdown(f"**Overview:** {details.get('description', '')}")
                    specifics = details.get("specific", [])
                    if specifics:
                        st.markdown("**Action Items:**")
                        for item in specifics:
                            st.markdown(f"- {item}")

def improved_resume_section(has_resume, get_improved_resume_func):
    st.subheader("⬆️ Generate Improved Resume")

    target_role = st.text_input("Target Role")
    highlight_skills = st.text_area("Skills to Highlight (comma-separated or paste JD)")

    if st.button("Generate Improved Resume"):
        path = get_improved_resume_func(target_role, highlight_skills)
        if path:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            st.text_area("Improved Resume", content, height=400)
            st.download_button("⬇️ Download", content, file_name="improved_resume.txt")
        else:
            st.error("Failed to generate improved resume.")


class MotionDetector(VideoTransformerBase):
    def __init__(self):
        self.prev_frame = None
        self.last_alert = None

    def transform(self, frame):
        img = frame.to_ndarray(format="bgr24")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if self.prev_frame is None:
            self.prev_frame = gray
            return frame

        diff = cv2.absdiff(self.prev_frame, gray)
        motion_score = float(np.mean(diff))
        self.prev_frame = gray
        if motion_score > 25 and (self.last_alert is None or (time.time() - self.last_alert) > 5):
            self.last_alert = time.time()
            st.session_state["live_motion_alert"] = round(motion_score, 2)
        return frame


def ai_interview_section(agent):
    st.subheader("🎤 AI Interview Coach")
    st.caption("The assistant asks a question, scores each answer, and monitors the camera for suspicious movement.")

    if not agent:
        st.warning("Connect your Gemini API key in the sidebar to enable interview coaching.")
        return

    role = st.text_input("Interview Role", value="Software Engineer")
    if "ai_interview_question" not in st.session_state:
        st.session_state.ai_interview_question = None
    if "ai_interview_history" not in st.session_state:
        st.session_state.ai_interview_history = []
    if "live_motion_alert" not in st.session_state:
        st.session_state.live_motion_alert = None

    if st.button("Start Interview"):
        st.session_state.ai_interview_question = agent.generate_interview_question(role)
        st.session_state.ai_interview_history = []
        st.session_state.live_motion_alert = None

    if st.session_state.ai_interview_question:
        st.info(f"Question: {st.session_state.ai_interview_question}")

        answer = st.text_area("Your answer")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Submit Answer") and answer:
                with st.spinner("Scoring your answer..."):
                    result = agent.evaluate_interview_answer(st.session_state.ai_interview_question, answer)
                st.session_state.ai_interview_history.append({
                    "question": st.session_state.ai_interview_question,
                    "answer": answer,
                    "result": result,
                })
                st.session_state.ai_interview_question = agent.generate_interview_question(role)
                st.metric("Score", f"{result['score']}/10")
                st.success(result["feedback"])
                if result.get("improvement"):
                    st.caption(f"Improvement tip: {result['improvement']}")

        with col2:
            if st.button("Skip Question"):
                st.session_state.ai_interview_question = agent.generate_interview_question(role)

    if st.session_state.live_motion_alert is not None:
        st.warning(f"Suspicious movement detected: {st.session_state.live_motion_alert}")

    st.markdown("---")
    st.subheader("Live camera")
    webrtc_streamer(
        key="ai-interview-camera",
        video_transformer_factory=MotionDetector,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

    if st.session_state.ai_interview_history:
        st.markdown("---")
        st.subheader("Recent responses")
        for entry in reversed(st.session_state.ai_interview_history[-5:]):
            with st.expander(f"Score {entry['result']['score']}/10"):
                st.markdown(f"**Q:** {entry['question']}")
                st.markdown(f"**A:** {entry['answer']}")
                st.markdown(f"**Feedback:** {entry['result']['feedback']}")

    st.markdown("---")
    st.subheader("Cheating / movement check")
    st.caption("Upload two frames from the camera to estimate sudden movement and trigger an alert.")
    before_frame = st.file_uploader("Frame before", type=["png", "jpg", "jpeg"], key="before_frame")
    after_frame = st.file_uploader("Frame after", type=["png", "jpg", "jpeg"], key="after_frame")
    if st.button("Check Movement") and before_frame and after_frame:
        with st.spinner("Inspecting movement..."):
            detection = agent.flag_suspicious_behavior(before_frame.getvalue(), after_frame.getvalue(), context=role)
        if detection["suspicious"]:
            st.warning(f"Suspicious movement detected with score {detection['motion_score']:.2f}.")
            st.info("An alert has been sent if email/Telegram/WhatsApp webhook settings are configured.")
        else:
            st.success(f"Movement score: {detection['motion_score']:.2f}. No suspicious movement detected.")
