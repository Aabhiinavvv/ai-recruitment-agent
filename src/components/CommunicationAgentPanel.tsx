import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, MessageSquare, PlusCircle } from 'lucide-react';
import type { Candidate, HiringBrief, OutreachDraft } from '../types';
import {
  createCommunicationDraft,
  mapCommunicationType,
  type CommunicationType,
} from '../services/communicationApi';

interface Props {
  brief: HiringBrief | null;
  candidates: Candidate[];
  onQueueDraft: (draft: OutreachDraft, reasonCategory: string) => void;
}

const OPTIONS: Array<{ value: CommunicationType; label: string }> = [
  { value: 'application_acknowledgement', label: 'Application acknowledgement' },
  { value: 'interview_invitation', label: 'Interview invitation' },
  { value: 'scheduling_request', label: 'Request availability' },
  { value: 'schedule_confirmation', label: 'Confirm interview schedule' },
  { value: 'status_update', label: 'Application status update' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'not_selected', label: 'Non-progression notice' },
];

function decisionFor(candidate: Candidate): 'pending_review' | 'advanced' | 'not_proceeding' {
  if (candidate.recruiter_decision === 'advance'
    || candidate.decision_status?.includes('Advanced')
    || candidate.decision_status?.includes('Hired')) return 'advanced';
  if (candidate.recruiter_decision === 'reject'
    || candidate.decision_status?.includes('Not proceeding')) return 'not_proceeding';
  return 'pending_review';
}

