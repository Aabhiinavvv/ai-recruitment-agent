import asyncio
import inspect
import json
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class RecruitmentState(TypedDict, total=False):
    task: str
    route: str
    result: Any
    safety_warnings: list[str]
    decision_status: str
    human_decision: str


TASK_ROUTES = {
    "analyze_resume": "resume_agent",
    "generate_detailed_weaknesses": "resume_agent",
    "ask_question": "candidate_qa_agent",
    "generate_interview_question": "interview_agent",
    "generate_interview_questions": "interview_agent",
    "evaluate_interview_answer": "interview_agent",
    "build_interview_snapshot": "interview_agent",
    "detect_motion": "interview_agent",
    "detect_repeated_motion": "interview_agent",
    "flag_suspicious_behavior": "interview_agent",
    "improve_resume": "resume_coach_agent",
    "get_improved_resume": "resume_coach_agent",
}


async def _call_mcp_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    server_path = Path(__file__).with_name("mcp_server.py")
    child_env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"GEMINI_API_KEY", "GOOGLE_API_KEY"}
    }
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(server_path)],
        env=child_env,
    )
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            response = await session.call_tool(name, arguments)

    if response.isError:
        raise RuntimeError(f"MCP guardrail tool {name!r} failed.")
    structured = getattr(response, "structuredContent", None)
    if isinstance(structured, dict):
        return structured
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
    raise RuntimeError(f"MCP guardrail tool {name!r} returned no structured result.")


def _call_mcp_tool_sync(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_call_mcp_tool(name, arguments))

    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(asyncio.run, _call_mcp_tool(name, arguments)).result()


def _agent_and_payload(config: dict[str, Any]) -> tuple[Any, dict[str, Any]]:
    configurable = config.get("configurable", {})
    agent = configurable.get("recruitment_agent")
    payload = configurable.get("action_payload", {})
    if agent is None or not isinstance(payload, dict):
        raise RuntimeError("Recruitment workflow is missing its action context.")
    return agent, payload


def _request_content(task: str, payload: dict[str, Any], agent: Any) -> str:
    if task == "analyze_resume":
        resume_file = payload.get("file")
        if resume_file is None:
            return ""
        resume_text = str(agent.extract_text(resume_file) or "")
        custom_jd = payload.get("custom_jd")
        if custom_jd is None:
            return resume_text
        if isinstance(custom_jd, str):
            job_description = custom_jd
        else:
            job_description = str(agent.extract_text(custom_jd) or "")
        return f"{resume_text}\n{job_description}"
    fields = ("question", "answer", "custom_jd", "highlight_skills", "role", "areas")
    values = [payload.get(field) for field in fields if payload.get(field) is not None]
    content = []
    for value in values:
        if isinstance(value, str):
            content.append(value)
        elif hasattr(value, "getvalue") or isinstance(value, (str, Path)):
            content.append(str(agent.extract_text(value) or ""))
        else:
            content.append(json.dumps(value, ensure_ascii=True))
    return "\n".join(content)


def _guardrail(state: RecruitmentState, config: RunnableConfig) -> dict[str, Any]:
    agent, payload = _agent_and_payload(config)
    task = state["task"]
    decision = _call_mcp_tool_sync(
        "check_recruitment_request",
        {
            "task": task,
            "content": _request_content(task, payload, agent),
            "role": str(payload.get("role") or ""),
        },
    )
    if not decision.get("allowed"):
        details = "; ".join(decision.get("errors", [])) or "Request rejected by guardrails."
        raise ValueError(details)
    return {"safety_warnings": decision.get("warnings", [])}


def _supervisor(state: RecruitmentState) -> dict[str, Any]:
    route = TASK_ROUTES.get(state["task"])
    if route is None:
        raise ValueError(f"Unsupported recruitment action: {state['task']}")
    return {"route": route}


def _agent_node(state: RecruitmentState, config: RunnableConfig) -> dict[str, Any]:
    agent, payload = _agent_and_payload(config)
    result = getattr(agent, state["task"])(**payload)
    return {"result": result}


def _validate_analysis(state: RecruitmentState) -> dict[str, Any]:
    result = state.get("result")
    if not isinstance(result, dict):
        raise TypeError("Resume analysis must return a structured result.")
    decision = _call_mcp_tool_sync(
        "check_analysis_output",
        {
            "overall_score": result.get("overall_score"),
            "skill_scores": result.get("skill_scores"),
        },
    )
    if not decision.get("allowed"):
        details = "; ".join(decision.get("errors", [])) or "Analysis output rejected."
        raise ValueError(details)

    guarded_result = dict(result)
    guarded_result["recommendation"] = bool(guarded_result.get("selected"))
    guarded_result["selected"] = None
    guarded_result["decision_status"] = "Pending recruiter review"
    warnings = state.get("safety_warnings", [])
    if warnings:
        guarded_result["safety_warnings"] = list(warnings)
    return {"result": guarded_result, "decision_status": "pending"}


