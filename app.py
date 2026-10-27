import streamlit as st
import asyncio
import os




def ensure_event_loop():
    """Provide an event loop for libraries imported by Streamlit's script thread."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())


ensure_event_loop()

# set_page_config MUST be the very first Streamlit call — only called once here, NOT in ui.py
st.set_page_config(page_title="AI Recruitment Workflow", page_icon=":sparkles:", layout="wide")

from agents import RecruitmentAgent  # matches class name in agents.py
import atexit
import ui
from workflow import RecruitmentWorkflow

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
        "Tailwind CSS", "Redux","GraphQL", "Performance Optimization",
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
        "CloudFormation",  "Nagios","Puppet", "Grafana", "Istio", "Service Mesh",
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
    provider = config.get("llm_provider", "Groq")
    api_key = config.get("llm_api_key")
    if not api_key:
        if provider == "Groq":
            api_key = os.getenv("GROQ_API_KEY")
        else:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        st.error(
            f"Enter your {provider} API key in the sidebar or configure the matching "
            "environment variable in .env."
        )
        return None

    if st.session_state.resume_agent is None:
        st.session_state.resume_agent = RecruitmentWorkflow(
            RecruitmentAgent(
                api_key=api_key,
                cutoff_score=config.get("cutoff_score", 75),
                model=config.get("llm_model"),
                provider=provider,
            )
        )
    else:
        st.session_state.resume_agent.configure(
            api_key=api_key,
            cutoff_score=config.get("cutoff_score", 75),
            model=config.get("llm_model"),
            provider=provider,
        )

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


def generate_detailed_weaknesses(agent):
    try:
        with st.spinner("Generating detailed weakness analysis..."):
            weaknesses = agent.generate_detailed_weaknesses()
        st.session_state.analysis_result = agent.analysis_results
        return weaknesses
    except Exception as e:
        st.error(f"Error generating detailed weakness analysis: {e}")
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


def resolve_human_review(agent, action):
    try:
        return agent.approve_or_reject(action)
    except Exception as e:
        st.error(f"Error recording recruiter decision: {e}")
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
    setup_agent(config)
    tabs = ui.create_tabs()

    with tabs[0]:
        ui.hiring_workflow_section(st.session_state.resume_agent)

    with tabs[1]:
        ui.ai_interview_section(st.session_state.resume_agent)

    with tabs[2]:
        ui.platform_architecture_section()


if __name__ == "__main__":
    main()