export function CommunicationAgentPanel({ brief, candidates, onQueueDraft }: Props) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.candidate_id ?? '');
  const [communicationType, setCommunicationType] = useState<CommunicationType>('application_acknowledgement');
  const [contactAuthorized, setContactAuthorized] = useState(false);
  const [context, setContext] = useState('');
  const [roundName, setRoundName] = useState('Technical interview');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [format, setFormat] = useState('Video interview');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof createCommunicationDraft>> | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [queued, setQueued] = useState(false);

  const candidate = useMemo(
    () => candidates.find((item) => item.candidate_id === candidateId),
    [candidates, candidateId],
  );
  const decision = candidate ? decisionFor(candidate) : 'pending_review';
  const approvedJob = brief?.status === 'Approved by recruiter — publishing integration required';

  useEffect(() => {
    if (!candidates.some((item) => item.candidate_id === candidateId)) {
      setCandidateId(candidates[0]?.candidate_id ?? '');
    }
  }, [candidates, candidateId]);

  useEffect(() => {
    setDraft(null);
    setError(null);
    setQueued(false);
  }, [candidateId, communicationType]);

  useEffect(() => {
    setContactAuthorized(false);
  }, [candidateId]);

  const requiresAdvance = ['interview_invitation', 'scheduling_request', 'schedule_confirmation'].includes(communicationType);
  const requiresNotProceeding = communicationType === 'not_selected';
  const decisionAllowed = (!requiresAdvance || decision === 'advanced')
    && (!requiresNotProceeding || decision === 'not_proceeding');

  const generate = async () => {
    setError(null);
    setDraft(null);
    setQueued(false);
    if (!approvedJob || !brief) {
      setError('Approve the Agent 1 job description before drafting candidate communication.');
      return;
    }
    if (!candidate) {
      setError('Select a candidate first.');
      return;
    }
    if (!candidate.email?.trim()) {
      setError('This candidate has no email address in the current profile.');
      return;
    }
    if (!contactAuthorized) {
      setError('Confirm that the organisation is authorised to contact this candidate.');
      return;
    }
    if (!decisionAllowed) {
      setError('This communication type does not match the current recruiter decision.');
      return;
    }

    setLoading(true);
    try {
      const result = await createCommunicationDraft({
        communication_type: communicationType,
        candidate_id: candidate.candidate_id,
        candidate_name: candidate.name,
        recipient_email: candidate.email,
        job_title: brief.job_title,
        company_name: brief.company_name || 'the recruitment team',
        recruiter_decision: decision,
        contact_authorized: true,
        recruiter_context: context,
        interview_round: roundName,
        interview_date: communicationType === 'schedule_confirmation' ? interviewDate : undefined,
        interview_time: communicationType === 'schedule_confirmation' ? interviewTime : undefined,
        timezone,
        interview_format: format,
        meeting_url: meetingUrl || undefined,
      });
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Communication draft generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const addToQueue = () => {
    if (!draft || !candidate || !contactAuthorized) return;
    const queueDraft: OutreachDraft = {
      id: draft.draft_id,
      type: mapCommunicationType(communicationType),
      communication_type: communicationType,
      candidate_id: candidate.candidate_id,
      candidate_name: candidate.name,
      candidate_email: candidate.email,
      candidate_phone: candidate.phone,
      subject,
      body,
      call_script: draft.call_script,
      availability: communicationType === 'schedule_confirmation'
        ? interviewDate + ' ' + interviewTime + ' ' + timezone
        : 'Not scheduled',
      status: 'Draft — not sent or scheduled',
    };
    onQueueDraft(queueDraft, communicationType);
    setQueued(true);
    setDraft(null);
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm space-y-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><MessageSquare className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 4 — Communication Agent</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Prepare candidate emails and human call scripts using recruiter-approved workflow context.</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Draft only · No dispatch</span>
      </div>

      {!approvedJob && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Approve the Agent 1 job description before preparing candidate communications.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Candidate</span>
          <select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs">
            <option value="">Select candidate</option>
            {candidates.map((item) => <option key={item.candidate_id} value={item.candidate_id}>{item.name} · {item.candidate_id}</option>)}
          </select>
          {candidate && <span className="block text-[11px] text-slate-500">{candidate.email || 'No email'} · Recruiter state: {decision.replace('_', ' ')}</span>}
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Communication purpose</span>
          <select value={communicationType} onChange={(event) => setCommunicationType(event.target.value as CommunicationType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs">
            {OPTIONS.map((item) => (
              <option key={item.value} value={item.value} disabled={
                (['interview_invitation', 'scheduling_request', 'schedule_confirmation'].includes(item.value) && decision !== 'advanced')
                || (item.value === 'not_selected' && decision !== 'not_proceeding')
              }>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      {['interview_invitation', 'scheduling_request', 'schedule_confirmation'].includes(communicationType) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Interview round</span><input value={roundName} onChange={(event) => setRoundName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Interview format</span><select value={format} onChange={(event) => setFormat(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs"><option>Video interview</option><option>Phone interview</option><option>On-site interview</option></select></label>
          {communicationType === 'schedule_confirmation' && (
            <>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Confirmed date</span><input type="date" value={interviewDate} onChange={(event) => setInterviewDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Confirmed time</span><input type="time" value={interviewTime} onChange={(event) => setInterviewTime(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Time zone</span><input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-700">Meeting URL (optional)</span><input value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" /></label>
            </>
          )}
        </div>
      )}

      {(communicationType === 'status_update' || communicationType === 'follow_up') && (
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Recruiter-approved process context (optional)</span>
          <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={3} maxLength={1200} placeholder="Provide a factual process update. Avoid protected, medical or score/rank information." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-xs" />
        </label>
      )}

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <input type="checkbox" checked={contactAuthorized} onChange={(event) => setContactAuthorized(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
        <span className="text-xs leading-5 text-amber-950">I confirm that the organisation is authorised to contact this candidate about this recruitment process.</span>
      </label>

      {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {queued && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" />Added to recruiter queue. Nothing has been sent.</div>}

      <button type="button" disabled={!approvedJob || !candidate || !contactAuthorized || loading || !decisionAllowed} onClick={generate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {loading ? 'Preparing draft…' : 'Generate communication draft'}
      </button>

      {draft && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Draft preview</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800">Recruiter approval required</span>
          </div>
          {draft.warnings.map((warning, index) => <p key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{warning}</p>)}
          <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" /></label>
          <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">Email body</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={9} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-5" /></label>
          {draft.call_script && <details className="rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Human call script</summary><p className="mt-2 text-xs leading-5 text-slate-600">{draft.call_script}</p></details>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">Delivery is disabled. Approval does not send.</p>
            <button type="button" disabled={!contactAuthorized || !subject.trim() || !body.trim()} onClick={addToQueue} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><PlusCircle className="h-4 w-4" />Add to recruiter queue</button>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-5 text-slate-500">Agent 4 only prepares drafts and call scripts. Recruiters must review and approve them. Provider delivery integrations are not enabled.</p>
    </section>
  );
}
