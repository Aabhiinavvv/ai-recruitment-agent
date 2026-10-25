"""Canonical description of the recruiter's four-layer hiring platform."""

PLATFORM_LAYERS = (
    {
        "id": "agent_workforce",
        "number": 1,
        "name": "Agent Workforce",
        "purpose": "Routes tasks and delegates to specialists through bounded plan-act-observe cycles.",
        "modules": ("workflow.py", "agent_runtime.py", "agents.py"),
        "boundary": "Tool calls are allowlisted; action results are reflected on; agents cannot decide hiring outcomes.",
    },
    {
        "id": "company_memory",
        "number": 2,
        "name": "Company Memory",
        "purpose": "Supplies consented candidate history and the active workforce relationship graph.",
        "modules": ("organizational_memory.py", "hiring_pipeline.py"),
        "boundary": "Persistent history is encrypted and opt-in; role ranking uses current-role evidence.",
    },
    {
        "id": "reasoning_engine",
        "number": 3,
        "name": "Reasoning Engine",
        "purpose": "Plans workflows, evaluates evidence, and reflects on completed internal actions.",
        "modules": ("agent_runtime.py", "agents.py", "mcp_server.py", "hiring_pipeline.py"),
        "boundary": "Reasoning is bounded and observable; outputs are advisory and must not use protected traits.",
    },
    {
        "id": "execution_engine",
        "number": 4,
        "name": "Execution Engine",
        "purpose": "Applies recruiter-approved workflow transitions and prepares action drafts.",
        "modules": ("ui.py", "hiring_pipeline.py"),
        "boundary": "Recruiter approval is required; external publishing, messaging, and provisioning are not connected.",
    },
)

PLATFORM_FLOW = (
    "Recruiter request",
    "Agent Workforce",
    "Company Memory",
    "Reasoning Engine",
    "Recruiter approval",
    "Execution Engine",
    "Audit event and workflow result",
)
