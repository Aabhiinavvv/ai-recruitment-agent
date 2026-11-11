import React, { useState, useMemo } from 'react';
import { 
  Candidate, 
  HiringStage, 
  HiringBrief, 
  StageIntensityLevel, 
  CandidateHeatmapRow, 
  CandidateStageDwellInfo 
} from '../types';
import { 
  PIPELINE_STAGES, 
  SLA_PRESETS, 
  DEFAULT_STAGE_SLAS, 
  resolveCandidateDwells, 
  calculatePipelineBottlenecks, 
  getIntensityColorTokens 
} from '../services/recruitmentIntensityService';
import { 
  Flame, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Filter, 
  Search, 
  ArrowUpDown, 
  Zap, 
  TrendingUp, 
  SlidersHorizontal, 
  Calendar, 
  FileText, 
  Mail, 
  Copy, 
  Check, 
  ChevronRight, 
  ShieldAlert, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

interface RecruitmentIntensityHeatmapProps {
  candidates: Candidate[];
  brief: HiringBrief | null;
  onInspectCandidate: (candidateId: string) => void;
  onOpenScheduler?: (candidate: Candidate) => void;
  onOpenEmailModal?: (candidate: Candidate) => void;
  onStageChange?: (candidateId: string, newStage: HiringStage) => void;
}

export const RecruitmentIntensityHeatmap: React.FC<RecruitmentIntensityHeatmapProps> = ({
  candidates,
  brief,
  onInspectCandidate,
  onOpenScheduler,
  onOpenEmailModal,
  onStageChange,
}) => {
  // State for SLA mode, filters, sorting, and selected cell for inspection
  const [slaPresetKey, setSlaPresetKey] = useState<'standard' | 'fastTrack' | 'thorough'>('standard');
  const [filterBottlenecksOnly, setFilterBottlenecksOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'bottleneck' | 'totalDays' | 'score' | 'name'>('bottleneck');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [inspectedCell, setInspectedCell] = useState<{
    candidate: Candidate;
    stage: HiringStage;
    dwellInfo: CandidateStageDwellInfo;
  } | null>(null);
  const [copiedDigest, setCopiedDigest] = useState<boolean>(false);
  const [nudgedCandidateId, setNudgedCandidateId] = useState<string | null>(null);

  const activeSlas = useMemo(() => SLA_PRESETS[slaPresetKey], [slaPresetKey]);

  // Resolve dwell times for all candidates
  const heatmapRows: CandidateHeatmapRow[] = useMemo(() => {
    return candidates.map(c => resolveCandidateDwells(c, activeSlas));
  }, [candidates, activeSlas]);

  // Aggregate bottleneck calculations
  const bottleneckAnalytics = useMemo(() => {
    return calculatePipelineBottlenecks(candidates, activeSlas);
  }, [candidates, activeSlas]);

  // Filter and sort candidates
  const filteredAndSortedRows = useMemo(() => {
    let result = [...heatmapRows];

    // Filter bottlenecks only
    if (filterBottlenecksOnly) {
      result = result.filter(r => r.hasBottleneck);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.candidate.name.toLowerCase().includes(q) ||
        r.candidate.candidate_id.toLowerCase().includes(q) ||
        r.candidate.email.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'bottleneck') {
        const severityRank: Record<StageIntensityLevel, number> = {
          bottleneck: 4,
          elevated: 3,
          moderate: 2,
          optimal: 1,
          unreached: 0
        };
        comparison = (severityRank[b.worstIntensityLevel] || 0) - (severityRank[a.worstIntensityLevel] || 0);
        if (comparison === 0) {
          comparison = b.totalPipelineDays - a.totalPipelineDays;
        }
      } else if (sortBy === 'totalDays') {
        comparison = b.totalPipelineDays - a.totalPipelineDays;
      } else if (sortBy === 'score') {
        comparison = b.candidate.overall_score - a.candidate.overall_score;
      } else if (sortBy === 'name') {
        comparison = a.candidate.name.localeCompare(b.candidate.name);
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [heatmapRows, filterBottlenecksOnly, searchQuery, sortBy, sortDirection]);

  const handleCopyBottleneckDigest = () => {
    const roleTitle = brief?.job_title || 'Open Role';
    const digest = `## 🌡️ Recruitment Intensity & Pipeline Bottleneck Report
**Role:** ${roleTitle}
**Primary Pipeline Bottleneck:** ${bottleneckAnalytics.primaryBottleneckStage} Round
**SLA Health Index:** ${bottleneckAnalytics.slaHealthIndexPercent}% within SLA
**Average Cycle Time:** ${bottleneckAnalytics.overallAvgCycleDays} days
**Candidates At-Risk / Overdue:** ${bottleneckAnalytics.totalCandidatesAtRisk} of ${candidates.length}

---
### Stage-by-Stage Dwell Breakdown:
${PIPELINE_STAGES.map(stage => {
  const avg = bottleneckAnalytics.stageAverages[stage];
  return `• **${stage}:** Avg ${avg.avgDays} days (Target SLA: ${avg.slaTarget}d) · ${avg.stalledCount} overdue / ${avg.activeCount} active`;
}).join('\n')}

---
### AI Remediation Actions:
${bottleneckAnalytics.recommendedActions.map(action => `• ${action}`).join('\n')}
`;

    navigator.clipboard.writeText(digest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2200);
  };

  const handleNudge = (candidateId: string) => {
    setNudgedCandidateId(candidateId);
    setTimeout(() => {
      setNudgedCandidateId(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive Bottleneck Analytics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Primary Bottleneck Card */}
        <div className="p-4 bg-gradient-to-br from-rose-50 to-orange-50/80 rounded-2xl border border-rose-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-rose-900">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
              Primary Bottleneck
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-black uppercase tracking-wider">
              Critical
            </span>
          </div>
          <div className="text-xl font-black text-rose-950">
            {bottleneckAnalytics.primaryBottleneckStage} Round
          </div>
          <p className="text-xs text-rose-800 leading-snug">
            Avg dwell: <strong className="font-bold">{bottleneckAnalytics.stageAverages[bottleneckAnalytics.primaryBottleneckStage]?.avgDays || 0} days</strong> vs {activeSlas[bottleneckAnalytics.primaryBottleneckStage]?.targetDays}d SLA.
          </p>
        </div>

        {/* SLA Health Index Card */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/80 rounded-2xl border border-emerald-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              SLA Health Index
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
              Flow Rate
            </span>
          </div>
          <div className="text-xl font-black text-emerald-950">
            {bottleneckAnalytics.slaHealthIndexPercent}% Within SLA
          </div>
          <p className="text-xs text-emerald-800 leading-snug">
            Percentage of candidate phases progressing without exceeding threshold.
          </p>
        </div>

        {/* Total Candidates At-Risk Card */}
        <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50/80 rounded-2xl border border-amber-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Overdue Candidates
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
              Attention
            </span>
          </div>
          <div className="text-xl font-black text-amber-950">
            {bottleneckAnalytics.totalCandidatesAtRisk} Stalled
          </div>
          <p className="text-xs text-amber-800 leading-snug">
            Candidates currently exceeding the maximum stage dwell SLA.
          </p>
        </div>

        {/* Average Cycle Time Card */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50/80 rounded-2xl border border-purple-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#6743ee]" />
              Average Cycle Time
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] font-bold border border-purple-300">
              Velocity
            </span>
          </div>
          <div className="text-xl font-black text-purple-950">
            {bottleneckAnalytics.overallAvgCycleDays} Days
          </div>
          <p className="text-xs text-purple-800 leading-snug">
            Cumulative dwell from screening to current active recruitment phase.
          </p>
        </div>
      </div>

      {/* 2. Interactive Heatmap Controls & Legend Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>Recruitment Intensity Heatmap Matrix</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  Phase Dwell Velocity
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Color-coded stages based on days spent in each recruitment phase. Click any cell to inspect blockers and take remediation actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* SLA Tolerance Preset Switcher */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold">SLA Mode:</span>
              <select
                value={slaPresetKey}
                onChange={(e) => setSlaPresetKey(e.target.value as any)}
                className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                title="Select stage SLA velocity benchmarks"
              >
                <option value="standard">Standard (2d / 4d / 5d / 3d)</option>
                <option value="fastTrack">Fast-Track (1d / 2.5d / 3d / 2d)</option>
                <option value="thorough">Thorough (3d / 6d / 7d / 4d)</option>
              </select>
            </div>

            {/* Copy Bottleneck Report */}
            <button
              type="button"
              onClick={handleCopyBottleneckDigest}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                copiedDigest
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
              title="Copy executive bottleneck summary markdown for hiring team standup"
            >
              {copiedDigest ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copiedDigest ? 'Copied Report!' : 'Export Bottleneck Report'}</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Left: Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterBottlenecksOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !filterBottlenecksOnly
                  ? 'bg-[#6743ee] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterBottlenecksOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                filterBottlenecksOnly
                  ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-400/30'
                  : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Bottlenecks Only ({bottleneckAnalytics.totalCandidatesAtRisk})</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate name or ID..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#6743ee] w-48 sm:w-60"
              />
            </div>
          </div>

          {/* Right: Sorting */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
            >
              <option value="bottleneck">Bottleneck Severity</option>
              <option value="totalDays">Total Pipeline Dwell</option>
              <option value="score">AI Evaluation Score</option>
              <option value="name">Candidate Name</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Color Scale Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-[11px]">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
            Intensity Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 shadow-2xs" />
            <span className="text-slate-700 font-medium">Optimal (&lt; SLA)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-400 shadow-2xs" />
            <span className="text-slate-700 font-medium">Moderate (Near SLA)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-500 shadow-2xs" />
            <span className="text-slate-700 font-medium">Elevated (Attention)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-600 shadow-2xs ring-1 ring-rose-400" />
            <span className="text-slate-900 font-bold">Critical Bottleneck (&gt; SLA)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 border-dashed" />
            <span>Not Reached</span>
          </div>
        </div>
      </div>

      {/* 3. Heatmap Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3.5 px-4 min-w-[220px]">Candidate</th>
                <th className="py-3.5 px-3 min-w-[110px]">Current Stage</th>
                {PIPELINE_STAGES.map(stage => (
                  <th key={stage} className="py-3.5 px-3 min-w-[140px] text-center">
                    <div className="font-bold text-slate-900">{activeSlas[stage].label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      SLA: ≤{activeSlas[stage].targetDays}d (Max {activeSlas[stage].bottleneckDays}d)
                    </div>
                  </th>
                ))}
                <th className="py-3.5 px-3 min-w-[100px] text-center">Total Dwell</th>
                <th className="py-3.5 px-4 min-w-[140px] text-right">Expedite Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAndSortedRows.map((row) => {
                const cand = row.candidate;
                const isNudged = nudgedCandidateId === cand.candidate_id;

                return (
                  <tr key={cand.candidate_id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Candidate Identity */}
                    <td className="py-3 px-4">
                      <div 
                        onClick={() => onInspectCandidate(cand.candidate_id)}
                        className="cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#6743ee] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                            {cand.overall_score}%
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-[#6743ee] transition-colors truncate block">
                              {cand.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {cand.candidate_id} · {cand.email.split('@')[0]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Current Stage Badge */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border inline-block ${
                        row.currentStage === 'Offered'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : row.currentStage === 'Interview'
                          ? 'bg-purple-100 text-[#5b43d6] border-purple-300'
                          : row.currentStage === 'Technical'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {row.currentStage}
                      </span>
                    </td>

                    {/* Heatmap Stage Cells (Screening, Technical, Interview, Offered) */}
                    {PIPELINE_STAGES.map(stage => {
                      const dwell = row.stageDwells[stage];
                      const tokens = getIntensityColorTokens(dwell.intensityLevel);
                      const isCellActive = inspectedCell?.candidate.candidate_id === cand.candidate_id && inspectedCell?.stage === stage;

                      return (
                        <td key={stage} className="py-2.5 px-2 text-center">
                          <div
                            onClick={() => {
                              if (dwell.days > 0) {
                                setInspectedCell({ candidate: cand, stage, dwellInfo: dwell });
                              }
                            }}
                            className={`p-2 rounded-xl border transition-all text-center relative ${
                              tokens.bgClass
                            } ${
                              dwell.days > 0 ? 'cursor-pointer hover:scale-[1.03] shadow-2xs' : 'opacity-60'
                            } ${isCellActive ? 'ring-2 ring-[#6743ee] shadow-sm' : ''}`}
                            title={
                              dwell.days > 0
                                ? `${cand.name} in ${stage}: ${dwell.days} days (Target SLA: ${dwell.slaTarget}d). Click to inspect diagnosis.`
                                : `Stage not yet reached.`
                            }
                          >
                            {/* Current Active Stage Indicator */}
                            {dwell.isCurrent && (
                              <span 
                                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#6743ee] border-2 border-white animate-pulse" 
                                title="Currently active phase"
                              />
                            )}

                            {dwell.days > 0 ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-black">
                                  {dwell.days}d
                                </div>
                                <div className="text-[10px] font-semibold">
                                  {dwell.isOverdue ? (
                                    <span className="text-rose-700 font-bold">
                                      +{dwell.overdueDays}d overdue
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">
                                      ✓ In SLA
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Dwell */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-black text-slate-800 text-xs">
                        {row.totalPipelineDays}d
                      </span>
                    </td>

                    {/* Expedite / Remediation Action */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.hasBottleneck ? (
                          <button
                            type="button"
                            onClick={() => handleNudge(cand.candidate_id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ${
                              isNudged
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                            title="Nudge interviewers and expedite stage review"
                          >
                            <Zap className="w-3 h-3" />
                            <span>{isNudged ? 'Nudged!' : 'Expedite'}</span>
                          </button>
                        ) : (
                          onOpenScheduler && (
                            <button
                              type="button"
                              onClick={() => onOpenScheduler(cand)}
                              className="px-2.5 py-1 bg-white hover:bg-purple-50 text-[#6743ee] border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                              title="Schedule interview session"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Schedule</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span>No candidates matched the current heatmap filter or search term.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Stage-by-Stage Funnel Averages Footer Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {PIPELINE_STAGES.map(stage => {
            const data = bottleneckAnalytics.stageAverages[stage];
            const isWorst = stage === bottleneckAnalytics.primaryBottleneckStage;

            return (
              <div 
                key={stage} 
                className={`p-3 rounded-xl border ${
                  isWorst 
                    ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400/30' 
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                  <span>{stage}</span>
                  {isWorst && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-black">
                      Bottleneck
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900">{data?.avgDays || 0}d</span>
                  <span className="text-[10px] text-slate-500">avg dwell</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target SLA: {data?.slaTarget}d · <strong className={data?.stalledCount > 0 ? 'text-rose-700 font-bold' : 'text-slate-700'}>{data?.stalledCount || 0} stalled</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Inspected Stage Blocker Diagnostic Popover / Modal (When a cell is clicked) */}
      {inspectedCell && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50/90 via-white to-rose-50/90 border border-purple-200 rounded-2xl shadow-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-purple-200/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#6743ee] text-white rounded-lg shadow-2xs">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Stage Dwell Diagnostic: {inspectedCell.candidate.name} in {inspectedCell.stage}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dwell Time: <strong className="text-slate-800 font-bold">{inspectedCell.dwellInfo.days} days</strong> vs {inspectedCell.dwellInfo.slaTarget}d target SLA
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectedCell(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-400 text-[10px] block font-semibold uppercase">Phase Health</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full inline-block ${
                inspectedCell.dwellInfo.isOverdue
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {inspectedCell.dwellInfo.isOverdue ? `Overdue (+${inspectedCell.dwellInfo.overdueDays} days)` : 'Within SLA Target'}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 md:col-span-2">
              <span className="text-slate-400 text-[10px] block font-semibold uppercase">Identified Stage Blocker / Bottleneck Root Cause</span>
              <p className="text-slate-800 font-medium">
                {inspectedCell.dwellInfo.blockerReason || 'Candidate is progressing smoothly through the standard review workflow.'}
              </p>
            </div>
          </div>

          {/* Remediation Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-100 text-xs">
            <div className="text-slate-500 text-[11px]">
              Take action to clear this bottleneck and maintain candidate pipeline velocity.
            </div>

            <div className="flex items-center gap-2">
              {onOpenScheduler && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenScheduler(inspectedCell.candidate);
                    setInspectedCell(null);
                  }}
                  className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Launch Interview Scheduler</span>
                </button>
              )}

              {onOpenEmailModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenEmailModal(inspectedCell.candidate);
                    setInspectedCell(null);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#6743ee]" />
                  <span>Draft Update Email</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onInspectCandidate(inspectedCell.candidate.candidate_id);
                  setInspectedCell(null);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold transition-colors"
              >
                Inspect Full Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI Operational Bottleneck Insights & Remediation Panel */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h4 className="font-bold text-sm sm:text-base">
            AI Pipeline Bottleneck Diagnosis & Operational Recommendations
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The recruitment engine continuously monitors candidate phase dwell times against SLA benchmarks to prevent pipeline stagnation and candidate drop-off.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {bottleneckAnalytics.recommendedActions.map((action, idx) => (
            <div key={idx} className="p-3 bg-white/10 rounded-xl border border-white/15 text-xs text-slate-200 space-y-1">
              <span className="font-bold text-amber-300 text-[11px] block">
                Recommendation #{idx + 1}
              </span>
              <p className="leading-snug text-slate-100">
                {action}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
