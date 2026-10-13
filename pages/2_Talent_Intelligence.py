import streamlit as st

from recruitment_core.matching import CandidateProfile, JobCriteria, score_candidate
from recruitment_core.memory import CandidateMemory

st.set_page_config(page_title="Talent Intelligence", page_icon="🎯", layout="wide")
st.title("🎯 Talent Intelligence")
st.caption("Research MVP · evidence-based matching · persistent memory with consent · human-reviewed decisions")

st.warning(
    "Decision-support prototype only. A match score is not a hiring decision. "
    "Review candidate evidence, use consistent job-related criteria, and make final decisions through a human reviewer."
)

with st.sidebar:
    st.subheader("Job criteria")
    role_title = st.text_input("Role title", "Data Analyst")
    required_raw = st.text_area("Required skills (comma-separated)", "Python, SQL, Data Analysis")
    preferred_raw = st.text_area("Preferred skills (comma-separated)", "Power BI, Statistics")
    minimum_experience = st.number_input("Minimum relevant experience (years)", min_value=0.0, max_value=50.0, value=0.0, step=0.5)
    skill_weight = st.slider("Skill importance", 0, 100, 75)
    experience_weight = 100 - skill_weight

def parse_skills(raw):
    return [item.strip() for item in raw.split(",") if item.strip()]

job = JobCriteria(
    role_title=role_title.strip() or "Unspecified role",
    required_skills=parse_skills(required_raw),
    preferred_skills=parse_skills(preferred_raw),
    minimum_experience_years=float(minimum_experience),
    skill_weight=float(skill_weight),
    experience_weight=float(experience_weight),
)

left, right = st.columns(2)
with left:
    st.subheader("Candidate profile")
    candidate_id = st.text_input("Candidate reference / pseudonymous ID", "candidate-demo-001")
    candidate_skills_raw = st.text_area("Candidate-listed skills (comma-separated)", "Python, SQL, Excel")
    years = st.number_input("Relevant experience (years)", min_value=0.0, max_value=60.0, value=1.0, step=0.5)
    evidence_notes = st.text_area("Evidence notes (optional)", "Add portfolio, project, certification, or resume section references.")
with right:
    st.subheader("How scoring works")
    st.markdown(
        "- Required skills contribute 80% of the skill subscore when preferred skills are also defined.\n"
        "- Preferred skills contribute the remaining 20%.\n"
        "- Skill and experience subscores are combined using the weights in the sidebar.\n"
        "- Missing information is a verification gap, not proof that a candidate lacks a skill.\n"
        "- Protected/sensitive attributes are not accepted as scoring inputs."
    )

if st.button("Evaluate role match", type="primary", use_container_width=True):
    candidate_skills = parse_skills(candidate_skills_raw)
    evidence = {skill: evidence_notes for skill in candidate_skills if evidence_notes.strip()}
    candidate = CandidateProfile(
        candidate_id=candidate_id.strip() or "anonymous",
        skills=candidate_skills,
        experience_years=float(years),
        evidence=evidence,
    )
    result = score_candidate(candidate, job)
    st.session_state["talent_match_result"] = {
        "candidate_id": result.candidate_id,
        "role_title": result.role_title,
        "score": result.score,
        "matched_required_skills": result.matched_required_skills,
        "missing_required_skills": result.missing_required_skills,
        "matched_preferred_skills": result.matched_preferred_skills,
        "experience_score": result.experience_score,
        "explanation": result.explanation,
    }
    st.session_state["talent_match_skills"] = candidate_skills

result = st.session_state.get("talent_match_result")
if result:
    st.divider()
    st.subheader("Explainable match result")
    metric_col, exp_col = st.columns([1, 2])
    with metric_col:
        st.metric("Preliminary match score", f"{result['score']:.1f}/100")
        st.caption("Not a probability of job success.")
        st.metric("Experience subscore", f"{result['experience_score']:.1f}/100")
    with exp_col:
        st.info(result["explanation"])
        st.markdown("**Matched required skills**")
        st.write(", ".join(result["matched_required_skills"]) or "No required skills matched / none specified.")
        st.markdown("**Skills to verify**")
        st.write(", ".join(result["missing_required_skills"]) or "No required-skill gaps identified from the supplied list.")
        st.markdown("**Matched preferred skills**")
        st.write(", ".join(result["matched_preferred_skills"]) or "None identified.")

    st.subheader("Candidate memory")
    st.caption("Prototype stores structured summaries in a local SQLite database. Only record history when the candidate has been informed and the required consent/lawful basis has been obtained.")
    consent = st.checkbox("I confirm the required candidate consent/lawful basis has been obtained for storing this history.")
    outcome = st.selectbox("Workflow status to record", ["Reviewed by recruiter", "Interview invited", "Interview completed", "Hold for further evidence"])
    notes = st.text_input("Recruiter note (job-related only)", "")
    if st.button("Save candidate history", disabled=not consent):
        try:
            memory = CandidateMemory()
            memory.record(
                candidate_id=result["candidate_id"],
                role_title=result["role_title"],
                skills=st.session_state.get("talent_match_skills", []),
                outcome=outcome,
                consent=consent,
                notes=notes,
            )
            st.success("Candidate history saved.")
        except Exception as exc:
            st.error(f"Could not save history: {exc}")

    history_id = st.text_input("Look up candidate history by reference", result["candidate_id"], key="history_lookup")
    if st.button("Load history"):
        try:
            st.session_state["talent_history"] = CandidateMemory().history(history_id)
            st.session_state["talent_history_id"] = history_id
        except Exception as exc:
            st.error(f"Could not load history: {exc}")
    if "talent_history" in st.session_state:
        st.markdown("**History for candidate:** " + str(st.session_state.get("talent_history_id", "")))
        if st.session_state["talent_history"]:
            st.dataframe(st.session_state["talent_history"], use_container_width=True, hide_index=True)
        else:
            st.caption("No stored history found.")
        if st.button("Delete all history for this candidate"):
            try:
                deleted = CandidateMemory().delete_candidate(st.session_state.get("talent_history_id", ""))
                st.session_state["talent_history"] = []
                st.success(f"Deleted {deleted} record(s).")
            except Exception as exc:
                st.error(f"Could not delete history: {exc}")

st.divider()
st.caption("Research next step: benchmark this rubric against recruiter-labelled examples, then compare with keyword, embedding, and LLM-only baselines. Do not use demo scores for real hiring.")
