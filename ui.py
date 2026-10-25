import base64
import html
import json
import os
import re
import time
from datetime import date, timedelta
from io import BytesIO
import cv2
import numpy as np
import streamlit as st
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase
import av
import streamlit.components.v1 as components

from agents import RecruitmentAgent
from agent_runtime import execute_candidate_preparation
from live_speech import live_speech_recognition
from hiring_pipeline import (
    DOCUMENT_VALIDATION_TYPES,
    ONBOARDING_STATUSES,
    ONBOARDING_TASKS,
    VERIFICATION_CHECKS,
    append_audit_event,
    build_candidate_profile_sources,
    build_workforce_graph,
    create_interview_invitation_draft,
    create_rejection_message_draft,
    rank_candidates,
    summarize_hiring_funnel,
    record_final_hiring_decision,
    record_recruiter_decision,
    record_round_decision,
)
from organizational_memory import (
    delete_candidate_history,
    find_candidate_history,
    memory_is_configured,
    save_candidate_history,
)
from platform_architecture import PLATFORM_FLOW, PLATFORM_LAYERS

def display_header():
    st.markdown("""
    <style>
      #MainMenu, footer, header {visibility: hidden;}
      .stApp { background: #f4f7fb; color: #1f2937; }
      .block-container { max-width: 1480px; padding: 2rem 2.4rem 3rem; }
      [data-testid="stSidebar"] { background: #ffffff; border-right: 1px solid #e5e7eb; }
      [data-testid="stSidebar"] * { color: #1f2937; }
      [data-testid="stSidebar"] .stTextInput input { background: #f9fafb; color: #111827; border-color: #d1d5db; }
      [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] > div { background: #f9fafb; border-color: #d1d5db; }
      .portal-title { display:flex; align-items:center; justify-content:space-between; margin: 0 0 1.35rem; }
      .portal-title h1 { margin:0; font-size:1.5rem; font-weight:700; letter-spacing:-.03em; color:#111827; }
      .portal-title p { margin: .25rem 0 0; color:#6b7280; font-size:.92rem; }
      .portal-status { color:#5b43d6; background:#f0ebff; border-radius:999px; padding:.45rem .8rem; font-weight:600; font-size:.8rem; }
      .workspace-card, .metric-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 22px; box-shadow: 0 8px 20px rgba(15, 23, 42, .05); }
      .workspace-card { padding: 1.05rem 1.2rem; }
      .metric-card { padding: 1.1rem; min-height: 130px; }
      .metric-card .label { color:#6b7280; font-size:.8rem; margin-top:.35rem; }
      .metric-card .value { color:#5b43d6; font-size:1.7rem; font-weight:750; line-height:1.1; }
      .section-kicker { color:#6b7280; font-size:.84rem; margin:.15rem 0 .7rem; }
      .question-card { background:linear-gradient(135deg,#6d5ef5,#8a72ff); color:white; border-radius:18px; padding:1rem 1.2rem; margin:.8rem 0; }
      .question-card small { color:#e8e3ff; } .question-card p { font-size:1.05rem; font-weight:600; margin:.35rem 0 0; }
      .chat-bubble { background:#f3f0ff; color:#4c3fb6; border-radius:14px 14px 4px 14px; padding:.7rem .85rem; margin:.6rem 0 .6rem auto; max-width:86%; font-size:.9rem; }
      .stButton > button { border:0; border-radius:12px; background:#6743ee; color:white; font-weight:650; min-height:2.65rem; }
      .stButton > button:hover { background:#5637d2; color:white; border:0; }
      .stTextArea textarea, .stTextInput input { border-radius:12px; border-color:#d1d5db; background:#ffffff; color:#111827; }
      [data-testid="stTabs"] [role="tablist"] { gap:.45rem; }
      [data-testid="stTabs"] [role="tab"] { border-radius:10px; padding:.55rem .8rem; background:white; border:1px solid #e5e7eb; color:#374151; }
      [data-testid="stTabs"] [aria-selected="true"] { color:#5b43d6; border-color:#5b43d6; background:#f3f0ff; }
    </style>
    <div class="portal-title">
      <div><h1>HireOS</h1><p>One workspace for every hiring stage.</p></div>
      <div class="portal-status">● Live interview workspace</div>
    </div>
    """, unsafe_allow_html=True)

def setup_sidebar():
    with st.sidebar:
        st.markdown("## ◉ HireOS")
        st.caption("Company hiring workspace")
        st.markdown("---")
        st.markdown("**MAIN MENU**")
        st.markdown("⌘ &nbsp; Dashboard")
        st.markdown("▣ &nbsp; **Interview**")
        st.markdown("◌ &nbsp; Insights")
        st.markdown("♙ &nbsp; Talent")
        st.markdown("---")
        st.markdown("**AI BRAIN**")
        provider_options = ["Groq", "Gemini"]
        default_provider = "Groq" if os.getenv("GROQ_API_KEY") else "Gemini"
        provider = st.selectbox(
            "LLM Provider",
            provider_options,
            index=provider_options.index(default_provider),
        )
        api_key = st.text_input(
            f"{provider} API Key",
            type="password",
            placeholder=f"Leave blank to use {provider.upper()}_API_KEY in .env",
        )
        if provider == "Groq":
            model = st.selectbox(
                "Groq Model",
                ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
                index=0,
            )
        else:
            model = st.selectbox(
                "Gemini Model",
                ["gemini-2.5-flash", "gemini-2.5-pro"],
                index=0,
            )
        st.markdown("---")
        cutoff_score = st.slider("Selection Cutoff Score", min_value=0, max_value=100, value=75)
    return {
        "llm_provider": provider,
        "llm_api_key": api_key,
        "llm_model": model,
        "cutoff_score": cutoff_score,
    }

def create_tabs():
    # Put the employer's core workflow first; individual resume utilities remain available below.
    return st.tabs([
        "🧭 Hiring Workflow",
        "📣 Sourcing & Integrations",
        "📄 Resume Screening",
        "🎯 Interview Studio",
        "🎤 Interview Review",
        "💬 Candidate Q&A",
        "👥 Employee HR Help",
        "🏗️ Architecture",
        "✍️ Resume Improvement",
        "⬆️ Improved Resume",
    ])


def platform_architecture_section():
    st.subheader("Four-layer hiring platform")
    st.caption(
        "A recruiter-supervised architecture: agents coordinate work, memory supplies "
        "consented context, reasoning produces evidence-based guidance, and execution "
        "records only approved actions."
    )
    flow = ["digraph HiringPlatform {", '  graph [rankdir="TB", bgcolor="transparent"];']
    flow.append('  node [shape="box", style="rounded,filled", fontname="Arial", fontsize=11];')
    flow.append('  edge [fontname="Arial", fontsize=9, color="#64748b"];')
    colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#ede9fe"]
    layer_nodes = []
    for layer, color in zip(PLATFORM_LAYERS, colors):
        node_id = layer["id"]
        layer_nodes.append(node_id)
        label = json.dumps(f"Layer {layer['number']}\n{layer['name']}")
        flow.append(
            f"  {node_id} [label={label}, fillcolor={json.dumps(color)}];"
        )
    flow.append('  human [label="Recruiter approval\\nrequired for high-impact actions", fillcolor="#fee2e2"];')
    flow.append(f"  {layer_nodes[0]} -> {layer_nodes[1]};")
    flow.append(f"  {layer_nodes[1]} -> {layer_nodes[2]};")
    flow.append(f"  {layer_nodes[2]} -> human;")
    flow.append(f"  human -> {layer_nodes[3]};")
    flow.append('  external [label="External systems\\nnot connected", fillcolor="#f1f5f9"];')
    flow.append(f"  {layer_nodes[3]} -> external [style=dashed];")
    flow.append("}")
    st.graphviz_chart("\n".join(flow), use_container_width=True)

    columns = st.columns(2)
    for index, layer in enumerate(PLATFORM_LAYERS):
        with columns[index % 2]:
            with st.container(border=True):
                st.markdown(f"### Layer {layer['number']} · {layer['name']}")
                st.write(layer["purpose"])
                st.caption("Current modules: " + ", ".join(layer["modules"]))
                st.info(layer["boundary"])
    st.markdown("**Request and data flow**")
    st.write(" → ".join(PLATFORM_FLOW))
    st.warning(
        "This is the app's logical architecture mapped onto the existing modules; the "
        "source files have not yet been physically split into separate deployable services. "
        "Memory integrations are opt-in, and the app currently has no authentication or "
        "connected external execution providers."
    )


def _update_pipeline_candidate(candidates, updated_candidate):
    candidates[:] = [
        updated_candidate if item["candidate_id"] == updated_candidate["candidate_id"] else item
        for item in candidates
    ]


def _persist_consented_candidate_memory(workflow_state):
    for candidate in workflow_state["candidates"]:
        if candidate.get("memory_consent") is not True:
            continue
        email = candidate.get("memory_email")
        if not email:
            st.error(
                f"Persistent memory is enabled for {candidate['candidate_id']} but its lookup email is missing."
            )
            continue
        try:
            record = save_candidate_history(
                email=email,
                candidate=candidate,
                job=workflow_state.get("job") or {},
                communications=workflow_state["outreach_queue"],
                activity=workflow_state["events"],
            )
        except (RuntimeError, ValueError) as exc:
            st.error(f"Could not save organizational memory for {candidate['candidate_id']}: {exc}")
        else:
            candidate["organizational_memory"] = record


def _render_organizational_memory(candidate):
    memory = candidate.get("organizational_memory")
    if not isinstance(memory, dict) or not memory.get("history"):
        return
    with st.expander(
        f"Shared organizational memory — {len(memory['history'])} saved history snapshots"
    ):
        st.caption(
            "Historical information is for recruiter context and follow-up only. Review each "
            "new role on its current evidence; prior rejection or scores must not determine the outcome."
        )
        for index, entry in enumerate(reversed(memory["history"]), start=1):
            snapshot = json.loads(entry["snapshot_json"])
            prior_candidate = snapshot.get("candidate", {})
            prior_job = snapshot.get("job", {})
            with st.expander(
                f"{entry['recorded_at']} · {prior_job.get('job_title', 'Role not recorded')} · "
                f"{prior_candidate.get('decision_status', 'Status not recorded')}"
            ):
                st.json(snapshot)
        if st.checkbox(
            "I confirm this candidate requested deletion of their organizational memory.",
            key=f"memory_delete_confirm_{candidate['candidate_id']}",
        ) and st.button(
            "Delete all saved history for this candidate",
            key=f"memory_delete_{candidate['candidate_id']}",
            type="secondary",
        ):
            try:
                delete_candidate_history(candidate["memory_email"])
            except (RuntimeError, ValueError) as exc:
                st.error(f"Could not delete candidate memory: {exc}")
            else:
                candidate["memory_consent"] = False
                candidate.pop("memory_email", None)
                candidate.pop("organizational_memory", None)
                st.session_state.hiring_workflow_state["events"] = append_audit_event(
                    st.session_state.hiring_workflow_state["events"],
                    "Deleted organizational memory at candidate request",
                    candidate["candidate_id"],
                )
                st.rerun()


