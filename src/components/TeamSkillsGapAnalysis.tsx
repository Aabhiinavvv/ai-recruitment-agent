import React, { useState, useMemo } from 'react';
import { Candidate, HiringBrief, SkillCoverageStatus } from '../types';
import { analyzeTeamSkillsGap, getCandidateSkillProficiency } from '../services/skillsGapService';
import { AlertCircle, CheckCircle2, MinusCircle, ChevronDown, ChevronUp, Users, BarChart2, Grid } from 'lucide-react';

interface TeamSkillsGapAnalysisProps {
  candidates: Candidate[];
  brief: HiringBrief | null;
  cutoffScore?: number;
  onInspectCandidate?: (candidateId: string) => void;
  onFilterBySkill?: (skill: string) => void;
  onOpenLinkedInImport?: () => void;
}

export const TeamSkillsGapAnalysis: React.FC<TeamSkillsGapAnalysisProps> = ({
  candidates,
  brief,
  cutoffScore = 75,
  onInspectCandidate,
  onFilterBySkill,
  onOpenLinkedInImport,
}) => {
  const [thresholdMode, setThresholdMode] = useState<'cutoff' | 'top85' | 'all'>('cutoff');
  const [statusFilter, setStatusFilter] = useState<'all' | SkillCoverageStatus>('all');
  const [viewMode, setViewMode] = useState<'bars' | 'matrix'>('bars');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const activeThreshold =
    thresholdMode === 'cutoff' ? cutoffScore : thresholdMode === 'top85' ? 85 : 0;

  const report = useMemo(
    () => analyzeTeamSkillsGap(candidates, brief, activeThreshold),
    [candidates, brief, activeThreshold]
  );

  const filteredCompetencies = useMemo(() => {
    if (statusFilter === 'all') return report.competencies;
    return report.competencies.filter((c) => c.status === statusFilter);
  }, [report.competencies, statusFilter]);

  const missingSkillNames = useMemo(
    () => report.competencies.filter((c) => c.status === 'missing').map((c) => c.skill),
    [report.competencies]
  );

  return (
    <section
      aria-label="Team Skills Gap Analysis"
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5"
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Team Skills Gap Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregates competencies across high-scoring candidates ({activeThreshold > 0 ? `score ≥ ${activeThreshold}%` : 'all active applicants'}) against the {report.roleTitle} brief.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Cohort Threshold Switcher */}
          <div
            role="group"
            aria-label="Candidate cohort threshold"
            className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setThresholdMode('cutoff')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                thresholdMode === 'cutoff'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cutoff (≥ {cutoffScore}%)
            </button>
            <button
              type="button"
              onClick={() => setThresholdMode('top85')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                thresholdMode === 'top85'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top Tier (≥ 85%)
            </button>
            <button
              type="button"
              onClick={() => setThresholdMode('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                thresholdMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pool
            </button>
          </div>

          {/* Chart vs Matrix View Switcher */}
          <div
            role="group"
            aria-label="Visualization mode"
            className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setViewMode('bars')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'bars'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Coverage Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-indigo-600" />
              <span>Candidate Grid</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Skills Gap Analysis' : 'Collapse Skills Gap Analysis'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3 Unboxed Summary Metrics with Hairline Dividers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
        <div className="sm:border-r sm:border-slate-100 sm:pr-4">
          <div className="text-xs font-medium text-slate-500">Brief Competency Coverage</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {report.overallCoveragePercent}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {report.coveredSkillsCount} covered · {report.thinSkillsCount} single-candidate
            </span>
          </div>
        </div>

        <div className="sm:border-r sm:border-slate-100 sm:pr-4">
          <div className="text-xs font-medium text-slate-500">Missing Pool Competencies</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-bold tabular-nums ${
                report.missingSkillsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {report.missingSkillsCount}
            </span>
            <span className="text-xs text-slate-500">
              {report.missingSkillsCount === 0
                ? 'Zero gaps across brief criteria'
                : `of ${report.totalRequiredSkills} required skills uncovered`}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-500">High-Scoring Cohort Evaluated</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {report.cohortCandidates.length}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {report.cohortCandidates.length > 0
                ? `${report.cohortAvgScore}% avg · ${report.cohortCandidates.map((c) => c.name.split(' ')[0]).join(', ')}`
                : 'No candidates above threshold'}
            </span>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {report.cohortCandidates.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Users className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                No candidates meet the {activeThreshold}% threshold yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Lower the score threshold in the sidebar or switch to "All Pool" above to inspect skill coverage across your full applicant pipeline.
              </p>
              <button
                type="button"
                onClick={() => setThresholdMode('all')}
                className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Show All Candidates
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'all', label: `All Required (${report.totalRequiredSkills})` },
                      { id: 'missing', label: `Missing Gaps (${report.missingSkillsCount})` },
                      { id: 'thin', label: `Thin Bench (${report.thinSkillsCount})` },
                      { id: 'covered', label: `Well Covered (${report.coveredSkillsCount})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {report.surplusSkills.length > 0 && (
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Bonus pool strengths:</span>{' '}
                    {report.surplusSkills.map((s) => s.skill).join(' · ')}
                  </div>
                )}
              </div>

              {/* Visualization Body */}
              {viewMode === 'bars' ? (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {filteredCompetencies.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No competencies match this filter.
                    </div>
                  ) : (
                    filteredCompetencies.map((item) => {
                      const isMissing = item.status === 'missing';
                      const isThin = item.status === 'thin';

                      return (
                        <div
                          key={item.skill}
                          className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-6 hover:bg-slate-50/70 px-2 -mx-2 rounded-lg transition-colors"
                        >
                          {/* Left: Skill Title & Explicit Status Indicator */}
                          <div className="md:w-64 shrink-0 flex items-center justify-between md:justify-start gap-2.5">
                            <button
                              type="button"
                              onClick={() => onFilterBySkill?.(item.skill)}
                              className="text-xs font-semibold text-slate-900 hover:text-indigo-600 text-left transition-colors cursor-pointer"
                              title={`Filter pipeline by ${item.skill}`}
                            >
                              {item.skill}
                            </button>

                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                                isMissing
                                  ? 'text-rose-600'
                                  : isThin
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {isMissing ? (
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              ) : isThin ? (
                                <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>
                                {isMissing
                                  ? 'Missing Gap'
                                  : isThin
                                  ? `Thin (${item.coveredCount}/${item.cohortSize})`
                                  : `Covered (${item.coveredCount}/${item.cohortSize})`}
                              </span>
                            </span>
                          </div>

                          {/* Center: Proportional Coverage Bar */}
                          <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              {item.coveragePercent > 0 ? (
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isThin ? 'bg-amber-500' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${item.coveragePercent}%` }}
                                />
                              ) : (
                                <div className="h-full w-full border border-dashed border-rose-300 rounded-full bg-rose-50/50" />
                              )}
                            </div>

                            <span className="w-16 text-right text-xs font-mono tabular-nums text-slate-600 shrink-0">
                              {item.avgProficiency > 0 ? `${item.avgProficiency}/10` : '—'}
                            </span>
                          </div>

                          {/* Right: Holder Breakdown or Near-Cutoff Recovery Insight */}
                          <div className="md:w-72 shrink-0 text-xs text-slate-500 md:text-right truncate">
                            {item.holders.length > 0 ? (
                              <span>
                                {item.holders
                                  .map((h) => `${h.candidateName.split(' ')[0]} (${h.skillScore})`)
                                  .join(' · ')}
                              </span>
                            ) : item.nearCutoffHolders.length > 0 ? (
                              <span className="text-amber-700">
                                Held by{' '}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onInspectCandidate?.(item.nearCutoffHolders[0].candidateId)
                                  }
                                  className="font-semibold underline hover:text-indigo-600 cursor-pointer"
                                >
                                  {item.nearCutoffHolders[0].candidateName}
                                </button>{' '}
                                ({item.nearCutoffHolders[0].overallScore}%, below cutoff)
                              </span>
                            ) : (
                              <span className="text-rose-600/90">
                                Not evidenced in top cohort
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Candidate Matrix Mode */
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Required Competency</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        {report.cohortCandidates.map((cand) => (
                          <th
                            key={cand.candidate_id}
                            className="py-2.5 px-3 font-semibold text-right whitespace-nowrap"
                          >
                            <button
                              type="button"
                              onClick={() => onInspectCandidate?.(cand.candidate_id)}
                              className="hover:text-indigo-600 cursor-pointer"
                            >
                              {cand.name.split(' ')[0]} ({cand.overall_score}%)
                            </button>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 font-semibold text-right">Pool Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCompetencies.map((item) => (
                        <tr key={item.skill} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {item.skill}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold ${
                                item.status === 'missing'
                                  ? 'text-rose-600'
                                  : item.status === 'thin'
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {item.status === 'missing'
                                ? 'Missing Gap'
                                : item.status === 'thin'
                                ? 'Thin Bench'
                                : 'Covered'}
                            </span>
                          </td>
                          {report.cohortCandidates.map((cand) => {
                            const score = getCandidateSkillProficiency(cand, item.skill);
                            return (
                              <td
                                key={cand.candidate_id}
                                className="py-2 px-3 text-right font-mono tabular-nums"
                              >
                                {score !== null ? (
                                  <span
                                    className={`font-semibold ${
                                      score >= 8 ? 'text-emerald-700' : 'text-slate-700'
                                    }`}
                                  >
                                    {score}/10
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {item.avgProficiency > 0 ? `${item.avgProficiency}/10` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actionable Gap Summary Footer */}
              {missingSkillNames.length > 0 && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-slate-600">
                    <span className="font-semibold text-slate-900">Priority Sourcing Gaps:</span>{' '}
                    {missingSkillNames.slice(0, 5).join(', ')}
                    {missingSkillNames.length > 5 && ` +${missingSkillNames.length - 5} more`}
                  </div>

                  {onOpenLinkedInImport && (
                    <button
                      type="button"
                      onClick={onOpenLinkedInImport}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      Source Missing Skills
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
