import streamlit as st
import os

# set_page_config MUST be the very first Streamlit call — only called once here, NOT in ui.py
st.set_page_config(page_title="Recruitment Agent", page_icon=":sparkles:", layout="centered")

import ui
from agents import RecruitmentAgent  # matches class name in agents.py
import atexit

from dotenv import load_dotenv
load_dotenv()

ROLE_REQUIREMENTS = {
    "AI/ML Engineer": [
        "Python", "Machine Learning", "Deep Learning", "Data Analysis", "Model Deployment",
        "Natural Language Processing", "Computer Vision", "Reinforcement Learning", "AI Ethics",
        "Cloud Computing", "MLOPS", "Scikit Learn", "AutoML", "Feature Engineering",
        "Data Engineering", "Hugging Face",
    ],
    "Frontend Engineer": [
        "HTML", "CSS", "JavaScript", "React", "Vue.js", "Angular", "Responsive Design",
        "Cross-Browser Compatibility", "Web Performance Optimization", "Version Control (Git)",
        "UI/UX Design Principles", "Testing and Debugging", "TypeScript", "SASS", "Bootstrap",
        "Tailwind CSS", "GraphQL", "Redux", "Performance Optimization",
    ],
    "Backend Engineer": [
        "Python", "Java", "Node.js", "Ruby", "Go", "Database Management (SQL/NoSQL)",
        "API Development (RESTful, GraphQL)", "Microservices Architecture",
        "Cloud Computing (AWS, Azure, GCP)", "Containerization (Docker, Kubernetes)",
        "Version Control (Git)", "Testing and Debugging", "Spring Boot", "Django", "Flask",
        "Express.js", "Serverless Architecture", "Message Queues (RabbitMQ, Kafka)",
        "Authentication and Authorization",
    ],
    "DevOps Engineer": [
        "Linux/Unix Systems", "Cloud Platforms (AWS, Azure, GCP)",
        "Containerization (Docker, Kubernetes)", "Infrastructure as Code (Terraform, Ansible)",
        "CI/CD Pipelines (Jenkins, GitLab CI)", "Monitoring and Logging (Prometheus, ELK Stack)",
        "Scripting Languages (Python, Bash)", "Version Control (Git)", "Security Best Practices",
        "Networking Concepts", "Configuration Management", "Serverless Architecture",
        "CloudFormation", "Puppet", "Nagios", "Grafana", "Istio", "Service Mesh",
    ],
    "Full Stack Engineer": [
        "Frontend Development (HTML, CSS, JavaScript, React, Vue.js)",
        "Backend Development (Python, Java, Node.js, Ruby, Go)",
        "Database Management (SQL/NoSQL)", "API Development (RESTful, GraphQL)",
        "Cloud Computing (AWS, Azure, GCP)", "Containerization (Docker, Kubernetes)",
        "Version Control (Git)", "Testing and Debugging", "UI/UX Design Principles",
        "Security Best Practices", "TypeScript", "SASS", "Bootstrap", "Tailwind CSS",
        "GraphQL", "Redux", "Performance Optimization", "Spring Boot", "Django", "Flask",
        "Express.js", "Serverless Architecture", "Message Queues (RabbitMQ, Kafka)",
        "Authentication and Authorization",
    ],
    "Product Manager": [
        "Product Strategy", "Market Research", "User Experience (UX) Design",
        "Agile Methodologies", "Project Management", "Data Analysis", "Stakeholder Management",
        "Communication Skills", "Leadership", "Problem-Solving Skills", "Roadmapping",
        "Prioritization", "Metrics and Analytics", "Customer Development",
        "Go-to-Market Strategy", "Cross-Functional Collaboration",
    ],
    "Data Scientist": [
        "Python", "R", "Machine Learning", "Deep Learning", "Data Visualization",
        "Statistical Analysis", "Data Wrangling", "Big Data Technologies (Hadoop, Spark)",
        "Cloud Computing (AWS, Azure, GCP)", "Version Control (Git)", "Testing and Debugging",
        "Scikit Learn", "AutoML", "Feature Engineering", "Data Engineering", "Hugging Face",
        "Natural Language Processing", "Computer Vision", "Reinforcement Learning", "AI Ethics",
    ],
}

# ── Session state defaults ──────────────────────────────────────────────────
if "resume_agent" not in st.session_state:
    st.session_state.resume_agent = None
if "resume_analyzed" not in st.session_state:
    st.session_state.resume_analyzed = False
if "analysis_result" not in st.session_state:
    st.session_state.analysis_result = None


# ── Agent setup ─────────────────────────────────────────────────────────────
def setup_agent(config):
    """Initialise (or update) the RecruitmentAgent in session state."""
    api_key = (
        config.get("gemini_api_key")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )
    if not api_key:
        st.error("Please enter your Gemini API key in the sidebar or set GEMINI_API_KEY in .env.")
        return None

    if st.session_state.resume_agent is None:
        st.session_state.resume_agent = RecruitmentAgent(
            api_key=api_key,
            cutoff_score=config.get("cutoff_score", 75),
            model=config.get("gemini_model"),
        )
    else:
        st.session_state.resume_agent.api_key = api_key
        st.session_state.resume_agent.cutoff_score = config.get("cutoff_score", 75)
        st.session_state.resume_agent.model = config.get("gemini_model")

    return st.session_state.resume_agent


