import React, { useState } from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { DimensionScores } from '../types';
import { Sparkles, CheckCircle2, Sliders, Info } from 'lucide-react';

interface CandidateDimensionRadarProps {
  scores: DimensionScores;
  candidateName?: string;
  evidence?: Record<string, string>;
  cutoffScore?: number;
}

const DIMENSION_CONFIG = [
  { key: 'technical', label: 'Technical', fullName: 'Technical Competency', weight: '30%', weightVal: 0.30, benchmark: 75 },
  { key: 'experience', label: 'Experience', fullName: 'Relevant Experience', weight: '20%', weightVal: 0.20, benchmark: 70 },
  { key: 'education', label: 'Education', fullName: 'Education & Degree', weight: '10%', weightVal: 0.10, benchmark: 70 },
  { key: 'projects', label: 'Projects', fullName: 'Practical Projects', weight: '15%', weightVal: 0.15, benchmark: 75 },
  { key: 'domain', label: 'Domain', fullName: 'Domain Knowledge', weight: '15%', weightVal: 0.15, benchmark: 70 },
  { key: 'communication', label: 'Communication', fullName: 'Communication Clarity', weight: '10%', weightVal: 0.10, benchmark: 75 },
] as const;

export const CandidateDimensionRadar: React.FC<CandidateDimensionRadarProps> = ({
  scores,
  candidateName = 'Candidate',
  evidence = {},
  cutoffScore = 75,
}) => {
  const [showBenchmark, setShowBenchmark] = useState(true);

  // Transform scores into Recharts data
  const chartData = DIMENSION_CONFIG.map(({ key, label, weight, benchmark }) => {
    const scoreVal = scores[key as keyof DimensionScores] ?? 0;
    return {
      dimension: label,
      fullName: label,
      weight,
      candidateScore: scoreVal,
      benchmark: cutoffScore ? Math.round((benchmark / 75) * cutoffScore) : benchmark,
      fullMark: 100,
    };
  });

  // Calculate weighted overall score
  const weightedSum = DIMENSION_CONFIG.reduce((acc, { key, weightVal }) => {
    return acc + (scores[key as keyof DimensionScores] ?? 0) * weightVal;
  }, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      {/* Header with Title and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6743ee]" />
            <span>6-Dimension AI Screener Competency Radar</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            Interactive multi-axial radar comparing evaluated dimensions against role benchmark ({cutoffScore}%)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={showBenchmark}
              onChange={(e) => setShowBenchmark(e.target.checked)}
              className="accent-[#6743ee] rounded cursor-pointer"
            />
            <span>Show Target Benchmark</span>
          </label>
        </div>
      </div>

      {/* Main Content: Chart on left, Dimension Breakdown & Evidence on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Recharts Radar Chart */}
        <div className="lg:col-span-5 h-[280px] w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
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

              {/* Target Benchmark overlay */}
              {showBenchmark && (
                <Radar
                  name="Role Benchmark"
                  dataKey="benchmark"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fill="#94a3b8"
                  fillOpacity={0.08}
                />
              )}

              {/* Candidate Score */}
              <Radar
                name={`${candidateName}'s Score`}
                dataKey="candidateScore"
                stroke="#6743ee"
                strokeWidth={2.5}
                fill="#8a72ff"
                fillOpacity={0.35}
                dot={{ r: 3.5, fill: '#6743ee', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#5b43d6', stroke: '#ffffff', strokeWidth: 2 }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const dimKey = data.dimension.toLowerCase();
                    const dimEvidence = evidence[dimKey] || evidence[data.dimension] || '';

                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 max-w-xs border border-slate-700">
                        <div className="font-bold flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
                          <span className="text-[#a78bfa]">{data.dimension} Dimension</span>
                          <span className="text-[10px] text-slate-300">Weight: {data.weight}</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Candidate Score:</span>
                            <span className="font-bold text-emerald-400">{data.candidateScore}%</span>
                          </div>
                          {showBenchmark && (
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Target Benchmark:</span>
                              <span className="text-slate-300 font-medium">{data.benchmark}%</span>
                            </div>
                          )}
                        </div>
                        {dimEvidence && (
                          <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 italic">
                            "{dimEvidence}"
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Right Side: Dimension Metrics Tiles & Evidence */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
            <span>Evaluated Dimensions (Weighted Contribution)</span>
            <span className="text-[#6743ee] font-bold">Sum: {Math.round(weightedSum)}%</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {DIMENSION_CONFIG.map(({ key, label, weight, weightVal }) => {
              const score = scores[key as keyof DimensionScores] ?? 0;
              const contribution = (score * weightVal).toFixed(1);
              const isAboveBenchmark = score >= 75;

              return (
                <div
                  key={key}
                  className={`p-2.5 rounded-lg border transition-all text-xs ${
                    isAboveBenchmark 
                      ? 'bg-purple-50/50 border-purple-200' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 capitalize">{label}</span>
                    <span className="text-[10px] font-bold text-slate-400">{weight}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-black text-[#6743ee]">{score}%</span>
                    <span className="text-[10px] font-medium text-slate-500">+{contribution} pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-1.5">
                    <div 
                      className={`h-full rounded-full ${
                        isAboveBenchmark ? 'bg-[#6743ee]' : 'bg-slate-400'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Evidence Insight */}
          {Object.keys(evidence).length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                <Info className="w-3.5 h-3.5 text-[#6743ee]" />
                Key Dimension Evidence Extracted by Screener:
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-2">
                {evidence.technical || evidence.experience || Object.values(evidence)[0]}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
