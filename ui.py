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
    st.markdown("""
    <style>
      #MainMenu, footer, header {visibility: hidden;}
      .stApp { background: #000000; color: #202126; }
      .block-container { max-width: 1480px; padding: 2rem 2.4rem 3rem; }
      [data-testid="stSidebar"] { background: #151719; border: 0; }
      [data-testid="stSidebar"] * { color: #f4f2fa; }
      [data-testid="stSidebar"] .stTextInput input { background: #272a2e; color: white; border-color: #44474d; }
      [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] > div { background: #272a2e; border-color: #44474d; }
      .portal-title { display:flex; align-items:center; justify-content:space-between; margin: 0 0 1.35rem; }
      .portal-title h1 { margin:0; font-size:1.5rem; font-weight:700; letter-spacing:-.03em; }
      .portal-title p { margin: .25rem 0 0; color:#7a7c85; font-size:.92rem; }
      .portal-status { color:#6940e8; background:#eeeaff; border-radius:999px; padding:.45rem .8rem; font-weight:600; font-size:.8rem; }
      .workspace-card, .metric-card { background: #fff; border: 1px solid #e9e9ef; border-radius: 22px; box-shadow: 0 9px 25px rgba(35, 28, 55, .045); }
      .workspace-card { padding: 1.05rem 1.2rem; }
      .metric-card { padding: 1.1rem; min-height: 130px; }
      .metric-card .label { color:#777984; font-size:.8rem; margin-top:.35rem; }
      .metric-card .value { color:#7540eb; font-size:1.7rem; font-weight:750; line-height:1.1; }
      .section-kicker { color:#777984; font-size:.84rem; margin:.15rem 0 .7rem; }
      .question-card { background:linear-gradient(135deg,#6837e6,#8a45f2); color:white; border-radius:18px; padding:1rem 1.2rem; margin:.8rem 0; }
      .question-card small { color:#e6dcff; } .question-card p { font-size:1.05rem; font-weight:600; margin:.35rem 0 0; }
      .chat-bubble { background:#f5f2ff; color:#4e28b1; border-radius:14px 14px 4px 14px; padding:.7rem .85rem; margin:.6rem 0 .6rem auto; max-width:86%; font-size:.9rem; }
      .stButton > button { border:0; border-radius:12px; background:#7440e8; color:white; font-weight:650; min-height:2.65rem; }
      .stButton > button:hover { background:#5d2bca; color:white; border:0; }
      .stTextArea textarea, .stTextInput input { border-radius:12px; border-color:#e2e0e9; }
      [data-testid="stTabs"] [role="tablist"] { gap:.45rem; }
      [data-testid="stTabs"] [role="tab"] { border-radius:10px; padding:.55rem .8rem; background:white; border:1px solid #eceaf1; }
      [data-testid="stTabs"] [aria-selected="true"] { color:#6d3ce4; border-color:#6d3ce4; }
    </style>
    <div class="portal-title">
      <div><h1>InterviewAI</h1><p>Recruit smarter. Interview with confidence.</p></div>
      <div class="portal-status">● Live interview workspace</div>
    </div>
    """, unsafe_allow_html=True)

def setup_sidebar():
    with st.sidebar:
        st.markdown("## ◉ InterviewAI")
        st.caption("AI recruitment portal")
        st.markdown("---")
        st.markdown("**MAIN MENU**")
        st.markdown("⌘ &nbsp; Dashboard")
        st.markdown("▣ &nbsp; **Interview**")
        st.markdown("◌ &nbsp; Insights")
        st.markdown("♙ &nbsp; Talent")
        st.markdown("---")
        st.markdown("**INTERVIEW SETTINGS**")
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


