import streamlit as st

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
        "⬆️ Improved Resume"
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
