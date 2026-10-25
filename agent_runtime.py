"""Bounded, observable plan-act-observe runtime for recruiter-approved work."""

import json
import re
from typing import Any, Callable


class AgentToolRegistry:
    """Explicit allowlist of in-process actions; no arbitrary code or shell tools."""

    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., Any]] = {}

    def register(self, name: str, action: Callable[..., Any]) -> None:
        if not name or not name.replace("_", "").isalnum():
            raise ValueError("Tool names must be non-empty identifiers.")
        if not callable(action):
            raise ValueError("Registered agent tools must be callable.")
        if name in self._tools:
            raise ValueError(f"Tool {name!r} is already registered.")
        self._tools[name] = action

    def describe_tools(self) -> list[str]:
        return sorted(self._tools)

    def execute(self, name: str, arguments: dict[str, Any]) -> Any:
        if name not in self._tools:
            raise ValueError(f"Tool {name!r} is not in the allowlist.")
        if not isinstance(arguments, dict):
            raise ValueError("Tool arguments must be an object.")
        return self._tools[name](**arguments)


def execute_bounded_plan(
    plan: list[dict[str, Any]],
    tools: AgentToolRegistry,
    max_steps: int = 8,
) -> dict[str, Any]:
    """Execute a bounded sequence of internal tools with stop-on-error reporting."""
    if not isinstance(plan, list) or not plan:
        raise ValueError("The agent plan must contain at least one step.")
    if not isinstance(max_steps, int) or max_steps < 1:
        raise ValueError("The plan execution limit must be a positive integer.")
    if len(plan) > max_steps:
        raise ValueError(f"Agent plan exceeds the {max_steps}-step execution limit.")

    trace = []
    for index, step in enumerate(plan, start=1):
        if not isinstance(step, dict):
            raise ValueError(f"Plan step {index} must be an object.")
        tool_name = step.get("tool")
        arguments = step.get("arguments", {})
        if not isinstance(tool_name, str) or not isinstance(arguments, dict):
            raise ValueError(f"Plan step {index} has invalid tool arguments.")
        expected_result = step.get("expected_result")
        if expected_result is not None and (
            not isinstance(expected_result, str)
            or expected_result not in {"non_empty_dict", "non_empty_list"}
        ):
            raise ValueError(f"Plan step {index} has an unsupported reflection contract.")
        try:
            observation = tools.execute(tool_name, arguments)
        except Exception as exc:
            trace.append(
                {
                    "step": index,
                    "tool": tool_name,
                    "reflection": {
                        "passed": False,
                        "message": f"Tool failed: {exc}",
                    },
                }
            )
            return {
                "status": "failed",
                "steps_completed": index - 1,
                "trace": trace,
            }
        if expected_result == "non_empty_dict":
            passed = isinstance(observation, dict) and bool(observation)
        elif expected_result == "non_empty_list":
            passed = isinstance(observation, list) and bool(observation)
        else:
            passed = True
        trace.append(
            {
                "step": index,
                "tool": tool_name,
                "observation": observation,
                "reflection": {
                    "passed": passed,
                    "message": (
                        "Output met the expected structure."
                        if passed
                        else f"Output did not meet expected result: {expected_result}."
                    ),
                },
            }
        )
        if not passed:
            return {
                "status": "failed",
                "steps_completed": index - 1,
                "trace": trace,
            }
    return {
        "status": "completed",
        "steps_completed": len(trace),
        "trace": trace,
    }


