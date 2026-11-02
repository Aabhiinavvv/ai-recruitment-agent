import React, { useState, useEffect, useMemo } from 'react';
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
import { Candidate, DimensionScores, HiringBrief, CandidatePersona } from '../types';
import { generateCandidatePersona } from '../services/personaGenerator';
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
  Target,
  Copy,
  Check,
  Briefcase,
  HelpCircle,
  Clock,
  Compass,
  BarChart3,
  Flame,
  FileText
} from 'lucide-react';

interface CandidateComparisonModalProps {
  candidateA: Candidate;
  candidateB: Candidate;
  allCandidates: Candidate[];
  onSelectCandidateA: (candidate: Candidate) => void;
  onSelectCandidateB: (candidate: Candidate) => void;
  onClose: () => void;
  cutoffScore?: number;
  brief?: HiringBrief | null;
  onOpenPersonaModal?: (candidate: Candidate) => void;
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
  brief = null,
  onOpenPersonaModal,
}) => {
  // Navigation active tab: 'split-persona' | 'scores-radar' | 'all-in-one'
  const [activeTab, setActiveTab] = useState<'split-persona' | 'scores-radar' | 'all-in-one'>('split-persona');
  const [radarViewMode, setRadarViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedProbeKey, setCopiedProbeKey] = useState<string | null>(null);

  // Guarantee personas exist for both candidates (generate on-the-fly if missing)
  const personaA: CandidatePersona = useMemo(() => {
    return candidateA.persona || generateCandidatePersona(candidateA, brief);
  }, [candidateA, brief]);

  const personaB: CandidatePersona = useMemo(() => {
    return candidateB.persona || generateCandidatePersona(candidateB, brief);
  }, [candidateB, brief]);

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

  const handleCopyProbe = (probeText: string, key: string) => {
    navigator.clipboard.writeText(probeText);
    setCopiedProbeKey(key);
    setTimeout(() => {
      setCopiedProbeKey(null);
    }, 2000);
  };

  const handleCopyComparisonBrief = () => {
    const roleTitle = brief?.job_title || 'Role';
    const briefMarkdown = `## ⚖️ Head-to-Head Candidate Comparison: ${candidateA.name} vs ${candidateB.name}
**Target Position:** ${roleTitle}
**Role Benchmark Cutoff:** ${cutoffScore}%

---
### 1. Overall & Dimension Score Matchup
• **${candidateA.name} (Candidate A):** Overall Score **${candidateA.overall_score}%** (Tech: ${candidateA.dimension_scores.technical}%, Exp: ${candidateA.dimension_scores.experience}%)
• **${candidateB.name} (Candidate B):** Overall Score **${candidateB.overall_score}%** (Tech: ${candidateB.dimension_scores.technical}%, Exp: ${candidateB.dimension_scores.experience}%)
• **Advantage Summary:** ${candidateA.name} leads in ${aWins} dimensions · ${candidateB.name} leads in ${bWins} dimensions (${ties} tied)

---
### 2. Candidate Persona Summaries
#### ${candidateA.name} (${personaA.archetype} — ${personaA.fitSignal})
• **Tagline:** "${personaA.tagline}"
• **Superpower:** ${personaA.superpower}
• **Top Highlight:** ${personaA.highlightReel[0]?.title} (${personaA.highlightReel[0]?.metric || 'Proven'}) — ${personaA.highlightReel[0]?.description}
• **Working Style:** Pace: ${personaA.workingStyle.paceAndExecution} | Style: ${personaA.workingStyle.collaborationStyle}

#### ${candidateB.name} (${personaB.archetype} — ${personaB.fitSignal})
• **Tagline:** "${personaB.tagline}"
• **Superpower:** ${personaB.superpower}
• **Top Highlight:** ${personaB.highlightReel[0]?.title} (${personaB.highlightReel[0]?.metric || 'Proven'}) — ${personaB.highlightReel[0]?.description}
• **Working Style:** Pace: ${personaB.workingStyle.paceAndExecution} | Style: ${personaB.workingStyle.collaborationStyle}

---
### 3. Key Strengths & Growth Areas
• **${candidateA.name} Strengths:** ${personaA.strengths.map(s => s.trait).join(', ')}
• **${candidateA.name} Interview Probe:** "${personaA.growthAreas[0]?.interviewProbe || 'N/A'}"
• **${candidateB.name} Strengths:** ${personaB.strengths.map(s => s.trait).join(', ')}
• **${candidateB.name} Interview Probe:** "${personaB.growthAreas[0]?.interviewProbe || 'N/A'}"
`;

    navigator.clipboard.writeText(briefMarkdown);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6743ee] shrink-0 shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  Split-Screen Candidate Comparison
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-teal-100 text-[#5b43d6] font-bold border border-purple-200/80">
                  Head-to-Head
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Display scores, verified strengths, and AI persona summaries side-by-side for hiring decisions.
              </p>
            </div>
          </div>

          {/* Primary View Mode Tabs & Top Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View switcher tabs */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('split-persona')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'split-persona'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Persona & Strengths</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scores-radar')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'scores-radar'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#6743ee]" />
                <span>Scores & Radar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all-in-one')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'all-in-one'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>Full Executive Brief</span>
              </button>
            </div>

            {/* Copy head-to-head comparison brief */}
            <button
              type="button"
              onClick={handleCopyComparisonBrief}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
                copiedBrief
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
              title="Copy side-by-side comparison brief in markdown for interview panel or Slack"
            >
              {copiedBrief ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copiedBrief ? 'Copied Brief!' : 'Copy Head-to-Head Brief'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1"
              title="Close comparison (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sticky Candidate Selector Dual Bar */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-11 gap-3 items-center sticky top-0 z-20 shadow-2xs">
          {/* Candidate A Selector Card */}
          <div className="md:col-span-5 flex items-center gap-3 p-2.5 rounded-xl bg-purple-50/70 border border-purple-200">
            <div className="w-11 h-11 rounded-xl bg-[#6743ee] text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
              <span className="font-black text-sm leading-tight">{candidateA.overall_score}%</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-85">Match</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#5b43d6] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6743ee]" />
                  Candidate A
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] border border-purple-200 truncate max-w-[130px]">
                  {personaA.archetype}
                </span>
              </div>
              <select
                value={candidateA.candidate_id}
                onChange={(e) => {
                  const target = allCandidates.find(c => c.candidate_id === e.target.value);
                  if (target) onSelectCandidateA(target);
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-purple-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-[#6743ee] truncate"
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
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={handleSwapCandidates}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#6743ee] border border-slate-200 hover:border-purple-300 transition-all shadow-2xs hover:scale-105 active:scale-95"
              title="Swap Candidate A and Candidate B sides"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">VS</span>
          </div>

          {/* Candidate B Selector Card */}
          <div className="md:col-span-5 flex items-center gap-3 p-2.5 rounded-xl bg-teal-50/70 border border-teal-200">
            <div className="w-11 h-11 rounded-xl bg-[#0d9488] text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
              <span className="font-black text-sm leading-tight">{candidateB.overall_score}%</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-85">Match</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-teal-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" />
                  Candidate B
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 truncate max-w-[130px]">
                  {personaB.archetype}
                </span>
              </div>
              <select
                value={candidateB.candidate_id}
                onChange={(e) => {
                  const target = allCandidates.find(c => c.candidate_id === e.target.value);
                  if (target) onSelectCandidateB(target);
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-teal-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-[#0d9488] truncate"
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

        {/* Scrollable Split-Screen Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Executive Advantage Snapshot Banner */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50/90 via-slate-50 to-teal-50/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#6743ee] shrink-0" />
              <div>
                <span className="font-bold text-slate-900">Head-to-Head Differential: </span>
                <span className="font-semibold text-[#5b43d6]">{candidateA.name} leads in {aWins} dimensions</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="font-semibold text-teal-800">{candidateB.name} leads in {bWins} dimensions</span>
                {ties > 0 && (
                  <>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">{ties} tied</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs">
              <span className="text-slate-600">
                Overall Delta:{' '}
                <strong className={candidateA.overall_score >= candidateB.overall_score ? 'text-[#6743ee]' : 'text-teal-700'}>
                  {candidateA.overall_score > candidateB.overall_score
                    ? `+${candidateA.overall_score - candidateB.overall_score}% (${candidateA.name})`
                    : candidateB.overall_score > candidateA.overall_score
                    ? `+${candidateB.overall_score - candidateA.overall_score}% (${candidateB.name})`
                    : 'Evenly Matched (0% Delta)'}
                </strong>
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VIEW TAB 1 OR ALL-IN-ONE: PERSONA & STRENGTHS SPLIT SCREEN */}
          {/* ========================================================================= */}
          {(activeTab === 'split-persona' || activeTab === 'all-in-one') && (
            <div className="space-y-6">
              {/* Split Screen Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    Candidate Persona Summaries & Distilled Strengths Split-Screen
                  </h4>
                </div>
                <span className="text-xs text-slate-500">
                  Side-by-side archetypes, highlight reels, and verified evidence
                </span>
              </div>

              {/* Side-by-Side Dual Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                {/* -------------------- CANDIDATE A COLUMN (PURPLE) -------------------- */}
                <div className="space-y-5 rounded-2xl border border-purple-200/90 bg-purple-50/25 p-4 sm:p-5">
                  {/* Persona Identity Header */}
                  <div className="space-y-2 pb-3 border-b border-purple-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#6743ee]" />
                        <h4 className="font-bold text-slate-900 text-base">{candidateA.name}</h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#5b43d6] border border-purple-200">
                        {personaA.fitSignal}
                      </span>
                    </div>

                    <div className="inline-block px-3 py-1 bg-white rounded-lg border border-purple-200 text-xs font-bold text-purple-900 shadow-2xs">
                      Archetype: {personaA.archetype}
                    </div>

                    <p className="text-xs text-slate-600 italic">
                      "{personaA.tagline}"
                    </p>
                  </div>

                  {/* Superpower Block */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-purple-50 border border-amber-200/80 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Distilled Superpower</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      {personaA.superpower}
                    </p>
                  </div>

                  {/* Verified Strengths with Concrete Evidence & Impact */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Distilled Strengths & Business Impact</span>
                    </div>
                    <div className="space-y-2">
                      {personaA.strengths.map((s, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{s.trait}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                              Verified
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            <strong>Evidence:</strong> {s.evidence}
                          </p>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            <strong>Impact:</strong> {s.businessImpact}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Professional Highlight Reel */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                      <Award className="w-4 h-4 text-[#6743ee]" />
                      <span>Professional Highlight Reel</span>
                    </div>
                    <div className="space-y-2">
                      {personaA.highlightReel.map((h, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-purple-950 truncate">{h.title}</span>
                            {h.metric && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] shrink-0 font-mono">
                                {h.metric}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {h.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Potential Growth Areas & Panel Interview Probes */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        <span>Growth Areas & Tailored Interview Probes</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {personaA.growthAreas.map((g, idx) => {
                        const probeKey = `candA-probe-${idx}`;
                        const isCopied = copiedProbeKey === probeKey;

                        return (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900">{g.area}</span>
                              <p className="text-[11px] text-slate-600 mt-0.5">{g.context}</p>
                            </div>
                            <div className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-200 text-xs flex items-start justify-between gap-2">
                              <div className="text-[11px] text-amber-950">
                                <strong className="font-bold text-amber-900">Probe Question:</strong> "{g.interviewProbe}"
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyProbe(g.interviewProbe, probeKey)}
                                className="p-1 rounded text-amber-700 hover:text-amber-900 hover:bg-amber-200/80 shrink-0 transition-colors"
                                title="Copy probe question for interview panel"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Working Style & Ideal Setup */}
                  <div className="p-3 bg-white rounded-xl border border-purple-200/70 space-y-1.5 text-xs shadow-2xs">
                    <span className="font-bold text-slate-900 block text-xs">Working Style & Ideal Setup:</span>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div><strong>Execution:</strong> {personaA.workingStyle.paceAndExecution}</div>
                      <div><strong>Collaboration:</strong> {personaA.workingStyle.collaborationStyle}</div>
                      <div><strong>Ideal Environment:</strong> {personaA.idealEnvironment}</div>
                    </div>
                  </div>
                </div>

                {/* -------------------- CANDIDATE B COLUMN (TEAL) -------------------- */}
                <div className="space-y-5 rounded-2xl border border-teal-200/90 bg-teal-50/25 p-4 sm:p-5">
                  {/* Persona Identity Header */}
                  <div className="space-y-2 pb-3 border-b border-teal-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#0d9488]" />
                        <h4 className="font-bold text-slate-900 text-base">{candidateB.name}</h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                        {personaB.fitSignal}
                      </span>
                    </div>

                    <div className="inline-block px-3 py-1 bg-white rounded-lg border border-teal-200 text-xs font-bold text-teal-900 shadow-2xs">
                      Archetype: {personaB.archetype}
                    </div>

                    <p className="text-xs text-slate-600 italic">
                      "{personaB.tagline}"
                    </p>
                  </div>

                  {/* Superpower Block */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-teal-50 border border-amber-200/80 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Distilled Superpower</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      {personaB.superpower}
                    </p>
                  </div>

                  {/* Verified Strengths with Concrete Evidence & Impact */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Distilled Strengths & Business Impact</span>
                    </div>
                    <div className="space-y-2">
                      {personaB.strengths.map((s, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{s.trait}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                              Verified
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            <strong>Evidence:</strong> {s.evidence}
                          </p>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            <strong>Impact:</strong> {s.businessImpact}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Professional Highlight Reel */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                      <Award className="w-4 h-4 text-[#0d9488]" />
                      <span>Professional Highlight Reel</span>
                    </div>
                    <div className="space-y-2">
                      {personaB.highlightReel.map((h, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-teal-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-teal-950 truncate">{h.title}</span>
                            {h.metric && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 shrink-0 font-mono">
                                {h.metric}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {h.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Potential Growth Areas & Panel Interview Probes */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        <span>Growth Areas & Tailored Interview Probes</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {personaB.growthAreas.map((g, idx) => {
                        const probeKey = `candB-probe-${idx}`;
                        const isCopied = copiedProbeKey === probeKey;

                        return (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900">{g.area}</span>
                              <p className="text-[11px] text-slate-600 mt-0.5">{g.context}</p>
                            </div>
                            <div className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-200 text-xs flex items-start justify-between gap-2">
                              <div className="text-[11px] text-amber-950">
                                <strong className="font-bold text-amber-900">Probe Question:</strong> "{g.interviewProbe}"
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyProbe(g.interviewProbe, probeKey)}
                                className="p-1 rounded text-amber-700 hover:text-amber-900 hover:bg-amber-200/80 shrink-0 transition-colors"
                                title="Copy probe question for interview panel"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Working Style & Ideal Setup */}
                  <div className="p-3 bg-white rounded-xl border border-teal-200/70 space-y-1.5 text-xs shadow-2xs">
                    <span className="font-bold text-slate-900 block text-xs">Working Style & Ideal Setup:</span>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div><strong>Execution:</strong> {personaB.workingStyle.paceAndExecution}</div>
                      <div><strong>Collaboration:</strong> {personaB.workingStyle.collaborationStyle}</div>
                      <div><strong>Ideal Environment:</strong> {personaB.idealEnvironment}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW TAB 2 OR ALL-IN-ONE: 6-DIMENSION SCORES & RADAR COMPETENCY */}
          {/* ========================================================================= */}
          {(activeTab === 'scores-radar' || activeTab === 'all-in-one') && (
            <div className="space-y-6">
              {/* Controls bar for radar display */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#6743ee]" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    6-Dimension Competency Radars & Differential Analysis
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setRadarViewMode('side-by-side')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        radarViewMode === 'side-by-side'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Side-by-Side Radars
                    </button>
                    <button
                      type="button"
                      onClick={() => setRadarViewMode('overlay')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        radarViewMode === 'overlay'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Overlaid Polygon
                    </button>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={showBenchmark}
                      onChange={(e) => setShowBenchmark(e.target.checked)}
                      className="accent-[#6743ee] rounded cursor-pointer"
                    />
                    <span>Role Benchmark ({cutoffScore}%)</span>
                  </label>
                </div>
              </div>

              {/* Radar Chart Visualizations */}
              {radarViewMode === 'side-by-side' ? (
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

                    <div className="h-[270px] w-full flex items-center justify-center">
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

                    <div className="h-[270px] w-full flex items-center justify-center">
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

                  <div className="h-[330px] w-full flex items-center justify-center">
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

              {/* Side-by-Side Dimension Differences & Evidence */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#6743ee]" />
                    <h4 className="font-bold text-slate-900 text-sm">6-Dimension Differential Breakdown</h4>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Evaluates candidate performance across all rubric evaluation dimensions
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

              {/* Direct Skill Score Matchup (1–10 Scale) */}
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
                        <div key={skill} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span className="truncate">{skill}</span>
                            {diff !== 0 && (
                              <span className={`text-[10px] font-bold px-1 rounded ${
                                diff > 0 ? 'bg-purple-100 text-[#5b43d6]' : 'bg-teal-100 text-teal-800'
                              }`}>
                                {diff > 0 ? `+${diff} ${candidateA.name.split(' ')[0]}` : `+${Math.abs(diff)} ${candidateB.name.split(' ')[0]}`}
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
          )}
        </div>

        {/* Modal Footer with Quick Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              Split-screen candidate scores, distilled strengths & personas grounded in verified resume data.
            </span>
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
