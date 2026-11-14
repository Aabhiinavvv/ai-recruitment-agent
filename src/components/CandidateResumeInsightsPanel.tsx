import React from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Compass,
  HelpCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { Candidate } from '../types';

interface CandidateResumeInsightsPanelProps {
  candidate: Candidate;
  isAnalyzing: boolean;
  errorMessage?: string | null;
  onAnalyze: (forceRefresh?: boolean) => void;
}

export const CandidateResumeInsightsPanel: React.FC<CandidateResumeInsightsPanelProps> = ({
  candidate,
  isAnalyzing,
  errorMessage,
  onAnalyze,
}) => {
  const insights = candidate.ai_insights;

  const getSignalStyles = (signal: 'positive' | 'neutral' | 'watch') => {
    if (signal === 'positive') {
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        label: 'Strong Signal',
        border: 'border-emerald-200/80 bg-emerald-50/25',
      };
    }
    if (signal === 'watch') {
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'Probe Area',
        border: 'border-amber-200/80 bg-amber-50/25',
      };
    }
    return {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      label: 'Pattern',
      border: 'border-slate-200 bg-white',
    };
  };

  return (
    <div className="space-y-4">
      {/* Brief Summary Card */}
      <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              <Sparkles className="w-4 h-4 text-[#6743ee]" />
              <span>AI Brief Summary &amp; Resume Insights</span>
            </span>
            {candidate.source_file_name && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {candidate.source_file_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(candidate.experience_years || candidate.education_summary) && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 mr-1">
                {candidate.experience_years && (
                  <span className="font-medium text-slate-700">
                    {candidate.experience_years}
                  </span>
                )}
                {candidate.experience_years && candidate.education_summary && (
                  <span>·</span>
                )}
                {candidate.education_summary && (
                  <span className="font-medium text-slate-700 truncate max-w-[200px]">
                    {candidate.education_summary}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => onAnalyze(true)}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-[#6743ee] hover:text-[#6743ee] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3 h-3 ${isAnalyzing ? 'animate-spin text-[#6743ee]' : ''}`}
              />
              <span>
                {isAnalyzing
                  ? 'Analyzing Resume...'
                  : insights?.engine === 'local-pattern-engine'
                    ? 'Run Gemini AI Analysis'
                    : insights
                      ? 'Refresh AI Insights'
                      : 'Analyze with AI'}
              </span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between gap-2">
            <span>
              {errorMessage}{' '}
              {insights?.engine === 'local-pattern-engine' &&
                'Showing structured baseline pattern insights below.'}
            </span>
            <button
              type="button"
              onClick={() => onAnalyze(true)}
              className="font-semibold text-amber-800 hover:underline shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {isAnalyzing && !insights ? (
          <div className="p-3 bg-white border border-indigo-100 rounded-lg space-y-2 animate-pulse">
            <div className="h-3.5 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
          </div>
        ) : insights ? (
          <div className="space-y-3">
            {/* TL;DR + Concise Brief */}
            <div className="p-3.5 bg-white border border-slate-200/90 rounded-lg space-y-1.5">
              <div className="text-xs font-bold text-slate-900">
                {insights.tldrHeadline}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {insights.briefSummary}
              </p>
            </div>

            {/* Calibration Signals Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Seniority Calibration
                </div>
                <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                  {insights.workStyleSignals.seniorityCalibration}
                </div>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Depth vs Breadth
                </div>
                <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                  {insights.workStyleSignals.technicalDepthVsBreadth}
                </div>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Impact Orientation
                </div>
                <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                  {insights.workStyleSignals.impactOrientation}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-700 leading-relaxed">
              {candidate.summary_excerpt || candidate.resume_profile}
            </p>
          </div>
        )}

        {/* Grounded Work Highlights (compact) */}
        {candidate.work_highlights && candidate.work_highlights.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-700">
              Key Resume Highlights
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              {candidate.work_highlights.slice(0, 3).map((hl, idx) => (
                <li key={idx} className="leading-snug">
                  {hl}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deep Career Patterns & Key Insights Section */}
      {insights && (
        <div className="space-y-3">
          {/* Detected Resume & Career Patterns */}
          {insights.careerPatterns.length > 0 && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <TrendingUp className="w-4 h-4 text-[#6743ee]" />
                  <span>Detected Resume &amp; Career Patterns</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {insights.careerPatterns.length} patterns synthesized
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.careerPatterns.map((pat, idx) => {
                  const style = getSignalStyles(pat.signal);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border space-y-1.5 ${style.border}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {pat.category}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${style.badge}`}
                        >
                          {style.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900">
                        {pat.pattern}
                      </div>

                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {pat.insight}
                      </p>

                      {pat.evidence && (
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                          <span className="font-semibold text-slate-600">Evidence:</span>{' '}
                          {pat.evidence}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Insights + Interview Probe Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insights.keyInsights.length > 0 && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span>Recruiter Actionable Insights</span>
                </div>
                <ul className="space-y-2">
                  {insights.keyInsights.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-[11px] text-slate-700 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.riskOrProbeAreas.length > 0 && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Suggested Validation Probes</span>
                </div>
                <div className="space-y-2.5">
                  {insights.riskOrProbeAreas.map((probe, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/70 space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-slate-800">
                        {probe.concern}
                      </div>
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span>“{probe.suggestedQuestion}”</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
