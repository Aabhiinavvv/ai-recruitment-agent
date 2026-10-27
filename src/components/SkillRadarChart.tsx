import React, { useState } from 'react';
import { BarChart3, Radar as RadarIcon } from 'lucide-react';

interface SkillRadarChartProps {
  skillScores?: Record<string, number>;
  overallScore?: number;
  selected?: boolean;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  skillScores,
  overallScore,
  selected,
}) => {
  const [viewMode, setViewMode] = useState<'radar' | 'bars'>('radar');

  // Default demo skills if empty
  const defaultSkills: Record<string, number> = {
    Python: 9,
    "Machine Learning": 8,
    "Data Engineering": 6,
    NLP: 7,
    DevOps: 5,
    "System Design": 7,
  };

  const activeSkills = skillScores && Object.keys(skillScores).length > 0 ? skillScores : defaultSkills;
  const labels = Object.keys(activeSkills);
  const values = Object.values(activeSkills);

  const scoreDisplay = overallScore !== undefined ? `${overallScore}%` : "Awaiting analysis";
  const scoreStatus = selected === true ? "Selected" : selected === false ? "Not selected" : "Advisory review";

  // Radar geometry
  const size = 300;
  const center = size / 2;
  const radius = center - 45;
  const total = labels.length;

  const points = labels.map((_, i) => {
    const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
    const value = Math.min(10, Math.max(0, values[i]));
    const r = (value / 10) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Candidate Insights & Skill Snapshot</h3>
          <p className="text-xs text-slate-500">Interactive multi-skill radar & competency visualization</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Score</span>
            <span className="text-xl font-extrabold text-[#6743ee] leading-none">{scoreDisplay}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{scoreStatus}</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('radar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'radar'
                  ? 'bg-white text-[#6743ee] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RadarIcon className="w-3.5 h-3.5" />
              Radar
            </button>
            <button
              onClick={() => setViewMode('bars')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'bars'
                  ? 'bg-white text-[#6743ee] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Bars
            </button>
          </div>
        </div>
      </div>

      <div className="py-4 flex justify-center">
        {viewMode === 'radar' ? (
          <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
              {/* Background web concentric polygons */}
              {[0.25, 0.5, 0.75, 1.0].map((level, lvlIdx) => {
                const poly = labels.map((_, i) => {
                  const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
                  const r = radius * level;
                  return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                }).join(' ');
                return (
                  <polygon
                    key={lvlIdx}
                    points={poly}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={lvlIdx < 3 ? "3 3" : undefined}
                  />
                );
              })}

              {/* Axis spokes */}
              {labels.map((_, i) => {
                const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
                const x2 = center + radius * Math.cos(angle);
                const y2 = center + radius * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={x2}
                    y2={y2}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Active filled polygon */}
              <polygon
                points={polygonPoints}
                fill="rgba(103, 67, 238, 0.2)"
                stroke="#6743ee"
                strokeWidth="2.5"
                className="transition-all duration-500 ease-out"
              />

              {/* Data points & labels */}
              {points.map((p, i) => {
                // Label positioning slightly outside radius
                const labelAngle = p.angle;
                const labelRadius = radius + 24;
                const lx = center + labelRadius * Math.cos(labelAngle);
                const ly = center + labelRadius * Math.sin(labelAngle);

                return (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4.5"
                      fill="#6743ee"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[10px] fill-slate-700 font-medium"
                    >
                      {labels[i]} ({values[i]}/10)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-3">
            {labels.map((skill, index) => {
              const val = values[index];
              const pct = (val / 10) * 100;
              const isHigh = val >= 8;

              return (
                <div key={skill} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{skill}</span>
                    <span className="font-semibold text-slate-900">{val} / 10</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHigh ? 'bg-emerald-500' : 'bg-[#6743ee]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
