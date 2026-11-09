import React, { useMemo, useState } from 'react';
import type { Candidate, HiringBrief } from '../types';
import {
  createOrchestrationPlan,
  type CandidateOrchestrationState,
  type CommunicationStatus,
  type InterviewStatus,
  type OfferStatus,
  type OnboardingStatus,
  type OrchestrationPlanResponse,
  type RecruiterDecision,
  type VerificationStatus,
} from '../services/recruitmentOrchestratorApi';
import {
  AlertCircle,
  ArrowDown,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface RecruitmentOrchestratorPanelProps {
  brief: HiringBrief | null;
  candidates: Candidate[];
  onAudit?: (action: string, subject: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  ready: 'Ready to run',
  blocked: 'Blocked by dependency',
  needs_human_review: 'Human review required',
  waiting_external_action: 'Waiting for external action',
  not_applicable: 'Not applicable',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ready: 'bg-sky-50 text-sky-800 border-sky-200',
  blocked: 'bg-rose-50 text-rose-800 border-rose-200',
  needs_human_review: 'bg-amber-50 text-amber-900 border-amber-200',
  waiting_external_action: 'bg-violet-50 text-violet-800 border-violet-200',
  not_applicable: 'bg-slate-100 text-slate-600 border-slate-200',
};

const decisionFor = (candidate: Candidate): RecruiterDecision => {
  if (candidate.decision_status === 'Hired by recruiter') return 'hire_approved';
  if (candidate.decision_status === 'Advanced by recruiter') return 'advance';
  if (candidate.decision_status === 'Not proceeding (recruiter decision)') return 'not_proceeding';
  return 'pending';
};

const SelectField: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, options, onChange, disabled }) => (
  <label className="block space-y-1">
    <span className="text-xs font-semibold text-slate-700">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

export const RecruitmentOrchestratorPanel: React.FC<RecruitmentOrchestratorPanelProps> = ({
  brief,
  candidates,
  onAudit,
}) => {
  const [candidateIndex, setCandidateIndex] = useState('-1');
  const [matchingReviewed, setMatchingReviewed] = useState(false);
  const [communicationConsent, setCommunicationConsent] = useState(false);
  const [communicationStatus, setCommunicationStatus] = useState<CommunicationStatus>('not_started');
  const [interviewConsent, setInterviewConsent] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>('not_started');
  const [verificationConsent, setVerificationConsent] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('not_started');
  const [offerStatus, setOfferStatus] = useState<OfferStatus>('not_started');
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('not_started');

  const [analyticsGenerated, setAnalyticsGenerated] = useState(false);
  const [workforceMonths, setWorkforceMonths] = useState('0');
  const [workforceAssumptions, setWorkforceAssumptions] = useState(false);
  const [workforceGenerated, setWorkforceGenerated] = useState(false);

  const [plan, setPlan] = useState<OrchestrationPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedIndex = Number(candidateIndex);
  const selectedCandidate = candidates[selectedIndex];
  const jobStatus = brief?.status?.toLowerCase().includes('approved')
    ? 'approved'
    : brief
      ? 'draft'
      : 'not_started';
  const jobTitle = brief?.job_title ?? 'No role brief selected';

  const candidateRef = useMemo(
    () => selectedCandidate ? 'candidate-' + String(selectedIndex + 1).padStart(4, '0') : '',
    [selectedCandidate, selectedIndex],
  );

  const defaultOfferOptions = [
    { value: 'not_started', label: 'Not started' },
    { value: 'draft', label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'sent', label: 'Sent outside the platform' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'declined', label: 'Declined' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ];

  const buildCandidateState = (): CandidateOrchestrationState | null => {
    if (!selectedCandidate) return null;
    const decision = decisionFor(selectedCandidate);
    return {
      candidate_ref: candidateRef,
      profile_ready: Boolean(selectedCandidate.resume_profile?.trim()),
      matching_reviewed: matchingReviewed,
      recruiter_decision: decision,
      communication_consent_confirmed: communicationConsent,
      communication_status: communicationStatus,
      interview_consent_confirmed: interviewConsent,
      interview_status: interviewStatus,
      verification_consent_confirmed: verificationConsent,
      verification_status: verificationStatus,
      offer_status: offerStatus,
      onboarding_status: onboardingStatus,
    };
  };

  const generatePlan = async () => {
    setError(null);
    setPlan(null);
    const candidateState = buildCandidateState();
    if (candidates.length > 0 && !candidateState) {
      setError('Select a candidate to create a candidate-specific orchestration plan.');
      return;
    }
    if (interviewStatus !== 'not_started' && !matchingReviewed) {
      setError('Interview status requires recruiter-reviewed matching evidence.');
      return;
    }
    if (verificationStatus !== 'not_started' && interviewStatus !== 'completed') {
      setError('Background verification requires a completed and reviewed interview.');
      return;
    }
    if (offerStatus !== 'not_started' && candidateState?.recruiter_decision !== 'hire_approved') {
      setError('Offer states require a recruiter-recorded final hire approval.');
      return;
    }
    if (['draft', 'approved', 'sent', 'accepted'].includes(offerStatus) && interviewStatus !== 'completed') {
      setError('Offer workflow requires a completed and reviewed interview.');
      return;
    }
    if (['draft', 'approved', 'sent', 'accepted'].includes(offerStatus) && verificationStatus !== 'completed') {
      setError('Offer workflow requires a completed background-verification review.');
      return;
    }
    if (onboardingStatus !== 'not_started' && offerStatus !== 'accepted') {
      setError('Onboarding can only progress after the offer is recorded as accepted.');
      return;
    }
    setLoading(true);
    try {
      const response = await createOrchestrationPlan({
        role_ref: 'role-0001',
        job_status: jobStatus,
        candidate_count_in_pipeline: candidates.length,
        candidate: candidateState,
        analytics_snapshot_generated: analyticsGenerated,
        workforce_history_months_available: Number(workforceMonths),
        workforce_assumptions_confirmed: workforceAssumptions,
        workforce_forecast_generated: workforceGenerated,
      });
      setPlan(response);
      onAudit?.('Generated dependency-aware recruitment orchestration plan', jobTitle + ' — ' + response.orchestration_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create orchestration plan.');
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-700" />;
    if (status === 'ready') return <Circle className="h-4 w-4 text-sky-700" />;
    if (status === 'waiting_external_action') return <Clock3 className="h-4 w-4 text-violet-700" />;
    if (status === 'needs_human_review') return <UserCheck className="h-4 w-4 text-amber-700" />;
    return <LockKeyhole className="h-4 w-4 text-slate-500" />;
  };

  return (
    <section className="space-y-5 rounded-2xl border border-fuchsia-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-fuchsia-50 p-2.5 text-fuchsia-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 10 — AI Recruitment Orchestrator</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Coordinate Agents 1–9 using dependency gates, recruiter decisions, candidate consent and workflow state.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">Central coordination layer</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p className="font-semibold text-slate-800">Plan mode, not automatic execution</p>
        Agent 10 checks the facts you supply, orders dependencies and identifies the next safe actions. It does not invoke the other agents, send messages, run verification providers, update candidate decisions or persist workflow state.
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">1. Select workflow scope</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] font-semibold text-slate-600">Role</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{jobTitle}</p>
            <p className="mt-1 text-[11px] text-slate-500">Job state: {jobStatus.replace(/_/g, ' ')}</p>
          </div>
          <SelectField
            label="Candidate workflow (optional for role-level tasks)"
            value={candidateIndex}
            onChange={(value) => {
              setCandidateIndex(value);
              setMatchingReviewed(false);
              setCommunicationConsent(false);
              setCommunicationStatus('not_started');
              setInterviewConsent(false);
              setInterviewStatus('not_started');
              setVerificationConsent(false);
              setVerificationStatus('not_started');
              setOfferStatus('not_started');
              setOnboardingStatus('not_started');
              setPlan(null);
            }}
            options={[
              { value: '-1', label: 'Role-level tasks only' },
              ...candidates.map((candidate, index) => ({
                value: String(index),
                label: candidate.name + ' — ' + candidate.role,
              })),
            ]}
          />
        </div>
        {selectedCandidate && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">Selected workflow candidate</p>
            <p className="mt-1 text-xs text-slate-600">{selectedCandidate.name} · {selectedCandidate.role}</p>
            <p className="mt-1 text-[11px] text-slate-500">Recruiter decision: {selectedCandidate.decision_status}. Candidate IDs and identity fields are not sent to the orchestration API.</p>
          </div>
        )}
      </div>

      {selectedCandidate && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-slate-900">2. Confirm candidate workflow facts</h3>
          <p className="text-xs leading-5 text-slate-500">
            These are explicit workflow attestations for the current planning request. They are not imported automatically from other agent sessions because the prototype does not yet have a shared persistent workflow database.
          </p>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" checked={matchingReviewed} onChange={(event) => setMatchingReviewed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
            <span className="text-xs leading-5 text-slate-700">Recruiter has reviewed the evidence-backed matching and ranking result.</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={communicationConsent} onChange={(event) => { setCommunicationConsent(event.target.checked); if (!event.target.checked) setCommunicationStatus('not_started'); }} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
              <span className="text-xs leading-5 text-slate-700">Candidate has consented to recruitment communications.</span>
            </label>
            <SelectField
              label="Communication workflow status"
              value={communicationStatus}
              onChange={(value) => setCommunicationStatus(value as CommunicationStatus)}
              disabled={!communicationConsent}
              options={[
                { value: 'not_started', label: 'Not started' },
                { value: 'drafted', label: 'Draft prepared' },
                { value: 'approved', label: 'Recruiter approved' },
                { value: 'external_delivery_recorded', label: 'External delivery recorded' },
                { value: 'responded', label: 'Candidate response recorded' },
              ]}
            />
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={interviewConsent} onChange={(event) => { setInterviewConsent(event.target.checked); if (!event.target.checked) setInterviewStatus('not_started'); }} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
              <span className="text-xs leading-5 text-slate-700">Candidate has consented to interview processing.</span>
            </label>
            <SelectField
              label="Interview workflow status"
              value={interviewStatus}
              onChange={(value) => setInterviewStatus(value as InterviewStatus)}
              disabled={!interviewConsent}
              options={[
                { value: 'not_started', label: 'Not started' },
                { value: 'scheduled', label: 'Scheduled / waiting for interview' },
                { value: 'completed', label: 'Completed — recruiter reviewed' },
                { value: 'needs_review', label: 'Needs human review' },
              ]}
            />
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={verificationConsent} onChange={(event) => { setVerificationConsent(event.target.checked); if (!event.target.checked) setVerificationStatus('not_started'); }} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
              <span className="text-xs leading-5 text-slate-700">Candidate has authorised the selected background checks.</span>
            </label>
            <SelectField
              label="Background verification status"
              value={verificationStatus}
              onChange={(value) => setVerificationStatus(value as VerificationStatus)}
              disabled={!verificationConsent}
              options={[
                { value: 'not_started', label: 'Not started' },
                { value: 'in_progress', label: 'In progress — awaiting source/provider' },
                { value: 'completed', label: 'Completed — reviewed' },
                { value: 'discrepancy', label: 'Discrepancy — human review' },
                { value: 'unable_to_verify', label: 'Unable to verify — human review' },
              ]}
            />
            <SelectField
              label="Offer status"
              value={offerStatus}
              onChange={(value) => {
                setOfferStatus(value as OfferStatus);
                if (value !== 'accepted') setOnboardingStatus('not_started');
              }}
              options={defaultOfferOptions}
            />
            <SelectField
              label="Onboarding status"
              value={onboardingStatus}
              onChange={(value) => setOnboardingStatus(value as OnboardingStatus)}
              disabled={offerStatus !== 'accepted'}
              options={[
                { value: 'not_started', label: 'Not started' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-bold text-slate-900">3. Role-level analytics and workforce planning</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" checked={analyticsGenerated} onChange={(event) => setAnalyticsGenerated(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
            <span className="text-xs leading-5 text-slate-700">Agent 8 analytics snapshot has been generated for this role.</span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" checked={workforceAssumptions} onChange={(event) => setWorkforceAssumptions(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
            <span className="text-xs leading-5 text-slate-700">HR/business owners have confirmed workforce planning assumptions.</span>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Months of aggregate workforce history</span>
            <input type="number" min="0" max="36" value={workforceMonths} onChange={(event) => setWorkforceMonths(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" checked={workforceGenerated} onChange={(event) => setWorkforceGenerated(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-700"/>
            <span className="text-xs leading-5 text-slate-700">Agent 9 workforce forecast has been generated.</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={generatePlan}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-fuchsia-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
        {loading ? 'Building orchestration plan…' : 'Generate master workflow plan'}
      </button>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}
        </p>
      )}

      {plan && (
        <div className="space-y-4 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Master orchestration plan</h3>
              <p className="mt-1 text-[11px] text-slate-500">{plan.orchestration_id} · {plan.role_ref}{plan.candidate_ref ? ' · ' + plan.candidate_ref : ''}</p>
            </div>
            <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-800">
              {plan.completion_percent.toFixed(1)}% complete
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <CountCard label="Completed" value={plan.counts.completed}/>
            <CountCard label="Ready" value={plan.counts.ready}/>
            <CountCard label="Blocked" value={plan.counts.blocked}/>
            <CountCard label="Human review" value={plan.counts.needs_human_review}/>
            <CountCard label="Waiting" value={plan.counts.waiting_external_action}/>
            <CountCard label="Not applicable" value={plan.counts.not_applicable}/>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-fuchsia-600 transition-all" style={{ width: plan.completion_percent + '%' }}/>
          </div>

          <div className="space-y-3">
            {plan.tasks.map((task, index) => (
              <React.Fragment key={task.agent_number}>
                <article className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{task.agent_number}</div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Agent {task.agent_number} — {task.agent_name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{task.recommended_action}</p>
                      </div>
                    </div>
                    <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold ' + STATUS_STYLES[task.status]}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  {task.dependencies.length > 0 && <p className="mt-2 text-[10px] text-slate-500">Dependencies: {task.dependencies.map((dep) => 'Agent ' + dep).join(', ')}</p>}
                  {task.blockers.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-rose-700">
                      {task.blockers.map((blocker, blockerIndex) => <li key={blockerIndex}>{blocker}</li>)}
                    </ul>
                  )}
                </article>
                {index < plan.tasks.length - 1 && <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-slate-300"/></div>}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-bold text-sky-950">Next recommended actions</p>
            {plan.next_actions.length ? plan.next_actions.map((task) => (
              <div key={task.agent_number} className="flex items-start gap-2 text-xs leading-5 text-sky-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>
                <span><strong>Agent {task.agent_number}:</strong> {task.recommended_action}</span>
              </div>
            )) : <p className="text-xs text-sky-900">No ready tasks. Resolve blockers or review the completed workflow.</p>}
          </div>

          {plan.warnings.map((warning, index) => (
            <p key={index} className="text-[11px] leading-5 text-amber-800">• {warning}</p>
          ))}
          <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
            Every task remains subject to human approval. This is a stateless plan; generating it does not trigger any agent, send any message or modify the candidate record.
          </p>
        </div>
      )}
    </section>
  );
};

const CountCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-[10px] font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
  </div>
);
