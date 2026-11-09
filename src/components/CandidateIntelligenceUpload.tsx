import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, FileText, Loader2, ShieldCheck, UploadCloud, XCircle } from 'lucide-react';
import { uploadResumeBatch } from '../services/candidateIntelligenceApi';
import type {
  CandidateIntelligenceBatchResponse,
  CandidateProfile,
} from '../services/candidateIntelligenceApi';
import { matchCandidates } from '../services/candidateMatchingApi';
import type {
  CandidateMatchBatchResponse,
  CandidateMatchResult,
  MatchJobContext,
} from '../services/candidateMatchingApi';
import type { HiringBrief } from '../types';

const MAX_FILES = 15;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = '.pdf,.docx,.txt';

function ProfileCard({ profile }: { profile: CandidateProfile }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{profile.full_name || 'Name not detected'}</h3>
          <p className="text-xs text-slate-500 break-all">{profile.source_file}</p>
          <p className="text-xs text-slate-500 mt-1">{profile.candidate_id}</p>
        </div>
        <span className={profile.extraction_status === 'parsed'
          ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
          : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'}>
          {profile.extraction_status === 'parsed' ? 'Extracted' : 'Needs recruiter review'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
        <div><span className="text-slate-500">Email: </span><span className="break-all">{profile.email || 'Not detected'}</span></div>
        <div><span className="text-slate-500">Phone: </span>{profile.phone_numbers.join(', ') || 'Not detected'}</div>
        <div><span className="text-slate-500">Location: </span>{profile.location || 'Not detected'}</div>
        <div><span className="text-slate-500">NLP: </span>{profile.nlp_engine}</div>
      </div>

      {profile.summary && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Resume summary</h4>
          <p className="text-sm leading-6 text-slate-700">{profile.summary}</p>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Detected skills ({profile.skills.length})</h4>
        {profile.skills.length ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span key={skill.name} className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">{skill.name}</span>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No vocabulary matches detected.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Experience ({profile.work_experience.length})</h4>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {profile.work_experience.slice(0, 6).map((item, index) => <li key={index} className="rounded-lg bg-slate-50 p-2">{item.raw_entry}</li>)}
            {!profile.work_experience.length && <li className="text-slate-500">No experience section detected.</li>}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Education ({profile.education.length})</h4>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {profile.education.slice(0, 6).map((item, index) => <li key={index} className="rounded-lg bg-slate-50 p-2">{item.raw_entry}</li>)}
            {!profile.education.length && <li className="text-slate-500">No education section detected.</li>}
          </ul>
        </div>
      </div>

      {profile.projects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Projects ({profile.projects.length})</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
            {profile.projects.slice(0, 8).map((item, index) => <li key={index}>{item.details}</li>)}
          </ul>
        </div>
      )}

      {profile.review_flags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          <h4 className="text-xs font-semibold text-amber-900">Review flags</h4>
          {profile.review_flags.map((flag) => <p key={flag.code} className="text-xs text-amber-900"><strong>{flag.code}:</strong> {flag.message}</p>)}
        </div>
      )}

      <details className="group rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-slate-800">
          Supporting evidence ({profile.evidence.length})
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2">
          {profile.evidence.map((item) => (
            <div key={item.evidence_id} className="rounded-lg bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono">{item.evidence_id}</span>
                <span>{item.field.replace(/_/g, ' ')}</span>
                {item.page_number && <span>Page {item.page_number}</span>}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.quote}</p>
            </div>
          ))}
          {!profile.evidence.length && <p className="text-xs text-slate-500">No evidence snippets were produced.</p>}
          <p className="text-[11px] text-slate-500">Verify excerpts against the original resume.</p>
        </div>
      </details>

      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Privacy and redaction details</summary>
        <p className="mt-2 text-xs text-slate-600">Engine: {profile.privacy.redaction_engine}. Detected: {profile.privacy.redacted_entities.join(', ') || 'None'}.</p>
        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-600">{profile.privacy.redacted_resume_text}</pre>
      </details>

      {profile.profile_links.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {profile.profile_links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="text-indigo-700 underline break-all">{link}</a>)}
        </div>
      )}
    </article>
  );
}