def _prior_work_context(candidate):
    memory = candidate.get("organizational_memory")
    if not isinstance(memory, dict):
        return []
    latest_by_role = {}
    for entry in reversed(memory.get("history", [])):
        snapshot = json.loads(entry["snapshot_json"])
        job = snapshot.get("job", {})
        role_key = (job.get("job_title"), job.get("requirements"))
        if role_key in latest_by_role:
            continue
        previous_candidate = snapshot.get("candidate", {})
        latest_by_role[role_key] = {
            "role": job.get("job_title", "Role not recorded"),
            "resume_project_and_skill_evidence": previous_candidate.get(
                "resume_profile", ""
            ),
            "interview_responses": {
                round_name: {
                    "questions": round_data.get("questions", []),
                    "answers": round_data.get("answers", []),
                }
                for round_name, round_data in previous_candidate.get(
                    "rounds", {}
                ).items()
                if round_name in {"technical", "hr"}
            },
        }
        if len(latest_by_role) == 5:
            break
    return list(reversed(list(latest_by_role.values())))


def _candidate_digital_profile_sources(candidate):
    sources = [
        {
            "source_type": "Redacted resume profile",
            "source_ref": "resume",
            "source_location": "",
            "content": candidate.get("resume_profile", ""),
        }
    ]
    sources.extend(candidate.get("digital_profile_sources", []))
    recent_responses = []
    seen_responses = set()
    for round_name, round_data in candidate.get("rounds", {}).items():
        if round_name not in {"coding", "technical", "hr"}:
            continue
        for question, answer in zip(
            round_data.get("questions", []),
            round_data.get("answers", []),
        ):
            if not isinstance(answer, str) or not answer.strip():
                continue
            response_key = (str(question), answer)
            if response_key not in seen_responses:
                seen_responses.add(response_key)
                recent_responses.append((round_name, question, answer))
    recent_responses = recent_responses[-12:]
    seen_responses = {
        (str(question), answer)
        for _, question, answer in recent_responses
    }
    memory = candidate.get("organizational_memory")
    if isinstance(memory, dict) and len(recent_responses) < 12:
        for entry in reversed(memory.get("history", [])):
            snapshot = json.loads(entry["snapshot_json"])
            rounds = snapshot.get("candidate", {}).get("rounds", {})
            for round_name, round_data in reversed(list(rounds.items())):
                if round_name not in {"coding", "technical", "hr"}:
                    continue
                questions = round_data.get("questions", [])
                answers = round_data.get("answers", [])
                for question, answer in reversed(list(zip(questions, answers))):
                    if not isinstance(answer, str) or not answer.strip():
                        continue
                    response_key = (str(question), answer)
                    if response_key in seen_responses:
                        continue
                    seen_responses.add(response_key)
                    recent_responses.append((round_name, question, answer))
                    if len(recent_responses) >= 12:
                        break
                if len(recent_responses) >= 12:
                    break
            if len(recent_responses) >= 12:
                break
        for index, (round_name, question, answer) in enumerate(
            reversed(recent_responses), start=1
        ):
            sources.append(
                {
                    "source_type": f"Prior {round_name} interview response",
                    "source_ref": f"prior_interview_{index}",
                    "source_location": "",
                    "content": (
                        f"Question: {str(question)[:300]}\n"
                        f"Candidate response: {answer[:1200]}"
                    ),
                }
            )
    return sources


def _run_candidate_agent_step(agent, candidate, job, workflow_state):
    result = execute_candidate_preparation(
        candidate=candidate,
        job=job,
        agent=agent,
        prior_work_context=_prior_work_context(candidate),
    )
    candidate["agent_execution_trace"] = result
    if result["status"] == "completed":
        tool_name = result["trace"][-1]["tool"]
        workflow_state["events"] = append_audit_event(
            workflow_state["events"],
            f"Agent executed {tool_name}",
            f"{job['job_title']}: {candidate['candidate_id']}",
        )
        _persist_consented_candidate_memory(workflow_state)
        st.rerun()
    elif result["status"] == "failed":
        failed_step = result["trace"][-1]
        st.error(
            f"Agent action {failed_step['tool']} failed: "
            f"{failed_step['reflection']['message']}"
        )
    else:
        st.info(result["message"])


def _clear_candidate_widget_state():
    candidate_widget_prefixes = (
        "coding_",
        "questions_",
        "round_",
        "final_",
        "reject_",
        "invite_",
        "draft_",
        "advance_",
        "download_invite_",
        "hiring_resume_uploads",
        "hiring_resume_processing_consent",
        "memory_candidate_name",
        "memory_candidate_email",
        "candidate_github_url",
        "candidate_linkedin_url",
        "candidate_portfolio_url",
        "candidate_university",
        "candidate_referral",
        "candidate_work_highlights",
        "candidate_digital_profile_consent",
        "candidate_memory_consent",
    )
    for key in list(st.session_state.keys()):
        if key.startswith(candidate_widget_prefixes):
            del st.session_state[key]


def _render_candidate_round(agent, candidate, job, workflow_state):
    round_name = candidate.get("current_round")
    round_state = candidate.setdefault("rounds", {}).setdefault(round_name, {})
    st.markdown(f"**{round_name.title()} round**")
    required_skills = [
        skill.strip()
        for skill in re.split(r"[\n,;]+", job["requirements"])
        if skill.strip()
    ]

    if round_name == "coding":
        evaluation = round_state.get("evaluation")
        previous_score = evaluation.get("score") if evaluation else None
        difficulty = "Medium"
        if previous_score is not None:
            difficulty = "Hard" if previous_score >= 80 else "Easy" if previous_score <= 50 else "Medium"
        st.caption(
            f"Adaptive coding challenge difficulty: {difficulty}. The next prompt is generated "
            "from this candidate's prior attempt; no fixed question bank is used."
        )
        if agent and not round_state.get("challenge") and st.button(
            "Agent: plan and generate adaptive coding challenge",
            key=f"coding_generate_{candidate['candidate_id']}",
        ):
            _run_candidate_agent_step(agent, candidate, job, workflow_state)
        challenge = round_state.get("challenge")
        if challenge:
            st.markdown(f"**{challenge['title']}**")
            st.write(challenge["prompt"])
            st.write(f"**Input:** {challenge['input_format']}")
            st.write(f"**Output:** {challenge['output_format']}")
            st.write(f"**Constraints:** {challenge['constraints']}")
            st.write("**Examples:**")
            st.code(str(challenge["examples"]))
            if challenge["starter_code"]:
                st.write("**Starter code:**")
                st.code(str(challenge["starter_code"]))
            submission = st.text_area(
                "Candidate's coding submission (enter after the candidate completes the exercise)",
                value=round_state.get("candidate_submission", ""),
                height=200,
                key=(
                    f"coding_submission_{candidate['candidate_id']}_"
                    f"{round_state.get('challenge_version', 0)}"
                ),
            )
            round_state["candidate_submission"] = submission
            if st.button(
                "Agent: evaluate coding submission",
                key=f"coding_evaluate_{candidate['candidate_id']}",
                disabled=not submission.strip(),
            ):
                _run_candidate_agent_step(agent, candidate, job, workflow_state)
        if evaluation:
            st.info(
                f"AI coding review: {evaluation['score']}/100 — advisory evidence only. "
                "A recruiter must decide whether the candidate advances."
            )
            st.write(f"**Correctness:** {evaluation.get('correctness', '')}")
            st.write(f"**Approach:** {evaluation.get('approach', '')}")
            st.write(f"**Complexity:** {evaluation.get('complexity', '')}")
            st.write("**Strengths:** " + str(evaluation.get("strengths", [])))
            st.write("**Areas to follow up:** " + str(evaluation.get("improvement_areas", [])))

    elif round_name in {"technical", "hr"}:
        questions = round_state.get("questions", [])
        if not questions and agent and st.button(
            f"Agent: plan and generate {round_name} interview questions",
            key=f"questions_generate_{candidate['candidate_id']}_{round_name}",
        ):
            _run_candidate_agent_step(agent, candidate, job, workflow_state)
        if questions:
            if round_name == "hr":
                call_guide = (
                    "Recruiter phone interview guide — manual call only\n"
                    "Opening: Introduce yourself and confirm the candidate is available to speak.\n"
                    "Explain: This is the HR interview for the role. Ask permission before taking notes.\n\n"
                    + "\n".join(
                        f"{index + 1}. {question}"
                        for index, question in enumerate(questions)
                    )
                    + "\n\nClosing: Explain next steps and when the candidate can expect an update."
                )
                st.markdown("**Optional HR phone-interview guide (no call is placed)**")
                st.code(call_guide)
            answers = []
            for index, question in enumerate(questions):
                st.markdown(f"**Q{index + 1}. {question}**")
                answers.append(
                    st.text_area(
                        f"Candidate response {index + 1}",
                        key=f"round_answer_{candidate['candidate_id']}_{round_name}_{index}",
                        height=90,
                    )
                )
            round_state["answers"] = answers
            if agent and st.button(
                "Agent: reflect on interview evidence",
                key=f"round_evaluate_{candidate['candidate_id']}_{round_name}",
                disabled=not any(answer.strip() for answer in answers),
            ):
                _run_candidate_agent_step(agent, candidate, job, workflow_state)
        summary = round_state.get("evaluation")
        if summary:
            st.info("AI summary is advisory; the recruiter makes the round decision.")
            st.write("**Evidence:** " + str(summary.get("evidence", "")))
            st.write("**Strengths:** " + str(summary.get("strengths", [])))
            st.write("**Follow-up areas:** " + str(summary.get("follow_up_areas", [])))
            if summary.get("communication_observations"):
                st.write("**Communication observations:** " + str(summary["communication_observations"]))

    round_draft = next(
        (
            item
            for item in workflow_state["outreach_queue"]
            if item.get("candidate_id") == candidate["candidate_id"]
            and item.get("type") == "round"
            and item.get("round_name") == round_name
        ),
        None,
    )
    if round_draft:
        st.info(
            f"{round_name.title()} invitation draft is ready for review. "
            "It has not been sent or scheduled."
        )
    else:
        with st.form(f"round_invite_{candidate['candidate_id']}_{round_name}"):
            st.markdown(f"**Prepare {round_name.title()} round invitation**")
            invite_name = st.text_input(
                "Candidate's preferred name",
                key=f"round_invite_name_{candidate['candidate_id']}_{round_name}",
            )
            invite_email = st.text_input(
                "Candidate email",
                key=f"round_invite_email_{candidate['candidate_id']}_{round_name}",
            )
            invite_format = st.selectbox(
                "Interview format",
                ["Video interview", "Phone interview"],
                key=f"round_invite_format_{candidate['candidate_id']}_{round_name}",
            )
            invite_phone = st.text_input(
                "Phone number (required for phone interview)",
                key=f"round_invite_phone_{candidate['candidate_id']}_{round_name}",
            )
            invite_times = st.text_area(
                "Suggested date/time windows with timezone",
                placeholder="2026-11-02 10:00–12:00 IST",
                key=f"round_invite_times_{candidate['candidate_id']}_{round_name}",
            )
            invite_authorized = st.checkbox(
                "I confirm we are authorized to contact this candidate.",
                key=f"round_invite_authorized_{candidate['candidate_id']}_{round_name}",
            )
            make_invite = st.form_submit_button("Create round invitation draft")
        if make_invite:
            try:
                draft = create_interview_invitation_draft(
                    candidate=candidate,
                    job_title=job["job_title"],
                    email=invite_email,
                    availability=invite_times,
                    interview_format=invite_format,
                    round_name=round_name,
                    phone=invite_phone,
                    candidate_name=invite_name,
                    contact_authorized=invite_authorized,
                )
            except ValueError as exc:
                st.error(str(exc))
            else:
                draft["type"] = "round"
                draft["round_name"] = round_name
                if round_name == "coding" and round_state.get("challenge"):
                    challenge = round_state["challenge"]
                    draft["body"] += (
                        f"\n\nCoding exercise: {challenge['title']}\n"
                        f"{challenge['prompt']}\n"
                    )
                workflow_state["outreach_queue"].append(draft)
                workflow_state["events"] = append_audit_event(
                    workflow_state["events"],
                    "AI prepared round invitation draft",
                    f"{job['job_title']}: {candidate['candidate_id']} ({round_name})",
                )
                st.rerun()

    evaluation = round_state.get("evaluation")
    if evaluation:
        recruiter_notes = st.text_area(
            "Recruiter notes for this round",
            key=f"round_notes_{candidate['candidate_id']}_{round_name}",
        )
        pass_col, reject_col = st.columns(2)
        with pass_col:
            if st.button(
                f"Recruiter: pass {round_name} round",
                key=f"round_pass_{candidate['candidate_id']}_{round_name}",
            ):
                updated = record_round_decision(
                    candidate,
                    round_name,
                    "pass",
                    recruiter_notes,
                )
                _update_pipeline_candidate(workflow_state["candidates"], updated)
                workflow_state["events"] = append_audit_event(
                    workflow_state["events"],
                    f"Recruiter passed {round_name} round",
                    f"{job['job_title']}: {candidate['candidate_id']}",
                )
                st.rerun()
        with reject_col:
            if st.button(
                f"Recruiter: do not proceed after {round_name}",
                key=f"round_reject_{candidate['candidate_id']}_{round_name}",
            ):
                updated = record_round_decision(
                    candidate,
                    round_name,
                    "not_proceeding",
                    recruiter_notes,
                )
                _update_pipeline_candidate(workflow_state["candidates"], updated)
                workflow_state["events"] = append_audit_event(
                    workflow_state["events"],
                    f"Recruiter ended process after {round_name} round",
                    f"{job['job_title']}: {candidate['candidate_id']}",
                )
                st.rerun()


