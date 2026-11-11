import React, { useState, useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Candidate,
  CandidatePersona,
  DimensionScores,
  HiringBrief,
} from '../types';
import { generateCandidatePersona } from '../services/personaGenerator';
import { getCandidateStage } from './HiringWorkflowTab';
import {
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Scale,
  Calendar,
  Eye,
  Radar as RadarIcon,
  ListFilter,
  Award,
} from 'lucide-react';

interface SplitPaneComparisonViewProps {
  candidates: Candidate[];
  candidateAId: string | null;
  candidateBId: string | null;
  onSelectCandidateA: (candidateId: string) => void;
  onSelectCandidateB: (candidateId: string) => void;
  onSelectPair?: (candidateAId: string, candidateBId: string) => void;
  onSwapCandidates: () => void;
  brief: HiringBrief | null;
  cutoffScore?: number;
  onInspectCandidate?: (candidateId: string) => void;
  onOpenScheduler?: (candidate: Candidate) => void;
  onOpenPersona?: (candidate: Candidate) => void;
  onAdvanceCandidate?: (candidateId: string) => void;
  onBackToList?: () => void;
}

interface RubricDimensionSpec {
  key: keyof DimensionScores;
  label: string;
  defaultCriterion: string;
  defaultWeight: number;
}

const RUBRIC_DIMENSIONS: RubricDimensionSpec[] = [
  {
    key: 'technical',
    label: 'Technical',
    defaultCriterion: 'Technical proficiency in required skill stack',
    defaultWeight: 30,
  },
  {
    key: 'experience',
    label: 'Experience',
    defaultCriterion: 'Demonstrated production experience and career progression',
    defaultWeight: 20,
  },
  {
    key: 'education',
    label: 'Education',
    defaultCriterion: 'Education credentials or recognized technical degree',
    defaultWeight: 10,
  },
  {
    key: 'projects',
    label: 'Projects',
    defaultCriterion: 'Practical project outcomes, open-source or system impact',
    defaultWeight: 15,
  },
  {
    key: 'domain',
    label: 'Domain',
    defaultCriterion: 'Target industry domain knowledge & architecture concepts',
    defaultWeight: 15,
  },
  {
    key: 'communication',
    label: 'Communication',
    defaultCriterion: 'Clear communication, documentation, and structured thought',
    defaultWeight: 10,
  },
];

