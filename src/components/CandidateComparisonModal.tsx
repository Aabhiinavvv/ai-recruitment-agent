import React, { useState, useEffect } from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from 'recharts';
import { Candidate, DimensionScores } from '../types';
import { 
  X, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Layers, 
  Scale, 
  Sliders, 
  ChevronRight,
  Shield,
  Zap,
  Target
} from 'lucide-react';

interface CandidateComparisonModalProps {
  candidateA: Candidate;
  candidateB: Candidate;
  allCandidates: Candidate[];
  onSelectCandidateA: (candidate: Candidate) => void;
  onSelectCandidateB: (candidate: Candidate) => void;
  onClose: () => void;
  cutoffScore?: number;
}

export const DIMENSION_CONFIG = [
  { key: 'technical', label: 'Technical', fullName: 'Technical Competency', weight: '30%', weightVal: 0.30, benchmark: 75 },
  { key: 'experience', label: 'Experience', fullName: 'Relevant Experience', weight: '20%', weightVal: 0.20, benchmark: 70 },
  { key: 'education', label: 'Education', fullName: 'Education & Degree', weight: '10%', weightVal: 0.10, benchmark: 70 },
  { key: 'projects', label: 'Projects', fullName: 'Practical Projects', weight: '15%', weightVal: 0.15, benchmark: 75 },
  { key: 'domain', label: 'Domain', fullName: 'Domain Knowledge', weight: '15%', weightVal: 0.15, benchmark: 70 },
  { key: 'communication', label: 'Communication', fullName: 'Communication Clarity', weight: '10%', weightVal: 0.10, benchmark: 75 },
] as const;