def hiring_workflow_section(agent):
    st.subheader("Recruiter-supervised hiring workflow")
    st.caption(
        "AI prepares drafts and job-related evidence. Recruiter approval is required "
        "for publication, candidate progression, rejection, and all offers."
    )
    st.info(
        "Job-board publishing, web sourcing, candidate contact, verification, and onboarding "
        "are not connected. No external actions are performed by this prototype."
    )

    if "hiring_workflow_state" not in st.session_state:
        st.session_state.hiring_workflow_state = {
            "job": None,
            "candidates": [],
            "events": [],
            "outreach_queue": [],
        }
    workflow_state = st.session_state.hiring_workflow_state
    workflow_state.setdefault("intelligence_report", None)
    _persist_consented_candidate_memory(workflow_state)

    st.markdown("### 1. Hiring brief")
    with st.form("hiring_brief_form"):
        first, second = st.columns(2)
        with first:
            company_name = st.text_input("Company / hiring organization (optional)")
            job_title = st.text_input("Job title", placeholder="Backend Engineer")
            location = st.text_input("Location", placeholder="Bangalore")
            headcount = st.number_input("Number of hires", min_value=1, max_value=500, value=1)
        with second:
            salary_budget = st.text_input("Salary budget", placeholder="Up to ₹18 LPA")
            timeline = st.text_input("Hiring timeline", placeholder="Within 30 days")
            skills_text = st.text_area(
                "Essential, job-related skills (one per line or comma-separated)",
                placeholder="Python, APIs, SQL, distributed systems",
                height=100,
            )
        generate_jd = st.form_submit_button("Generate JD draft", type="primary")

    if generate_jd:
        if not agent:
            st.error("Configure an LLM provider and API key before generating a job description.")
        elif not job_title.strip() or not location.strip() or not skills_text.strip():
            st.error("Enter a job title, location, and at least one job-related skill.")
        else:
            brief = {
                "company_name": company_name.strip(),
                "job_title": job_title.strip(),
                "location": location.strip(),
                "headcount": int(headcount),
                "salary_budget": salary_budget.strip() or "To be confirmed",
                "timeline": timeline.strip() or "To be confirmed",
                "requirements": skills_text.strip(),
            }
            with st.spinner("Drafting an inclusive, role-focused job description..."):
                try:
                    jd = agent.generate_job_description(**brief)
                except Exception as exc:
                    st.error(f"Could not generate the job description: {exc}")
                else:
                    _clear_candidate_widget_state()
                    workflow_state["job"] = {
                        **brief,
                        "jd": jd,
                        "status": "Draft — recruiter review required",
                    }
                    workflow_state["candidates"] = []
                    workflow_state["outreach_queue"] = []
                    workflow_state["intelligence_report"] = None
                    workflow_state["events"] = append_audit_event(
                        workflow_state["events"],
                        "AI drafted job description",
                        brief["job_title"],
                    )
                    st.session_state.hiring_jd_editor = jd

    job = workflow_state.get("job")
    if job:
        st.markdown("### 2. Review and approve the JD")
        st.caption(f"Status: **{job['status']}**")
        jd_text = st.text_area(
            "Edit the JD before approval",
            value=job["jd"],
            height=300,
            key="hiring_jd_editor",
            disabled=job["status"] != "Draft — recruiter review required",
        )
        job["jd"] = jd_text
        if job["status"] == "Draft — recruiter review required":
            if st.button("Approve JD for publication", key="approve_hiring_jd"):
                if not jd_text.strip():
                    st.error("The job description cannot be empty.")
                else:
                    job["jd"] = jd_text.strip()
                    job["status"] = "Approved by recruiter — publishing integration required"
                    workflow_state["events"] = append_audit_event(
                        workflow_state["events"],
                        "Approved job description",
                        job["job_title"],
                    )
                    st.rerun()
        if job["status"] == "Approved by recruiter — publishing integration required":
            st.success("JD approved. No job boards have been contacted.")
            for platform in ("LinkedIn", "Internshala", "Naukri", "Indeed", "Company career page"):
                st.markdown(f"- **{platform}:** Integration required")

        st.markdown("### 3. Screen candidate resumes")
        st.caption(
            "Screening pipeline: Resume parsing → Information extraction → Skill extraction → "
            "Job requirement extraction → Evidence-based semantic matching → Candidate ranking → Explanation"
        )
        st.caption(
            "Upload one authorized application at a time. Raw resume files are not retained in "
            "organizational memory; an encrypted, redacted resume profile and later workflow "
            "history are retained only with candidate consent."
        )
        upload = st.file_uploader(
            "Candidate resume (PDF or TXT)",
            type=["pdf", "txt"],
            key="hiring_resume_uploads",
        )
        candidate_name = st.text_input(
            "Candidate name (optional; used only in the current recruiter workflow)",
            key="memory_candidate_name",
        )
        candidate_email = st.text_input(
            "Candidate email (required only for persistent memory)",
            key="memory_candidate_email",
        )
        with st.expander("Candidate-submitted digital profile sources (optional)"):
            st.caption(
                "Enter links and work highlights supplied by the candidate. Links are saved "
                "as references only; this prototype does not visit or verify them."
            )
            github_url = st.text_input(
                "GitHub profile or repository URL",
                key="candidate_github_url",
            )
            linkedin_url = st.text_input(
                "LinkedIn profile URL",
                key="candidate_linkedin_url",
            )
            portfolio_url = st.text_input(
                "Portfolio URL",
                key="candidate_portfolio_url",
            )
            university = st.text_input(
                "University / institution (candidate-stated, optional)",
                key="candidate_university",
            )
            referral = st.text_input(
                "Referral source/name (candidate-stated, optional)",
                key="candidate_referral",
            )
            candidate_work = st.text_area(
                "Candidate-submitted project, hackathon, or research highlights",
                key="candidate_work_highlights",
                max_chars=6000,
            )
            profile_consent = st.checkbox(
                "I confirm the candidate consented to create an AI evidence profile from their resume, links, work highlights, optional university/referral details, and (if available) prior interview answers using the configured AI provider.",
                key="candidate_digital_profile_consent",
            )
        consent_confirmed = st.checkbox(
            "I confirm these resumes were submitted for hiring and may be processed for this role.",
            key="hiring_resume_processing_consent",
        )
        memory_consent = st.checkbox(
            "I confirm the candidate gave informed consent to retain full hiring history and share relevant history with authorized recruiters and the configured AI provider across roles. The candidate can request deletion.",
            key="candidate_memory_consent",
        )
        if memory_consent and not memory_is_configured():
            st.warning(
                "Persistent memory needs a CANDIDATE_MEMORY_KEY. Without it, screening can proceed "
                "only if you leave persistent-memory consent unchecked."
            )
        if job["status"] != "Approved by recruiter — publishing integration required":
            st.warning("Approve the JD before screening candidates.")
        elif st.button(
            "Screen uploaded resume",
            key="screen_hiring_candidates",
            disabled=not upload or not agent or not consent_confirmed,
        ):
            if memory_consent and not memory_is_configured():
                st.error("Configure the encryption key before retaining candidate history.")
            elif memory_consent and not candidate_email.strip():
                st.error("Enter the candidate email to match future applications to this history.")
            else:
                try:
                    prior_memory = (
                        find_candidate_history(candidate_email)
                        if memory_consent
                        else None
                    )
                except (RuntimeError, ValueError) as exc:
                    st.error(f"Could not load candidate organizational memory: {exc}")
                else:
                    continue_screening = False
                    if prior_memory and any(
                        item.get("candidate_id") == f"Candidate {prior_memory['memory_id'][:8]}"
                        for item in workflow_state["candidates"]
                    ):
                        st.error("This candidate has already been screened for this role in the current workflow.")
                    else:
                        try:
                            profile_sources = build_candidate_profile_sources(
                                github_url=github_url,
                                linkedin_url=linkedin_url,
                                portfolio_url=portfolio_url,
                                candidate_submitted_work=candidate_work,
                                university=university,
                                referral=referral,
                            )
                        except ValueError as exc:
                            st.error(str(exc))
                            profile_sources = None
                        if profile_sources is None:
                            continue_screening = False
                        else:
                            continue_screening = True
                        if profile_sources and not profile_consent:
                            st.warning(
                                "Profile links/highlights were not attached because the separate "
                                "digital-profile consent was not confirmed."
                            )
                            profile_sources = []
                    if continue_screening:
                        skills = [
                            skill.strip()
                            for skill in re.split(r"[\n,;]+", job["requirements"])
                            if skill.strip()
                        ]
                        candidate_id = (
                            f"Candidate {prior_memory['memory_id'][:8]}"
                            if prior_memory
                            else f"Candidate {len(workflow_state['candidates']) + 1:03d}"
                        )
                        try:
                            with st.spinner(
                                f"Reviewing job-related evidence for {candidate_id}..."
                            ):
                                result = agent.screen_candidate_resume(upload, skills)
                        except Exception as exc:
                            st.error(f"{candidate_id} could not be screened: {exc}")
                        else:
                            candidate = {
                                "candidate_id": candidate_id,
                                "candidate_name": candidate_name.strip(),
                                **result,
                            }
                            if profile_consent:
                                candidate["digital_profile_consent"] = True
                                candidate["digital_profile_sources"] = profile_sources
                            if memory_consent:
                                candidate["memory_consent"] = True
                                candidate["memory_email"] = candidate_email.strip()
                                candidate["organizational_memory"] = prior_memory
                            workflow_state["candidates"].append(candidate)
                            workflow_state["events"] = append_audit_event(
                                workflow_state["events"],
                                "AI screened resume against job skills",
                                f"{job['job_title']}: {candidate_id}",
                            )
                            _persist_consented_candidate_memory(workflow_state)

        candidates = rank_candidates(workflow_state["candidates"])
        if candidates:
            st.markdown("### 4. Evidence-based shortlist")
            st.caption(
                "Sorted by required-skill evidence only. Scores are advisory, may be incomplete, "
                "and do not decide hiring. Communication, culture fit, protected traits, and "
                "camera/voice characteristics are not used for ranking."
            )
            for candidate in candidates:
                with st.expander(
                    f"{candidate['candidate_id']} — {candidate['overall_score']}% "
                    f"job-skill evidence · {candidate['decision_status']}"
                ):
                    _render_organizational_memory(candidate)
                    execution_trace = candidate.get("agent_execution_trace")
                    if execution_trace and execution_trace.get("trace"):
                        with st.expander("Agent action trace — tool and validation only"):
                            for step in execution_trace["trace"]:
                                st.write(
                                    f"Step {step['step']}: `{step['tool']}` — "
                                    f"{step['reflection']['message']}"
                                )
                    if candidate.get("digital_profile_consent"):
                        st.markdown("**Candidate Digital Twin — evidence profile, not a score**")
                        st.caption(
                            "This synthesis uses candidate-submitted content and consented "
                            "interview answers. Profile URLs are references only and have not "
                            "been accessed or verified."
                        )
                        digital_profile = candidate.get("digital_profile")
                        if agent and st.button(
                            "Build / refresh evidence-linked profile",
                            key=f"digital_profile_{candidate['candidate_id']}",
                        ):
                            try:
                                with st.spinner("Synthesizing candidate-submitted evidence..."):
                                    digital_profile = agent.build_candidate_digital_profile(
                                        evidence_sources=_candidate_digital_profile_sources(
                                            candidate
                                        ),
                                    )
                            except Exception as exc:
                                st.error(f"Could not build the candidate profile: {exc}")
                            else:
                                candidate["digital_profile"] = digital_profile
                                workflow_state["events"] = append_audit_event(
                                    workflow_state["events"],
                                    "Built consented evidence-linked candidate profile",
                                    f"{job['job_title']}: {candidate['candidate_id']}",
                                )
                                _persist_consented_candidate_memory(workflow_state)
                                st.rerun()
                        elif digital_profile:
                            st.write(digital_profile["summary"])
                            for item in digital_profile["evidence"]:
                                st.markdown(
                                    f"- **{item['claim']}** "
                                    f"(sources: {', '.join(item['source_refs'])})"
                                )
                                if item["limitations"]:
                                    st.caption(f"Limitations: {item['limitations']}")
                            with st.expander("Review submitted evidence sources"):
                                for source in _candidate_digital_profile_sources(candidate):
                                    st.markdown(
                                        f"**[{source['source_ref']}] "
                                        f"{source['source_type']}**"
                                    )
                                    if source.get("source_location"):
                                        st.write(source["source_location"])
                                    st.caption(source["content"])
                            source_locations = {
                                source["source_ref"]: source["source_location"]
                                for source in candidate.get(
                                    "digital_profile_sources", []
                                )
                                if source.get("source_location")
                            }
                            if source_locations:
                                st.write("Candidate-submitted links (not verified):")
                                for source_ref, source_url in source_locations.items():
                                    st.markdown(
                                        f"- [{source_ref}]({source_url})"
                                    )
                    st.caption(candidate["assessment_method"])
                    explanation = candidate.get("screening_explanation", {})
                    if explanation:
                        st.caption(explanation.get("score_basis", ""))
                    extracted_information = candidate.get("extracted_information", {})
                    if extracted_information:
                        with st.expander("Extracted resume information and evidence"):
                            st.write("**Experience excerpts**")
                            st.write(extracted_information.get("experience", []))
                            st.write("**Projects**")
                            st.write(extracted_information.get("projects", []))
                            st.write("**Education**")
                            st.write(extracted_information.get("education", []))
                            st.write("**Certifications**")
                            st.write(extracted_information.get("certifications", []))
                    st.write("**Skill evidence scores**")
                    for skill, score in candidate["skill_scores"].items():
                        st.progress(float(score) / 10, text=f"{skill}: {score}/10")
                        item_evidence = candidate.get("skill_evidence", {}).get(skill, {})
                        if item_evidence.get("quote"):
                            st.caption(
                                f"Evidence: “{item_evidence['quote']}” "
                                f"— {item_evidence.get('explanation', '')}"
                            )
                        else:
                            st.caption(
                                item_evidence.get(
                                    "explanation",
                                    "No direct evidence quote was captured; recruiter verification is needed.",
                                )
                            )
                    if explanation.get("requirements_without_evidence"):
                        st.warning(
                            "No cited resume text was found for: "
                            + ", ".join(explanation["requirements_without_evidence"])
                        )
                    if candidate["missing_skills"]:
                        st.write("**Skills needing follow-up:** " + ", ".join(candidate["missing_skills"]))
                    if candidate["resume_review_flags"]:
                        st.caption(
                            "Resume verification prompts are not findings of fraud and must not "
                            "be used as automatic rejection criteria."
                        )
                        for flag in candidate["resume_review_flags"]:
                            st.write(f"- {flag['category']}: {flag['evidence']} — {flag['action']}")
                    if candidate["decision_status"] == "Pending recruiter review":
                        advance_col, reject_col = st.columns(2)
                        with advance_col:
                            if st.button(
                                "Recruiter: advance to interview",
                                key=f"advance_{candidate['candidate_id']}",
                            ):
                                updated = record_recruiter_decision(candidate, "advance")
                                workflow_state["candidates"] = [
                                    updated if item["candidate_id"] == candidate["candidate_id"] else item
                                    for item in workflow_state["candidates"]
                                ]
                                workflow_state["events"] = append_audit_event(
                                    workflow_state["events"],
                                    "Advanced candidate to interview",
                                    f"{job['job_title']}: {candidate['candidate_id']}",
                                )
                                st.rerun()
                        with reject_col:
                            if st.button(
                                "Recruiter: do not proceed",
                                key=f"reject_{candidate['candidate_id']}",
                            ):
                                updated = record_recruiter_decision(candidate, "not_proceeding")
                                workflow_state["candidates"] = [
                                    updated if item["candidate_id"] == candidate["candidate_id"] else item
                                    for item in workflow_state["candidates"]
                                ]
                                workflow_state["events"] = append_audit_event(
                                    workflow_state["events"],
                                    "Marked candidate not proceeding",
                                    f"{job['job_title']}: {candidate['candidate_id']}",
                                )
                                st.rerun()
                    elif candidate.get("current_round") in {"coding", "technical", "hr"}:
                        _render_candidate_round(agent, candidate, job, workflow_state)
                    elif candidate.get("decision_status") == "Final recruiter decision pending":
                        st.warning(
                            "All interview rounds are complete. A recruiter must make the final hiring decision."
                        )
                        hr_brief = candidate.get("hr_decision_brief")
                        if hr_brief is None:
                            st.caption(
                                "The HR Decision Agent summarizes evidence; it does not decide who to hire. "
                                "Joining readiness is based only on explicit candidate statements, not a probability."
                            )
                            if agent and st.button(
                                "Agent: plan and prepare HR decision brief",
                                key=f"hr_brief_{candidate['candidate_id']}",
                            ):
                                _run_candidate_agent_step(
                                    agent, candidate, job, workflow_state
                                )
                        else:
                            st.markdown("#### HR Decision Agent brief")
                            st.caption(
                                "Advisory only. It does not hire/reject candidates or estimate "
                                "a numeric joining probability."
                            )
                            st.write("**Pros**")
                            if hr_brief["pros"]:
                                for item in hr_brief["pros"]:
                                    st.markdown(f"- {item}")
                            else:
                                st.write("No supported evidence recorded.")
                            st.write("**Cons / follow-up areas**")
                            if hr_brief["cons"]:
                                for item in hr_brief["cons"]:
                                    st.markdown(f"- {item}")
                            else:
                                st.write("No supported concerns recorded.")
                            st.write("**Role-related risks / uncertainties**")
                            if hr_brief["role_related_risks"]:
                                for item in hr_brief["role_related_risks"]:
                                    st.markdown(f"- {item}")
                            else:
                                st.write("No specific role-related risk identified from the supplied evidence.")
                            salary = hr_brief["salary_recommendation"]
                            st.write("**Salary guidance**")
                            st.write(salary["guidance"])
                            st.caption(f"Basis: {salary['basis']}")
                            readiness = hr_brief["joining_readiness"]
                            st.write("**Joining readiness (not a probability)**")
                            st.write(f"Status: **{readiness['status'].replace('_', ' ').title()}**")
                            if readiness["evidence"]:
                                for item in readiness["evidence"]:
                                    st.markdown(f"- {item}")
                            else:
                                st.caption("No explicit candidate statements about joining readiness were provided.")
                        final_notes = st.text_area(
                            "Final recruiter decision notes",
                            key=f"final_notes_{candidate['candidate_id']}",
                        )
                        hire_col, no_hire_col = st.columns(2)
                        with hire_col:
                            if st.button(
                                "Recruiter: approve hire",
                                key=f"final_hire_{candidate['candidate_id']}",
                            ):
                                updated = record_final_hiring_decision(
                                    candidate,
                                    "hire",
                                    final_notes,
                                )
                                _update_pipeline_candidate(workflow_state["candidates"], updated)
                                workflow_state["events"] = append_audit_event(
                                    workflow_state["events"],
                                    "Recruiter approved hire",
                                    f"{job['job_title']}: {candidate['candidate_id']}",
                                )
                                st.rerun()
                        with no_hire_col:
                            if st.button(
                                "Recruiter: do not hire",
                                key=f"final_no_hire_{candidate['candidate_id']}",
                            ):
                                updated = record_final_hiring_decision(
                                    candidate,
                                    "not_proceeding",
                                    final_notes,
                                )
                                _update_pipeline_candidate(workflow_state["candidates"], updated)
                                workflow_state["events"] = append_audit_event(
                                    workflow_state["events"],
                                    "Recruiter declined to hire",
                                    f"{job['job_title']}: {candidate['candidate_id']}",
                                )
                                st.rerun()
                    elif candidate.get("decision_status") == "Hired by recruiter":
                        st.success("Hire approved by recruiter. Prepare an offer draft for HR/legal review.")
                        offer = candidate.get("offer_draft")
                        if offer is None:
                            with st.form(f"offer_form_{candidate['candidate_id']}"):
                                candidate_name = st.text_input(
                                    "Candidate's legal/preferred offer name",
                                    key=f"offer_name_{candidate['candidate_id']}",
                                )
                                company_name = st.text_input(
                                    "Company name",
                                    key=f"offer_company_{candidate['candidate_id']}",
                                )
                                annual_salary_lpa = st.number_input(
                                    "Proposed gross annual salary (INR LPA)",
                                    min_value=0.1,
                                    max_value=1000.0,
                                    value=10.0,
                                    step=0.5,
                                    key=f"offer_salary_{candidate['candidate_id']}",
                                )
                                joining_date = st.date_input(
                                    "Proposed joining date",
                                    value=date.today() + timedelta(days=30),
                                    key=f"offer_joining_date_{candidate['candidate_id']}",
                                )
                                documents = st.multiselect(
                                    "Post-acceptance document checklist",
                                    [
                                        "Tax identification / PAN (where applicable and lawful)",
                                        "Bank account details (after acceptance, via secure channel)",
                                        "Identity document (only where legally required; obtain consent)",
                                        "Relevant education certificates",
                                        "Prior employment / experience documents (if applicable)",
                                    ],
                                    key=f"offer_documents_{candidate['candidate_id']}",
                                )
                                budget_confirmed = st.checkbox(
                                    "I confirm this salary is within the approved role band and has compensation approval.",
                                    key=f"offer_budget_confirmed_{candidate['candidate_id']}",
                                )
                                prepare_offer = st.form_submit_button("Generate offer letter draft")
                            if prepare_offer:
                                try:
                                    offer = agent.generate_offer_letter_draft(
                                        candidate=candidate,
                                        job_title=job["job_title"],
                                        candidate_name=candidate_name,
                                        company_name=company_name,
                                        annual_salary_lpa=annual_salary_lpa,
                                        joining_date=joining_date.isoformat(),
                                        documents=documents,
                                        salary_budget=job["salary_budget"],
                                        budget_confirmed=budget_confirmed,
                                    )
                                except ValueError as exc:
                                    st.error(str(exc))
                                else:
                                    candidate["offer_draft"] = offer
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "AI prepared offer letter draft",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()
                        else:
                            st.caption(
                                f"Offer status: **{offer['status']}**. This draft is not signed, "
                                "sent, or an employment contract."
                            )
                            st.write(f"**Proposed salary:** INR {offer['annual_salary_lpa']:g} LPA")
                            st.write(f"**Proposed joining date:** {offer['joining_date']}")
                            st.write("**Documents after acceptance:**")
                            for document in offer["documents"]:
                                st.markdown(f"- {document}")
                            edited_letter = st.text_area(
                                "Review/edit offer letter",
                                value=offer["letter"],
                                height=350,
                                key=f"offer_letter_{candidate['candidate_id']}",
                                disabled=offer["status"] != "Draft — not approved or issued",
                            )
                            if offer["status"] == "Draft — not approved or issued":
                                offer["letter"] = edited_letter
                                if st.button(
                                    "Approve draft for HR/legal issuance review",
                                    key=f"approve_offer_{candidate['candidate_id']}",
                                ):
                                    offer["status"] = (
                                        "Recruiter approved — HR/legal issuance required; not issued"
                                    )
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "Recruiter approved offer draft",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()
                            st.download_button(
                                "Download offer letter draft",
                                data=offer["letter"],
                                file_name=f"{candidate['candidate_id'].lower().replace(' ', '-')}-offer-draft.txt",
                                mime="text/plain",
                                key=f"download_offer_{candidate['candidate_id']}",
                            )
                        st.markdown("#### Verification Agent")
                        st.caption(
                            "Verification is available only after a recruiter confirms an offer "
                            "was formally issued and accepted and candidate consent was obtained. "
                            "This prototype tracks statuses only; it does not contact institutions, "
                            "references, government services, or verification vendors."
                        )
                        verification = candidate.get("verification")
                        if verification is None:
                            with st.form(f"verification_start_{candidate['candidate_id']}"):
                                offer_accepted = st.checkbox(
                                    "I confirm the offer was formally issued outside this app and accepted by the candidate.",
                                    key=f"verification_offer_accepted_{candidate['candidate_id']}",
                                )
                                candidate_consent = st.checkbox(
                                    "I confirm the candidate gave informed consent for the selected checks.",
                                    key=f"verification_consent_{candidate['candidate_id']}",
                                )
                                verification_checks = st.multiselect(
                                    "Checks to coordinate (select only lawful, necessary checks)",
                                    options=list(VERIFICATION_CHECKS),
                                    format_func=lambda check: VERIFICATION_CHECKS[check],
                                    key=f"verification_checks_{candidate['candidate_id']}",
                                )
                                start_verification = st.form_submit_button(
                                    "Start verification tracking"
                                )
                            if start_verification:
                                try:
                                    updated = agent.create_verification_plan(
                                        candidate=candidate,
                                        checks=verification_checks,
                                        offer_accepted=offer_accepted,
                                        candidate_consent=candidate_consent,
                                    )
                                except ValueError as exc:
                                    st.error(str(exc))
                                else:
                                    _update_pipeline_candidate(
                                        workflow_state["candidates"], updated
                                    )
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "Recruiter started consented verification tracking",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()
                        else:
                            st.write(f"**Overall status:** {verification['status']}")
                            st.warning(
                                "Use an authorized, consented provider outside this prototype. "
                                "Do not enter identity numbers, document images, or sensitive personal data."
                            )
                            for check, check_state in verification["checks"].items():
                                with st.expander(
                                    f"{check_state['label']}: {check_state['status']}"
                                ):
                                    st.caption(
                                        "Provider contact and evidence review happen outside the app; "
                                        "record only a minimal outcome summary."
                                    )
                                    with st.form(
                                        f"verification_update_{candidate['candidate_id']}_{check}"
                                    ):
                                        new_status = st.selectbox(
                                            "Check status",
                                            [
                                                "Not started",
                                                "Requested",
                                                "In progress",
                                                "Verified",
                                                "Needs review",
                                                "Unable to verify",
                                                "Not applicable",
                                            ],
                                            index=[
                                                "Not started",
                                                "Requested",
                                                "In progress",
                                                "Verified",
                                                "Needs review",
                                                "Unable to verify",
                                                "Not applicable",
                                            ].index(check_state["status"]),
                                            key=f"verification_status_{candidate['candidate_id']}_{check}",
                                        )
                                        outcome_notes = st.text_area(
                                            "Non-sensitive outcome summary",
                                            value=check_state.get("notes", ""),
                                            key=f"verification_notes_{candidate['candidate_id']}_{check}",
                                        )
                                        save_check = st.form_submit_button("Save check status")
                                    if save_check:
                                        try:
                                            updated = agent.update_verification_check(
                                                candidate=candidate,
                                                check=check,
                                                status=new_status,
                                                notes=outcome_notes,
                                            )
                                        except ValueError as exc:
                                            st.error(str(exc))
                                        else:
                                            _update_pipeline_candidate(
                                                workflow_state["candidates"], updated
                                            )
                                            workflow_state["events"] = append_audit_event(
                                                workflow_state["events"],
                                                f"Recruiter updated verification check: {new_status}",
                                                f"{job['job_title']}: {candidate['candidate_id']} ({check_state['label']})",
                                            )
                                            st.rerun()
                        st.markdown("#### Document Validation Agent")
                        st.caption(
                            "This prototype tracks document-check statuses only. It does not accept "
                            "document uploads, run OCR, or call verification APIs. Connect only "
                            "authorized providers with secure storage and retention controls."
                        )
                        document_validation = candidate.get("document_validation")
                        if document_validation is None:
                            with st.form(
                                f"document_validation_start_{candidate['candidate_id']}"
                            ):
                                doc_offer_accepted = st.checkbox(
                                    "I confirm the offer was formally issued outside this app and accepted by the candidate.",
                                    key=f"doc_offer_accepted_{candidate['candidate_id']}",
                                )
                                doc_candidate_consent = st.checkbox(
                                    "I confirm the candidate consented to these necessary document checks.",
                                    key=f"doc_candidate_consent_{candidate['candidate_id']}",
                                )
                                document_types = st.multiselect(
                                    "Documents to validate",
                                    options=list(DOCUMENT_VALIDATION_TYPES),
                                    format_func=lambda kind: DOCUMENT_VALIDATION_TYPES[kind],
                                    key=f"document_validation_types_{candidate['candidate_id']}",
                                )
                                aadhaar_integration_confirmed = st.checkbox(
                                    "I confirm lawful authority and an authorized compliant Aadhaar verification integration are in place (no Aadhaar data is processed by this app).",
                                    key=f"aadhaar_integration_confirmed_{candidate['candidate_id']}",
                                )
                                start_document_validation = st.form_submit_button(
                                    "Start document validation tracking"
                                )
                            if start_document_validation:
                                try:
                                    updated = agent.create_document_validation_plan(
                                        candidate=candidate,
                                        document_types=document_types,
                                        offer_accepted=doc_offer_accepted,
                                        candidate_consent=doc_candidate_consent,
                                        aadhaar_compliant_integration_confirmed=(
                                            aadhaar_integration_confirmed
                                        ),
                                    )
                                except ValueError as exc:
                                    st.error(str(exc))
                                else:
                                    _update_pipeline_candidate(
                                        workflow_state["candidates"], updated
                                    )
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "Recruiter started consented document validation tracking",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()
                        else:
                            st.write(f"**Overall status:** {document_validation['status']}")
                            st.warning(
                                "Do not enter or upload PAN/Aadhaar numbers, identity documents, "
                                "or document images here. Record only a minimal non-sensitive outcome."
                            )
                            for document_type, document_state in document_validation["checks"].items():
                                with st.expander(
                                    f"{document_state['label']}: {document_state['status']}"
                                ):
                                    with st.form(
                                        f"document_validation_update_{candidate['candidate_id']}_{document_type}"
                                    ):
                                        validation_statuses = [
                                            "Not started",
                                            "Requested",
                                            "In progress",
                                            "Verified",
                                            "Needs review",
                                            "Unable to verify",
                                            "Not applicable",
                                        ]
                                        new_status = st.selectbox(
                                            "Validation status",
                                            validation_statuses,
                                            index=validation_statuses.index(
                                                document_state["status"]
                                            ),
                                            key=f"document_validation_status_{candidate['candidate_id']}_{document_type}",
                                        )
                                        save_document_status = st.form_submit_button(
                                            "Save validation status"
                                        )
                                    if save_document_status:
                                        try:
                                            updated = agent.update_document_validation_check(
                                                candidate=candidate,
                                                document_type=document_type,
                                                status=new_status,
                                            )
                                        except ValueError as exc:
                                            st.error(str(exc))
                                        else:
                                            _update_pipeline_candidate(
                                                workflow_state["candidates"], updated
                                            )
                                            workflow_state["events"] = append_audit_event(
                                                workflow_state["events"],
                                                f"Recruiter updated document validation: {new_status}",
                                                f"{job['job_title']}: {candidate['candidate_id']} ({document_state['label']})",
                                            )
                                            st.rerun()
                        st.markdown("#### Onboarding Agent")
                        st.caption(
                            "After formal offer acceptance, this agent creates a supervised setup checklist. "
                            "It does not provision accounts, order devices, configure payroll, or collect documents."
                        )
                        onboarding = candidate.get("onboarding")
                        if onboarding is None:
                            with st.form(f"onboarding_start_{candidate['candidate_id']}"):
                                onboarding_offer_accepted = st.checkbox(
                                    "I confirm the offer was formally issued outside this app and accepted.",
                                    key=f"onboarding_offer_accepted_{candidate['candidate_id']}",
                                )
                                onboarding_consent = st.checkbox(
                                    "I confirm the candidate was informed about and consents to the necessary onboarding data processing.",
                                    key=f"onboarding_consent_{candidate['candidate_id']}",
                                )
                                start_onboarding = st.form_submit_button(
                                    "Create onboarding checklist"
                                )
                            if start_onboarding:
                                try:
                                    updated = agent.create_onboarding_plan(
                                        candidate=candidate,
                                        offer_accepted=onboarding_offer_accepted,
                                        candidate_consent=onboarding_consent,
                                    )
                                except ValueError as exc:
                                    st.error(str(exc))
                                else:
                                    _update_pipeline_candidate(
                                        workflow_state["candidates"], updated
                                    )
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "Recruiter created onboarding checklist",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()
                        else:
                            st.write(f"**Overall status:** {onboarding['status']}")
                            st.warning(
                                "External actions require authorized system integrations and explicit human approval. "
                                "Never enter passwords, access tokens, bank details, tax IDs, or identity documents here."
                            )
                            for task, task_state in onboarding["tasks"].items():
                                with st.expander(
                                    f"{task_state['label']}: {task_state['status']}"
                                ):
                                    with st.form(
                                        f"onboarding_task_{candidate['candidate_id']}_{task}"
                                    ):
                                        onboarding_status = st.selectbox(
                                            "Task status",
                                            list(ONBOARDING_STATUSES),
                                            index=list(ONBOARDING_STATUSES).index(
                                                task_state["status"]
                                            ),
                                            key=f"onboarding_status_{candidate['candidate_id']}_{task}",
                                        )
                                        onboarding_notes = st.text_area(
                                            "Optional non-sensitive admin note",
                                            value=task_state.get("notes", ""),
                                            max_chars=500,
                                            key=f"onboarding_notes_{candidate['candidate_id']}_{task}",
                                        )
                                        save_onboarding_task = st.form_submit_button(
                                            "Save task status"
                                        )
                                    if save_onboarding_task:
                                        try:
                                            updated = agent.update_onboarding_task(
                                                candidate=candidate,
                                                task=task,
                                                status=onboarding_status,
                                                notes=onboarding_notes,
                                            )
                                        except ValueError as exc:
                                            st.error(str(exc))
                                        else:
                                            _update_pipeline_candidate(
                                                workflow_state["candidates"], updated
                                            )
                                            workflow_state["events"] = append_audit_event(
                                                workflow_state["events"],
                                                f"Recruiter updated onboarding task: {onboarding_status}",
                                                f"{job['job_title']}: {candidate['candidate_id']} ({task_state['label']})",
                                            )
                                            st.rerun()
                    elif candidate.get("decision_status") == "Not proceeding (recruiter decision)":
                        rejection_draft = next(
                            (
                                item
                                for item in workflow_state["outreach_queue"]
                                if item.get("candidate_id") == candidate["candidate_id"]
                                and item.get("type") == "rejection"
                            ),
                            None,
                        )
                        if rejection_draft:
                            st.info("Recruiter-reviewed rejection message/call script is in the draft queue.")
                        else:
                            with st.form(f"rejection_draft_{candidate['candidate_id']}"):
                                st.markdown("**Prepare a respectful rejection email/call script**")
                                st.caption(
                                    "A recruiter made the not-proceeding decision. This creates a draft only; "
                                    "it will not email or call the candidate."
                                )
                                reject_name = st.text_input(
                                    "Candidate's preferred name",
                                    key=f"reject_name_{candidate['candidate_id']}",
                                )
                                reject_email = st.text_input(
                                    "Candidate email",
                                    key=f"reject_email_{candidate['candidate_id']}",
                                )
                                reject_phone = st.text_input(
                                    "Candidate phone (for optional manual call script)",
                                    key=f"reject_phone_{candidate['candidate_id']}",
                                )
                                reject_authorized = st.checkbox(
                                    "I confirm we are authorized to send this application update.",
                                    key=f"reject_authorized_{candidate['candidate_id']}",
                                )
                                create_rejection = st.form_submit_button("Create rejection draft")
                            if create_rejection:
                                try:
                                    draft = create_rejection_message_draft(
                                        candidate=candidate,
                                        job_title=job["job_title"],
                                        email=reject_email,
                                        phone=reject_phone,
                                        candidate_name=reject_name,
                                        contact_authorized=reject_authorized,
                                    )
                                except ValueError as exc:
                                    st.error(str(exc))
                                else:
                                    workflow_state["outreach_queue"].append(
                                        {"type": "rejection", **draft}
                                    )
                                    workflow_state["events"] = append_audit_event(
                                        workflow_state["events"],
                                        "AI prepared rejection communication draft",
                                        f"{job['job_title']}: {candidate['candidate_id']}",
                                    )
                                    st.rerun()

        if workflow_state["outreach_queue"]:
            st.markdown("### 5. Recruiter review: outreach and scheduling drafts")
            st.caption(
                "Review the invitation and proposed availability. Approval only marks it ready "
                "for a future integration; it does not send an email, place a call, or create a calendar event."
            )
            for draft in workflow_state["outreach_queue"]:
                draft_kind = draft.get("type", "round")
                draft_label = (
                    f"{draft.get('round_name', 'Interview').title()} invitation"
                    if draft_kind == "round"
                    else "Rejection update"
                )
                with st.expander(
                    f"{draft['candidate_id']} — {draft_label} — {draft['status']}"
                ):
                    st.write(f"**To:** {draft['candidate_email']}")
                    if draft_kind == "round":
                        st.write(f"**Format:** {draft['interview_format']}")
                        if draft["candidate_phone"]:
                            st.write(f"**Phone:** {draft['candidate_phone']}")
                            st.write("**Optional manual call script:**")
                            st.code(draft["call_script"])
                        st.write(f"**Suggested availability:** {draft['availability']}")
                    elif draft["candidate_phone"]:
                        st.write(f"**Optional manual call:** {draft['candidate_phone']}")
                        st.write("**Call script:**")
                        st.code(draft["call_script"])
                    draft["subject"] = st.text_input(
                        "Subject",
                        value=draft["subject"],
                        key=f"draft_subject_{draft_kind}_{draft['candidate_id']}_{draft.get('round_name', '')}",
                        disabled=draft["status"] != "Draft — not sent or scheduled",
                    )
                    edited_body = st.text_area(
                        "Invitation message",
                        value=draft["body"],
                        key=f"draft_body_{draft_kind}_{draft['candidate_id']}_{draft.get('round_name', '')}",
                        height=200,
                        disabled=draft["status"] != "Draft — not sent or scheduled",
                    )
                    if draft["status"] == "Draft — not sent or scheduled":
                        draft["body"] = edited_body
                        if st.button(
                            "Approve draft (still not sent or called)",
                            key=f"approve_draft_{draft_kind}_{draft['candidate_id']}_{draft.get('round_name', '')}",
                        ):
                            draft["status"] = "Recruiter approved — integration required; not sent or called"
                            workflow_state["events"] = append_audit_event(
                                workflow_state["events"],
                                "Approved communication draft",
                                f"{job['job_title']}: {draft['candidate_id']} ({draft_label})",
                            )
                            st.rerun()
                    st.download_button(
                        "Download email draft",
                        data=f"To: {draft['candidate_email']}\nSubject: {draft['subject']}\n\n{draft['body']}",
                        file_name=(
                            f"{draft['candidate_id'].lower().replace(' ', '-')}-"
                            f"{draft.get('round_name', 'rejection')}-message.txt"
                        ),
                        mime="text/plain",
                        key=f"download_invite_{draft_kind}_{draft['candidate_id']}_{draft.get('round_name', '')}",
                    )

    st.markdown("### 6. Workforce Graph")
    st.caption(
        "A descriptive relationship map of this role and consented candidate history. "
        "It is not an employee-performance system or a candidate-scoring/ranking input."
    )
    graph = build_workforce_graph(job, workflow_state["candidates"])
    graph_metrics = st.columns(3)
    graph_metrics[0].metric("People / candidates", graph["candidate_count"])
    graph_metrics[1].metric("Entities", graph["node_count"])
    graph_metrics[2].metric("Relationships", graph["relationship_count"])
    st.info(
        "The graph can show company and role, current/consented historical candidates, "
        "job-related skill evidence, candidate-submitted projects, optional candidate-stated "
        "university/referral details, and recruiter-recorded interview-round outcomes. "
        "University and referral details are context only and never affect candidate ranking. "
        "Company-wide employees, verified referrals, and on-the-job performance data are not "
        "connected in this prototype."
    )
    if graph["node_count"]:
        st.graphviz_chart(graph["dot"], use_container_width=True)
    else:
        st.caption("Create a hiring brief or screen a candidate to populate this graph.")

    st.markdown("### 7. Hiring Intelligence")
    st.caption(
        "Evidence-based strategic suggestions from this role's recorded funnel. "
        "Recommendations are advisory; the recruiter decides whether to test or adopt them."
    )
    funnel_metrics = summarize_hiring_funnel(workflow_state["candidates"])
    first, second, third, fourth = st.columns(4)
    first.metric("Screened", funnel_metrics["screened"])
    second.metric("Advanced", funnel_metrics["advanced_after_screening"])
    third.metric("Not proceeding", funnel_metrics["not_proceeding_total"])
    fourth.metric("Hired", funnel_metrics["hired"])
    report_signature = json.dumps(
        {"job": job, "metrics": funnel_metrics},
        sort_keys=True,
        ensure_ascii=True,
    )
    st.info(
        "This prototype currently tracks one active role at a time. Recruiting source, "
        "market salary, offer acceptance, and candidate-experience data are not captured, "
        "so this view cannot reliably identify the best job board, recommend a pay increase, "
        "or compare schools."
    )
    if not agent:
        st.warning("Configure an AI provider to generate strategic recommendations.")
    elif not funnel_metrics["screened"]:
        st.caption("Screen candidates to establish an evidence base for role-specific advice.")
    elif st.button("Generate strategic recommendations", key="generate_hiring_intelligence"):
        try:
            with st.spinner("Reviewing hiring funnel evidence..."):
                report = agent.generate_hiring_intelligence(
                    job={
                        key: job.get(key)
                        for key in (
                            "job_title",
                            "location",
                            "headcount",
                            "salary_budget",
                            "timeline",
                            "requirements",
                        )
                    },
                    funnel_metrics=funnel_metrics,
                )
        except Exception as exc:
            st.error(f"Could not generate hiring intelligence: {exc}")
        else:
            workflow_state["intelligence_report"] = {
                "signature": report_signature,
                "recommendations": report["recommendations"],
            }
    intelligence_report = workflow_state.get("intelligence_report")
    if intelligence_report:
        if intelligence_report.get("signature") != report_signature:
            st.caption("The funnel changed since this report. Generate a fresh analysis.")
        else:
            recommendations = intelligence_report.get("recommendations", [])
            if not recommendations:
                st.success(
                    "No strategic change is supported by the current evidence. "
                    "Continue collecting outcomes before changing the process."
                )
            for recommendation in recommendations:
                with st.expander(recommendation["title"]):
                    st.write(recommendation["action"])
                    st.write(f"**Why:** {recommendation['rationale']}")
                    st.write(
                        f"**Confidence:** {recommendation['confidence'].title()} "
                        "(advisory; confidence reflects evidence completeness)"
                    )
                    st.write("**Supporting evidence:**")
                    for evidence in recommendation["supporting_evidence"]:
                        st.markdown(f"- {evidence}")
                    if recommendation["data_needed"]:
                        st.write("**Data needed before acting:**")
                        for item in recommendation["data_needed"]:
                            st.markdown(f"- {item}")

    st.markdown("### 8. Downstream workflow")
    downstream = (
        ("Candidate discovery (authorized sources)", "Integration + source authorization required"),
        ("Interview email/call/calendar scheduling", "Draft queue only; sending and booking integration required"),
        ("Offer and compensation", "Integration + human approval required"),
        ("Verification Agent", "Consent-gated status tracker; provider contact and verification integrations required"),
        ("Document Validation Agent", "OCR/API integrations required; no documents are uploaded or processed here"),
        ("Onboarding Agent", "Consent-gated task checklist; account, device, and payroll integrations + human approval required"),
    )
    for stage, status in downstream:
        st.markdown(f"- **{stage}:** {status}")

    if workflow_state["events"]:
        with st.expander("Workflow activity log"):
            for event in reversed(workflow_state["events"]):
                st.write(
                    f"{event['timestamp']} · {event['actor']} · "
                    f"{event['action']} · {event['subject']}"
                )


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

                overall_score = analysis_result.get("overall_score") if isinstance(analysis_result, dict) else None
                score_status = "Selected" if analysis_result and analysis_result.get("selected") else "Not selected"
                score_display = f"{overall_score}%" if overall_score is not None else "Awaiting analysis"

        # normalize to 0-10
        labels = list(skill_scores.keys())
        values = [min(10, max(0, float(v))) for v in skill_scores.values()]

        payload = {
                "labels": labels,
                "values": values,
        }

        payload_json = json.dumps(payload)
        html = """
        <style>
        .hero-card {
            background: linear-gradient(135deg,#f3f4f6 0%, #ffffff 60%);
            color: #1f2937; border-radius:16px; padding:18px; box-shadow: 0 8px 24px rgba(15,23,42,0.08);
            margin-bottom: 18px; overflow:hidden; border: 1px solid #e5e7eb;
        }
        .hero-header {display:flex; align-items:center; justify-content:space-between; gap:16px}
        .hero-title {font-size:1.05rem; font-weight:700; color:#111827}
        .hero-sub {color:#6b7280; font-size:0.9rem}
        .hero-score {min-width:140px; text-align:right; color:#111827; font-size:1.35rem; font-weight:750}
        .hero-score small {display:block; color:#6b7280; font-size:0.72rem; font-weight:600; margin-top:3px}
        .view-toggle button {background:#eef2ff;color:#4338ca;border:0;padding:8px 12px;margin-left:6px;border-radius:8px;cursor:pointer; font-weight:600}
        .view-toggle button.active {background:linear-gradient(90deg,#7c3aed,#4f46e5); color:white}
        </style>
        <div class="hero-card">
            <div class="hero-header">
                <div>
                    <div class="hero-title">Candidate Insights</div>
                    <div class="hero-sub">Interactive skill snapshot — hover metrics, toggle views, and explore.</div>
                </div>
                <div class="hero-score">SCORE: __SCORE__<small>__STATUS__</small></div>
                <div class="view-toggle">
                    <button id="radarBtn" class="active">Radar</button>
                    <button id="barsBtn">Bars</button>
                </div>
            </div>
            <canvas id="skillChart" style="width:100%;height:300px"></canvas>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
        const payload = """ + payload_json + """;
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
                    r: { min:0, max:10, grid: {color: 'rgba(15,23,42,0.08)'}, angleLines: {color:'rgba(15,23,42,0.08)'}, ticks:{display:false} }
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

        const maxIndex = payload.values.indexOf(Math.max(...payload.values));
        setInterval(() => {
            if (!chart) return;
            const meta = chart.getDatasetMeta(0);
            if (meta && meta.data && meta.data[maxIndex]) {
                meta.data[maxIndex].transition(400).draw();
            }
        }, 2200);
        </script>
        """.replace('""" + payload_json + """', payload_json).replace('__SCORE__', score_display).replace('__STATUS__', score_status)

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
    selected = result.get("selected")

    st.markdown("---")
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Overall Score", f"{score}%")
    with col2:
        if result.get("decision_status") == "Pending recruiter review":
            st.warning("⏳ Pending recruiter review")
        elif selected is True:
            st.success("✅ Selected")
        elif selected is False:
            st.error("❌ Not selected by recruiter")
        else:
            st.info("No final selection decision")

    if result.get("recommendation") is not None:
        st.caption(
            "AI recommendation is advisory only; the recruiter makes the final decision."
        )
    for warning in result.get("safety_warnings", []):
        st.warning(warning)

    review_flags = result.get("review_flags", [])
    if review_flags:
        st.subheader("Fairness and resume verification flags")
        st.caption(result.get("review_note", "These are prompts for human review, not findings or selection criteria."))
        for flag in review_flags:
            with st.expander(f"{flag['category']}: {flag['evidence']}"):
                st.write(flag["action"])
    elif result.get("review_note"):
        st.caption(result["review_note"])

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