export const SplitPaneComparisonView: React.FC<SplitPaneComparisonViewProps> = ({
  candidates,
  candidateAId,
  candidateBId,
  onSelectCandidateA,
  onSelectCandidateB,
  onSelectPair,
  onSwapCandidates,
  brief,
  cutoffScore = 75,
  onInspectCandidate,
  onOpenScheduler,
  onOpenPersona,
  onAdvanceCandidate,
  onBackToList,
}) => {
  const [showRadarChart, setShowRadarChart] = useState<boolean>(false);

  const sortedByScore = useMemo(
    () => [...candidates].sort((a, b) => b.overall_score - a.overall_score),
    [candidates]
  );

  const candidateA = useMemo(() => {
    return (
      candidates.find((c) => c.candidate_id === candidateAId) ||
      sortedByScore[0] ||
      candidates[0] ||
      null
    );
  }, [candidates, candidateAId, sortedByScore]);

  const candidateB = useMemo(() => {
    const found = candidates.find((c) => c.candidate_id === candidateBId);
    if (found && found.candidate_id !== candidateA?.candidate_id) {
      return found;
    }
    return (
      sortedByScore.find((c) => c.candidate_id !== candidateA?.candidate_id) ||
      sortedByScore[1] ||
      null
    );
  }, [candidates, candidateBId, candidateA, sortedByScore]);

  // Merge active brief rubric criteria & weights with the 6 core dimensions
  const rubricDimensions = useMemo(() => {
    const criteriaList = brief?.evaluation_rubric?.criteria || [];
    return RUBRIC_DIMENSIONS.map((spec, idx) => {
      const matchedCriterion =
        criteriaList.find((c) => c.criterion.toLowerCase().includes(spec.key)) ||
        criteriaList[idx];
      return {
        key: spec.key,
        label: spec.label,
        criterion: matchedCriterion?.criterion || spec.defaultCriterion,
        weightPercent: matchedCriterion?.weight_percent ?? spec.defaultWeight,
      };
    });
  }, [brief]);

  const personaA: CandidatePersona | null = useMemo(() => {
    if (!candidateA) return null;
    return candidateA.persona || generateCandidatePersona(candidateA, brief);
  }, [candidateA, brief]);

  const personaB: CandidatePersona | null = useMemo(() => {
    if (!candidateB) return null;
    return candidateB.persona || generateCandidatePersona(candidateB, brief);
  }, [candidateB, brief]);

  const handleChangeA = (newId: string) => {
    if (candidateB && newId === candidateB.candidate_id && candidateA) {
      onSwapCandidates();
      return;
    }
    onSelectCandidateA(newId);
  };

  const handleChangeB = (newId: string) => {
    if (candidateA && newId === candidateA.candidate_id && candidateB) {
      onSwapCandidates();
      return;
    }
    onSelectCandidateB(newId);
  };

  const handleSelectTopTwo = () => {
    if (sortedByScore.length >= 2) {
      const topA = sortedByScore[0].candidate_id;
      const topB = sortedByScore[1].candidate_id;
      if (onSelectPair) {
        onSelectPair(topA, topB);
      } else {
        onSelectCandidateA(topA);
        onSelectCandidateB(topB);
      }
    }
  };

  if (candidates.length < 2 || !candidateA || !candidateB) {
    return (
      <div className="p-8 text-center space-y-3">
        <Scale className="w-7 h-7 text-slate-400 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-900">
          Add at least two candidates to compare side-by-side
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Upload a resume or import candidates from LinkedIn so you can compare two candidates across all 6 rubric dimensions.
        </p>
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            className="px-3.5 py-1.5 bg-[#6743ee] text-white text-xs font-semibold rounded-lg hover:bg-[#5637d2] cursor-pointer"
          >
            Back to Candidate List
          </button>
        )}
      </div>
    );
  }

  // Compute 6-dimension rubric comparisons
  const dimensionComparisons = rubricDimensions.map((dim) => {
    const scoreA = candidateA.dimension_scores?.[dim.key] ?? 0;
    const scoreB = candidateB.dimension_scores?.[dim.key] ?? 0;
    const weightedA = Number(((scoreA * dim.weightPercent) / 100).toFixed(1));
    const weightedB = Number(((scoreB * dim.weightPercent) / 100).toFixed(1));
    const diff = scoreA - scoreB;
    const leader: 'A' | 'B' | 'tie' = diff > 0 ? 'A' : diff < 0 ? 'B' : 'tie';
    const evidenceA =
      candidateA.dimension_evidence?.[dim.key] ||
      candidateA.dimension_evidence?.[dim.label] ||
      '';
    const evidenceB =
      candidateB.dimension_evidence?.[dim.key] ||
      candidateB.dimension_evidence?.[dim.label] ||
      '';

    return {
      ...dim,
      scoreA,
      scoreB,
      weightedA,
      weightedB,
      diff,
      leader,
      evidenceA,
      evidenceB,
    };
  });

  const weightedTotalA = dimensionComparisons.reduce((sum, d) => sum + d.weightedA, 0).toFixed(1);
  const weightedTotalB = dimensionComparisons.reduce((sum, d) => sum + d.weightedB, 0).toFixed(1);

  const winsA = dimensionComparisons.filter((d) => d.leader === 'A').length;
  const winsB = dimensionComparisons.filter((d) => d.leader === 'B').length;
  const tiesCount = dimensionComparisons.filter((d) => d.leader === 'tie').length;
  const overallDelta = candidateA.overall_score - candidateB.overall_score;

  const radarData = dimensionComparisons.map((d) => ({
    dimension: d.label,
    [candidateA.name]: d.scoreA,
    [candidateB.name]: d.scoreB,
    Benchmark: cutoffScore,
  }));

  const renderPaneHeaderCard = (
    paneSide: 'A' | 'B',
    cand: Candidate,
    otherCand: Candidate,
    persona: CandidatePersona | null,
    weightedTotal: string,
    onSelectId: (id: string) => void
  ) => {
    const isLeft = paneSide === 'A';
    const accentText = isLeft ? 'text-[#6743ee]' : 'text-teal-700';
    const accentBorderTop = isLeft ? 'border-t-2 border-t-[#6743ee]' : 'border-t-2 border-t-teal-600';
    const paneDelta = isLeft ? overallDelta : -overallDelta;

    return (
      <div
        data-testid={`compare-pane-${paneSide}`}
        className={`bg-white border border-slate-200 ${accentBorderTop} rounded-xl p-5 flex flex-col justify-between gap-4`}
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${accentText}`}>
              {isLeft ? 'Left Pane · Candidate A' : 'Right Pane · Candidate B'}
            </span>
            <span className="text-xs text-slate-500">
              Stage: <strong className="text-slate-800">{getCandidateStage(cand)}</strong>
            </span>
          </div>

          {/* Candidate Dropdown Selector */}
          <div>
            <label htmlFor={`compare-select-${paneSide}`} className="sr-only">
              {isLeft ? 'Select Candidate A' : 'Select Candidate B'}
            </label>
            <select
              id={`compare-select-${paneSide}`}
              value={cand.candidate_id}
              onChange={(e) => onSelectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#6743ee] cursor-pointer"
            >
              {candidates.map((item) => (
                <option key={item.candidate_id} value={item.candidate_id}>
                  {item.name} — {item.overall_score}% ({getCandidateStage(item)})
                  {item.candidate_id === otherCand.candidate_id ? ' [Swap Pane]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Candidate Identity & Score Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-slate-500 truncate">
                {cand.email}
                {cand.phone ? ` · ${cand.phone}` : ''}
              </div>
              {persona && (
                <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 ${accentText}`} />
                  <span className="truncate">{persona.archetype}</span>
                </div>
              )}
              <div>
                <span
                  className={`text-xs font-medium ${
                    cand.decision_status.includes('Not proceeding')
                      ? 'text-rose-700'
                      : cand.decision_status.includes('Advanced') ||
                        cand.decision_status.includes('Hired')
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {cand.decision_status}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={`text-2xl font-bold tabular-nums leading-none ${accentText}`}>
                {cand.overall_score}%
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums mt-1">
                {weightedTotal} weighted pts
              </div>
              <div className="text-[11px] font-medium mt-0.5 tabular-nums">
                {paneDelta > 0 ? (
                  <span className="text-emerald-700">+{paneDelta}% ahead</span>
                ) : paneDelta < 0 ? (
                  <span className="text-slate-500">{paneDelta}% behind</span>
                ) : (
                  <span className="text-slate-500">Tied overall</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pane Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          {onInspectCandidate && (
            <button
              type="button"
              onClick={() => onInspectCandidate(cand.candidate_id)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              <span>View Details</span>
            </button>
          )}
          {onOpenPersona && (
            <button
              type="button"
              onClick={() => onOpenPersona(cand)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#6743ee]" />
              <span>Persona</span>
            </button>
          )}
          {onOpenScheduler && (
            <button
              type="button"
              onClick={() => onOpenScheduler(cand)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3 h-3" />
              <span>Schedule</span>
            </button>
          )}
          {onAdvanceCandidate &&
            !cand.decision_status.includes('Advanced') &&
            !cand.decision_status.includes('Hired') && (
              <button
                type="button"
                onClick={() => onAdvanceCandidate(cand.candidate_id)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold cursor-pointer ml-auto"
              >
                Advance
              </button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div id="split-pane-comparison-view" className="p-5 space-y-5 bg-slate-50/50">
      {/* Top Split-Pane Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#6743ee]" />
            <span>Split-Pane 6-Dimension Rubric Comparison</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {brief?.evaluation_rubric?.scoring_scale ||
              'Select two candidates side-by-side to compare weighted scores and evidence across all 6 rubric dimensions.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwapCandidates}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Swap left and right candidates"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
            <span>Swap Panes</span>
          </button>

          <button
            type="button"
            onClick={handleSelectTopTwo}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-[#6743ee]" />
            <span>Top 2 Scorers</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRadarChart((prev) => !prev)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              showRadarChart
                ? 'bg-[#6743ee] text-white border-[#6743ee]'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <RadarIcon className="w-3.5 h-3.5" />
            <span>{showRadarChart ? 'Hide Radar Overlay' : 'Radar Overlay'}</span>
          </button>

          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-slate-500" />
              <span>List View</span>
            </button>
          )}
        </div>
      </div>

      {/* Head-to-Head Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-900">
            {candidateA.name}{' '}
            <span className="text-[#6743ee] tabular-nums">({candidateA.overall_score}%)</span>
            <span className="text-slate-400 mx-2 font-normal">vs</span>
            {candidateB.name}{' '}
            <span className="text-teal-700 tabular-nums">({candidateB.overall_score}%)</span>
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-600 tabular-nums">
            6 Rubric Dimensions led:{' '}
            <strong className="text-[#6743ee]">{candidateA.name.split(' ')[0]} ({winsA})</strong> ·{' '}
            <strong className="text-teal-700">{candidateB.name.split(' ')[0]} ({winsB})</strong>
            {tiesCount > 0 ? ` · Tied (${tiesCount})` : ''}
          </span>
        </div>

        <div className="text-xs font-medium text-slate-700">
          {overallDelta > 0 ? (
            <span>
              Rubric Leader: <strong className="text-[#6743ee]">{candidateA.name}</strong> (+
              {overallDelta}% overall)
            </span>
          ) : overallDelta < 0 ? (
            <span>
              Rubric Leader: <strong className="text-teal-700">{candidateB.name}</strong> (+
              {Math.abs(overallDelta)}% overall)
            </span>
          ) : (
            <span>Equal overall rubric match score ({candidateA.overall_score}%)</span>
          )}
        </div>
      </div>

      {/* Side-by-Side Candidate Selector & Summary Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {renderPaneHeaderCard('A', candidateA, candidateB, personaA, weightedTotalA, handleChangeA)}
        {renderPaneHeaderCard('B', candidateB, candidateA, personaB, weightedTotalB, handleChangeB)}
      </div>

      {/* Optional 6-Dimension Dual Radar Chart Overlay */}
      {showRadarChart && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              6-Dimension Rubric Radar Overlay
            </h4>
            <span className="text-xs text-slate-500 tabular-nums">
              Target cutoff benchmark: {cutoffScore}%
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  stroke="#e2e8f0"
                />
                <Radar
                  name={`Cutoff (${cutoffScore}%)`}
                  dataKey="Benchmark"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fill="#94a3b8"
                  fillOpacity={0.06}
                />
                <Radar
                  name={candidateA.name}
                  dataKey={candidateA.name}
                  stroke="#6743ee"
                  strokeWidth={2.5}
                  fill="#6743ee"
                  fillOpacity={0.22}
                />
                <Radar
                  name={candidateB.name}
                  dataKey={candidateB.name}
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fill="#0d9488"
                  fillOpacity={0.2}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Synchronized Side-by-Side 6 Rubric Dimensions Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Side-by-Side 6-Dimension Rubric Breakdown
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Direct comparison of unweighted dimension scores (0–100%), rubric weight contributions, and evaluation evidence
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums">
            <span className="font-semibold text-[#6743ee]">
              {candidateA.name}: {weightedTotalA} / 100 pts
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-teal-700">
              {candidateB.name}: {weightedTotalB} / 100 pts
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {dimensionComparisons.map((dim, idx) => {
            const absDiff = Math.abs(dim.diff);
            const leadsA = dim.leader === 'A';
            const leadsB = dim.leader === 'B';

            return (
              <div key={dim.key} className="p-4 sm:p-5 space-y-3">
                {/* Shared Dimension Title & Weight Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      0{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{dim.label}</span>
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                      ({dim.weightPercent}% rubric weight)
                    </span>
                    <span className="text-slate-300 hidden sm:inline">·</span>
                    <span className="text-xs text-slate-600">{dim.criterion}</span>
                  </div>

                  <div className="text-xs font-semibold tabular-nums shrink-0">
                    {leadsA ? (
                      <span className="text-[#6743ee]">
                        {candidateA.name.split(' ')[0]} +{absDiff}%
                      </span>
                    ) : leadsB ? (
                      <span className="text-teal-700">
                        {candidateB.name.split(' ')[0]} +{absDiff}%
                      </span>
                    ) : (
                      <span className="text-slate-500">Tied ({dim.scoreA}%)</span>
                    )}
                  </div>
                </div>

                {/* Synchronized Left Pane vs Right Pane Score & Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Candidate A Dimension Card */}
                  <div
                    className={`p-3.5 rounded-lg border transition-colors ${
                      leadsA
                        ? 'bg-purple-50/40 border-[#6743ee]/40'
                        : 'bg-slate-50/60 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {candidateA.name}
                      </span>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            leadsA ? 'text-[#6743ee]' : 'text-slate-900'
                          }`}
                        >
                          {dim.scoreA}%
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          (+{dim.weightedA} / {dim.weightPercent} pts)
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full h-2 bg-slate-200/80 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          leadsA ? 'bg-[#6743ee]' : 'bg-slate-400'
                        }`}
                        style={{ width: `${dim.scoreA}%` }}
                      />
                      <div
                        title={`Cutoff (${cutoffScore}%)`}
                        style={{ left: `${cutoffScore}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-700/50"
                      />
                    </div>

                    {dim.evidenceA && (
                      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                        {dim.evidenceA}
                      </p>
                    )}
                  </div>

                  {/* Candidate B Dimension Card */}
                  <div
                    className={`p-3.5 rounded-lg border transition-colors ${
                      leadsB
                        ? 'bg-teal-50/40 border-teal-600/40'
                        : 'bg-slate-50/60 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {candidateB.name}
                      </span>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            leadsB ? 'text-teal-700' : 'text-slate-900'
                          }`}
                        >
                          {dim.scoreB}%
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          (+{dim.weightedB} / {dim.weightPercent} pts)
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full h-2 bg-slate-200/80 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          leadsB ? 'bg-teal-600' : 'bg-slate-400'
                        }`}
                        style={{ width: `${dim.scoreB}%` }}
                      />
                      <div
                        title={`Cutoff (${cutoffScore}%)`}
                        style={{ left: `${cutoffScore}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-700/50"
                      />
                    </div>

                    {dim.evidenceB && (
                      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                        {dim.evidenceB}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Synchronized Side-by-Side Strengths, Skill Gaps & Persona Fit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {[
          { side: 'A', cand: candidateA, persona: personaA, accent: 'text-[#6743ee]' },
          { side: 'B', cand: candidateB, persona: personaB, accent: 'text-teal-700' },
        ].map(({ side, cand, persona, accent }) => (
          <div
            key={side}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-900">
                {cand.name} — Strengths & Role Fit
              </span>
              {persona && (
                <span className={`font-medium ${accent}`}>{persona.archetype}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Verified Strengths</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                {cand.strengths.slice(0, 4).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Skill Gaps vs Brief</span>
              </div>
              {cand.missing_skills.length > 0 ? (
                <p className="text-slate-600">{cand.missing_skills.join(', ')}</p>
              ) : (
                <p className="text-emerald-700">All required role competencies evidenced.</p>
              )}
            </div>

            {persona && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <div className="font-semibold text-slate-800">
                  Persona Fit & Core Superpower
                </div>
                <p className="text-slate-700 font-medium">{persona.tagline}</p>
                <p className="text-slate-600 leading-relaxed">{persona.superpower}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