def plan_candidate_preparation(
    candidate: dict[str, Any],
    job: dict[str, Any],
    prior_work_context: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Decompose a candidate's current recruiter-approved state into one safe next tool call."""
    status = candidate.get("decision_status")
    current_round = candidate.get("current_round")
    rounds = candidate.get("rounds", {})
    required_skills = [
        skill.strip()
        for skill in re.split(r"[\n,;]+", str(job.get("requirements", "")))
        if skill.strip()
    ]
    if status == "Final recruiter decision pending" and not candidate.get(
        "hr_decision_brief"
    ):
        interview_evidence = {}
        for round_name, round_data in rounds.items():
            evidence = {
                "evaluation": round_data.get("evaluation", {}),
                "recruiter_notes": round_data.get("recruiter_notes", ""),
            }
            if round_name == "hr":
                evidence["candidate_statements"] = [
                    {"question": question, "answer": answer}
                    for question, answer in zip(
                        round_data.get("questions", []),
                        round_data.get("answers", []),
                    )
                    if isinstance(answer, str) and answer.strip()
                ]
            interview_evidence[round_name] = evidence
        return [
            {
                "tool": "build_hr_decision_brief",
                "arguments": {
                    "role": job.get("job_title", ""),
                    "required_skills": required_skills,
                    "salary_budget": job.get("salary_budget", "To be confirmed"),
                    "candidate_evidence": {
                        "skill_scores": candidate.get("skill_scores", {}),
                        "strengths": candidate.get("strengths", []),
                        "missing_skills": candidate.get("missing_skills", []),
                        "rounds": interview_evidence,
                    },
                    "prior_work_context": prior_work_context or [],
                },
                "expected_result": "non_empty_dict",
            }
        ]

    if current_round not in {"coding", "technical", "hr"}:
        return []
    round_data = rounds.get(current_round, {})
    if current_round == "coding":
        challenge = round_data.get("challenge")
        submission = str(round_data.get("candidate_submission", "")).strip()
        if challenge and submission and not round_data.get("submitted"):
            return [
                {
                    "tool": "evaluate_coding_submission",
                    "arguments": {
                        "challenge": challenge,
                        "submission": submission,
                        "required_skills": required_skills,
                    },
                    "expected_result": "non_empty_dict",
                }
            ]
        if round_data.get("challenge"):
            return []
        evaluation = round_data.get("evaluation")
        score = evaluation.get("score") if isinstance(evaluation, dict) else None
        difficulty = (
            "Hard"
            if isinstance(score, (int, float)) and score >= 80
            else "Easy"
            if isinstance(score, (int, float)) and score <= 50
            else "Medium"
        )
        return [
            {
                "tool": "generate_coding_challenge",
                "arguments": {
                    "role": job.get("job_title", ""),
                    "required_skills": required_skills,
                    "difficulty": difficulty,
                    "previous_feedback": (
                        json.dumps(evaluation, ensure_ascii=True)
                        if evaluation
                        else ""
                    ),
                },
                "expected_result": "non_empty_dict",
            }
        ]
    if round_data.get("questions"):
        answers = round_data.get("answers", [])
        if not round_data.get("evaluation") and any(
            isinstance(answer, str) and answer.strip() for answer in answers
        ):
            questions_and_answers = [
                {"question": question, "answer": answer}
                for question, answer in zip(
                    round_data.get("questions", []),
                    answers,
                )
                if isinstance(answer, str) and answer.strip()
            ]
            return [
                {
                    "tool": "evaluate_interview_round",
                    "arguments": {
                        "round_name": current_round,
                        "questions_and_answers": questions_and_answers,
                        "required_skills": required_skills,
                    },
                    "expected_result": "non_empty_dict",
                }
            ]
        return []
    return [
        {
            "tool": "generate_round_interview_questions",
            "arguments": {
                "role": job.get("job_title", ""),
                "round_name": current_round,
                "required_skills": required_skills,
                "candidate_evidence": json.dumps(
                    {
                        "strengths": candidate.get("strengths", []),
                        "missing_skills": candidate.get("missing_skills", []),
                        "previous_rounds": rounds,
                    },
                    ensure_ascii=True,
                ),
                "num_questions": 5,
                "prior_work_context": prior_work_context or [],
            },
            "expected_result": "non_empty_list",
        }
    ]


def execute_candidate_preparation(
    candidate: dict[str, Any],
    job: dict[str, Any],
    agent: Any,
    prior_work_context: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    plan = plan_candidate_preparation(candidate, job, prior_work_context)
    if not plan:
        return {
            "status": "no_action",
            "steps_completed": 0,
            "trace": [],
            "message": (
                "No safe preparation action is available. Collect candidate responses "
                "or wait for a recruiter decision."
            ),
        }

    tools = AgentToolRegistry()
    for tool_name in {
        "build_hr_decision_brief",
        "generate_coding_challenge",
        "generate_round_interview_questions",
        "evaluate_coding_submission",
        "evaluate_interview_round",
    }:
        tools.register(tool_name, getattr(agent, tool_name))
    result = execute_bounded_plan(plan, tools, max_steps=3)
    if result["status"] != "completed":
        return result

    step = plan[0]
    observation = result["trace"][0]["observation"]
    if step["tool"] == "build_hr_decision_brief":
        candidate["hr_decision_brief"] = observation
    elif step["tool"] == "generate_coding_challenge":
        round_data = candidate.setdefault("rounds", {}).setdefault("coding", {})
        round_data["challenge"] = observation
        round_data["evaluation"] = None
        round_data["difficulty"] = step["arguments"]["difficulty"]
        round_data["challenge_version"] = round_data.get("challenge_version", 0) + 1
        round_data["candidate_submission"] = ""
        round_data["submitted"] = False
    elif step["tool"] == "evaluate_coding_submission":
        round_data = candidate.setdefault("rounds", {}).setdefault("coding", {})
        round_data["evaluation"] = observation
        round_data["submitted"] = True
    elif step["tool"] == "evaluate_interview_round":
        round_name = step["arguments"]["round_name"]
        round_data = candidate.setdefault("rounds", {}).setdefault(round_name, {})
        round_data["evaluation"] = observation
    elif step["tool"] == "generate_round_interview_questions":
        round_name = step["arguments"]["round_name"]
        round_data = candidate.setdefault("rounds", {}).setdefault(round_name, {})
        round_data["questions"] = observation
        round_data["answers"] = [""] * len(observation)
    return result