def employee_hr_support_section(agent):
    st.subheader("Employee Agent")
    st.caption(
        "Ask routine HR-policy questions. Answers are grounded only in the approved policy "
        "documents you provide; the agent does not access employee records or HR systems."
    )
    st.warning(
        "Do not upload documents containing employee personal data, payroll records, credentials, "
        "or confidential material unless your organization has approved sharing it with the "
        "configured AI provider. Uploaded text and your question are sent to that provider for answering."
    )
    policy_files = st.file_uploader(
        "Approved HR policy documents (PDF or TXT, up to 10 files)",
        type=["pdf", "txt"],
        accept_multiple_files=True,
        key="employee_hr_policy_files",
    )
    with st.form("employee_hr_question_form"):
        question = st.text_area(
            "What would you like to know?",
            max_chars=1000,
            placeholder="For example: How many days of annual leave does the policy provide?",
        )
        provider_authorized = st.checkbox(
            "I am authorized to share these approved policy documents and this question with the configured AI provider.",
            key="employee_hr_provider_authorized",
        )
        submit_question = st.form_submit_button(
            "Ask Employee Agent",
            type="primary",
            disabled=not bool(agent),
        )

    if submit_question:
        if not policy_files:
            st.error("Upload at least one approved HR policy document.")
        elif not provider_authorized:
            st.error("Confirm authorization before sending policy text to the AI provider.")
        elif not question.strip():
            st.error("Enter an HR policy question.")
        else:
            policy_documents = []
            for policy_file in policy_files:
                policy_text = agent.extract_text(policy_file)
                if not policy_text.strip():
                    st.error(
                        f"Could not extract readable text from {policy_file.name!r}. "
                        "Use a text-based PDF or TXT file."
                    )
                    break
                policy_documents.append(
                    {"name": policy_file.name, "text": policy_text}
                )
            else:
                with st.spinner("Checking the approved HR policies..."):
                    try:
                        result = agent.answer_employee_hr_question(
                            question=question,
                            policy_documents=policy_documents,
                        )
                    except (ValueError, RuntimeError) as exc:
                        st.error(str(exc))
                    else:
                        st.markdown("### Answer")
                        st.write(result["answer"])
                        if result["sources"]:
                            st.caption(
                                "Sources: " + ", ".join(result["sources"])
                            )
                        else:
                            st.caption("No supporting policy source was identified.")
                        if result["needs_hr_follow_up"]:
                            st.info(
                                "Please confirm this with HR. Sensitive, personal, or case-specific "
                                "questions should be handled by an authorized HR representative."
                            )


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
    st.markdown("<div class='workspace-card'><b>Interview for your selected role</b><div class='section-kicker'>Read questions aloud and answer using live browser speech recognition or typed responses.</div></div>", unsafe_allow_html=True)

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
    if "ai_interview_question_token" not in st.session_state:
        st.session_state.ai_interview_question_token = 0
    if "ai_interview_last_speech_update" not in st.session_state:
        st.session_state.ai_interview_last_speech_update = None
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
        st.markdown("<div class='section-kicker'>Optional camera motion signals are not used to score or select candidates.</div>", unsafe_allow_html=True)
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
                    st.session_state.camera_alert_caption = f"Camera motion sample: {detection['motion_score']:.2f}"

    st.markdown("<br>", unsafe_allow_html=True)

    if st.button("Start Interview"):
        st.session_state.ai_interview_question_token += 1
        st.session_state.ai_interview_last_speech_update = None
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
        safe_question = html.escape(str(st.session_state.ai_interview_question))
        st.markdown(f"<div class='question-card'><small>QUESTION</small><p>{safe_question}</p></div>", unsafe_allow_html=True)
        speech_result = live_speech_recognition(
            question=st.session_state.ai_interview_question,
            key=f"ai_interview_live_speech_{st.session_state.ai_interview_question_token}",
        )
        speech_update = speech_result.get("updatedAt") if isinstance(speech_result, dict) else None
        if (
            isinstance(speech_result, dict)
            and speech_result.get("transcript")
            and speech_update != st.session_state.ai_interview_last_speech_update
        ):
            st.session_state.ai_interview_last_speech_update = speech_update
            st.session_state.ai_interview_voice_answer = speech_result["transcript"]
            st.session_state.ai_interview_voice_status = speech_result.get("status", "listening")
            answer_widget_key = f"ai_interview_answer_input_{st.session_state.ai_interview_question_token}"
            st.session_state[answer_widget_key] = speech_result["transcript"]
        st.caption(
            "Voice recognition runs in your browser. If it is unsupported or microphone access is denied, "
            "type your answer below. Depending on your browser, speech may be processed by its speech service."
        )
        answer_widget_key = f"ai_interview_answer_input_{st.session_state.ai_interview_question_token}"
        answer = st.text_area(
            "Your answer (live transcript or typed)",
            value=st.session_state.ai_interview_voice_answer,
            key=answer_widget_key,
            height=140,
        )
        st.session_state.ai_interview_voice_answer = answer
        if st.button("Submit Answer", disabled=not answer.strip()):
            with st.spinner("Scoring your answer..."):
                result = agent.evaluate_interview_answer(st.session_state.ai_interview_question, answer)
            snapshot = agent.build_interview_snapshot(
                question=st.session_state.ai_interview_question,
                answer=answer,
                result=result,
                motion_alert=st.session_state.live_motion_alert,
                voice_answer=answer,
            )
            st.session_state.ai_interview_history.append(snapshot)
            st.session_state.ai_interview_question_token += 1
            st.session_state.ai_interview_last_speech_update = None
            st.session_state.ai_interview_question = agent.generate_interview_question(role)
            st.session_state.ai_interview_voice_answer = ""
            st.session_state.ai_interview_voice_status = "Waiting"
            st.metric("Score", f"{result['score']}/10")
            st.success(result["feedback"])
            if result.get("improvement"):
                st.caption(f"Improvement tip: {result['improvement']}")

        if st.button("Skip Question"):
            st.session_state.ai_interview_question_token += 1
            st.session_state.ai_interview_last_speech_update = None
            st.session_state.ai_interview_question = agent.generate_interview_question(role)
            st.session_state.ai_interview_voice_answer = ""
            st.session_state.ai_interview_voice_status = "Waiting"

    if st.session_state.live_motion_alert is not None:
        st.info(
            f"Camera motion signal: {st.session_state.live_motion_alert}. "
            "Movement can have many causes and is not evidence of misconduct or a hiring criterion."
        )

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
        motion_review = (
            "A camera motion event was recorded for optional human review."
            if st.session_state.camera_alert_frame
            else "No camera motion event was recorded."
        )
        st.session_state.ai_interview_completed = True
        st.session_state.ai_interview_review = {
            "average_motion": round(avg_motion, 2),
            "motion_review": motion_review,
            "summary": (
                "Camera motion is not used to evaluate candidate suitability. "
                f"Average movement intensity: {round(avg_motion, 2)}."
            ),
        }
        st.rerun()

    if st.session_state.ai_interview_completed and st.session_state.ai_interview_review:
        review = st.session_state.ai_interview_review
        st.markdown("---")
        st.subheader("Interview Review")
        st.info(review["summary"])
        st.metric("Average motion", f"{review['average_motion']}")
        st.caption(review["motion_review"])

    if st.session_state.ai_interview_history:
        st.markdown("---")
        st.subheader("Recent responses")
        for entry in reversed(st.session_state.ai_interview_history[-5:]):
            with st.expander(f"Score {entry['result']['score']}/10"):
                st.markdown(f"**Q:** {entry['question']}")
                st.markdown(f"**A:** {entry['answer']}")
                st.markdown(f"**Feedback:** {entry['result']['feedback']}")


