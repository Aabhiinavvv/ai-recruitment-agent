import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts';
import { Candidate, DimensionScores, HiringBrief } from '../types';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  BarChart2,
  Radar as RadarIcon,
  ShieldCheck,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CandidateRubricRadarChartProps {
  candidate: Candidate;
  brief: HiringBrief | null;
  cutoffScore?: number;
}

export interface RubricDimensionMeta {
  key: keyof DimensionScores;
  name: string;
  shortLabel: string;
  defaultWeight: number;
  defaultTarget: number;
  criterion: string;
}

export const RUBRIC_DIMENSIONS_CONFIG: RubricDimensionMeta[] = [
  {
    key: 'technical',
    name: 'Technical Proficiency',
    shortLabel: 'Technical',
    defaultWeight: 30,
    defaultTarget: 80,
    criterion: 'Technical proficiency in required skill stack & architectural depth',
  },
  {
    key: 'experience',
    name: 'Production Experience',
    shortLabel: 'Experience',
    defaultWeight: 20,
    defaultTarget: 75,
    criterion: 'Demonstrated production experience, tenure & leadership progression',
  },
  {
    key: 'education',
    name: 'Education & Credentials',
    shortLabel: 'Education',
    defaultWeight: 10,
    defaultTarget: 70,
    criterion: 'Academic credentials, technical degrees or relevant certifications',
  },
  {
    key: 'projects',
    name: 'Projects & Real Impact',
    shortLabel: 'Projects',
    defaultWeight: 15,
    defaultTarget: 75,
    criterion: 'Practical project outcomes, open-source systems or measurable scale',
  },
  {
    key: 'domain',
    name: 'Domain & System Architecture',
    shortLabel: 'Domain',
    defaultWeight: 15,
    defaultTarget: 75,
    criterion: 'Target industry domain mastery & distributed architecture concepts',
  },
  {
    key: 'communication',
    name: 'Communication & Synergy',
    shortLabel: 'Communication',
    defaultWeight: 10,
    defaultTarget: 75,
    criterion: 'Clear technical communication, collaborative prose & trade-off rationale',
  },
];

type TargetMode = 'role_calibrated' | 'cutoff_baseline' | 'senior_bar' | 'custom';

