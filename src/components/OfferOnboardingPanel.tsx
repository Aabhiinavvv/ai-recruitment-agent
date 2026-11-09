import React, { useMemo, useState } from 'react';
import type { Candidate, HiringBrief } from '../types';
import {
  createOfferDraft,
  createOnboardingPlan,
  recordOfferEvent,
  recordOnboardingTaskEvent,
  type EmploymentType,
  type OfferDraftResponse,
  type OfferEvent,
  type OfferEventResponse,
  type OfferStatus,
  type OnboardingPlanResponse,
  type OnboardingTask,
  type OnboardingTaskStatus,
} from '../services/onboardingApi';
import {
  AlertCircle,
  BadgeCheck,
  ClipboardList,
  Download,
  FileSignature,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface OfferOnboardingPanelProps {
  brief: HiringBrief | null;
  candidates: Candidate[];
  onAudit?: (action: string, subject: string) => void;
}

const EMPLOYMENT_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft_pending_approval: 'Draft — approval required',
  approved_not_sent: 'Approved — not sent',
  sent_outside_platform: 'Sent outside platform',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

const TASK_STATUS_LABELS: Record<OnboardingTaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const NEXT_TASK_STATUSES: Record<OnboardingTaskStatus, OnboardingTaskStatus[]> = {
  pending: ['in_progress', 'blocked', 'completed'],
  in_progress: ['blocked', 'completed'],
  blocked: ['in_progress'],
  completed: [],
};

const todayIso = () => {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const OfferOnboardingPanel: React.FC<OfferOnboardingPanelProps> = ({
  brief,
  candidates,
  onAudit,
}) => {
  const approvedCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.decision_status === 'Hired by recruiter'),
    [candidates],
  );
  const jobApproved = brief?.status === 'Approved by recruiter — publishing integration required';

  const [candidateId, setCandidateId] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [currency, setCurrency] = useState('INR');
  const [compensationAmount, setCompensationAmount] = useState('');
  const [payFrequency, setPayFrequency] = useState<'annual' | 'monthly' | 'hourly'>('annual');
  const [workMode, setWorkMode] = useState<'onsite' | 'hybrid' | 'remote'>('hybrid');
  const [workLocation, setWorkLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [probationMonths, setProbationMonths] = useState('3');
  const [benefitsText, setBenefitsText] = useState('');
  const [termsText, setTermsText] = useState('');
  const [hireApprovalConfirmed, setHireApprovalConfirmed] = useState(false);
  const [verificationReviewConfirmed, setVerificationReviewConfirmed] = useState(false);
  const [unresolvedItems, setUnresolvedItems] = useState('0');

  const [offer, setOffer] = useState<OfferDraftResponse | null>(null);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>('draft_pending_approval');
  const [offerExpiry, setOfferExpiry] = useState('');
  const [offerEventReference, setOfferEventReference] = useState('');
  const [offerEventNote, setOfferEventNote] = useState('');
  const [candidateResponseConfirmed, setCandidateResponseConfirmed] = useState(false);

  const [onboarding, setOnboarding] = useState<OnboardingPlanResponse | null>(null);
  const [onboardingStartApproved, setOnboardingStartApproved] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [taskStatuses, setTaskStatuses] = useState<Record<string, OnboardingTaskStatus>>({});
  const [taskSavingId, setTaskSavingId] = useState<string | null>(null);

  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [isSubmittingOfferEvent, setIsSubmittingOfferEvent] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = approvedCandidates.find((candidate) => candidate.candidate_id === candidateId);

  const createDraft = async () => {
    setError(null);
    setOffer(null);
    setOnboarding(null);
    if (!brief || !jobApproved) {
      setError('Approve the job description in Agent 1 before preparing an offer.');
      return;
    }
    if (!selectedCandidate) {
      setError('Select a candidate whose hire decision has been explicitly recorded by the recruiter.');
      return;
    }
    if (!hireApprovalConfirmed) {
      setError('Confirm the final recruiter hire approval.');
      return;
    }
    if (!verificationReviewConfirmed || Number(unresolvedItems) !== 0) {
      setError('Confirm that the background verification review is complete and there are no unresolved items.');
      return;
    }
    if (!compensationAmount.trim() || !workLocation.trim() || !startDate || !expiryDate) {
      setError('Complete all required offer terms. The system will not invent missing terms.');
      return;
    }
    if (expiryDate < todayIso() || startDate <= expiryDate) {
      setError('The start date must be after a future offer expiry date.');
      return;
    }

    setIsCreatingOffer(true);
    try {
      const result = await createOfferDraft({
        candidate_id: selectedCandidate.candidate_id,
        job_title: brief.job_title,
        company_name: brief.company_name,
        recruiter_hire_approved: true,
        verification_review_completed: true,
        unresolved_verification_items: 0,
        employment_type: employmentType,
        currency: currency.toUpperCase(),
        compensation_amount: compensationAmount,
        pay_frequency: payFrequency,
        work_mode: workMode,
        work_location_label: workLocation.trim(),
        start_date: startDate,
        offer_expiry_date: expiryDate,
        probation_months: probationMonths.trim() === '' ? null : Number(probationMonths),
        benefits: benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
        additional_terms: termsText.split('\n').map((item) => item.trim()).filter(Boolean),
      });
      setOffer(result);
      setOfferStatus(result.status);
      setOfferExpiry(result.offer_expiry_date);
      onAudit?.('Prepared non-binding offer draft for recruiter approval', selectedCandidate.name + ' (' + selectedCandidate.candidate_id + ')');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare offer draft.');
    } finally {
      setIsCreatingOffer(false);
    }
  };

  const submitOfferEvent = async (event: OfferEvent) => {
    if (!offer) return;
    setError(null);
    setIsSubmittingOfferEvent(true);
    try {
      const response: OfferEventResponse = await recordOfferEvent({
        offer_id: offer.offer_id,
        candidate_id: offer.candidate_id,
        current_status: offerStatus,
        event,
        recruiter_attested: true,
        candidate_response_confirmed: event === 'record_acceptance' || event === 'record_decline'
          ? candidateResponseConfirmed
          : false,
        event_reference: ['mark_sent', 'record_acceptance', 'record_decline'].includes(event)
          ? offerEventReference.trim() || null
          : null,
        offer_expiry_date: offerExpiry,
        reviewer_note: offerEventNote.trim(),
      });
      setOfferStatus(response.current_status);
      setOfferEventReference('');
      setOfferEventNote('');
      setCandidateResponseConfirmed(false);
      onAudit?.(
        'Recorded offer workflow event: ' + event,
        offer.candidate_id + ' — ' + response.current_status,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record offer event.');
    } finally {
      setIsSubmittingOfferEvent(false);
    }
  };

  const createPlan = async () => {
    if (!offer || offerStatus !== 'accepted') return;
    setError(null);
    if (!onboardingStartApproved) {
      setError('Confirm recruiter approval to initiate onboarding.');
      return;
    }
    setIsCreatingPlan(true);
    try {
      const result = await createOnboardingPlan({
        offer_id: offer.offer_id,
        candidate_id: offer.candidate_id,
        job_title: offer.job_title,
        employment_type: offer.employment_type,
        offer_status: 'accepted',
        recruiter_start_approved: true,
        start_date: offer.start_date,
      });
      setOnboarding(result);
      setTaskStatuses(Object.fromEntries(result.tasks.map((task) => [task.task_id, task.status])));
      onAudit?.('Created onboarding task plan after recorded offer acceptance', offer.candidate_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create onboarding plan.');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const updateTask = async (task: OnboardingTask, currentStatus: OnboardingTaskStatus, target: OnboardingTaskStatus) => {
    if (!onboarding || target === currentStatus) return;
    const note = taskNotes[task.task_id] ?? '';
    if (target === 'blocked' && !note.trim()) {
      setError('Add a non-sensitive note explaining why the task is blocked.');
      return;
    }
    setError(null);
    setTaskSavingId(task.task_id);
    try {
      const response = await recordOnboardingTaskEvent({
        plan_id: onboarding.plan_id,
        offer_id: onboarding.offer_id,
        candidate_id: onboarding.candidate_id,
        task_id: task.task_id,
        current_status: currentStatus,
        target_status: target,
        reviewer_attested: true,
        reviewer_note: note.trim(),
      });
      setTaskStatuses((current) => ({ ...current, [task.task_id]: response.current_status }));
      onAudit?.('Updated onboarding task: ' + response.current_status, offer?.candidate_id + ' — ' + task.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update onboarding task.');
    } finally {
      setTaskSavingId(null);
    }
  };

  const exportOffer = () => {
    if (!offer) return;
    const blob = new Blob([offer.draft_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'offer-draft-' + offer.offer_id.toLowerCase() + '.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportOnboarding = () => {
    if (!onboarding) return;
    const report = {
      ...onboarding,
      tasks: onboarding.tasks.map((task) => ({
        ...task,
        status: taskStatuses[task.task_id] ?? task.status,
        reviewer_note: taskNotes[task.task_id] ?? '',
      })),
      exported_at: new Date().toISOString(),
      note: 'This client-side export is not a persisted HR record.',
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'onboarding-' + onboarding.plan_id.toLowerCase() + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const canApproveOffer = offerStatus === 'draft_pending_approval';
  const canMarkSent = offerStatus === 'approved_not_sent';
  const canRecordResponse = offerStatus === 'sent_outside_platform';
  const canWithdraw = offerStatus === 'approved_not_sent' || offerStatus === 'sent_outside_platform';
  const canExpire = offerStatus === 'sent_outside_platform' && todayIso() >= offerExpiry;

  return (
    <section className="space-y-5 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 7 — Offer Management & Onboarding</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Prepare recruiter-supplied offer drafts, record externally handled offer events,
              and coordinate post-acceptance onboarding tasks.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">Recruiter controlled</span>
      </div>

      {!jobApproved && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Approve the job description in Agent 1 before preparing an offer.
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">1. Prepare offer draft</h3>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Candidate with recruiter-recorded hire approval</span>
          <select
            value={candidateId}
            onChange={(event) => {
              setCandidateId(event.target.value);
              setOffer(null);
              setOnboarding(null);
              setHireApprovalConfirmed(false);
              setVerificationReviewConfirmed(false);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500"
          >
            <option value="">Select candidate</option>
            {approvedCandidates.map((candidate) => (
              <option key={candidate.candidate_id} value={candidate.candidate_id}>
                {candidate.name} — {candidate.candidate_id}
              </option>
            ))}
          </select>
          {approvedCandidates.length === 0 && <span className="block text-[11px] text-amber-700">No candidate has yet been marked as hired by the recruiter.</span>}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Employment type</span>
            <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              {EMPLOYMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Currency (ISO code)</span>
            <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Compensation amount</span>
            <input type="number" min="0.01" step="0.01" value={compensationAmount} onChange={(event) => setCompensationAmount(event.target.value)} placeholder="Enter approved amount" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Pay frequency</span>
            <select value={payFrequency} onChange={(event) => setPayFrequency(event.target.value as 'annual' | 'monthly' | 'hourly')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              <option value="annual">Annual</option><option value="monthly">Monthly</option><option value="hourly">Hourly</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Work mode</span>
            <select value={workMode} onChange={(event) => setWorkMode(event.target.value as 'onsite' | 'hybrid' | 'remote')} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              <option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Work location label</span>
            <input value={workLocation} onChange={(event) => setWorkLocation(event.target.value)} maxLength={100} placeholder="e.g. Noida, India / Remote" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Proposed start date</span>
            <input type="date" min={todayIso()} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Offer expiry date</span>
            <input type="date" min={todayIso()} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Probation months (optional)</span>
            <input type="number" min="0" max="36" value={probationMonths} onChange={(event) => setProbationMonths(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Benefits supplied by HR (one per line)</span>
          <textarea rows={2} value={benefitsText} onChange={(event) => setBenefitsText(event.target.value)} maxLength={2400} placeholder="Only enter benefits that have been approved and confirmed." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Additional terms supplied by HR/legal (one per line)</span>
          <textarea rows={2} value={termsText} onChange={(event) => setTermsText(event.target.value)} maxLength={2400} placeholder="Do not generate or invent legal clauses." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={hireApprovalConfirmed} onChange={(event) => setHireApprovalConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span className="text-xs leading-5 text-amber-950">I confirm the final hiring decision was approved by an authorised recruiter.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={verificationReviewConfirmed} onChange={(event) => setVerificationReviewConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span className="text-xs leading-5 text-amber-950">I confirm Agent 6 checks have been reviewed and all findings are resolved or formally dispositioned.</span>
          </label>
        </div>
        <label className="block max-w-xs space-y-1">
          <span className="text-xs font-semibold text-slate-700">Unresolved verification items</span>
          <input type="number" min="0" max="100" value={unresolvedItems} onChange={(event) => setUnresolvedItems(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        </label>

        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Offer terms are supplied by the recruiter. This module does not create legal clauses, calculate taxes, issue contracts, send emails, collect signatures or persist the offer. The verification confirmation is a recruiter attestation; Agent 6 review results are not automatically linked to this stateless prototype.
        </p>
        <button type="button" disabled={!jobApproved || !candidateId || !hireApprovalConfirmed || !verificationReviewConfirmed || isCreatingOffer} onClick={createDraft} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isCreatingOffer ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
          {isCreatingOffer ? 'Preparing offer…' : 'Generate non-binding offer draft'}
        </button>
      </div>

      {error && <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      {offer && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-sm font-bold text-slate-900">Offer {offer.offer_id}</h3><p className="mt-1 text-xs text-slate-500">{offer.company_name} · {offer.job_title}</p></div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800">{OFFER_STATUS_LABELS[offerStatus]}</span>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">{offer.draft_text}</pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportOffer} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Export draft</button>
            {canApproveOffer && <button type="button" disabled={isSubmittingOfferEvent} onClick={() => submitOfferEvent('approve')} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve offer draft</button>}
            {canMarkSent && (
              <button type="button" disabled={isSubmittingOfferEvent || !offerEventReference.trim()} onClick={() => submitOfferEvent('mark_sent')} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 disabled:opacity-50">Record manually sent</button>
            )}
            {canWithdraw && <button type="button" disabled={isSubmittingOfferEvent} onClick={() => submitOfferEvent('withdraw')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50">Withdraw offer</button>}
            {canExpire && <button type="button" disabled={isSubmittingOfferEvent} onClick={() => submitOfferEvent('mark_expired')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Mark expired</button>}
          </div>

          {(canMarkSent || canRecordResponse) && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">{canMarkSent ? 'Secure reference for the externally sent offer' : 'Secure reference for candidate response'}</span>
                <input value={offerEventReference} onChange={(event) => setOfferEventReference(event.target.value)} maxLength={120} placeholder="vault:offer:reference123" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
              </label>
              {canRecordResponse && (
                <>
                  <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={candidateResponseConfirmed} onChange={(event) => setCandidateResponseConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />I confirm the candidate's response was received through an authorised channel.</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={isSubmittingOfferEvent || !candidateResponseConfirmed || !offerEventReference.trim()} onClick={() => submitOfferEvent('record_acceptance')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Record acceptance</button>
                    <button type="button" disabled={isSubmittingOfferEvent || !candidateResponseConfirmed || !offerEventReference.trim()} onClick={() => submitOfferEvent('record_decline')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50">Record decline</button>
                  </div>
                </>
              )}
              <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">Reviewer note (non-sensitive)</span><input value={offerEventNote} onChange={(event) => setOfferEventNote(event.target.value)} maxLength={400} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
            </div>
          )}

          {offerStatus === 'accepted' && !onboarding && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><BadgeCheck className="h-4 w-4" />Offer acceptance recorded</p>
              <label className="flex items-start gap-2 text-xs leading-5 text-emerald-950"><input type="checkbox" checked={onboardingStartApproved} onChange={(event) => setOnboardingStartApproved(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />I approve creating the onboarding checklist for this accepted offer.</label>
              <button type="button" disabled={!onboardingStartApproved || isCreatingPlan} onClick={createPlan} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isCreatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}Create onboarding plan</button>
            </div>
          )}
        </div>
      )}

      {onboarding && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-sm font-bold text-slate-900">Onboarding plan {onboarding.plan_id}</h3><p className="mt-1 text-xs text-slate-500">{onboarding.job_title} · Starts {onboarding.start_date}</p></div>
            <button type="button" onClick={exportOnboarding} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Export plan</button>
          </div>
          <div className="space-y-3">
            {onboarding.tasks.map((task: OnboardingTask) => {
              const status = taskStatuses[task.task_id] ?? task.status;
              return (
                <article key={task.task_id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{task.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">{TASK_STATUS_LABELS[status]}</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-600">{task.description}</p>
                  <p className="text-[11px] text-slate-500">Owner: {task.owner} · {task.evidence_required ? 'Evidence handled in secure HR system' : 'No document upload required here'}</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-44 flex-1 space-y-1"><span className="text-[11px] font-semibold text-slate-600">Update status</span><select value={status} onChange={(event) => updateTask(task, status, event.target.value as OnboardingTaskStatus)} disabled={taskSavingId === task.task_id || NEXT_TASK_STATUSES[status].length === 0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-60"><option value={status}>{TASK_STATUS_LABELS[status]}</option>{NEXT_TASK_STATUSES[status].map((next) => <option key={next} value={next}>{TASK_STATUS_LABELS[next]}</option>)}</select></label>
                    <label className="min-w-44 flex-1 space-y-1"><span className="text-[11px] font-semibold text-slate-600">Non-sensitive note</span><input value={taskNotes[task.task_id] ?? ''} onChange={(event) => setTaskNotes((current) => ({ ...current, [task.task_id]: event.target.value }))} maxLength={400} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Reason required if blocked" /></label>
                  </div>
                  {taskSavingId === task.task_id && <p className="text-[11px] text-violet-700">Recording update…</p>}
                </article>
              );
            })}
          </div>
          <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />No payroll, tax, bank or identity documents are collected. IT account creation, equipment orders and document signatures must be performed separately in approved systems.</p>
        </div>
      )}

      <p className="text-[11px] leading-5 text-slate-500">Prototype limits: offer dispatch, e-signature, legally binding contracts, HRIS/payroll integrations, document collection, account provisioning, equipment orders, and persistent task storage are not enabled.</p>
    </section>
  );
};