function MatchResultCard({
  match,
  profile,
}: {
  match: CandidateMatchResult;
  profile: CandidateProfile | undefined;
}) {
  const evidenceById = new Map((profile?.evidence ?? []).map((item) => [item.evidence_id, item]));
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Rank #{match.rank} · {match.candidate_id}</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">{profile?.full_name || 'Name not detected'}</h3>
          <p className="text-xs text-slate-500">{match.source_file}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {match.evidence_alignment_index === null ? 'N/A' : match.evidence_alignment_index.toFixed(1)}
          </p>
          <p className="text-[11px] text-slate-500">Evidence alignment index</p>
          <p className="mt-1 text-xs text-slate-600">Coverage: {match.evidence_coverage_percent.toFixed(1)}%</p>
        </div>
      </div>

      {match.review_flags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-900">Review required</p>
          {match.review_flags.map((flag, index) => <p key={index} className="text-xs text-amber-900">{flag}</p>)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Required skills</p>
          <div className="mt-2 space-y-1.5">
            {match.required_skill_matches.map((skill) => (
              <div key={skill.skill} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-700">{skill.skill}</span>
                <span className={skill.status === 'matched' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                  {skill.status === 'matched' ? 'Evidence found' : 'Not detected'}
                </span>
              </div>
            ))}
            {!match.required_skill_matches.length && <p className="text-xs text-slate-500">No required skills were specified.</p>}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Preferred skills</p>
          <div className="mt-2 space-y-1.5">
            {match.preferred_skill_matches.map((skill) => (
              <div key={skill.skill} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-700">{skill.skill}</span>
                <span className={skill.status === 'matched' ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  {skill.status === 'matched' ? 'Evidence found' : 'Not detected'}
                </span>
              </div>
            ))}
            {!match.preferred_skill_matches.length && <p className="text-xs text-slate-500">No preferred skills were specified.</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">Approved rubric breakdown</p>
        <div className="space-y-2">
          {match.criteria.map((criterion, index) => (
            <div key={criterion.criterion + '-' + index} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{criterion.criterion}</p>
                <span className="text-xs font-semibold tabular-nums text-slate-700">
                  {criterion.status === 'scored' && criterion.score !== null ? criterion.score.toFixed(1) + '/100' : 'Not evaluable'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{criterion.rationale}</p>
              {criterion.evidence_ids.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-indigo-700">
                    Supporting evidence ({criterion.evidence_ids.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {criterion.evidence_ids.map((evidenceId) => {
                      const evidence = evidenceById.get(evidenceId);
                      return evidence ? (
                        <div key={evidenceId} className="rounded bg-slate-50 p-2">
                          <p className="text-[10px] text-slate-500">{evidence.evidence_id} · {evidence.field.replace(/_/g, ' ')}{evidence.page_number ? ' · Page ' + evidence.page_number : ''}</p>
                          <p className="mt-1 text-xs text-slate-700">{evidence.quote}</p>
                        </div>
                      ) : null;
                    })}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {match.strengths_supported_by_evidence.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Evidence-supported observations</p>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-slate-600">
            {match.strengths_supported_by_evidence.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}
      {match.not_detected_or_unverified.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Not detected / needs verification</p>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-slate-600">
            {match.not_detected_or_unverified.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span>Method: {match.retrieval_method}</span>
        <span>Recruiter decision: pending review</span>
      </div>
    </article>
  );
}

export function CandidateIntelligenceUpload({ brief }: { brief: HiringBrief | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateIntelligenceBatchResponse | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingResult, setMatchingResult] = useState<CandidateMatchBatchResponse | null>(null);
  const parsedProfiles = (result?.results ?? []).flatMap((item) =>
    item.success && item.candidate_profile ? [item.candidate_profile] : []
  );
  const jobIsApproved = brief?.status === 'Approved by recruiter — publishing integration required';

  useEffect(() => {
    setMatchingResult(null);
    setMatchingError(null);
  }, [brief?.job_id, brief?.status]);

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const selected = Array.from(incoming);
    if (selected.some((file) => file.size > MAX_BYTES)) {
      setError('Each resume must be 10 MB or smaller.');
      return;
    }
    const merged = [...files, ...selected];
    const unique = merged.filter((file, index) =>
      merged.findIndex((other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index
    );
    if (unique.length > MAX_FILES) {
      setError('You can upload a maximum of 15 resumes per batch.');
      return;
    }
    setFiles(unique);
    setResult(null);
    setMatchingResult(null);
    setMatchingError(null);
  };

  const handleUpload = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      setResult(await uploadResumeBatch(files, consentConfirmed));
      setMatchingResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchCandidates = async () => {
    setMatchingError(null);
    setMatchingResult(null);
    if (!brief || !jobIsApproved || !brief.evaluation_rubric) {
      setMatchingError('Generate and approve a job description with its evaluation rubric before matching candidates.');
      return;
    }
    if (!parsedProfiles.length) {
      setMatchingError('Process at least one resume successfully before running Agent 3.');
      return;
    }

    const fallbackRequiredSkills = brief.requirements
      .split(/[\\n,;•]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const job: MatchJobContext = {
      job_id: brief.job_id || 'JOB-' + brief.job_title.replace(/[^a-z0-9]+/gi, '-').toUpperCase(),
      job_title: brief.job_title,
      approved_for_matching: true,
      required_skills: brief.required_skills?.length ? brief.required_skills : fallbackRequiredSkills,
      preferred_skills: brief.preferred_skills ?? [],
      responsibilities: brief.responsibilities ?? [],
      education_requirements: brief.education_requirements ?? [],
      minimum_experience_months: brief.minimum_experience_months ?? null,
      rubric: {
        scoring_scale: brief.evaluation_rubric.scoring_scale,
        criteria: brief.evaluation_rubric.criteria.map((item) => ({
          criterion: item.criterion,
          weight_percent: item.weight_percent,
          evidence_to_look_for: item.evidence_to_look_for ?? [],
        })),
        decision_boundary: brief.evaluation_rubric.decision_boundary,
      },
    };

    setIsMatching(true);
    try {
      const response = await matchCandidates(job, parsedProfiles);
      setMatchingResult(response);
    } catch (err) {
      setMatchingError(err instanceof Error ? err.message : 'Candidate matching failed.');
    } finally {
      setIsMatching(false);
    }
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'candidate-intelligence-results.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><FileText className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 2 — Candidate Intelligence</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Upload multiple resumes and extract structured candidate profiles with source evidence.</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Unranked profiles</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40"
      >
        <UploadCloud className="mx-auto h-7 w-7 text-indigo-600" />
        <span className="mt-2 block text-sm font-semibold text-slate-800">Choose resumes or drop them here</span>
        <span className="mt-1 block text-xs text-slate-500">PDF, DOCX or TXT · up to 15 files · 10 MB per file</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {files.length > 0 && (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {files.map((file, index) => (
            <div key={file.name + '-' + file.lastModified + '-' + index} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-xs text-slate-700">{file.name}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <button type="button" aria-label={'Remove ' + file.name} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
        <span className="text-xs leading-5 text-amber-950">I confirm that candidates have been informed and that this organisation is authorised to process these resumes for the stated recruitment purpose.</span>
      </label>

      {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!files.length || !consentConfirmed || isProcessing} onClick={handleUpload} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isProcessing ? 'Processing resumes…' : 'Process resumes'}
        </button>
        <button type="button" disabled={!files.length || isProcessing} onClick={() => { setFiles([]); setResult(null); setError(null); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Clear batch</button>
      </div>

      <p className="text-[11px] leading-5 text-slate-500">Files are processed in memory and are not saved by this endpoint. Extraction is heuristic; verify every important field against the original resume. The consent confirmation is an application gate, not a consent-recording system.</p>

      {result && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Batch processing complete</h3>
              <p className="text-xs text-slate-500 mt-1">{result.processed_count} processed · {result.succeeded_count} succeeded · {result.failed_count} failed</p>
            </div>
            <button type="button" onClick={exportJson} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export JSON</button>
          </div>
          {result.results.map((item, index) => (
            <div key={item.file_name + '-' + index} className="space-y-2">
              {item.success && item.candidate_profile ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{item.file_name}<span className="font-normal text-slate-500">Parser: {item.parser_used || 'unknown'}</span></div>
                  {item.warnings.map((warning, warningIndex) => <p key={warningIndex} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{warning}</p>)}
                  <ProfileCard profile={item.candidate_profile} />
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div><p className="text-xs font-semibold text-rose-900">{item.file_name}</p><p className="mt-1 text-xs text-rose-800">{item.error || 'Unable to process this file.'}</p></div>
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">Agent 2 profiles are extraction results. Verify important fields against the original resumes before using them in a matching review.</p>

          <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agent 3 — Matching & Ranking</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Compare successfully parsed profiles with the approved job rubric. Every result is advisory and must be reviewed by a recruiter.
                </p>
                {brief && <p className="mt-1 text-xs font-semibold text-slate-700">Role: {brief.job_title}</p>}
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">Evidence-based · Human review</span>
            </div>

            {!jobIsApproved && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Matching is locked until the job description and rubric have been approved by the recruiter in Agent 1.
              </p>
            )}
            {jobIsApproved && !brief?.evaluation_rubric && (
              <p className="text-xs text-amber-800">The approved job brief has no saved evaluation rubric. Generate a new Agent 1 job brief before matching.</p>
            )}

            {matchingError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{matchingError}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!jobIsApproved || !brief?.evaluation_rubric || !parsedProfiles.length || isMatching}
                onClick={handleMatchCandidates}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {isMatching ? 'Comparing resume evidence…' : 'Run candidate matching'}
              </button>
              <span className="text-[11px] text-slate-500">{parsedProfiles.length} successfully parsed profile(s)</span>
            </div>

            {matchingResult && (
              <div className="space-y-3 border-t border-indigo-200 pt-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Matching review — {matchingResult.job_title}</h4>
                  <p className="mt-1 text-xs text-slate-600">
                    {matchingResult.processed_candidates} profiles processed. Ranking is an ordering for recruiter review, not a shortlist or rejection decision.
                  </p>
                </div>
                <p className="rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-600">{matchingResult.methodology}</p>
                {matchingResult.results.map((match) => (
                  <MatchResultCard
                    key={match.candidate_id}
                    match={match}
                    profile={parsedProfiles.find((item) => item.candidate_id === match.candidate_id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(matchingResult, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = 'candidate-matching-review.json';
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Export matching report (JSON)
                </button>
              </div>
            )}
            <p className="text-[11px] leading-5 text-slate-500">
              The index uses only observable, job-related evidence. Unavailable information is marked “not evaluable” and excluded from the scored-weight denominator; coverage shows how much of the approved rubric could be assessed. No automatic pass, rejection, shortlist or hiring decision is made.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
