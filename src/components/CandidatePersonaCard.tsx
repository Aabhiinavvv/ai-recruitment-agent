import React, { useState } from 'react';
import { Candidate, CandidatePersona } from '../types';
import { formatPersonaMarkdown } from '../services/personaGenerator';
import { 
  Sparkles, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Zap, 
  Compass, 
  Target, 
  Clock, 
  Users, 
  RotateCcw, 
  Briefcase, 
  Layers, 
  ChevronRight,
  HelpCircle,
  TrendingUp,
  FileText
} from 'lucide-react';

interface CandidatePersonaCardProps {
  candidate: Candidate;
  persona: CandidatePersona;
  onRegenerate?: (candidateId: string) => void;
  isRegenerating?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

export const CandidatePersonaCard: React.FC<CandidatePersonaCardProps> = ({
  candidate,
  persona,
  onRegenerate,
  isRegenerating = false,
  onClose,
  isModal = false,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedProbeIndex, setCopiedProbeIndex] = useState<number | null>(null);

  const handleCopySummary = async () => {
    try {
      const text = formatPersonaMarkdown(persona, candidate.name, candidate.role);
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    } catch {
      // fallback
    }
  };

  const handleCopyProbe = async (probeText: string, index: number) => {
    try {
      await navigator.clipboard.writeText(probeText);
      setCopiedProbeIndex(index);
      setTimeout(() => setCopiedProbeIndex(null), 2000);
    } catch {
      // fallback
    }
  };

  const getFitSignalBadge = (signal: CandidatePersona['fitSignal']) => {
    switch (signal) {
      case 'Immediate High-Impact Lead':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Specialized Domain Authority':
        return 'bg-purple-100 text-[#5b43d6] border-purple-300';
      case 'High-Ceiling Technical Generalist':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-300';
    }
  };

  const getHighlightCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Impact':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Architecture':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Leadership':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-6 ${
      isModal ? 'p-6 sm:p-8' : 'p-5 sm:p-6'
    }`}>
      {/* Top Banner / Hero */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="space-y-2">
          {/* Archetype & Candidate ID */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#6743ee] to-indigo-600 text-white shadow-xs flex items-center gap-1.5 tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              {persona.archetype}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${getFitSignalBadge(persona.fitSignal)}`}>
              {persona.fitSignal}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {candidate.candidate_id}
            </span>
            <span className="text-[11px] text-slate-400">
              • Distilled {persona.generatedAt}
            </span>
          </div>

          {/* Name & Target Role */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{candidate.name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                {candidate.role}
              </span>
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1 italic">
              "{persona.tagline}"
            </p>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 ${
              copiedSummary
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                : 'bg-[#6743ee] hover:bg-[#5637d2] text-white shadow-xs'
            }`}
            title="Copy executive persona brief to clipboard for hiring manager review"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'Copied Brief!' : 'Copy for Hiring Mgr'}</span>
          </button>

          {onRegenerate && (
            <button
              type="button"
              disabled={isRegenerating}
              onClick={() => onRegenerate(candidate.candidate_id)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200 active:scale-95 disabled:opacity-50"
              title="Re-run AI persona distillation engine"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-[#6743ee]' : ''}`} />
              <span>{isRegenerating ? 'Distilling...' : 'Regenerate'}</span>
            </button>
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Superpower Quote Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-slate-50 border border-purple-200/90 shadow-2xs relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6743ee] to-indigo-600 text-white shrink-0 shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#6743ee] flex items-center gap-1">
              <span>Candidate Superpower & Core Philosophy</span>
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
              "{persona.superpower}"
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Professional Highlight Reel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Professional Highlight Reel
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Distilled from resume achievements & technical evidence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {persona.highlightReel.map((item, idx) => (
            <div 
              key={idx}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-[#6743ee]/40 transition-all shadow-2xs space-y-2 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getHighlightCategoryBadge(item.category)}`}>
                  {item.category}
                </span>
                {item.metric && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-slate-800 border border-slate-200 shadow-2xs group-hover:border-[#6743ee]/30 transition-colors">
                    {item.metric}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#6743ee] transition-colors line-clamp-1">
                {item.title}
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Two Columns — Distilled Strengths vs Potential Growth Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Strengths (Evidence & Impact) */}
        <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wider">
                Distilled Strengths
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Verified Evidence
            </span>
          </div>

          <div className="space-y-3">
            {persona.strengths.map((str, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-emerald-200/90 shadow-2xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {str.trait}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/70 italic">
                  "{str.evidence}"
                </div>
                <div className="text-[10px] text-emerald-800 font-medium flex items-center gap-1 pt-0.5">
                  <span className="font-bold uppercase tracking-wider text-[9px] text-emerald-700">Business Impact:</span>
                  <span>{str.businessImpact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Potential Growth Areas & Actionable Interview Probes */}
        <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wider">
                Potential Growth Areas
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              Panel Interview Probes
            </span>
          </div>

          <div className="space-y-3">
            {persona.growthAreas.map((growth, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200/90 shadow-2xs space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {growth.area}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {growth.context}
                  </p>
                </div>

                {/* Verbatim Interview Probe Box */}
                <div className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-200/80 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#6743ee] flex items-center gap-1">
                      <HelpCircle className="w-2.5 h-2.5" />
                      Recommended Interview Probe
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyProbe(growth.interviewProbe, idx)}
                      className="text-[10px] font-semibold text-[#6743ee] hover:underline flex items-center gap-1"
                      title="Copy this specific probe question to clipboard"
                    >
                      {copiedProbeIndex === idx ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy Question</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] font-medium text-purple-950 italic">
                    "{growth.interviewProbe}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Working Style & Peak Environment */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#6743ee]" />
          <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
            Working Style & Team Synergy
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Pace & Execution
            </span>
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
              {persona.workingStyle.paceAndExecution}
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Collaboration Signature
            </span>
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
              {persona.workingStyle.collaborationStyle}
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Decision-Making Model
            </span>
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
              {persona.workingStyle.decisionMaking}
            </p>
          </div>
        </div>

        {/* Peak Velocity Environment Callout */}
        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80 flex items-start gap-2.5">
          <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-indigo-950 mr-1.5">Ideal Environment for Peak Velocity:</span>
            <span className="text-indigo-900 font-normal">{persona.idealEnvironment}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
