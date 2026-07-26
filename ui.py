import base64
import json
import time
from io import BytesIO
import cv2
import numpy as np
import streamlit as st
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase
import av
import streamlit.components.v1 as components

from agents import RecruitmentAgent

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
        self.motion_history = []

    def transform(self, frame):
        img = frame.to_ndarray(format="bgr24")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if self.prev_frame is None:
            self.prev_frame = gray
            return frame

        diff = cv2.absdiff(self.prev_frame, gray)
        motion_score = float(np.mean(diff))
        self.prev_frame = gray
        self.motion_history.append(motion_score)
        self.motion_history = self.motion_history[-12:]

        recent_scores = self.motion_history[-6:]
        repeated_spikes = sum(1 for score in recent_scores if score > 12)
        suspicious = repeated_spikes >= 2 or max(recent_scores) > 22
        if suspicious and (self.last_alert is None or (time.time() - self.last_alert) > 5):
            self.last_alert = time.time()
            success, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if success:
                st.session_state["camera_alert_frame"] = encoded.tobytes()
                st.session_state["camera_alert_caption"] = f"Repeated motion: {round(max(recent_scores), 2)}"
            st.session_state["live_motion_alert"] = round(max(recent_scores), 2)
            st.session_state["motion_history"] = self.motion_history
        return frame


def render_live_camera_component():
    component_html = """
    <div style="border:1px solid #d1d5db; border-radius:10px; overflow:hidden; background:#000;">
      <video id="live-video" autoplay playsinline muted style="width:100%; max-height:320px; display:block; background:#000;"></video>
      <div id="camera-status" style="padding:8px; color:white; background:#111827; font-size:13px;">Requesting camera access…</div>
    </div>
    <script>
      const video = document.getElementById('live-video');
      const status = document.getElementById('camera-status');
      const canvas = document.createElement('canvas');
      let previous = null;
      let lastSent = 0;

      async function startCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
          video.srcObject = stream;
          await video.play();
          status.textContent = 'Camera live. Monitoring motion...';
          setInterval(captureFrame, 800);
        } catch (error) {
          status.textContent = 'Camera access is blocked or unavailable in this browser.';
        }
      }

      function captureFrame() {
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 240;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let diff = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (previous) {
            const prevGray = previous[i / 4];
            diff += Math.abs(gray - prevGray);
          }
        }
        if (previous) {
          const motionScore = Math.min(100, (diff / (data.length / 4)) * 0.35);
          const now = Date.now();
          if (now - lastSent > 700) {
            lastSent = now;
            const frame = canvas.toDataURL('image/jpeg', 0.55);
            const payload = { motionScore: Number(motionScore.toFixed(2)), frame, suspicious: motionScore > 12 };
            if (window.Streamlit && window.Streamlit.setComponentValue) {
              window.Streamlit.setComponentValue(payload);
            }
          }
        }
        previous = Array.from({ length: data.length / 4 }, (_, index) => {
          const i = index * 4;
          return (data[i] + data[i + 1] + data[i + 2]) / 3;
        });
      }

      startCamera();
    </script>
    """
    payload = components.html(component_html, height=360)
    if isinstance(payload, dict):
        return payload
    return {}


