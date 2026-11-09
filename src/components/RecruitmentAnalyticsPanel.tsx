import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarClock,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import type { Candidate } from '../types';
import {
  fetchRecruitmentAnalytics,
  type CandidateAnalyticsRecord,
  type DecisionStatus,
  type RecruitmentAnalyticsResponse,
  type SourceChannel,
} from '../services/recruitmentAnalyticsApi';

interface RecruitmentAnalyticsPanelProps {
  candidates: Candidate[];
  onAudit?: (action: string, subject: string) => void;
}

interface AttributionInput {
  source_channel: SourceChannel | '';
  recruiter_label: string;
  applied_at: string;
  hired_at: string;
}

const SOURCE_OPTIONS: Array<{ value: SourceChannel; label: string }> = [
  { value: 'careers_site', label: 'Careers site' },
  { value: 'job_board', label: 'Job board' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'referral', label: 'Referral' },
  { value: 'agency', label: 'Recruitment agency' },
  { value: 'campus', label: 'Campus' },
  { value: 'direct', label: 'Direct application' },
  { value: 'other', label: 'Other' },
];

const money = (value: number | null | undefined, currency?: string | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

const numberText = (value: number | null | undefined, suffix = '') =>
  value === null || value === undefined || !Number.isFinite(value)
    ? 'Not available'
    : value.toFixed(1) + suffix;

const stageValue = (candidate: Candidate): CandidateAnalyticsRecord['stage'] => {
  const stage = candidate.stage;
  if (stage === 'Screening') return 'screening';
  if (stage === 'Technical') return 'technical';
  if (stage === 'Interview') return 'interview';
  if (stage === 'Offered') return 'offered';
  if (stage === 'Rejected') return 'rejected';
  return 'unknown';
};

const decisionValue = (candidate: Candidate): DecisionStatus => {
  if (candidate.decision_status === 'Hired by recruiter') return 'hired';
  if (candidate.decision_status === 'Advanced by recruiter') return 'advanced';
  if (candidate.decision_status === 'Not proceeding (recruiter decision)') return 'not_proceeding';
  return 'pending';
};

export const RecruitmentAnalyticsPanel: React.FC<RecruitmentAnalyticsPanelProps> = ({
  candidates,
  onAudit,
}) => {
  const [period, setPeriod] = useState('Current loaded pipeline');
  const [totalCost, setTotalCost] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [periodHires, setPeriodHires] = useState('');
  const [attribution, setAttribution] = useState<Record<string, AttributionInput>>({});
  const [analytics, setAnalytics] = useState<RecruitmentAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hiredInLoadedPipeline = useMemo(
    () => candidates.filter((candidate) => decisionValue(candidate) === 'hired').length,
    [candidates],
  );

  const updateAttribution = (candidateId: string, patch: Partial<AttributionInput>) => {
    setAttribution((current) => ({
      ...current,
      [candidateId]: {
        source_channel: '',
        recruiter_label: '',
        applied_at: '',
        hired_at: '',
        ...(current[candidateId] ?? {}),
        ...patch,
      },
    }));
  };

  const buildRequestRows = (): CandidateAnalyticsRecord[] => candidates.map((candidate, index) => {
    const meta = attribution[candidate.candidate_id];
    const decision = decisionValue(candidate);
    return {
      // Sequential row refs keep candidate identifiers and names out of the analytics API.
      record_ref: 'row-' + String(index + 1).padStart(4, '0'),
      stage: stageValue(candidate),
      decision_status: decision,
      overall_score: Number.isFinite(candidate.overall_score)
        ? Number(candidate.overall_score)
        : null,
      source_channel: meta?.source_channel || null,
      recruiter_label: meta?.recruiter_label.trim() || null,
      applied_at: meta?.applied_at || null,
      hired_at: decision === 'hired' ? (meta?.hired_at || null) : null,
    };
  });

  const generate = async () => {
    if (!candidates.length) {
      setError('Load or add candidate records before generating analytics.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        reporting_period: period.trim() || 'Current loaded pipeline',
        candidate_records: buildRequestRows(),
        total_recruitment_cost: totalCost.trim() ? totalCost.trim() : null,
        cost_currency: totalCost.trim() ? currency.toUpperCase() : null,
        period_hires: totalCost.trim() && periodHires.trim() ? Number(periodHires) : null,
      };
      const result = await fetchRecruitmentAnalytics(payload);
      setAnalytics(result);
      onAudit?.('Generated aggregate recruitment analytics', result.reporting_period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate recruitment analytics.');
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = () => {
    if (!analytics) return;
    const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recruitment-analytics-' + analytics.reporting_period
      .toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const funnelData = analytics?.stage_funnel.filter((item) => item.stage !== 'unknown') ?? [];
  const decisionData = analytics?.decision_breakdown ?? [];
  const sourceData = analytics?.source_effectiveness ?? [];
  const recruiterData = analytics?.recruiter_performance ?? [];
  const palette = ['#6d5ce7', '#0d9488', '#f59e0b', '#dc6b6b', '#64748b'];

  return (
    <section className="space-y-5 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 8 — Recruitment Analytics & Workforce Intelligence</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Aggregate hiring-funnel, decision, source, recruiter, time-to-hire and cost metrics.
              Missing source data is shown as unavailable, never estimated.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          Aggregate analytics
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Reporting period label</span>
          <input value={period} onChange={(event) => setPeriod(event.target.value)} maxLength={80} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Recruitment spend (optional)</span>
          <input type="number" min="0" step="0.01" value={totalCost} onChange={(event) => setTotalCost(event.target.value)} placeholder="Enter total cost" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Cost currency</span>
          <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} disabled={!totalCost.trim()} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Hires in same period (optional)</span>
          <input type="number" min="0" step="1" value={periodHires} onChange={(event) => setPeriodHires(event.target.value)} placeholder="Required for cost per hire" disabled={!totalCost.trim()} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50" />
        </label>
      </div>

      <details className="rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-700">
          Add missing source, recruiter and date metadata ({candidates.length} candidate records)
        </summary>
        <div className="space-y-3 border-t border-slate-200 p-4">
          <p className="text-xs leading-5 text-slate-500">
            Your existing candidate model has no reliable acquisition source, recruiter assignment or application/hire dates.
            Add these fields only when you have an actual record. Candidate names and IDs stay in the browser; the API receives sequential anonymous row references.
          </p>
          {candidates.map((candidate) => {
            const meta = attribution[candidate.candidate_id] ?? {
              source_channel: '',
              recruiter_label: '',
              applied_at: '',
              hired_at: '',
            };
            const isHired = decisionValue(candidate) === 'hired';
            return (
              <div key={candidate.candidate_id} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-xs font-semibold text-slate-800">{candidate.name}</p>
                  <p className="text-[11px] text-slate-500">{candidate.candidate_id} · {candidate.decision_status}</p>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-600">Acquisition source</span>
                  <select value={meta.source_channel} onChange={(event) => updateAttribution(candidate.candidate_id, { source_channel: event.target.value as SourceChannel | '' })} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">Not recorded</option>
                    {SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-600">Recruiter/team alias</span>
                  <input value={meta.recruiter_label} onChange={(event) => updateAttribution(candidate.candidate_id, { recruiter_label: event.target.value })} maxLength={40} placeholder="e.g. Team A" className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-600">Application date</span>
                  <input type="date" value={meta.applied_at} onChange={(event) => updateAttribution(candidate.candidate_id, { applied_at: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-slate-600">Hire date {isHired ? '' : '(hired only)'}</span>
                  <input type="date" value={meta.hired_at} disabled={!isHired} onChange={(event) => updateAttribution(candidate.candidate_id, { hired_at: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs disabled:bg-slate-100" />
                </label>
              </div>
            );
          })}
        </div>
      </details>

      <button
        type="button"
        onClick={generate}
        disabled={loading || candidates.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {loading ? 'Calculating metrics…' : 'Generate recruitment analytics'}
      </button>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      {analytics && (
        <div className="space-y-5 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Analytics dashboard — {analytics.reporting_period}</h3>
              <p className="mt-1 text-[11px] text-slate-500">Generated {new Date(analytics.generated_at).toLocaleString()}</p>
            </div>
            <button type="button" onClick={exportAnalytics} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" />Export aggregate report
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Candidates in snapshot" value={String(analytics.total_candidates)} icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Overall hire rate" value={numberText(analytics.overall_hire_rate_percent, '%')} icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Average candidate score" value={analytics.average_overall_score === null ? 'Not available' : numberText(analytics.average_overall_score, '/100')} icon={<Activity className="h-4 w-4" />} note={analytics.score_sample_size + ' scores'} />
            <MetricCard label="Time to hire" value={analytics.time_to_hire.average_days === null ? 'Not available' : numberText(analytics.time_to_hire.average_days, ' days')} icon={<CalendarClock className="h-4 w-4" />} note={analytics.time_to_hire.sample_size + ' dated hires'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Recruitment funnel</h4>
              <p className="mt-1 text-[11px] text-slate-500">Current pipeline snapshot, not historical stage transitions.</p>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 10, right: 12, left: -14, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="candidates" name="Candidates" fill="#0f8a9d" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Recruiter decision breakdown</h4>
              <p className="mt-1 text-[11px] text-slate-500">Based on recruiter-recorded decision status.</p>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={decisionData} dataKey="candidates" nameKey="status" cx="50%" cy="50%" outerRadius={88} label={({ name, value }) => String(name) + ': ' + String(value)}>
                      {decisionData.map((entry, index) => <Cell key={entry.status} fill={palette[index % palette.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Source effectiveness</h4>
              <p className="mt-1 text-[11px] text-slate-500">{analytics.source_attributed_candidates} of {analytics.total_candidates} candidates have a recorded source.</p>
              {sourceData.length ? (
                <div className="mt-3 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData} margin={{ top: 8, right: 10, left: -12, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source_channel" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="hire_rate_percent" name="Hire rate %" fill="#6d5ce7" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Unavailable text="Add verified source-channel metadata to compare channels." />}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Recruiter/team performance</h4>
              <p className="mt-1 text-[11px] text-slate-500">{analytics.recruiter_attributed_candidates} of {analytics.total_candidates} candidates have recruiter attribution.</p>
              {recruiterData.length ? (
                <div className="mt-3 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recruiterData} margin={{ top: 8, right: 10, left: -12, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="recruiter_label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="candidates" name="Assigned" fill="#0f8a9d" />
                      <Bar dataKey="hires" name="Hires" fill="#0d9488" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Unavailable text="Add anonymised recruiter/team aliases to compare workload and outcomes." />}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Hired" value={String(analytics.hired_count)} icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Advanced" value={String(analytics.advanced_count)} icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Pending review" value={String(analytics.pending_review_count)} icon={<Activity className="h-4 w-4" />} />
            <MetricCard label="Cost per hire" value={money(analytics.cost_per_hire.amount, analytics.cost_per_hire.currency)} icon={<BarChart3 className="h-4 w-4" />} note={analytics.cost_per_hire.period_hires === null ? 'No cost inputs supplied' : analytics.cost_per_hire.period_hires + ' hires in cost period'} />
          </div>

          {analytics.warnings.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-950">Data coverage notes</p>
              {analytics.warnings.map((warning, index) => <p key={index} className="text-xs leading-5 text-amber-900">• {warning}</p>)}
            </div>
          )}

          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Metric definitions and methodology</summary>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">
              {analytics.methodology.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </details>
        </div>
      )}

      <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        The API processes pseudonymous rows and returns aggregate metrics only. No candidate names, emails, phone numbers, resumes or raw candidate IDs are sent. This prototype does not persist analytics snapshots or historical events.
      </p>
    </section>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
}> = ({ label, value, icon, note }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">{icon}{label}</div>
    <p className="mt-2 break-words text-xl font-extrabold text-slate-900">{value}</p>
    {note && <p className="mt-1 text-[10px] text-slate-500">{note}</p>}
  </div>
);

const Unavailable: React.FC<{ text: string }> = ({ text }) => (
  <div className="mt-3 flex h-60 items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-xs leading-5 text-slate-500">
    {text}
  </div>
);