def display_interactive_dashboard(analysis_result=None):
        """Render a polished interactive skill radar + animated bars using Chart.js (no extra Python deps).

        If `analysis_result` contains `skill_scores` it will be used, otherwise a friendly demo dataset
        will be shown so the dashboard looks alive even before analysis.
        """
        # Prepare skill data
        skill_scores = {}
        if analysis_result and isinstance(analysis_result, dict):
                skill_scores = analysis_result.get("skill_scores") or {}

        if not skill_scores:
                # demo data
                skill_scores = {
                        "Python": 9,
                        "Machine Learning": 8,
                        "Data Engineering": 6,
                        "NLP": 7,
                        "DevOps": 5,
                        "System Design": 7,
                }

        # normalize to 0-10
        labels = list(skill_scores.keys())
        values = [min(10, max(0, float(v))) for v in skill_scores.values()]

        payload = {
                "labels": labels,
                "values": values,
        }

        # Nicely styled card + Chart.js radar + bars with toggle
        html = f"""
        <style>
        .hero-card {{
            background: linear-gradient(135deg,#0f172a 0%, #111827 60%);
            color: #e6eef8; border-radius:16px; padding:18px; box-shadow: 0 10px 30px rgba(2,6,23,0.6);
            margin-bottom: 18px; overflow:hidden;
        }}
        .hero-header {{display:flex; align-items:center; justify-content:space-between}}
        .hero-title {{font-size:1.05rem; font-weight:700}}
        .hero-sub {{color:#9aa7bf; font-size:0.9rem}}
        .view-toggle button {{background:#111827;color:#cbd5e1;border:0;padding:8px 12px;margin-left:6px;border-radius:8px;cursor:pointer}}
        .view-toggle button.active {{background:linear-gradient(90deg,#7c3aed,#4f46e5); color:white}}
        </style>
        <div class="hero-card">
            <div class="hero-header">
                <div>
                    <div class="hero-title">Candidate Insights</div>
                    <div class="hero-sub">Interactive skill snapshot — hover metrics, toggle views, and explore.</div>
                </div>
                <div class="view-toggle">
                    <button id="radarBtn" class="active">Radar</button>
                    <button id="barsBtn">Bars</button>
                </div>
            </div>
            <canvas id="skillChart" style="width:100%;height:300px"></canvas>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
        const payload = {json.dumps(payload)};
        const ctx = document.getElementById('skillChart').getContext('2d');

        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true, backgroundColor: '#111827', titleColor: '#e6eef8', bodyColor: '#cbd5e1' }
            }
        };

        const radarConfig = {
            type: 'radar',
            data: {
                labels: payload.labels,
                datasets: [{
                    label: 'Skill level',
                    data: payload.values,
                    backgroundColor: 'rgba(124,58,237,0.18)',
                    borderColor: 'rgba(124,58,237,0.95)',
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointRadius: 5,
                }]
            },
            options: Object.assign({}, baseOptions, {
                scales: {
                    r: { min:0, max:10, grid: {color: 'rgba(255,255,255,0.04)'}, angleLines: {color:'rgba(255,255,255,0.03)'}, ticks:{display:false} }
                }
            })
        };

        const barsConfig = {
            type: 'bar',
            data: {
                labels: payload.labels,
                datasets: [{
                    label: 'Skill level',
                    data: payload.values,
                    backgroundColor: payload.values.map(v => v >= 8 ? 'rgba(34,197,94,0.9)' : 'rgba(124,58,237,0.9)'),
                    borderRadius: 8,
                }]
            },
            options: Object.assign({}, baseOptions, {
                indexAxis: 'y',
                scales: { x: { min:0, max:10, grid:{display:false} }, y: { grid:{display:false} } }
            })
        };

        let chart = new Chart(ctx, radarConfig);

        document.getElementById('radarBtn').addEventListener('click', () => {
            document.getElementById('radarBtn').classList.add('active');
            document.getElementById('barsBtn').classList.remove('active');
            chart.destroy(); chart = new Chart(ctx, radarConfig);
        });
        document.getElementById('barsBtn').addEventListener('click', () => {
            document.getElementById('barsBtn').classList.add('active');
            document.getElementById('radarBtn').classList.remove('active');
            chart.destroy(); chart = new Chart(ctx, barsConfig);
        });

        // tiny animation: pulse the highest skill
        const maxIndex = payload.values.indexOf(Math.max(...payload.values));
        setInterval(() => {
            if (!chart) return;
            const meta = chart.getDatasetMeta(0);
            if (meta && meta.data && meta.data[maxIndex]) {
                meta.data[maxIndex].transition(400).draw();
            }
        }, 2200);
        </script>
        """

        components.html(html, height=360)

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
    st.markdown("<div class='workspace-card'><b>Interview for your selected role</b><div class='section-kicker'>Live AI-led practice session with camera monitoring and real-time feedback.</div></div>", unsafe_allow_html=True)

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

    completed_answers = st.session_state.ai_interview_history
    answer_scores = [item.get("result", {}).get("score", 0) for item in completed_answers]
    interview_score = round((sum(answer_scores) / len(answer_scores)) * 10) if answer_scores else 0
    readiness_score = (st.session_state.get("analysis_result") or {}).get("overall_score", 0)

    workspace_left, workspace_right = st.columns([1.85, 0.85], gap="large")
    with workspace_left:
        st.markdown("**◉ People attending the call** <span style='float:right;color:#7440e8;'>＋ Add participant</span>", unsafe_allow_html=True)
        st.markdown("<div class='section-kicker'>Candidate camera is live during the interview.</div>", unsafe_allow_html=True)
        camera_payload = render_live_camera_component()
    with workspace_right:
        score_a, score_b = st.columns(2)
        with score_a:
            st.markdown(f"<div class='metric-card'><div class='value'>{interview_score}%</div><div class='label'>AI Interview Score</div></div>", unsafe_allow_html=True)
        with score_b:
            st.markdown(f"<div class='metric-card'><div class='value' style='color:#ff935b'>{readiness_score}%</div><div class='label'>Resume Readiness</div></div>", unsafe_allow_html=True)
        st.markdown("<div class='workspace-card' style='margin-top:1rem'><b>Interview chat</b><div class='section-kicker'>Your AI interviewer is ready.</div><div class='chat-bubble'>Welcome! Start the interview when you are ready.</div></div>", unsafe_allow_html=True)

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

    st.markdown("<br>", unsafe_allow_html=True)

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
        st.markdown(f"<div class='question-card'><small>CONVERSATION NOW</small><p>{st.session_state.ai_interview_question}</p></div>", unsafe_allow_html=True)
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