export const CandidateComparisonModal: React.FC<CandidateComparisonModalProps> = ({
  candidateA,
  candidateB,
  allCandidates,
  onSelectCandidateA,
  onSelectCandidateB,
  onClose,
  cutoffScore = 75,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [showBenchmark, setShowBenchmark] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Prepare chart data for Candidate A
  const dataA = DIMENSION_CONFIG.map(({ key, label, benchmark }) => {
    const scoreVal = candidateA.dimension_scores[key as keyof DimensionScores] ?? 0;
    return {
      dimension: label,
      fullName: label,
      score: scoreVal,
      benchmark: cutoffScore ? Math.round((benchmark / 75) * cutoffScore) : benchmark,
      fullMark: 100,
    };
  });

  // Prepare chart data for Candidate B
  const dataB = DIMENSION_CONFIG.map(({ key, label, benchmark }) => {
    const scoreVal = candidateB.dimension_scores[key as keyof DimensionScores] ?? 0;
    return {
      dimension: label,
      fullName: label,
      score: scoreVal,
      benchmark: cutoffScore ? Math.round((benchmark / 75) * cutoffScore) : benchmark,
      fullMark: 100,
    };
  });

  // Prepare combined overlay data
  const combinedOverlayData = DIMENSION_CONFIG.map(({ key, label, benchmark }) => {
    const scoreA = candidateA.dimension_scores[key as keyof DimensionScores] ?? 0;
    const scoreB = candidateB.dimension_scores[key as keyof DimensionScores] ?? 0;
    return {
      dimension: label,
      fullName: label,
      [candidateA.name]: scoreA,
      [candidateB.name]: scoreB,
      benchmark: cutoffScore ? Math.round((benchmark / 75) * cutoffScore) : benchmark,
      fullMark: 100,
    };
  });

  // Dimension score deltas & leader calculations
  const dimensionAnalysis = DIMENSION_CONFIG.map(({ key, label, fullName, weight }) => {
    const scoreA = candidateA.dimension_scores[key as keyof DimensionScores] ?? 0;
    const scoreB = candidateB.dimension_scores[key as keyof DimensionScores] ?? 0;
    const delta = scoreA - scoreB;
    const leader = delta > 0 ? 'A' : delta < 0 ? 'B' : 'tie';
    const absDelta = Math.abs(delta);
    const evidenceA = candidateA.dimension_evidence?.[key] || 'Evaluated from resume & credentials.';
    const evidenceB = candidateB.dimension_evidence?.[key] || 'Evaluated from resume & credentials.';

    return {
      key,
      label,
      fullName,
      weight,
      scoreA,
      scoreB,
      delta,
      leader,
      absDelta,
      evidenceA,
      evidenceB,
    };
  });

  // Count dimension leaders
  const aWins = dimensionAnalysis.filter(d => d.leader === 'A').length;
  const bWins = dimensionAnalysis.filter(d => d.leader === 'B').length;
  const ties = dimensionAnalysis.filter(d => d.leader === 'tie').length;

  // Union of all skill scores across both candidates
  const allSkills = Array.from(new Set([
    ...Object.keys(candidateA.skill_scores || {}),
    ...Object.keys(candidateB.skill_scores || {}),
  ])).sort();

  const handleSwapCandidates = () => {
    const prevA = candidateA;
    onSelectCandidateA(candidateB);
    onSelectCandidateB(prevA);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6743ee] shrink-0 shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">Candidate Head-to-Head Comparison</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] font-bold">
                  Side-by-Side Radar
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Compare multi-axial competency radars, dimension deltas, and demonstrated strengths.
              </p>
            </div>
          </div>

          {/* Quick Controls: View Mode & Close */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'side-by-side'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side-by-Side Radars
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overlay')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'overlay'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overlaid Polygon
              </button>
            </div>

            <label className="hidden sm:flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showBenchmark}
                onChange={(e) => setShowBenchmark(e.target.checked)}
                className="accent-[#6743ee] rounded cursor-pointer"
              />
              <span>Role Benchmark</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              title="Close comparison modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Candidate Selector Bar */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
          {/* Candidate A Selector */}
          <div className="md:col-span-5 flex items-center gap-3 p-2.5 rounded-xl bg-purple-50/60 border border-purple-200">
            <div className="w-9 h-9 rounded-lg bg-[#6743ee] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
              {candidateA.overall_score}%
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#5b43d6] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#6743ee]" />
                  Candidate A
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{candidateA.candidate_id}</span>
              </div>
              <select
                value={candidateA.candidate_id}
                onChange={(e) => {
                  const target = allCandidates.find(c => c.candidate_id === e.target.value);
                  if (target) onSelectCandidateA(target);
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-purple-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-[#6743ee] truncate"
              >
                {allCandidates.map(c => (
                  <option key={c.candidate_id} value={c.candidate_id} disabled={c.candidate_id === candidateB.candidate_id}>
                    {c.name} — {c.overall_score}% (Tech: {c.dimension_scores.technical}%) {c.candidate_id === candidateB.candidate_id ? '(Selected as B)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VS / Swap button */}
          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwapCandidates}
              className="p-2 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#6743ee] border border-slate-200 transition-all shadow-2xs"
              title="Swap Candidate A and Candidate B"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Candidate B Selector */}
          <div className="md:col-span-5 flex items-center gap-3 p-2.5 rounded-xl bg-teal-50/60 border border-teal-200">
            <div className="w-9 h-9 rounded-lg bg-[#0d9488] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
              {candidateB.overall_score}%
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-teal-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#0d9488]" />
                  Candidate B
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{candidateB.candidate_id}</span>
              </div>
              <select
                value={candidateB.candidate_id}
                onChange={(e) => {
                  const target = allCandidates.find(c => c.candidate_id === e.target.value);
                  if (target) onSelectCandidateB(target);
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-teal-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-[#0d9488] truncate"
              >
                {allCandidates.map(c => (
                  <option key={c.candidate_id} value={c.candidate_id} disabled={c.candidate_id === candidateA.candidate_id}>
                    {c.name} — {c.overall_score}% (Tech: {c.dimension_scores.technical}%) {c.candidate_id === candidateA.candidate_id ? '(Selected as A)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Comparison Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Executive Advantage Summary Banner */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50/90 via-slate-50 to-teal-50/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#6743ee] shrink-0" />
              <div>
                <span className="font-bold text-slate-900">Dimension Score Matchup: </span>
                <span className="font-semibold text-[#5b43d6]">{candidateA.name} leads in {aWins}</span>
                <span className="text-slate-400 mx-1">·</span>
                <span className="font-semibold text-teal-800">{candidateB.name} leads in {bWins}</span>
                {ties > 0 && (
                  <>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-600">{ties} tied</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-[11px]">
              <span className="text-slate-500">
                Overall Delta: <strong className={candidateA.overall_score >= candidateB.overall_score ? 'text-[#6743ee]' : 'text-teal-700'}>
                  {candidateA.overall_score > candidateB.overall_score ? `+${candidateA.overall_score - candidateB.overall_score}% (${candidateA.name})` : candidateB.overall_score > candidateA.overall_score ? `+${candidateB.overall_score - candidateA.overall_score}% (${candidateB.name})` : 'Equal'}
                </strong>
              </span>
            </div>
          </div>

          {/* Section 1: Radar Charts Display */}
          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Candidate A Radar Chart Card */}
              <div className="bg-slate-50/50 rounded-xl border border-purple-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#6743ee]" />
                    <h4 className="font-bold text-slate-900 text-sm">{candidateA.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">({candidateA.candidate_id})</span>
                  </div>
                  <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6]">
                    Overall: {candidateA.overall_score}%
                  </div>
                </div>

                <div className="h-[280px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={dataA}>
                      <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <PolarAngleAxis 
                        dataKey="dimension" 
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                        stroke="#e2e8f0"
                      />
                      {showBenchmark && (
                        <Radar
                          name="Role Benchmark"
                          dataKey="benchmark"
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          fill="#94a3b8"
                          fillOpacity={0.06}
                        />
                      )}
                      <Radar
                        name={candidateA.name}
                        dataKey="score"
                        stroke="#6743ee"
                        strokeWidth={2.5}
                        fill="#8a72ff"
                        fillOpacity={0.35}
                      />
                      <Tooltip 
                        formatter={(val: any) => [`${val}%`, 'Score']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Score breakdown chips */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  {DIMENSION_CONFIG.map(({ key, label }) => (
                    <div key={key} className="p-1.5 bg-white rounded-lg border border-purple-100 text-[11px]">
                      <div className="text-slate-500 text-[10px] truncate">{label}</div>
                      <div className="font-bold text-purple-900 mt-0.5">
                        {candidateA.dimension_scores[key as keyof DimensionScores] ?? 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Candidate B Radar Chart Card */}
              <div className="bg-slate-50/50 rounded-xl border border-teal-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#0d9488]" />
                    <h4 className="font-bold text-slate-900 text-sm">{candidateB.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">({candidateB.candidate_id})</span>
                  </div>
                  <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    Overall: {candidateB.overall_score}%
                  </div>
                </div>

                <div className="h-[280px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={dataB}>
                      <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <PolarAngleAxis 
                        dataKey="dimension" 
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                        stroke="#e2e8f0"
                      />
                      {showBenchmark && (
                        <Radar
                          name="Role Benchmark"
                          dataKey="benchmark"
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          fill="#94a3b8"
                          fillOpacity={0.06}
                        />
                      )}
                      <Radar
                        name={candidateB.name}
                        dataKey="score"
                        stroke="#0d9488"
                        strokeWidth={2.5}
                        fill="#2dd4bf"
                        fillOpacity={0.35}
                      />
                      <Tooltip 
                        formatter={(val: any) => [`${val}%`, 'Score']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Score breakdown chips */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  {DIMENSION_CONFIG.map(({ key, label }) => (
                    <div key={key} className="p-1.5 bg-white rounded-lg border border-teal-100 text-[11px]">
                      <div className="text-slate-500 text-[10px] truncate">{label}</div>
                      <div className="font-bold text-teal-900 mt-0.5">
                        {candidateB.dimension_scores[key as keyof DimensionScores] ?? 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Overlaid Polygon Radar View */
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Overlaid 6-Dimension Competency Radar</h4>
                  <p className="text-xs text-slate-500">
                    Direct polygon overlay comparing {candidateA.name} (Indigo) vs {candidateB.name} (Teal)
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-[#5b43d6]">
                    <span className="w-3 h-3 rounded-full bg-[#6743ee]" />
                    {candidateA.name} ({candidateA.overall_score}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-teal-800">
                    <span className="w-3 h-3 rounded-full bg-[#0d9488]" />
                    {candidateB.name} ({candidateB.overall_score}%)
                  </span>
                </div>
              </div>

              <div className="h-[340px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={combinedOverlayData}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis 
                      dataKey="dimension" 
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      stroke="#e2e8f0"
                    />
                    {showBenchmark && (
                      <Radar
                        name="Role Benchmark"
                        dataKey="benchmark"
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        fill="#94a3b8"
                        fillOpacity={0.05}
                      />
                    )}
                    <Radar
                      name={candidateA.name}
                      dataKey={candidateA.name}
                      stroke="#6743ee"
                      strokeWidth={2.5}
                      fill="#8a72ff"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name={candidateB.name}
                      dataKey={candidateB.name}
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="#2dd4bf"
                      fillOpacity={0.25}
                    />
                    <Tooltip 
                      formatter={(val: any, name: any) => [`${val}%`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Section 2: Side-by-Side Dimension Differences & Evidence */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#6743ee]" />
                <h4 className="font-bold text-slate-900 text-sm">6-Dimension Differential Breakdown</h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Evaluates strengths and delta across all rubric dimensions
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {dimensionAnalysis.map((dim) => {
                const aIsAhead = dim.leader === 'A';
                const bIsAhead = dim.leader === 'B';

                return (
                  <div key={dim.key} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{dim.fullName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          Weight: {dim.weight}
                        </span>
                      </div>

                      {/* Advantage Chip */}
                      <div>
                        {aIsAhead ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#5b43d6] border border-purple-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6743ee]" />
                            {candidateA.name} leads by +{dim.absDelta}%
                          </span>
                        ) : bIsAhead ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
                            {candidateB.name} leads by +{dim.absDelta}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            Tied at {dim.scoreA}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comparative Visual Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                      {/* Candidate A Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-medium text-slate-600">{candidateA.name}</span>
                          <span className="font-bold text-[#5b43d6]">{dim.scoreA}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#6743ee] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, dim.scoreA))}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-1">
                          "{dim.evidenceA}"
                        </p>
                      </div>

                      {/* Candidate B Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-medium text-slate-600">{candidateB.name}</span>
                          <span className="font-bold text-teal-800">{dim.scoreB}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#0d9488] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, dim.scoreB))}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-1">
                          "{dim.evidenceB}"
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Demonstrated Strengths & Missing Skills Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Candidate A Strengths & Gaps */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                <span className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6743ee]" />
                  {candidateA.name}'s Profile Highlights
                </span>
                <span className="text-[11px] font-bold text-[#5b43d6]">{candidateA.overall_score}%</span>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Key Strengths
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {candidateA.strengths && candidateA.strengths.length > 0 ? (
                    candidateA.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No specific strengths listed.</li>
                  )}
                </ul>
              </div>

              {/* Missing skills */}
              <div className="space-y-2 pt-2 border-t border-purple-100">
                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Missing Skills / Development Areas
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {candidateA.missing_skills && candidateA.missing_skills.length > 0 ? (
                    candidateA.missing_skills.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No major skill gaps identified.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Candidate B Strengths & Gaps */}
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/30 space-y-4">
              <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                <span className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" />
                  {candidateB.name}'s Profile Highlights
                </span>
                <span className="text-[11px] font-bold text-teal-800">{candidateB.overall_score}%</span>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Key Strengths
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {candidateB.strengths && candidateB.strengths.length > 0 ? (
                    candidateB.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No specific strengths listed.</li>
                  )}
                </ul>
              </div>

              {/* Missing skills */}
              <div className="space-y-2 pt-2 border-t border-teal-100">
                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Missing Skills / Development Areas
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {candidateB.missing_skills && candidateB.missing_skills.length > 0 ? (
                    candidateB.missing_skills.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No major skill gaps identified.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Verified Skills Matchup Grid */}
          {allSkills.length > 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#6743ee]" />
                  Direct Skill Score Matchup (1–10 Scale)
                </span>
                <span className="text-[11px] text-slate-500">{allSkills.length} evaluated skills</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {allSkills.map(skill => {
                  const sA = candidateA.skill_scores?.[skill];
                  const sB = candidateB.skill_scores?.[skill];
                  const diff = (sA ?? 0) - (sB ?? 0);

                  return (
                    <div key={skill} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span className="truncate">{skill}</span>
                        {diff !== 0 && (
                          <span className={`text-[10px] font-bold px-1 rounded ${
                            diff > 0 ? 'bg-purple-100 text-[#5b43d6]' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {diff > 0 ? `+${diff} A` : `+${Math.abs(diff)} B`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-purple-700 font-medium">
                          {candidateA.name.split(' ')[0]}: <strong className="font-bold">{sA !== undefined ? `${sA}/10` : '—'}</strong>
                        </span>
                        <span className="text-teal-700 font-medium">
                          {candidateB.name.split(' ')[0]}: <strong className="font-bold">{sB !== undefined ? `${sB}/10` : '—'}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>AI Multi-axial Analysis grounded in candidate resume & digital footprint. Recruiter oversees final hiring decision.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSwapCandidates}
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 font-semibold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Swap Sides</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white font-bold rounded-lg transition-colors shadow-2xs"
            >
              Done Comparing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