# ── Core action helpers ──────────────────────────────────────────────────────
def analyze_resume(agent, resume_file, role, custom_jd):
    if not resume_file:
        st.error("Please upload a resume file to analyze.")
        return None
    if not role:
        st.error("Please select a job role to analyze against.")
        return None

    try:
        with st.spinner("Analyzing resume…"):
            if custom_jd:
                result = agent.analyze_resume(resume_file, role=role, custom_jd=custom_jd)
            else:
                result = agent.analyze_resume(
                    resume_file,
                    role=role,
                    role_requirements=ROLE_REQUIREMENTS.get(role, []),
                )
        st.session_state.resume_analyzed = True
        st.session_state.analysis_result = result
        return result
    except Exception as e:
        st.error(f"Error analyzing resume: {e}")
        return None


def ask_question(agent, question):
    # FIX: this function was referenced in a lambda but never defined
    try:
        return agent.ask_question(question)
    except Exception as e:
        st.error(f"Error answering question: {e}")
        return ""


def generate_interview_questions(agent, question_types, difficulty, num_questions):
    # FIX: signature now matches agents.py (types, difficulty, num_questions)
    try:
        with st.spinner("Generating interview questions…"):
            return agent.generate_interview_questions(question_types, difficulty, num_questions)
    except Exception as e:
        st.error(f"Error generating questions: {e}")
        return []


def improve_resume(agent, improvement_areas, target_role):
    try:
        with st.spinner("Generating resume improvement suggestions…"):
            return agent.improve_resume(improvement_areas, target_role)
    except Exception as e:
        st.error(f"Error improving resume: {e}")
        return {}


def get_improved_resume(agent, target_role, highlighted_skills):
    try:
        with st.spinner("Generating improved resume…"):
            return agent.get_improved_resume(target_role, highlighted_skills)
    except Exception as e:
        st.error(f"Error generating improved resume: {e}")
        return None


# ── Cleanup ──────────────────────────────────────────────────────────────────
def cleanup():
    if st.session_state.get("resume_agent"):
        st.session_state.resume_agent.cleanup()


atexit.register(cleanup)


# ── Main app ─────────────────────────────────────────────────────────────────
def main():
    # NOTE: ui.setup_page() must NOT call st.set_page_config — it's already called above.
    ui.display_header()
    config = ui.setup_sidebar()
    agent = setup_agent(config)
    tabs = ui.create_tabs()

    # ── Tab 0: Resume Analysis ───────────────────────────────────────────────
    with tabs[0]:
        role, custom_jd = ui.role_selection_section(ROLE_REQUIREMENTS)
        uploaded_resume = ui.resume_upload_section()

        col1, col2, col3 = st.columns([1, 1, 1])
        with col2:
            if st.button("Analyze Resume", use_container_width=True):
                if agent and uploaded_resume:
                    result = analyze_resume(agent, uploaded_resume, role, custom_jd)
                    if result:
                        ui.display_analysis_result(result, type="primary")

        # Persist result across reruns
        if st.session_state.analysis_result:
            ui.display_analysis_result(st.session_state.analysis_result, type="primary")

    # ── Tab 1: Q&A ───────────────────────────────────────────────────────────
    with tabs[1]:
        if st.session_state.resume_analyzed and st.session_state.analysis_result:
            ui.resume_qa_section(
                has_resume=True,
                ask_question_func=lambda q: ask_question(st.session_state.resume_agent, q),
            )
        else:
            st.warning("Please analyze a resume first to enable the Q&A section.")

    # ── Tab 2: Interview Questions ───────────────────────────────────────────
    with tabs[2]:
        if st.session_state.resume_analyzed and st.session_state.resume_agent:
            ui.interview_question_section(
                has_resume=True,
                generate_question_func=lambda types, diff, num: generate_interview_questions(
                    st.session_state.resume_agent, types, diff, num
                ),
            )
        else:
            st.warning(
                "Please analyze a resume first to enable the interview question generation section."
            )

    # ── Tab 3: Resume Improvement ────────────────────────────────────────────
    with tabs[3]:
        if st.session_state.resume_analyzed and st.session_state.analysis_result:
            ui.resume_improvement_section(
                has_resume=True,
                improve_resume_func=lambda areas, r: improve_resume(
                    st.session_state.resume_agent, areas, r
                ),
            )
        else:
            st.warning(
                "Please analyze a resume first to enable the resume improvement section."
            )

    # ── Tab 4: Improved Resume ───────────────────────────────────────────────
    with tabs[4]:
        if st.session_state.resume_analyzed and st.session_state.resume_agent:
            ui.improved_resume_section(
                has_resume=True,
                get_improved_resume_func=lambda r, skills: get_improved_resume(
                    st.session_state.resume_agent, r, skills
                ),
            )
        else:
            st.warning(
                "Please upload and analyze a resume first in the 'Resume Analysis' tab."
            )


if __name__ == "__main__":
    main()
