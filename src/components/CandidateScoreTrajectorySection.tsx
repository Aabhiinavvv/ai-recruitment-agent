import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Candidate, HiringBrief, HiringStage } from '../types';
import { getCandidateStage } from './HiringWorkflowTab';
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  Upload,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CandidateScoreTrajectorySectionProps {
  candidates: Candidate[];
  cutoffScore?: number;
  brief: HiringBrief | null;
  onInspectCandidate?: (candidateId: string) => void;
  onQuickUploadClick?: () => void;
}

type MetricMode = 'overall' | 'technical' | 'experience';

interface ChartPoint {
  index: number;
  sequenceLabel: string;
  candidateId: string;
  name: string;
  shortName: string;
  email: string;
  processedDateStr: string;
  processedTimestamp: number;
  overallScore: number;
  technicalScore: number;
  experienceScore: number;
  activeMetricScore: number;
  cumulativeAverage: number;
  meetsCutoff: boolean;
  stage: HiringStage;
  decisionStatus: string;
}

export const CandidateScoreTrajectorySection: React.FC<CandidateScoreTrajectorySectionProps> = ({
  candidates,
  cutoffScore = 75,
  brief,
  onInspectCandidate,
  onQuickUploadClick,
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('overall');
  const [showCumulativeAverage, setShowCumulativeAverage] = useState<boolean>(true);
  const [showCutoffZone, setShowCutoffZone] = useState<boolean>(true);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [viewWindow, setViewWindow] = useState<'all' | 'last10' | 'last5'>('all');
  const [showTableLog, setShowTableLog] = useState<boolean>(false);

  // 1. Sort candidates chronologically from earliest processed to latest processed
  const chronologicalCandidates = useMemo(() => {
    const list = [...candidates];
    return list.sort((a, b) => {
      const timeA = a.processed_at ? new Date(a.processed_at).getTime() : 0;
      const timeB = b.processed_at ? new Date(b.processed_at).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) {
        return timeA - timeB;
      }
      // Stable fallback: original insertion sequence (oldest at end of array in state)
      return candidates.indexOf(b) - candidates.indexOf(a);
    });
  }, [candidates]);

  // 2. Filter candidates by stage if requested
  const filteredCandidates = useMemo(() => {
    if (stageFilter === 'all') return chronologicalCandidates;
    return chronologicalCandidates.filter((c) => getCandidateStage(c) === stageFilter);
  }, [chronologicalCandidates, stageFilter]);

  // 3. Compute chart data points with sequential running averages
  const chartData: ChartPoint[] = useMemo(() => {
    let runningSum = 0;

    return filteredCandidates.map((cand, idx) => {
      const overall = cand.overall_score ?? 0;
      const technical = cand.dimension_scores?.technical ?? 0;
      const experience = cand.dimension_scores?.experience ?? 0;

      let activeMetric = overall;
      if (metricMode === 'technical') activeMetric = technical;
      if (metricMode === 'experience') activeMetric = experience;

      runningSum += activeMetric;
      const cumulativeAverage = Number((runningSum / (idx + 1)).toFixed(1));

      const dateObj = cand.processed_at ? new Date(cand.processed_at) : null;
      const processedDateStr = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : `Resume #${idx + 1}`;

      const nameParts = cand.name.trim().split(' ');
      const shortName =
        nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
          : cand.name;

      return {
        index: idx + 1,
        sequenceLabel: `#${idx + 1} ${shortName}`,
        candidateId: cand.candidate_id,
        name: cand.name,
        shortName,
        email: cand.email,
        processedDateStr,
        processedTimestamp: dateObj ? dateObj.getTime() : idx,
        overallScore: overall,
        technicalScore: technical,
        experienceScore: experience,
        activeMetricScore: activeMetric,
        cumulativeAverage,
        meetsCutoff: overall >= cutoffScore,
        stage: getCandidateStage(cand),
        decisionStatus: cand.decision_status,
      };
    });
  }, [filteredCandidates, metricMode, cutoffScore]);

  // 4. Window slice (All, Last 10, Last 5)
  const displayedChartData = useMemo(() => {
    if (viewWindow === 'last5') {
      return chartData.slice(-5);
    }
    if (viewWindow === 'last10') {
      return chartData.slice(-10);
    }
    return chartData;
  }, [chartData, viewWindow]);

  // 5. Aggregate statistics across all processed candidates
  const metrics = useMemo(() => {
    if (chronologicalCandidates.length === 0) {
      return {
        total: 0,
        average: 0,
        passCount: 0,
        passRate: 0,
        highest: null as Candidate | null,
        lowest: null as Candidate | null,
        trendDelta: 0,
      };
    }

    const total = chronologicalCandidates.length;
    const scores = chronologicalCandidates.map((c) => c.overall_score);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    const average = Number((sum / total).toFixed(1));
    const passCount = chronologicalCandidates.filter((c) => c.overall_score >= cutoffScore).length;
    const passRate = Math.round((passCount / total) * 100);

    const sortedByScore = [...chronologicalCandidates].sort(
      (a, b) => b.overall_score - a.overall_score
    );
    const highest = sortedByScore[0] || null;
    const lowest = sortedByScore[sortedByScore.length - 1] || null;

    // Quality momentum: compare average of the second half of evaluated candidates vs the first half
    let trendDelta = 0;
    if (total >= 2) {
      const midpoint = Math.floor(total / 2);
      const firstHalf = chronologicalCandidates.slice(0, midpoint);
      const secondHalf = chronologicalCandidates.slice(midpoint);

      const firstAvg =
        firstHalf.reduce((acc, c) => acc + c.overall_score, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((acc, c) => acc + c.overall_score, 0) / secondHalf.length;
      trendDelta = Number((secondAvg - firstAvg).toFixed(1));
    }

    return {
      total,
      average,
      passCount,
      passRate,
      highest,
      lowest,
      trendDelta,
    };
  }, [chronologicalCandidates, cutoffScore]);

  // 6. Score Tier Buckets for Distribution breakdown
  const distributionTiers = useMemo(() => {
    const total = chronologicalCandidates.length;
    const tiers = {
      exceptional: { label: 'Exceptional (90–100%)', count: 0, percent: 0, color: 'bg-[#6743ee]' },
      qualified: { label: 'Qualified (80–89%)', count: 0, percent: 0, color: 'bg-emerald-600' },
      review: { label: 'Review Zone (70–79%)', count: 0, percent: 0, color: 'bg-amber-600' },
      below: { label: 'Below Bar (<70%)', count: 0, percent: 0, color: 'bg-rose-600' },
    };

    if (total === 0) return tiers;

    chronologicalCandidates.forEach((c) => {
      const s = c.overall_score;
      if (s >= 90) tiers.exceptional.count++;
      else if (s >= 80) tiers.qualified.count++;
      else if (s >= 70) tiers.review.count++;
      else tiers.below.count++;
    });

    tiers.exceptional.percent = Math.round((tiers.exceptional.count / total) * 100);
    tiers.qualified.percent = Math.round((tiers.qualified.count / total) * 100);
    tiers.review.percent = Math.round((tiers.review.count / total) * 100);
    tiers.below.percent = Math.round((tiers.below.count / total) * 100);

    return tiers;
  }, [chronologicalCandidates]);

  // Custom Recharts Dot for Candidate Score Points
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return null;

    const meets = payload.overallScore >= cutoffScore;
    const strokeColor = meets ? '#10b981' : '#e11d48';

    return (
      <circle
        key={`dot-${payload.candidateId}-${payload.index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="#ffffff"
        stroke={strokeColor}
        strokeWidth={2.5}
        className="cursor-pointer transition-transform hover:scale-125"
        onClick={() => onInspectCandidate?.(payload.candidateId)}
      />
    );
  };

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: ChartPoint = payload[0].payload;
    const diff = data.overallScore - cutoffScore;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 text-xs space-y-2 min-w-[240px] z-50">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <div className="font-bold text-slate-900 text-sm">{data.name}</div>
            <div className="text-[11px] text-slate-500">
              Resume #{data.index} · <span className="font-mono">{data.candidateId}</span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
              data.meetsCutoff
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {data.overallScore}% Overall
          </span>
        </div>

        <div className="space-y-1 text-slate-600 text-[11px]">
          <div className="flex justify-between">
            <span>Processed:</span>
            <span className="font-medium text-slate-800">{data.processedDateStr}</span>
          </div>
          <div className="flex justify-between">
            <span>Vs. Rubric Cutoff ({cutoffScore}%):</span>
            <span
              className={`font-semibold tabular-nums ${
                diff >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {diff >= 0 ? `+${diff}% above bar` : `${diff}% below bar`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Cumulative Average at Intake:</span>
            <span className="font-semibold text-teal-700 tabular-nums">
              {data.cumulativeAverage}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Current Stage:</span>
            <span className="font-medium text-slate-800">{data.stage}</span>
          </div>
          <div className="flex justify-between">
            <span>Decision:</span>
            <span className="font-medium text-slate-800 truncate max-w-[140px]">
              {data.decisionStatus}
            </span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>Click point to view profile</span>
          <span className="text-[#6743ee] font-semibold">Inspect →</span>
        </div>
      </div>
    );
  };

  return (
    <section
      id="candidate-score-trajectory-section"
      aria-label="Candidate Score Trajectory & Distribution"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden space-y-0"
    >
      {/* Header & Controls Bar */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6743ee]" />
            <h2 className="text-sm font-semibold text-slate-900">
              Candidate Score Distribution & Intake Trajectory
            </h2>
            <span className="text-slate-400 font-normal text-xs tabular-nums">
              ({metrics.total} {metrics.total === 1 ? 'resume' : 'resumes'} evaluated)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribution of candidate overall scores over time as more resumes are processed against the{' '}
            <strong className="text-slate-700 font-medium">{cutoffScore}%</strong> rubric cutoff bar.
          </p>
        </div>

        {/* View Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Metric Selector */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {[
              { id: 'overall' as const, label: 'Overall Score' },
              { id: 'technical' as const, label: 'Technical' },
              { id: 'experience' as const, label: 'Experience' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetricMode(m.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  metricMode === m.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Time Window Selector */}
          <select
            aria-label="Filter timeline window"
            value={viewWindow}
            onChange={(e) => setViewWindow(e.target.value as 'all' | 'last10' | 'last5')}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee] cursor-pointer"
          >
            <option value="all">All Resumes</option>
            <option value="last10">Last 10 Resumes</option>
            <option value="last5">Last 5 Resumes</option>
          </select>

          {/* Stage Filter */}
          <select
            aria-label="Filter trajectory by stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee] cursor-pointer"
          >
            <option value="all">All Stages</option>
            <option value="Screening">Screening</option>
            <option value="Technical">Technical</option>
            <option value="Interview">Interview</option>
            <option value="Offered">Offered</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Cumulative Average Toggle */}
          <button
            type="button"
            onClick={() => setShowCumulativeAverage((prev) => !prev)}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              showCumulativeAverage
                ? 'bg-teal-50 text-teal-800 border-teal-200 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle cumulative average trendline"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Avg Trend</span>
          </button>

          {onQuickUploadClick && (
            <button
              type="button"
              onClick={onQuickUploadClick}
              className="px-2.5 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Upload resume to see real-time score trajectory update"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Next</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/50">
        <div className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Total Resumes Evaluated
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-500">applicants</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {brief?.job_title || 'Active Role'} talent pipeline
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Cohort Mean Score
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#6743ee] tabular-nums">
              {metrics.average}%
            </span>
            <span className="text-[11px] font-medium text-slate-500 tabular-nums">
              (Bar: {cutoffScore}%)
            </span>
          </div>
          <div className="text-[11px] font-medium">
            {metrics.average >= cutoffScore ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                +{(metrics.average - cutoffScore).toFixed(1)}% above bar
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                -{(cutoffScore - metrics.average).toFixed(1)}% below bar
              </span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Cutoff Pass Rate
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700 tabular-nums">
              {metrics.passRate}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({metrics.passCount} of {metrics.total})
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics.total - metrics.passCount} below advisory cutoff
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Intake Quality Momentum
          </div>
          <div className="flex items-baseline gap-2">
            {metrics.trendDelta > 0 ? (
              <>
                <span className="text-xl font-bold text-emerald-700 tabular-nums flex items-center gap-0.5">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  +{metrics.trendDelta}%
                </span>
                <span className="text-xs text-emerald-700 font-medium">Trending up</span>
              </>
            ) : metrics.trendDelta < 0 ? (
              <>
                <span className="text-xl font-bold text-amber-700 tabular-nums flex items-center gap-0.5">
                  <ArrowDownRight className="w-4 h-4 text-amber-600" />
                  {metrics.trendDelta}%
                </span>
                <span className="text-xs text-amber-700 font-medium">Tapering</span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold text-slate-700 tabular-nums flex items-center gap-0.5">
                  <Minus className="w-4 h-4 text-slate-400" />
                  0.0%
                </span>
                <span className="text-xs text-slate-500">Steady quality</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {metrics.highest ? `Peak: ${metrics.highest.name} (${metrics.highest.overall_score}%)` : 'Awaiting data'}
          </div>
        </div>
      </div>

      {/* Main Line Chart Body */}
      <div className="p-5 space-y-4">
        {displayedChartData.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Activity className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">
              No candidates match the selected filters to display on the trajectory line chart.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#6743ee]" />
                  <span className="font-semibold text-slate-800">
                    Candidate {metricMode === 'overall' ? 'Overall Score' : `${metricMode.toUpperCase()} Score`}
                  </span>
                </div>
                {showCumulativeAverage && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-teal-600" />
                    <span className="font-semibold text-teal-700">
                      Cumulative Cohort Mean
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" />
                  <span className="text-slate-500">
                    Cutoff Benchmark ({cutoffScore}%)
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                Click any point to inspect candidate details
              </div>
            </div>

            {/* Recharts Responsive Line Chart */}
            <div className="h-64 sm:h-72 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={displayedChartData}
                  margin={{ top: 12, right: 18, left: -10, bottom: 8 }}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="sequenceLabel"
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    tickLine={{ stroke: '#cbd5e1' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[40, 100]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                    tickLine={{ stroke: '#cbd5e1' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip content={renderCustomTooltip} />

                  {/* Cutoff Reference Zone & Line */}
                  {showCutoffZone && (
                    <ReferenceArea
                      y1={cutoffScore}
                      y2={100}
                      fill="#10b981"
                      fillOpacity={0.04}
                    />
                  )}
                  <ReferenceLine
                    y={cutoffScore}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Cutoff ${cutoffScore}%`,
                      fill: '#64748b',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />

                  {/* Cumulative Running Average Line */}
                  {showCumulativeAverage && (
                    <Line
                      type="monotone"
                      dataKey="cumulativeAverage"
                      name="Cumulative Average"
                      stroke="#0d9488"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 5, fill: '#0d9488' }}
                    />
                  )}

                  {/* Candidate Score Line */}
                  <Line
                    type="monotone"
                    dataKey="activeMetricScore"
                    name="Candidate Score"
                    stroke="#6743ee"
                    strokeWidth={2.5}
                    dot={renderCustomDot}
                    activeDot={{
                      r: 8,
                      fill: '#6743ee',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* 4-Tier Score Distribution Bar & Legend */}
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Score Distribution Tiers across All {metrics.total} Resumes
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              Target benchmark: &ge;{cutoffScore}%
            </span>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            {distributionTiers.exceptional.count > 0 && (
              <div
                style={{ width: `${distributionTiers.exceptional.percent}%` }}
                className="bg-[#6743ee] h-full transition-all"
                title={`Exceptional (90-100%): ${distributionTiers.exceptional.count} candidates (${distributionTiers.exceptional.percent}%)`}
              />
            )}
            {distributionTiers.qualified.count > 0 && (
              <div
                style={{ width: `${distributionTiers.qualified.percent}%` }}
                className="bg-emerald-600 h-full transition-all"
                title={`Qualified (80-89%): ${distributionTiers.qualified.count} candidates (${distributionTiers.qualified.percent}%)`}
              />
            )}
            {distributionTiers.review.count > 0 && (
              <div
                style={{ width: `${distributionTiers.review.percent}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Review Zone (70-79%): ${distributionTiers.review.count} candidates (${distributionTiers.review.percent}%)`}
              />
            )}
            {distributionTiers.below.count > 0 && (
              <div
                style={{ width: `${distributionTiers.below.percent}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`Below Cutoff (<70%): ${distributionTiers.below.count} candidates (${distributionTiers.below.percent}%)`}
              />
            )}
          </div>

          {/* Tier Counts Pill Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#6743ee]" />
                <span className="text-slate-700 font-medium">90–100%</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {distributionTiers.exceptional.count}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({distributionTiers.exceptional.percent}%)
                </span>
              </span>
            </div>

            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
                <span className="text-slate-700 font-medium">80–89%</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {distributionTiers.qualified.count}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({distributionTiers.qualified.percent}%)
                </span>
              </span>
            </div>

            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                <span className="text-slate-700 font-medium">70–79%</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {distributionTiers.review.count}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({distributionTiers.review.percent}%)
                </span>
              </span>
            </div>

            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                <span className="text-slate-700 font-medium">&lt;70%</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {distributionTiers.below.count}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({distributionTiers.below.percent}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Sequential Resume Log Table */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTableLog((prev) => !prev)}
            className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {showTableLog
                  ? 'Hide Sequential Resume Intake Table'
                  : `View Sequential Resume Intake Table (${chartData.length} records)`}
              </span>
            </div>
            {showTableLog ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {showTableLog && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2">Seq #</th>
                    <th className="px-3.5 py-2">Candidate</th>
                    <th className="px-3.5 py-2">Processed At</th>
                    <th className="px-3.5 py-2 text-right">Score</th>
                    <th className="px-3.5 py-2 text-right">Cumulative Mean</th>
                    <th className="px-3.5 py-2">Stage</th>
                    <th className="px-3.5 py-2">Decision</th>
                    <th className="px-3.5 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chartData.map((row) => (
                    <tr
                      key={row.candidateId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-3.5 py-2 font-mono text-slate-500">#{row.index}</td>
                      <td className="px-3.5 py-2">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {row.candidateId}
                        </div>
                      </td>
                      <td className="px-3.5 py-2 text-slate-600 text-[11px]">
                        {row.processedDateStr}
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <span
                          className={`font-bold tabular-nums ${
                            row.meetsCutoff ? 'text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {row.overallScore}%
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right text-teal-700 font-semibold tabular-nums">
                        {row.cumulativeAverage}%
                      </td>
                      <td className="px-3.5 py-2">
                        <span className="font-medium text-slate-700">{row.stage}</span>
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`text-[11px] font-medium ${
                            row.decisionStatus.includes('Not proceeding')
                              ? 'text-rose-700'
                              : row.decisionStatus.includes('Advanced') ||
                                row.decisionStatus.includes('Hired')
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {row.decisionStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectCandidate?.(row.candidateId)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