export const CandidateRubricRadarChart: React.FC<CandidateRubricRadarChartProps> = ({
  candidate,
  brief,
  cutoffScore = 75,
}) => {
  const [viewMode, setViewMode] = useState<'spider' | 'bars'>('spider');
  const [targetMode, setTargetMode] = useState<TargetMode>('role_calibrated');
  const [customBaseline, setCustomBaseline] = useState<number>(cutoffScore);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState<boolean>(true);
  const [activeDimensionKey, setActiveDimensionKey] = useState<string | null>(null);

  // Compute target benchmarks according to selected mode
  const targetScores = useMemo<Record<keyof DimensionScores, number>>(() => {
    switch (targetMode) {
      case 'cutoff_baseline':
        return {
          technical: cutoffScore,
          experience: cutoffScore,
          education: Math.max(60, cutoffScore - 5),
          projects: cutoffScore,
          domain: cutoffScore,
          communication: cutoffScore,
        };
      case 'senior_bar':
        return {
          technical: 88,
          experience: 85,
          education: 75,
          projects: 82,
          domain: 82,
          communication: 80,
        };
      case 'custom':
        return {
          technical: customBaseline,
          experience: Math.max(50, customBaseline - 2),
          education: Math.max(50, customBaseline - 8),
          projects: customBaseline,
          domain: customBaseline,
          communication: Math.max(50, customBaseline - 3),
        };
      case 'role_calibrated':
      default: {
        // Calibrate based on brief requirements if available, else default targets
        const scaleFactor = cutoffScore / 75;
        return {
          technical: Math.min(95, Math.round(80 * scaleFactor)),
          experience: Math.min(95, Math.round(75 * scaleFactor)),
          education: Math.min(90, Math.round(70 * scaleFactor)),
          projects: Math.min(95, Math.round(75 * scaleFactor)),
          domain: Math.min(95, Math.round(75 * scaleFactor)),
          communication: Math.min(95, Math.round(75 * scaleFactor)),
        };
      }
    }
  }, [targetMode, cutoffScore, customBaseline]);

  // Extract weights and criteria from brief's rubric if present
  const dimensionData = useMemo(() => {
    const briefCriteria = brief?.evaluation_rubric?.criteria || [];

    return RUBRIC_DIMENSIONS_CONFIG.map((dim, idx) => {
      const matchedBrief = briefCriteria[idx] || briefCriteria.find((c) =>
        c.criterion.toLowerCase().includes(dim.key)
      );

      const weight = matchedBrief?.weight_percent ?? dim.defaultWeight;
      const candidateScore = candidate.dimension_scores?.[dim.key] ?? 0;
      const targetScore = targetScores[dim.key] ?? dim.defaultTarget;
      const delta = candidateScore - targetScore;
      const evidence =
        candidate.dimension_evidence?.[dim.key] ||
        candidate.dimension_evidence?.[dim.name] ||
        candidate.dimension_evidence?.[dim.key.charAt(0).toUpperCase() + dim.key.slice(1)] ||
        '';

      return {
        key: dim.key,
        name: dim.name,
        shortLabel: dim.shortLabel,
        weight,
        criterion: matchedBrief?.criterion || dim.criterion,
        candidateScore,
        targetScore,
        delta,
        evidence,
        isExceeding: delta > 0,
        isMeeting: delta === 0,
        isBelow: delta < 0,
        fullMark: 100,
      };
    });
  }, [candidate, brief, targetScores]);

  // Aggregate stats
  const exceedingCount = dimensionData.filter((d) => d.candidateScore >= d.targetScore).length;
  const weightedCandidateScore = dimensionData
    .reduce((acc, d) => acc + (d.candidateScore * d.weight) / 100, 0)
    .toFixed(1);
  const weightedTargetScore = dimensionData
    .reduce((acc, d) => acc + (d.targetScore * d.weight) / 100, 0)
    .toFixed(1);

  // Highest surplus and largest gap
  const sortedByDelta = [...dimensionData].sort((a, b) => b.delta - a.delta);
  const topStrength = sortedByDelta[0];
  const primaryGap = sortedByDelta[sortedByDelta.length - 1];

  // Radar dataset for Recharts
  const radarChartData = useMemo(() => {
    return dimensionData.map((d) => ({
      dimension: d.shortLabel,
      fullName: d.name,
      'Candidate Score': d.candidateScore,
      'Target Job Requirement': d.targetScore,
      delta: d.delta,
      weight: d.weight,
      criterion: d.criterion,
      evidence: d.evidence,
      fullMark: 100,
    }));
  }, [dimensionData]);

  // Custom Recharts Tooltip
  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const delta = data.delta;
    const isExceeding = delta > 0;
    const isBelow = delta < 0;

    return (
      <div className="bg-white/95 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 shadow-xl max-w-xs text-xs space-y-2 z-50">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-900 text-sm">{data.fullName}</span>
          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#6743ee] font-semibold text-[11px]">
            {data.weight}% Weight
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6743ee]" />
              {candidate.name}:
            </span>
            <span className="font-extrabold text-slate-900 text-sm tabular-nums">
              {data['Candidate Score']}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-teal-600 bg-teal-100" />
              Target Requirement:
            </span>
            <span className="font-semibold text-teal-800 text-sm tabular-nums">
              {data['Target Job Requirement']}%
            </span>
          </div>

          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Variance vs Target:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1 ${
                isExceeding
                  ? 'bg-emerald-50 text-emerald-700'
                  : isBelow
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {isExceeding && `+${delta}% Exceeds Target`}
              {isBelow && `${delta}% Below Target`}
              {!isExceeding && !isBelow && `Meets Target`}
            </span>
          </div>
        </div>

        {data.evidence && (
          <p className="pt-1.5 text-[11px] text-slate-500 italic border-t border-slate-100 line-clamp-3">
            &ldquo;{data.evidence}&rdquo;
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 to-purple-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6743ee]/10 text-[#6743ee] flex items-center justify-center">
              <RadarIcon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              6-Dimension Rubric Spider Chart
            </h3>
            <span className="px-2 py-0.5 bg-purple-100/70 text-[#6743ee] rounded-full text-[11px] font-semibold">
              Candidate vs Target Requirements
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualizing {candidate.name}&apos;s verified scores across all 6 core evaluation dimensions
            against the {brief?.job_title || 'target role'} baseline.
          </p>
        </div>

        {/* View Mode & Target Benchmark Selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Target Requirement Benchmark Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 pl-1.5 pr-0.5">Target Bar:</span>
            <select
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as TargetMode)}
              className="bg-transparent border-0 text-slate-700 font-semibold focus:ring-0 text-xs py-1 pr-6 pl-1 cursor-pointer"
            >
              <option value="role_calibrated">Role Calibrated (Default)</option>
              <option value="cutoff_baseline">Cutoff Threshold ({cutoffScore}%)</option>
              <option value="senior_bar">Senior / High Bar (85%+)</option>
              <option value="custom">Custom Bar ({customBaseline}%)</option>
            </select>
          </div>

          {/* Custom Slider Popup when custom mode selected */}
          {targetMode === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-500 text-[11px]">Threshold:</span>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={customBaseline}
                onChange={(e) => setCustomBaseline(Number(e.target.value))}
                className="w-16 accent-[#6743ee] cursor-pointer"
              />
              <span className="font-bold text-slate-800 text-[11px] tabular-nums">{customBaseline}%</span>
            </div>
          )}

          {/* Toggle View: Spider Radar vs Dimension Bars */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('spider')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'spider'
                  ? 'bg-white text-[#6743ee] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RadarIcon className="w-3.5 h-3.5" />
              <span>Spider</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('bars')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'bars'
                  ? 'bg-white text-[#6743ee] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Bars</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-100 bg-slate-50/40 text-xs">
        <div className="p-3.5 flex flex-col justify-center">
          <span className="text-[11px] text-slate-500 font-medium">Candidate Weighted Score</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-extrabold text-[#6743ee] tabular-nums">
              {weightedCandidateScore}%
            </span>
            <span className="text-[11px] text-slate-400">/ 100%</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-center">
          <span className="text-[11px] text-slate-500 font-medium">Target Role Baseline</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-bold text-teal-700 tabular-nums">
              {weightedTargetScore}%
            </span>
            <span className="text-[11px] text-teal-600/80">req.</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-center">
          <span className="text-[11px] text-slate-500 font-medium">Requirements Alignment</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`font-bold tabular-nums text-sm ${
                exceedingCount >= 5
                  ? 'text-emerald-700'
                  : exceedingCount >= 4
                  ? 'text-indigo-700'
                  : 'text-amber-700'
              }`}
            >
              {exceedingCount} of 6
            </span>
            <span className="text-[11px] text-slate-500">Dimensions Meet/Exceed</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-center">
          <span className="text-[11px] text-slate-500 font-medium">Top Competency Surplus</span>
          <div className="flex items-center gap-1 mt-0.5 truncate">
            {topStrength && (
              <>
                <span className="font-semibold text-slate-900 truncate">{topStrength.shortLabel}</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                  +{topStrength.delta}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Side: Spider / Radar Visualization or Horizontal Comparison Bars */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          {viewMode === 'spider' ? (
            <div className="w-full h-[340px] sm:h-[380px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                  data={radarChartData}
                >
                  <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={({ x, y, payload }) => {
                      const item = dimensionData.find((d) => d.shortLabel === payload.value);
                      const isExceeding = item && item.delta >= 0;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={3}
                            textAnchor="middle"
                            className="text-[11px] font-semibold fill-slate-700"
                          >
                            {payload.value}
                          </text>
                          {item && (
                            <text
                              x={0}
                              y={13}
                              textAnchor="middle"
                              className={`text-[10px] font-bold ${
                                isExceeding ? 'fill-emerald-600' : 'fill-amber-600'
                              }`}
                            >
                              {item.candidateScore}% vs {item.targetScore}%
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    stroke="#cbd5e1"
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                  />
                  <Tooltip content={<CustomRadarTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => (
                      <span className="text-xs font-semibold text-slate-700">{val}</span>
                    )}
                  />
                  {/* Target Requirement Polygon (Dashed teal) */}
                  <Radar
                    name="Target Job Requirement"
                    dataKey="Target Job Requirement"
                    stroke="#0d9488"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="#0d9488"
                    fillOpacity={0.14}
                  />
                  {/* Candidate Evaluated Score Polygon (Solid purple) */}
                  <Radar
                    name={`${candidate.name} (Candidate)`}
                    dataKey="Candidate Score"
                    stroke="#6743ee"
                    strokeWidth={2.5}
                    fill="#6743ee"
                    fillOpacity={0.32}
                    dot={{ r: 4, fill: '#6743ee', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                </RadarChart>
              </ResponsiveContainer>

              <div className="text-center text-[11px] text-slate-400 mt-1">
                Hover any vertex to inspect rubric weight, target expectation, and candidate evidence.
              </div>
            </div>
          ) : (
            /* Bar view comparison */
            <div className="w-full space-y-4 py-2">
              {dimensionData.map((d) => (
                <div key={d.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{d.name}</span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded text-[10px]">
                        {d.weight}% weight
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#6743ee] tabular-nums">
                        {d.candidateScore}%
                      </span>
                      <span className="text-slate-400">/</span>
                      <span className="font-semibold text-teal-700 tabular-nums">
                        {d.targetScore}% target
                      </span>
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          d.delta >= 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {d.delta >= 0 ? `+${d.delta}%` : `${d.delta}%`}
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar Representation */}
                  <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    {/* Target Benchmark Marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-teal-600 z-10"
                      style={{ left: `${d.targetScore}%` }}
                      title={`Target Requirement: ${d.targetScore}%`}
                    />
                    {/* Candidate Score Bar */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        d.candidateScore >= d.targetScore ? 'bg-[#6743ee]' : 'bg-amber-500'
                      }`}
                      style={{ width: `${d.candidateScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Dimension Variance & Evidence Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Rubric Competency Matrix
            </h4>
            <button
              type="button"
              onClick={() => setShowEvidenceDetails((prev) => !prev)}
              className="text-[11px] text-[#6743ee] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{showEvidenceDetails ? 'Compact Cards' : 'Show Resume Evidence'}</span>
              {showEvidenceDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {dimensionData.map((d) => {
              const isSelected = activeDimensionKey === d.key;
              return (
                <div
                  key={d.key}
                  onClick={() => setActiveDimensionKey(isSelected ? null : d.key)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#6743ee] bg-purple-50/30 ring-1 ring-[#6743ee]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {d.delta >= 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-900 text-xs">{d.name}</span>
                        <span className="ml-1.5 text-[10px] text-slate-400">({d.weight}% weight)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 tabular-nums">
                        {d.candidateScore}%
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                          d.delta > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : d.delta === 0
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {d.delta > 0 ? `+${d.delta}%` : `${d.delta}%`}
                      </span>
                    </div>
                  </div>

                  {/* Progress Comparison bar */}
                  <div className="mt-2 relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-teal-600 z-10"
                      style={{ left: `${d.targetScore}%` }}
                    />
                    <div
                      className={`h-full rounded-full ${
                        d.candidateScore >= d.targetScore ? 'bg-[#6743ee]' : 'bg-amber-500'
                      }`}
                      style={{ width: `${d.candidateScore}%` }}
                    />
                  </div>

                  {/* Evidence Text */}
                  {(showEvidenceDetails || isSelected) && d.evidence && (
                    <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg leading-snug border border-slate-100">
                      <strong className="text-slate-700 font-medium">Evaluation Signal:</strong>{' '}
                      {d.evidence}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
