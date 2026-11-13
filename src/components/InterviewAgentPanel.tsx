import React, { useMemo, useState } from 'react';
import type { Candidate, HiringBrief } from '../types';
import {
  createInterviewPlan,
  evaluateInterviewAnswer,
  type InterviewAnswerEvaluationResponse,
  type InterviewPlanResponse,
  type InterviewRound,
} from '../services/interviewApi';
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';

interface InterviewAgentPanelProps {
  brief: HiringBrief | null;
  candidates: Candidate[];
  onAudit?: (action: string, subject: string) => void;
}

const ROUND_LABELS: Record<InterviewRound, string> = {
  technical: 'Technical interview',
  behavioral: 'Behavioral interview',
  role_specific: 'Role-specific interview',
  hr: 'HR interview',
};

export const InterviewAgentPanel: React.FC<InterviewAgentPanelProps> = ({
  brief,
  candidates,
  onAudit,
}) => {
  const [candidateId, setCandidateId] = useState('');
  const [interviewRound, setInterviewRound] = useState<InterviewRound>('technical');
  const [candidateConsent, setCandidateConsent] = useState(false);
  const [transcriptConsent, setTranscriptConsent] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<InterviewPlanResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, InterviewAnswerEvaluationResponse>>({});

  const approvedCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.recruiter_decision === 'advance'),
    [candidates],
  );
  const selectedCandidate = approvedCandidates.find((candidate) => candidate.candidate_id === candidateId);
  const jobApproved = brief?.status === 'Approved by recruiter — publishing integration required';

  const preparePlan = async () => {
    setError(null);
    setPlan(null);
    setAnswers({});
    setEvaluations({});
    if (!brief || !jobApproved) {
      setError('Approve the job description and evaluation rubric in Agent 1 before preparing an interview.');
      return;
    }
    if (!selectedCandidate) {
      setError('Select a candidate who has been explicitly advanced by the recruiter.');
      return;
    }
    if (!candidateConsent) {
      setError('Confirm that the candidate has consented to this interview preparation and processing.');
      return;
    }

    setIsPreparing(true);
    try {
      const response = await createInterviewPlan({
        candidate_id: selectedCandidate.candidate_id,
        job_title: brief.job_title,
        interview_round: interviewRound,
        recruiter_approved: true,
        recruiter_decision: 'advance',
        candidate_consent_confirmed: true,
        job_context: [
          brief.jd,
          brief.requirements,
          ...(brief.responsibilities ?? []),
        ].filter(Boolean).join('\n'),
        rubric_criteria: (brief.evaluation_rubric?.criteria ?? []).map((item) => ({
          criterion: item.criterion,
          weight_percent: item.weight_percent,
          evidence_to_look_for: item.evidence_to_look_for ?? [],
        })),
      });
      setPlan(response);
      onAudit?.(
        'Prepared recruiter-led interview question plan',
        selectedCandidate.name + ' (' + selectedCandidate.candidate_id + ')',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Interview plan generation failed.');
    } finally {
      setIsPreparing(false);
    }
  };

  const evaluateAnswer = async (question: InterviewPlanResponse['questions'][number]) => {
    setError(null);
    if (!plan || !selectedCandidate) {
      setError('Prepare an interview plan before evaluating answers.');
      return;
    }
    const answer = (answers[question.question_id] ?? '').trim();
    if (!answer) {
      setError('Enter the candidate answer before requesting an evaluation.');
      return;
    }
    if (!transcriptConsent) {
      setError('Confirm candidate consent before processing interview answer text.');
      return;
    }

    setIsEvaluating(question.question_id);
    try {
      const result = await evaluateInterviewAnswer({
        session_id: plan.session_id,
        candidate_id: selectedCandidate.candidate_id,
        job_title: plan.job_title,
        interview_round: plan.interview_round,
        question_id: question.question_id,
        question: question.question,
        competency: question.competency,
        answer,
        evidence_to_look_for: brief?.evaluation_rubric?.criteria
          .find((item) => item.criterion === question.competency)?.evidence_to_look_for ?? [],
        transcript_processing_consent_confirmed: true,
      });
      setEvaluations((current) => ({ ...current, [question.question_id]: result }));
      onAudit?.(
        'Prepared advisory interview answer review; recruiter decision required',
        selectedCandidate.name + ' — ' + question.competency,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Answer evaluation failed.');
    } finally {
      setIsEvaluating(null);
    }
  };

  const exportTranscript = () => {
    if (!plan) return;
    const report = {
      session_id: plan.session_id,
      candidate_id: plan.candidate_id,
      job_title: plan.job_title,
      interview_round: plan.interview_round,
      questions: plan.questions.map((question) => ({
        ...question,
        answer: answers[question.question_id] ?? '',
        advisory_review: evaluations[question.question_id] ?? null,
      })),
      exported_at: new Date().toISOString(),
      note: 'Recruiter review only. This export is created in the browser; the API does not persist the session.',
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'interview-review-' + plan.session_id.toLowerCase() + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 5 — AI Interview Agent</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Prepare structured role-based questions, capture text answers during a recruiter-led interview,
              and generate evidence-focused answer reviews.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
          Recruiter supervised
        </span>
      </div>

      {!jobApproved && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Agent 5 is locked until the recruiter approves the job description and evaluation rubric in Agent 1.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Recruiter-advanced candidate</span>
          <select
            value={candidateId}
            onChange={(event) => {
              setCandidateId(event.target.value);
              setPlan(null);
              setAnswers({});
              setEvaluations({});
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="">Select candidate</option>
            {approvedCandidates.map((candidate) => (
              <option key={candidate.candidate_id} value={candidate.candidate_id}>
                {candidate.name} — {candidate.candidate_id}
              </option>
            ))}
          </select>
          {approvedCandidates.length === 0 && (
            <span className="block text-[11px] text-amber-700">No candidates have been explicitly advanced by a recruiter yet.</span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-700">Interview round</span>
          <select
            value={interviewRound}
            onChange={(event) => setInterviewRound(event.target.value as InterviewRound)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
          >
            {Object.entries(ROUND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <input
          type="checkbox"
          checked={candidateConsent}
          onChange={(event) => setCandidateConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <span className="text-xs leading-5 text-amber-950">
          I confirm that the candidate has been informed and has consented to this interview process and processing of their responses for the stated recruitment purpose.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!jobApproved || !candidateId || !candidateConsent || isPreparing}
          onClick={preparePlan}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
          {isPreparing ? 'Preparing interview…' : 'Prepare interview questions'}
        </button>
        <span className="text-[11px] text-slate-500">
          {brief?.evaluation_rubric?.criteria.length ?? 0} approved rubric criteria
        </span>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      {plan && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Interview plan — {plan.job_title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedCandidate?.name} · {ROUND_LABELS[plan.interview_round]} · {plan.questions.length} questions · {plan.session_id}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {plan.generation_mode === 'ollama' ? 'Local AI generated' : 'Fallback question set'}
            </span>
          </div>

          {plan.warnings.map((warning, index) => (
            <p key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{warning}</p>
          ))}

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={transcriptConsent}
              onChange={(event) => setTranscriptConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span className="text-xs leading-5 text-slate-700">
              I confirm the candidate has consented to processing their typed interview responses for this evaluation. Responses are sent to the configured backend/local model and are not persisted by this prototype.
            </span>
          </label>

          <div className="space-y-3">
            {plan.questions.map((question, index) => {
              const evaluation = evaluations[question.question_id];
              return (
                <article key={question.question_id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Question {index + 1} · {question.competency}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{question.question_type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm font-semibold leading-6 text-slate-900">{question.question}</p>
                  <p className="text-xs leading-5 text-slate-500">{question.rationale}</p>
                  {question.follow_up_probes.length > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold text-slate-700">Suggested probes</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                        {question.follow_up_probes.map((probe, probeIndex) => <li key={probeIndex}>{probe}</li>)}
                      </ul>
                    </div>
                  )}
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700">Candidate answer (typed by the recruiter)</span>
                    <textarea
                      rows={4}
                      value={answers[question.question_id] ?? ''}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.question_id]: event.target.value }))}
                      placeholder="Enter the candidate's answer or a consented, recruiter-prepared transcript…"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-5 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!answers[question.question_id]?.trim() || !transcriptConsent || isEvaluating === question.question_id}
                    onClick={() => evaluateAnswer(question)}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isEvaluating === question.question_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                    {isEvaluating === question.question_id ? 'Reviewing answer…' : 'Evaluate answer'}
                  </button>

                  {evaluation && (
                    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                          <CheckCircle2 className="h-4 w-4" /> Advisory review — human decision required
                        </p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">
                          {evaluation.score === null ? 'Manual review fallback' : 'Advisory score ' + evaluation.score + '/5'}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-slate-700">{evaluation.assessment}</p>
                      {evaluation.evidence_quotes.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-700">Verbatim answer evidence</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                            {evaluation.evidence_quotes.map((quote, quoteIndex) => <li key={quoteIndex}>“{quote}”</li>)}
                          </ul>
                        </div>
                      )}
                      {evaluation.strengths.length > 0 && (
                        <div><p className="text-[11px] font-semibold text-slate-700">Evidence-supported strengths</p><p className="mt-1 text-xs text-slate-600">{evaluation.strengths.join(' · ')}</p></div>
                      )}
                      {evaluation.gaps.length > 0 && (
                        <div><p className="text-[11px] font-semibold text-slate-700">Evidence gaps to clarify</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">{evaluation.gaps.map((gap, gapIndex) => <li key={gapIndex}>{gap}</li>)}</ul></div>
                      )}
                      {evaluation.follow_up_question && (
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-semibold text-slate-700">Suggested follow-up</p><p className="mt-1 text-xs leading-5 text-slate-700">{evaluation.follow_up_question}</p></div>
                      )}
                      {evaluation.review_flags.map((flag, flagIndex) => <p key={flagIndex} className="text-[11px] text-amber-800">{flag}</p>)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="flex max-w-2xl items-start gap-2 text-[11px] leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              AI feedback is advisory. It cannot advance, reject, rank or hire anyone. The recruiter must verify the answer and make every decision.
            </p>
            <button type="button" onClick={exportTranscript} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Export interview review
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-5 text-slate-500">
        Prototype scope: text-only recruiter-led interviews. No candidate-facing autonomous voice agent, audio/video capture, emotion/face analysis, proctoring, calendar dispatch, database persistence or automated hiring decisions are enabled.
      </p>
    </section>
  );
};