def _human_review(state: RecruitmentState, config: RunnableConfig) -> dict[str, Any]:
    agent, _ = _agent_and_payload(config)
    action = interrupt(
        {
            "type": "candidate_decision",
            "message": "Review the job-related evidence and make the final decision.",
            "analysis": state["result"],
        }
    )
    if not isinstance(action, dict):
        raise ValueError("Recruiter decision must be supplied as an action object.")
    decision = _call_mcp_tool_sync(
        "check_human_decision",
        {"action": action.get("action", "")},
    )
    if not decision.get("allowed"):
        details = "; ".join(decision.get("errors", [])) or "Invalid recruiter decision."
        raise ValueError(details)

    selected = action["action"] == "approve"
    result = dict(state["result"])
    result["selected"] = selected
    result["human_decision"] = action["action"]
    result["decision_status"] = "Approved by recruiter" if selected else "Rejected by recruiter"
    agent.analysis_results = result
    return {
        "result": result,
        "human_decision": action["action"],
        "decision_status": "approved" if selected else "rejected",
    }


def _route_after_agent(state: RecruitmentState) -> str:
    return "validate_analysis" if state["task"] == "analyze_resume" else "finish"


def _build_graph():
    graph = StateGraph(RecruitmentState)
    graph.add_node("guardrail", _guardrail)
    graph.add_node("supervisor", _supervisor)
    for node in {
        "resume_agent",
        "candidate_qa_agent",
        "interview_agent",
        "resume_coach_agent",
    }:
        graph.add_node(node, _agent_node)
    graph.add_node("validate_analysis", _validate_analysis)
    graph.add_node("human_review", _human_review)
    graph.add_node("finish", lambda state: {})

    graph.add_edge(START, "guardrail")
    graph.add_edge("guardrail", "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        lambda state: state["route"],
        {
            "resume_agent": "resume_agent",
            "candidate_qa_agent": "candidate_qa_agent",
            "interview_agent": "interview_agent",
            "resume_coach_agent": "resume_coach_agent",
        },
    )
    for node in {
        "resume_agent",
        "candidate_qa_agent",
        "interview_agent",
        "resume_coach_agent",
    }:
        graph.add_conditional_edges(
            node,
            _route_after_agent,
            {"validate_analysis": "validate_analysis", "finish": "finish"},
        )
    graph.add_edge("validate_analysis", "human_review")
    graph.add_edge("human_review", "finish")
    graph.add_edge("finish", END)
    return graph.compile(checkpointer=MemorySaver())


class RecruitmentWorkflow:
    def __init__(self, recruitment_agent: Any):
        self._agent = recruitment_agent
        self._graph = _build_graph()
        self._pending_review_thread: str | None = None



        

    def configure(self, api_key: str, cutoff_score: int, model: str | None) -> None:
        self._agent.api_key = api_key
        self._agent.cutoff_score = cutoff_score
        self._agent.model = model

    @property
    def awaiting_review(self) -> bool:
        return self._pending_review_thread is not None

    @property
    def pending_review(self) -> dict[str, Any] | None:
        if not self._pending_review_thread:
            return None
        config = {"configurable": {"thread_id": self._pending_review_thread}}
        snapshot = self._graph.get_state(config)
        return snapshot.values.get("result")

    def approve_or_reject(self, action: str) -> dict[str, Any]:
        if not self._pending_review_thread:
            raise RuntimeError("There is no candidate decision awaiting review.")
        thread_id = self._pending_review_thread
        result = self._graph.invoke(
            Command(resume={"action": action}),
            config={
                "configurable": {
                    "thread_id": thread_id,
                    "recruitment_agent": self._agent,
                    "action_payload": {},
                }
            },
        )
        self._pending_review_thread = None
        self._agent.analysis_results = result["result"]
        return result["result"]

    def _invoke(self, task: str, *args: Any, **kwargs: Any) -> Any:
        method = getattr(self._agent, task)
        bound = inspect.signature(method).bind(*args, **kwargs)
        bound.apply_defaults()
        thread_id = str(uuid.uuid4())
        result = self._graph.invoke(
            {"task": task},
            config={
                "configurable": {
                    "thread_id": thread_id,
                    "recruitment_agent": self._agent,
                    "action_payload": dict(bound.arguments),
                }
            },
        )
        if task == "analyze_resume":
            if result.get("__interrupt__"):
                self._pending_review_thread = thread_id
            else:
                self._agent.analysis_results = result.get("result", {})
        if task == "generate_detailed_weaknesses":
            self._agent.analysis_results = getattr(self._agent, "analysis_results", {})
        return result.get("result")

    def cleanup(self) -> None:
        self._agent.cleanup()

    def __getattr__(self, name: str) -> Any:
        if name in TASK_ROUTES:
            return lambda *args, **kwargs: self._invoke(name, *args, **kwargs)
        return getattr(self._agent, name)
