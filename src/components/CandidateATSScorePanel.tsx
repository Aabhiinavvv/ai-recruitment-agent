import React from 'react';
import { Candidate, HiringBrief } from '../types';
import { getAtsBadgeColors, getCandidateATSScore } from '../services/atsScoringEngine';
import { CheckCircle2, AlertTriangle, FileCheck2, Sparkles } from 'lucide-react';

interface CandidateATSScorePanelProps {
  candidate: Candidate;
  brief: HiringBrief | null;
}

export const CandidateATSScorePanel: React.FC<CandidateATSScorePanelProps> = ({
  candidate,
  brief,
}) => {
  const ats = getCandidateATSScore(candidate, brief);
  const colors = getAtsBadgeColors(ats.overall_ats_score);

  const subMetrics = [
    { label: 'Keyword Match', weight: '40%', score: ats.keyword_match_score },
    { label: 'Section Completeness', weight: '20%', score: ats.section_completeness_score },
    { label: 'Contact Parseability', weight: '15%', score: ats.contact_info_score },
    { label: 'Quantified Impact', weight: '15%', score: ats.quantified_impact_score },
    { label: 'ATS Formatting', weight: '10%', score: ats.formatting_score },
  ];

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <FileCheck2 className="w-4 h-4 text-[#6743ee]" />
            <h4 className="font-semibold text-slate-900">Resume ATS Score &amp; Parseability</h4>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors.badge}`}>
              {ats.tier}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Measures keyword alignment, standard resume sections, contact parseability, quantified outcomes, and ATS formatting
            {candidate.source_file_name ? ` for ${candidate.source_file_name}` : ''}.
          </p>
        </div>

        <div className={`px-3.5 py-2 rounded-xl border text-right shrink-0 ${colors.badge}`}>
          <div className="text-xl font-bold tabular-nums leading-none">
            {ats.overall_ats_score}%
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide mt-1">
            ATS Score
          </div>
        </div>
      </div>

      {/* 5 ATS Dimension Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {subMetrics.map((m) => {
          const mColors = getAtsBadgeColors(m.score);
          return (
            <div key={m.label} className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-medium text-slate-700 truncate" title={m.label}>
                  {m.label}
                </span>
                <span className={`font-bold tabular-nums ${mColors.text}`}>
                  {m.score}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${mColors.bar}`}
                  style={{ width: `${m.score}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400">Weight: {m.weight}</div>
            </div>
          );
        })}
      </div>

      {/* Keyword Coverage & Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-700">
            ATS Keyword Match ({ats.matched_keywords.length} matched
            {ats.missing_keywords.length > 0 ? `, ${ats.missing_keywords.length} missing` : ''})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ats.matched_keywords.map((kw) => (
              <span
                key={`m-${kw}`}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                ✓ {kw}
              </span>
            ))}
            {ats.missing_keywords.map((kw) => (
              <span
                key={`x-${kw}`}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"
              >
                Missing: {kw}
              </span>
            ))}
            {ats.matched_keywords.length === 0 && ats.missing_keywords.length === 0 && (
              <span className="text-[11px] text-slate-500">No role keyword targets configured yet.</span>
            )}
          </div>
          {ats.detected_sections.length > 0 && (
            <div className="text-[11px] text-slate-500 pt-1">
              <strong className="text-slate-700">Detected Sections:</strong>{' '}
              {ats.detected_sections.join(' · ')}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#6743ee]" />
            <span>ATS Diagnostics</span>
          </div>
          <ul className="space-y-1 text-[11px]">
            {ats.passed_checks.map((chk, idx) => (
              <li key={`p-${idx}`} className="flex items-start gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{chk}</span>
              </li>
            ))}
            {ats.warnings.map((warn, idx) => (
              <li key={`w-${idx}`} className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
