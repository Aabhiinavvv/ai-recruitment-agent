import React from 'react';
import { Layers, ShieldCheck, Database, Cpu, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';

const PLATFORM_LAYERS = [
  {
    id: "agent_workforce",
    number: 1,
    name: "Agent Workforce",
    purpose: "Routes tasks and delegates to specialists through bounded plan-act-observe cycles.",
    modules: ["workflow.ts", "agentRuntime.ts", "agents.ts"],
    boundary: "Tool calls are allowlisted; action results are reflected on; agents cannot decide hiring outcomes.",
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800"
  },
  {
    id: "company_memory",
    number: 2,
    name: "Company Memory",
    purpose: "Supplies consented candidate history and the active workforce relationship graph.",
    modules: ["organizationalMemory.ts", "hiringPipeline.ts"],
    boundary: "Persistent history is encrypted and opt-in; role ranking uses current-role evidence.",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800"
  },
  {
    id: "reasoning_engine",
    number: 3,
    name: "Reasoning Engine",
    purpose: "Plans workflows, evaluates evidence, and reflects on completed internal actions.",
    modules: ["agentRuntime.ts", "agents.ts", "mcpServer.ts", "hiringPipeline.ts"],
    boundary: "Reasoning is bounded and observable; outputs are advisory and must not use protected traits.",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800"
  },
  {
    id: "execution_engine",
    number: 4,
    name: "Execution Engine",
    purpose: "Applies recruiter-approved workflow transitions and prepares action drafts.",
    modules: ["ui.tsx", "hiringPipeline.ts"],
    boundary: "Recruiter approval is required; external publishing, messaging, and provisioning are not connected.",
    color: "from-purple-500 to-violet-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-800"
  }
];

const PLATFORM_FLOW = [
  "Recruiter Request",
  "Agent Workforce",
  "Company Memory",
  "Reasoning Engine",
  "Recruiter Approval Gate",
  "Execution Engine",
  "Audit Event & Shortlist"
];

export const ArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#6743ee]" />
          Four-Layer Recruiter-Supervised Architecture
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          A recruiter-supervised architecture: agents coordinate work, memory supplies consented context,
          reasoning produces evidence-based guidance, and execution records only approved actions.
        </p>
      </div>

      {/* Interactive Flow Diagram */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-800">Sequential Architectural Data Flow</h3>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {PLATFORM_FLOW.map((step, idx) => (
            <React.Fragment key={step}>
              <div
                className={`px-3 py-2 rounded-xl font-semibold shadow-xs flex items-center gap-1.5 ${
                  step === "Recruiter Approval Gate"
                    ? "bg-rose-100 text-rose-800 border border-rose-300 font-bold"
                    : "bg-slate-100 text-slate-800 border border-slate-200"
                }`}
              >
                {step === "Recruiter Approval Gate" && <UserCheck className="w-4 h-4 text-rose-600" />}
                {step}
              </div>
              {idx < PLATFORM_FLOW.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Human in the loop callout */}
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-950">
          <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Recruiter Supervision & Non-Delegable Authority</span>
            AI agents provide multi-dimensional candidate evaluation and draft interview material.
            Consequential selections (advancing, rejecting, issuing formal invitations, hiring) strictly require active recruiter confirmation.
          </div>
        </div>
      </div>

      {/* Layer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLATFORM_LAYERS.map((layer) => (
          <div
            key={layer.id}
            className={`p-5 rounded-2xl border ${layer.border} ${layer.bg} space-y-3 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${layer.badge}`}>
                Layer {layer.number}
              </span>
              <span className="text-xs font-mono text-slate-400">ID: {layer.id}</span>
            </div>

            <h4 className="text-base font-bold text-slate-900">{layer.name}</h4>
            <p className="text-xs text-slate-700 leading-relaxed">{layer.purpose}</p>

            <div className="pt-2 border-t border-slate-200/60 space-y-1 text-xs">
              <span className="text-slate-500 font-medium block">
                Modules: <strong className="text-slate-700">{layer.modules.join(", ")}</strong>
              </span>
              <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                <strong>Safety Boundary:</strong> {layer.boundary}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Warning / Boundary Note */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          This is the app's logical architecture mapped onto modular components. Memory integrations are opt-in,
          and external publishing or email dispatching integrations remain sandboxed until authorized credentials are supplied.
        </p>
      </div>
    </div>
  );
};