def sourcing_integrations_section(workflow_state=None):
    """Company-facing job distribution and authorised application-ingestion workspace.

    This prepares posting packs and integration guidance only. It deliberately does not
    scrape LinkedIn/Indeed or claim to call their APIs without approved provider access.
    """
    import json

    st.subheader("Sourcing & job-board integrations")
    st.caption(
        "Prepare job-posting material and define the application-ingestion contract for your "
        "company. Live posting, profile search and applicant sync are not connected in this prototype."
    )

    linkedin_col, indeed_col = st.columns(2)
    with linkedin_col:
        with st.container(border=True):
            st.markdown("### LinkedIn Talent Solutions")
            st.warning("Not connected · approved integration access required")
            st.write(
                "LinkedIn's hiring integrations include Apply Connect, Apply With LinkedIn, "
                "Recruiter System Connect and posting capabilities. Access is restricted; "
                "its Job Posting API overview currently points new applicants toward Apply Connect."
            )
            st.markdown("[Talent Solutions APIs](https://learn.microsoft.com/en-us/linkedin/talent)")
            st.markdown("[Partner request form](https://business.linkedin.com/hire/ats-partners/partner-application)")
    with indeed_col:
        with st.container(border=True):
            st.markdown("### Indeed")
            st.warning("Not connected · ATS partner requirements apply")
            st.write(
                "Indeed documents Job Sync for job lifecycle management and Indeed Apply for "
                "application delivery. A live ATS integration needs the relevant partner process, "
                "agreements, credentials and technical review."
            )
            st.markdown("[Indeed API guides](https://docs.indeed.com/api-guides/)")
            st.markdown("[Job Sync API](https://docs.indeed.com/job-sync-api/)")
            st.markdown("[Indeed Apply for ATS partners](https://docs.indeed.com/indeed-apply/ats)")

    st.markdown("### Current channel status")
    status_rows = [
        {"Channel": "LinkedIn Jobs", "Current workflow": "Prepare copy; recruiter posts manually", "HireOS connection": "Not connected"},
        {"Channel": "Indeed", "Current workflow": "Prepare copy; recruiter posts manually", "HireOS connection": "Not connected"},
        {"Channel": "Company careers page", "Current workflow": "Use company-owned page and application URL", "HireOS connection": "Not connected"},
        {"Channel": "Referral / recruiting agency", "Current workflow": "Record source during recruiter intake", "HireOS connection": "Manual"},
    ]
    st.dataframe(status_rows, use_container_width=True, hide_index=True)

    st.markdown("### Prepare a job-posting pack")
    workflow_state = workflow_state if isinstance(workflow_state, dict) else {}
    job = workflow_state.get("job") if isinstance(workflow_state.get("job"), dict) else None
    if not job:
        st.info(
            "Create a hiring brief and generate a JD in the Hiring Workflow tab first. "
            "The pack will use that role's current company, location, requirements and JD."
        )
    else:
        approval_status = str(job.get("status") or "Draft")
        job_title = str(job.get("job_title") or "Untitled role")
        if "Approved by recruiter" not in approval_status:
            st.warning("This job description is still a draft. Approve it in Hiring Workflow before publication.")
        else:
            st.success("Job description approved by recruiter. It is still not published by HireOS.")
        st.caption(f"Requisition: {job_title} · Status: {approval_status}")
        target_channels = st.multiselect(
            "Target channels",
            ["LinkedIn", "Indeed", "Company careers page", "Other authorised job board"],
            default=["LinkedIn", "Indeed"],
            key="company_sourcing_target_channels",
        )
        description = str(job.get("jd") or "")
        posting_default = "\n".join([
            job_title,
            f"Company: {job.get('company_name') or 'To be confirmed'}",
            f"Location: {job.get('location') or 'To be confirmed'}",
            f"Number of hires: {job.get('headcount') or 1}",
            f"Salary budget: {job.get('salary_budget') or 'To be confirmed'}",
            f"Hiring timeline: {job.get('timeline') or 'To be confirmed'}",
            "",
            "Job description",
            description,
            "",
            "Essential job-related skills",
            str(job.get("requirements") or "To be confirmed"),
            "",
            "Recruiter checklist: confirm compensation, employment type, work arrangement, application URL, "
            "application deadline, lawful eligibility criteria and required notices before publishing."
        ])
        edited_posting = st.text_area(
            "Review and edit channel-ready posting copy",
            value=posting_default,
            height=360,
            key="company_sourcing_posting_copy",
        )
        posting_pack = {
            "company_name": job.get("company_name", ""),
            "job_title": job_title,
            "location": job.get("location", ""),
            "headcount": job.get("headcount", 1),
            "salary_budget": job.get("salary_budget", ""),
            "timeline": job.get("timeline", ""),
            "essential_skills": job.get("requirements", ""),
            "job_description": description,
            "target_channels": target_channels,
            "approval_status": approval_status,
            "publication_status": "Not published by HireOS",
            "integration_status": {
                "LinkedIn": "Not connected",
                "Indeed": "Not connected",
            },
            "posting_copy": edited_posting,
        }
        file_slug = re.sub(r"[^A-Za-z0-9_-]+", "-", job_title).strip("-").lower() or "requisition"
        download_col1, download_col2 = st.columns(2)
        with download_col1:
            st.download_button(
                "Download posting copy (.txt)",
                edited_posting,
                file_name=f"{file_slug}-posting.txt",
                mime="text/plain",
                use_container_width=True,
            )
        with download_col2:
            st.download_button(
                "Download requisition pack (.json)",
                json.dumps(posting_pack, ensure_ascii=False, indent=2),
                file_name=f"{file_slug}-posting-pack.json",
                mime="application/json",
                use_container_width=True,
            )

    st.markdown("### Applicant-ingestion data contract")
    st.write(
        "A company can use this template to align an authorised manual export while the provider "
        "adapter is being built. Downloading the template does not import applications into the "
        "screening workflow; automated ingestion and sync remain future integration work."
    )
    application_template = (
        "external_application_id,candidate_name,candidate_email,requisition_id,source,applied_at,"
        "resume_filename,processing_authorized\n"
        "example-application-001,Example Candidate,example@example.com,ROLE-001,Indeed,2026-01-15,"
        "resume.pdf,confirmed\n"
    )
    st.download_button(
        "Download applicant CSV template",
        application_template,
        file_name="hireos-authorised-applicant-import-template.csv",
        mime="text/csv",
    )
    st.info(
        "Do not scrape logged-in profiles or bypass platform access controls. Before a live connector, "
        "obtain the provider's required approvals and credentials, implement secure OAuth/webhook "
        "handling, map external IDs, de-duplicate retries, and document candidate notice, access, "
        "retention and deletion procedures."
    )