def ai_interview_section(agent):
    st.subheader("🎤 Virtual AI Interview Assistant")
    st.caption("The interview assistant asks questions aloud, keeps the webcam live throughout the session, and flags suspicious movements or cheating attempts.")

    if not agent:
        agent = RecruitmentAgent(api_key=None)

    role = st.text_input("Interview Role", value="Software Engineer")
    if "ai_interview_question" not in st.session_state:
        st.session_state.ai_interview_question = None
    if "ai_interview_history" not in st.session_state:
        st.session_state.ai_interview_history = []
    if "live_motion_alert" not in st.session_state:
        st.session_state.live_motion_alert = None
    if "ai_interview_voice_answer" not in st.session_state:
        st.session_state.ai_interview_voice_answer = ""
    if "ai_interview_voice_status" not in st.session_state:
        st.session_state.ai_interview_voice_status = "Waiting"
    if "camera_alert_frame" not in st.session_state:
        st.session_state.camera_alert_frame = None
    if "ai_interview_completed" not in st.session_state:
        st.session_state.ai_interview_completed = False
    if "ai_interview_review" not in st.session_state:
        st.session_state.ai_interview_review = None
    if "motion_history" not in st.session_state:
        st.session_state.motion_history = []

    if st.button("Start Interview"):
        st.session_state.ai_interview_question = agent.generate_interview_question(role)
        st.session_state.ai_interview_history = []
        st.session_state.live_motion_alert = None
        st.session_state.ai_interview_voice_answer = ""
        st.session_state.ai_interview_voice_status = "Waiting"
        st.session_state.camera_alert_frame = None
        st.session_state.ai_interview_completed = False
        st.session_state.ai_interview_review = None
        st.session_state.motion_history = []

    if st.session_state.ai_interview_question:
        st.info(f"Question: {st.session_state.ai_interview_question}")
        st.caption("The assistant is speaking the question and the camera remains active throughout the interview.")

        st.markdown("**Voice response**")
        audio_bytes = st.audio_input("Record your answer", key="ai_interview_audio")
        if audio_bytes:
            st.session_state.ai_interview_voice_answer = "[Voice answer recorded]"
            st.session_state.ai_interview_voice_status = "Voice answer recorded"

        if st.button("Submit Answer") and st.session_state.ai_interview_voice_answer:
            with st.spinner("Scoring your answer..."):
                result = agent.evaluate_interview_answer(st.session_state.ai_interview_question, st.session_state.ai_interview_voice_answer)
            snapshot = agent.build_interview_snapshot(
                question=st.session_state.ai_interview_question,
                answer=st.session_state.ai_interview_voice_answer,
                result=result,
                motion_alert=st.session_state.live_motion_alert,
                voice_answer=st.session_state.ai_interview_voice_answer,
            )
            st.session_state.ai_interview_history.append(snapshot)
            st.session_state.ai_interview_question = agent.generate_interview_question(role)
            st.session_state.ai_interview_voice_answer = ""
            st.session_state.ai_interview_voice_status = "Waiting"
            st.metric("Score", f"{result['score']}/10")
            st.success(result["feedback"])
            if result.get("improvement"):
                st.caption(f"Improvement tip: {result['improvement']}")

        answer = st.text_area(
            "Or type your answer",
            value=st.session_state.ai_interview_voice_answer,
            key="ai_interview_answer_input",
            height=140,
        )
        if answer:
            st.session_state.ai_interview_voice_answer = answer

        if st.button("Skip Question"):
            st.session_state.ai_interview_question = agent.generate_interview_question(role)
            st.session_state.ai_interview_voice_answer = ""
            st.session_state.ai_interview_voice_status = "Waiting"

    if st.session_state.live_motion_alert is not None:
        st.warning(f"Suspicious movement detected: {st.session_state.live_motion_alert}")

    if st.session_state.camera_alert_frame:
        st.image(
            st.session_state.camera_alert_frame,
            caption=st.session_state.get("camera_alert_caption", "Captured suspicious frame"),
            channels="BGR",
        )

    st.markdown("---")
    st.subheader("Live camera")
    st.caption("The camera stays on for the whole interview and is used to detect repeated head/body motion and possible cheating behavior.")
    camera_payload = render_live_camera_component()
    if isinstance(camera_payload, dict):
        motion_score = camera_payload.get("motionScore")
        if motion_score is not None:
            history = list(st.session_state.get("motion_history", []))
            history.append(float(motion_score))
            history = history[-12:]
            st.session_state.motion_history = history
            detection = agent.detect_repeated_motion(history)
            if detection["suspicious"]:
                st.session_state.live_motion_alert = detection["motion_score"]
                frame_value = camera_payload.get("frame")
                if frame_value:
                    image_bytes = base64.b64decode(frame_value.split(",", 1)[1])
                    st.session_state.camera_alert_frame = image_bytes
                    st.session_state.camera_alert_caption = f"Repeated movement detected: {detection['motion_score']:.2f}"

    if st.button("Finish Interview"):
        motion_values = [entry.get("motion_alert") for entry in st.session_state.ai_interview_history if entry.get("motion_alert") is not None]
        if not motion_values and st.session_state.get("motion_history"):
            motion_values = [float(score) for score in st.session_state.motion_history]
        avg_motion = sum(motion_values) / len(motion_values) if motion_values else 0.0
        body_language_score = max(0, min(100, 100 - (avg_motion * 1.2)))
        cheat_flags = "No cheating alert detected." if not st.session_state.camera_alert_frame else "Cheating alert captured and displayed above."
        st.session_state.ai_interview_completed = True
        st.session_state.ai_interview_review = {
            "body_language_score": round(body_language_score, 1),
            "average_motion": round(avg_motion, 2),
            "cheat_flags": cheat_flags,
            "summary": (
                "The interview remained live throughout the session. "
                f"Body-language stability score: {round(body_language_score, 1)}/100. "
                f"Average movement intensity: {round(avg_motion, 2)}."
            ),
        }
        st.rerun()

    if st.session_state.ai_interview_completed and st.session_state.ai_interview_review:
        review = st.session_state.ai_interview_review
        st.markdown("---")
        st.subheader("Interview Review")
        st.success(review["summary"])
        st.metric("Body-language score", f"{review['body_language_score']}/100")
        st.metric("Average motion", f"{review['average_motion']}")
        st.caption(review["cheat_flags"])

    if st.session_state.ai_interview_history:
        st.markdown("---")
        st.subheader("Recent responses")
        for entry in reversed(st.session_state.ai_interview_history[-5:]):
            with st.expander(f"Score {entry['result']['score']}/10"):
                st.markdown(f"**Q:** {entry['question']}")
                st.markdown(f"**A:** {entry['answer']}")
                st.markdown(f"**Feedback:** {entry['result']['feedback']}")
