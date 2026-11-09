import React, { useMemo, useState } from 'react';
import type { Candidate, HiringBrief } from '../types';
import {
  createVerificationCase,
  submitVerificationReview,
  type EvidenceSourceType,
  type VerificationCaseResponse,
  type VerificationOutcome,
  type VerificationReviewResponse,
  type VerificationType,
} from '../services/verificationApi';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

interface BackgroundVerificationPanelProps {
  brief: HiringBrief | null;
  candidates: Candidate[];
  onAudit?: (action: string, subject: string) => void;
}

const CHECK_OPTIONS: Array<{ value: VerificationType; label: string }> = [
  { value: 'identity', label: 'Identity' },
  { value: 'employment', label: 'Employment history' },
  { value: 'education', label: 'Education' },
  { value: 'address', label: 'Address (only if necessary and lawful)' },
  { value: 'professional_license', label: 'Professional licence' },
  { value: 'reference', label: 'Professional reference' },
];

const OUTCOMES: Array<{ value: VerificationOutcome; label: string }> = [
  { value: 'verified', label: 'Verified' },
  { value: 'unable_to_verify', label: 'Unable to verify' },
  { value: 'discrepancy', label: 'Discrepancy — needs review' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const SOURCE_OPTIONS: Array<{ value: EvidenceSourceType; label: string }> = [
  { value: 'candidate_document', label: 'Candidate-provided document (secure system)' },
  { value: 'issuer_confirmation', label: 'Issuer / institution confirmation' },
  { value: 'licensed_provider_report', label: 'Authorised verification provider report' },
  { value: 'reference_confirmation', label: 'Candidate-authorised reference' },
  { value: 'other', label: 'Other authorised source' },
];

interface ReviewDraft {
  outcome: VerificationOutcome;
  sourceChecked: boolean;
  sourceType: EvidenceSourceType;
  evidenceReference: string;
  evidenceSummary: string;
  reviewerNote: string;
}

const emptyReview = (): ReviewDraft => ({
  outcome: 'verified',
  sourceChecked: false,
  sourceType: 'issuer_confirmation',
  evidenceReference: '',
  evidenceSummary: '',
  reviewerNote: '',
});

export const BackgroundVerificationPanel: React.FC<BackgroundVerificationPanelProps> = ({
  brief,
  candidates,
  onAudit,
}) => {
  const approvedCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.recruiter_decision === 'advance'),
    [candidates],
  );
  const jobApproved = brief?.status === 'Approved by recruiter — publishing integration required';

  const [candidateId, setCandidateId] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<VerificationType[]>([
    'employment',
    'education',
  ]);
  const [jurisdiction, setJurisdiction] = useState('IN');
  const [caseResult, setCaseResult] = useState<VerificationCaseResponse | null>(null);
  const [reviews, setReviews] = useState<Record<string, VerificationReviewResponse>>({});
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [submittingCheckId, setSubmittingCheckId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = approvedCandidates.find(
    (candidate) => candidate.candidate_id === candidateId,
  );

  const toggleCheck = (checkType: VerificationType) => {
    setSelectedChecks((current) => current.includes(checkType)
      ? current.filter((item) => item !== checkType)
      : [...current, checkType]);
  };

  const createCase = async () => {
    setError(null);
    setCaseResult(null);
    setReviews({});
    setDrafts({});
    if (!brief || !jobApproved) {
      setError('Approve the job description in Agent 1 before starting verification.');
      return;
    }
    if (!selectedCandidate) {
      setError('Select a candidate who has been explicitly advanced by the recruiter.');
      return;
    }
    if (!consentConfirmed) {
      setError('Confirm that the candidate has authorised the selected verification checks.');
      return;
    }
    if (!selectedChecks.length) {
      setError('Select at least one verification check.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createVerificationCase({
        candidate_id: selectedCandidate.candidate_id,
        job_title: brief.job_title,
        recruiter_approved: true,
        recruiter_decision: 'advance',
        candidate_consent_confirmed: true,
        check_types: selectedChecks,
        jurisdiction: jurisdiction.trim() || 'unspecified',
      });
      setCaseResult(result);
      onAudit?.(
        'Created consent-gated background verification checklist',
        selectedCandidate.name + ' (' + selectedCandidate.candidate_id + ')',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create verification checklist.');
    } finally {
      setIsCreating(false);
    }
  };

  const updateDraft = (checkId: string, patch: Partial<ReviewDraft>) => {
    setDrafts((current) => ({
      ...current,
      [checkId]: { ...(current[checkId] ?? emptyReview()), ...patch },
    }));
  };

  const submitReview = async (check: VerificationCaseResponse['checks'][number]) => {
    if (!caseResult) return;
    const draft = drafts[check.check_id] ?? emptyReview();
    setError(null);

    if (!draft.reviewerNote.trim() && draft.outcome === 'unable_to_verify') {
      setError('Add a brief, non-sensitive explanation for an unable-to-verify result.');
      return;
    }
    if (draft.outcome === 'verified' || draft.outcome === 'discrepancy') {
      if (!draft.sourceChecked || !draft.evidenceReference.trim()) {
        setError('Confirm that the source was checked and enter an opaque evidence reference.');
        return;
      }
    }

    setSubmittingCheckId(check.check_id);
    try {
      const result = await submitVerificationReview({
        case_id: caseResult.case_id,
        candidate_id: caseResult.candidate_id,
        check_id: check.check_id,
        check_type: check.check_type,
        outcome: draft.outcome,
        reviewer_attested: true,
        source_checked: draft.sourceChecked,
        evidence_source_type: draft.sourceChecked ? draft.sourceType : null,
        evidence_reference: draft.evidenceReference.trim() || null,
        evidence_summary: draft.evidenceSummary.trim() || null,
        reviewer_note: draft.reviewerNote.trim(),
      });
      setReviews((current) => ({ ...current, [check.check_id]: result }));
      onAudit?.(
        'Submitted human-reviewed verification metadata: ' + draft.outcome,
        caseResult.candidate_id + ' — ' + check.title,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to validate this verification review.');
    } finally {
      setSubmittingCheckId(null);
    }
  };

  const exportReview = () => {
    if (!caseResult) return;
    const report = {
      case_id: caseResult.case_id,
      candidate_id: caseResult.candidate_id,
      job_title: caseResult.job_title,
      jurisdiction: caseResult.jurisdiction,
      checks: caseResult.checks.map((check) => ({
        ...check,
        review: reviews[check.check_id] ?? null,
      })),
      exported_at: new Date().toISOString(),
      note: 'This file is a recruiter export. The prototype API does not persist verification cases or evidence.',
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'background-verification-' + caseResult.case_id.toLowerCase() + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <UserRoundCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 6 — Background Verification</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Build a candidate-authorised verification checklist, capture human-reviewed source metadata,
              and flag unresolved items for recruiter review.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Consent gated · Human reviewed
        </span>
      </div>

      {!jobApproved && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Agent 6 is locked until the recruiter approves the job description in Agent 1.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Recruiter-advanced candidate</span>
          <select
            value={candidateId}
            onChange={(event) => {
              setCandidateId(event.target.value);
              setConsentConfirmed(false);
              setCaseResult(null);
              setReviews({});
              setDrafts({});
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="">Select candidate</option>
            {approvedCandidates.map((candidate) => (
              <option key={candidate.candidate_id} value={candidate.candidate_id}>
                {candidate.name} — {candidate.candidate_id}
              </option>
            ))}
          </select>
          {approvedCandidates.length === 0 && (
            <span className="block text-[11px] text-amber-700">No candidates have been explicitly advanced by a recruiter.</span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Jurisdiction</span>
          <input
            value={jurisdiction}
            onChange={(event) => setJurisdiction(event.target.value)}
            maxLength={80}
            placeholder="e.g. IN"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
          <span className="block text-[11px] text-slate-500">Use a country/region code. Requirements vary by jurisdiction.</span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Select role-relevant checks</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECK_OPTIONS.map((item) => (
            <label key={item.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                checked={selectedChecks.includes(item.value)}
                onChange={() => toggleCheck(item.value)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="text-xs leading-5 text-slate-700">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <input
          type="checkbox"
          checked={consentConfirmed}
          onChange={(event) => setConsentConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-600"
        />
        <span className="text-xs leading-5 text-amber-950">
          I confirm that the candidate has received the verification notice and authorised each selected check for this recruitment purpose, and that the organisation is permitted to request it in the stated jurisdiction.
        </span>
      </label>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p className="font-semibold text-slate-800">Do not upload sensitive documents here</p>
        This prototype does not accept Aadhaar, PAN, passport, identity-document images, full residential addresses, dates of birth, or document numbers. Keep originals and provider reports in an approved secure system; enter only an opaque internal evidence reference.
      </div>

      <button
        type="button"
        disabled={!jobApproved || !candidateId || !consentConfirmed || !selectedChecks.length || isCreating}
        onClick={createCase}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
        {isCreating ? 'Preparing checklist…' : 'Create verification checklist'}
      </button>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      {caseResult && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Verification case — {caseResult.case_id}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedCandidate?.name} · {caseResult.job_title} · {caseResult.jurisdiction}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              {Object.keys(reviews).length}/{caseResult.checks.length} reviews recorded in this session
            </span>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            No background checks have been run automatically. These are instructions for an authorised reviewer or a future licensed-provider integration. Verify the legal basis, scope and local rules before each check.
          </p>

          {caseResult.checks.map((check) => {
            const review = reviews[check.check_id];
            const draft = drafts[check.check_id] ?? emptyReview();
            return (
              <article key={check.check_id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{check.title}</h4>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    {review ? review.outcome.replace('_', ' ') : 'Awaiting review'}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-600">{check.purpose}</p>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-500">
                  {check.evidence_to_review.map((item, index) => <li key={index}>{item}</li>)}
                </ul>

                {!review ? (
                  <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Reviewer outcome</span>
                      <select
                        value={draft.outcome}
                        onChange={(event) => updateDraft(check.check_id, { outcome: event.target.value as VerificationOutcome })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                      >
                        {OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>

                    {(draft.outcome === 'verified' || draft.outcome === 'discrepancy') && (
                      <>
                        <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={draft.sourceChecked}
                            onChange={(event) => updateDraft(check.check_id, { sourceChecked: event.target.checked })}
                            className="mt-0.5 h-4 w-4 accent-emerald-600"
                          />
                          I checked the authorised source for this result.
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-700">Evidence source</span>
                          <select
                            value={draft.sourceType}
                            onChange={(event) => updateDraft(check.check_id, { sourceType: event.target.value as EvidenceSourceType })}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                          >
                            {SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-700">Opaque evidence reference</span>
                          <input
                            value={draft.evidenceReference}
                            onChange={(event) => updateDraft(check.check_id, { evidenceReference: event.target.value })}
                            maxLength={120}
                            placeholder="e.g. vault:report:abc123"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-700">Evidence summary (no personal identifiers)</span>
                          <textarea
                            rows={2}
                            value={draft.evidenceSummary}
                            onChange={(event) => updateDraft(check.check_id, { evidenceSummary: event.target.value })}
                            maxLength={600}
                            placeholder="Summarise what the authorised source confirmed."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                          />
                        </label>
                      </>
                    )}

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Reviewer note (non-sensitive)</span>
                      <textarea
                        rows={2}
                        value={draft.reviewerNote}
                        onChange={(event) => updateDraft(check.check_id, { reviewerNote: event.target.value })}
                        maxLength={500}
                        placeholder="Record any follow-up or explain why it could not be verified."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={submittingCheckId === check.check_id}
                      onClick={() => submitReview(check)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {submittingCheckId === check.check_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      {submittingCheckId === check.check_id ? 'Submitting review…' : 'Record reviewer outcome'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4" /> Human review metadata captured
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{review.outcome.replace('_', ' ')} · {new Date(review.reviewed_at).toLocaleString()}</p>
                    {review.evidence_summary && <p className="mt-1 text-xs text-slate-600">{review.evidence_summary}</p>}
                    {review.reviewer_note && <p className="mt-1 text-xs text-slate-600">{review.reviewer_note}</p>}
                  </div>
                )}
              </article>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="flex max-w-2xl items-start gap-2 text-[11px] leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              All outcomes remain subject to recruiter review. A discrepancy or unable-to-verify result is not an automated rejection.
            </p>
            <button
              type="button"
              onClick={exportReview}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export verification review
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
