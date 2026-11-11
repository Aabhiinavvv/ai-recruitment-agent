import React, { useState, useEffect } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  InterviewRoundFeedback, 
  StandardizedEvaluationReport, 
  InterviewCompetencyScores, 
  InterviewRecommendationType 
} from '../types';
import { 
  SAMPLE_FEEDBACK_PRESETS, 
  generateStandardizedEvaluationReport, 
  formatStandardizedReportMarkdown,
  getRecommendationColorTokens 
} from '../services/interviewFeedbackService';
import { 
  X, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Save, 
  Award, 
  Sliders, 
  ChevronRight, 
  User, 
  Calendar, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Mail, 
  Printer, 
  RotateCcw,
  BookOpen,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowRight
} from 'lucide-react';

interface InterviewFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  brief: HiringBrief | null;
  onSaveFeedback: (candidateId: string, feedback: InterviewRoundFeedback) => void;
  onOpenEmailDraft?: (candidate: Candidate) => void;
}

export const InterviewFeedbackModal: React.FC<InterviewFeedbackModalProps> = ({
  isOpen,
  onClose,
  candidate,
  brief,
  onSaveFeedback,
  onOpenEmailDraft
}) => {
  if (!isOpen || !candidate) return null;

  // Selected feedback report for candidate (or 'new' for creating a new round)
  const existingReports = candidate.interview_feedback_reports || [];
  const [selectedReportId, setSelectedReportId] = useState<string>('new');

  // Form State
  const [interviewerName, setInterviewerName] = useState<string>('Sarah Jenkins');
  const [interviewerRole, setInterviewerRole] = useState<string>('Staff Engineering Lead');
  const [roundName, setRoundName] = useState<string>('Technical Architecture & System Design');
  const [roundType, setRoundType] = useState<InterviewRoundFeedback['roundType']>('system_design');
  const [interviewDate, setInterviewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [rawNotes, setRawNotes] = useState<string>('');
  
  const [ratings, setRatings] = useState<InterviewCompetencyScores>({
    technicalDepth: 8,
    problemSolvingSpeed: 8,
    systemArchitecture: 8,
    communicationClarity: 8,
    cultureAndLeadership: 8
  });

  const [recommendation, setRecommendation] = useState<InterviewRecommendationType>('Strong Hire');
  
  // Generated Report state
  const [currentReport, setCurrentReport] = useState<StandardizedEvaluationReport | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Load existing report if available on open
  useEffect(() => {
    if (existingReports.length > 0) {
      const latest = existingReports[0];
      setSelectedReportId(latest.id);
      loadFeedbackIntoForm(latest);
    } else {
      setSelectedReportId('new');
      // Preload with high-signal sample preset matching role
      const defaultPreset = SAMPLE_FEEDBACK_PRESETS[0];
      loadPreset(defaultPreset, false);
    }
  }, [candidate.candidate_id]);

  const loadFeedbackIntoForm = (fb: InterviewRoundFeedback) => {
    setInterviewerName(fb.interviewerName);
    setInterviewerRole(fb.interviewerRole);
    setRoundName(fb.roundName);
    setRoundType(fb.roundType);
    setInterviewDate(fb.interviewDate);
    setDurationMinutes(fb.durationMinutes);
    setRawNotes(fb.rawNotes);
    setRatings(fb.ratings);
    setRecommendation(fb.overallRecommendation);
    if (fb.evaluationReport) {
      setCurrentReport(fb.evaluationReport);
      setActiveTab('report');
    }
  };

  const loadPreset = (preset: typeof SAMPLE_FEEDBACK_PRESETS[0], switchToForm = true) => {
    setRoundName(preset.roundName);
    setRoundType(preset.roundType);
    setInterviewerName(preset.interviewerName);
    setInterviewerRole(preset.interviewerRole);
    setRatings(preset.ratings);
    setRecommendation(preset.recommendation);
    setRawNotes(preset.notes);
    setCurrentReport(null);
    setIsSaved(false);
    if (switchToForm) {
      setActiveTab('form');
    }
  };

  const handleRatingChange = (key: keyof InterviewCompetencyScores, value: number) => {
    setRatings(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateReport = () => {
    if (!rawNotes.trim()) return;

    setIsGenerating(true);
    // Simulate high-fidelity AI synthesis processing
    setTimeout(() => {
      const report = generateStandardizedEvaluationReport(
        candidate,
        {
          roundName,
          roundType,
          interviewerName,
          interviewerRole,
          rawNotes,
          ratings,
          overallRecommendation: recommendation
        },
        brief
      );
      setCurrentReport(report);
      setIsGenerating(false);
      setActiveTab('report');
      setIsSaved(false);
    }, 450);
  };

  const handleSaveToCandidate = () => {
    const feedbackPayload: InterviewRoundFeedback = {
      id: selectedReportId === 'new' ? `feedback-${Date.now()}` : selectedReportId,
      candidateId: candidate.candidate_id,
      candidateName: candidate.name,
      interviewerName,
      interviewerRole,
      roundName,
      roundType,
      interviewDate,
      durationMinutes,
      rawNotes,
      ratings,
      overallRecommendation: recommendation,
      evaluationReport: currentReport || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveFeedback(candidate.candidate_id, feedbackPayload);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleCopyMarkdown = () => {
    if (!currentReport) return;
    const tempFeedback: InterviewRoundFeedback = {
      id: selectedReportId,
      candidateId: candidate.candidate_id,
      candidateName: candidate.name,
      interviewerName,
      interviewerRole,
      roundName,
      roundType,
      interviewDate,
      durationMinutes,
      rawNotes,
      ratings,
      overallRecommendation: recommendation,
      evaluationReport: currentReport,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const md = formatStandardizedReportMarkdown(currentReport, candidate, tempFeedback);
    navigator.clipboard.writeText(md);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const verdictTokens = getRecommendationColorTokens(recommendation);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-feedback-title"
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-purple-50/30 to-indigo-50/40 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6743ee] to-[#8d6eff] text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="interview-feedback-title" className="text-base font-bold text-slate-900">
                  Interview Evaluation & Standardization
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#5b43d6] border border-purple-200">
                  AI Synthesis
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Candidate: <strong className="text-slate-800">{candidate.name}</strong> • Role: <span className="font-medium">{candidate.role}</span> ({candidate.candidate_id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <div className="flex items-center p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'form'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-[#6743ee]" />
                <span>Feedback Form</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                disabled={!currentReport}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'report'
                    ? 'bg-white text-[#6743ee] shadow-2xs font-bold'
                    : currentReport
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Standardized Report</span>
                {currentReport && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Existing Reports Bar (if candidate already has evaluations) */}
        {existingReports.length > 0 && (
          <div className="px-6 py-2 bg-slate-100/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Saved Rounds ({existingReports.length}):</span>
              {existingReports.map(fb => (
                <button
                  key={fb.id}
                  type="button"
                  onClick={() => {
                    setSelectedReportId(fb.id);
                    loadFeedbackIntoForm(fb);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    selectedReportId === fb.id
                      ? 'bg-[#6743ee] text-white shadow-2xs font-bold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Award className="w-3 h-3" />
                  <span>{fb.roundName}</span>
                  <span className="text-[10px] opacity-80">({fb.overallRecommendation})</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedReportId('new');
                setCurrentReport(null);
                setRawNotes('');
                setActiveTab('form');
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#6743ee] hover:bg-purple-100/70 border border-purple-200 bg-purple-50 transition-colors"
            >
              + Log New Round Feedback
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'form' ? (
            /* ========================================================== */
            /* 1. FEEDBACK FORM VIEW                                      */
            /* ========================================================== */
            <div className="space-y-6">
              {/* Presets Quick-Loader Strip */}
              <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#5b43d6]">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold">Quick-Load Sample Notes:</span>
                  <span className="text-slate-600 hidden sm:inline">Test realistic interviewer evaluations instantly:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SAMPLE_FEEDBACK_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => loadPreset(preset, true)}
                      className="px-2.5 py-1 bg-white hover:bg-purple-100/80 text-slate-700 hover:text-[#5b43d6] border border-purple-200 rounded-lg text-[11px] font-semibold transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid: Interviewer Info & Round Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-[#6743ee]" />
                    Interviewer Name
                  </label>
                  <input
                    type="text"
                    value={interviewerName}
                    onChange={(e) => setInterviewerName(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                    placeholder="e.g. David Chen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Interviewer Title
                  </label>
                  <input
                    type="text"
                    value={interviewerRole}
                    onChange={(e) => setInterviewerRole(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                    placeholder="e.g. Principal Systems Architect"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#6743ee]" />
                    Interview Date
                  </label>
                  <input
                    type="date"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#6743ee]" />
                    Duration (Minutes)
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                  >
                    <option value={30}>30 min (Screening Sync)</option>
                    <option value={45}>45 min (Standard Technical)</option>
                    <option value={60}>60 min (Deep Architecture)</option>
                    <option value={90}>90 min (Pair Programming / Bar Raiser)</option>
                  </select>
                </div>
              </div>

              {/* Round Name & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Interview Round Title
                  </label>
                  <input
                    type="text"
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                    placeholder="e.g. Technical Architecture & Distributed Concurrency"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Round Focus Type
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['system_design', 'technical', 'coding', 'behavioral', 'hiring_manager', 'screening'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRoundType(type)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                          roundType === type
                            ? 'bg-[#6743ee] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rubric Rating Sliders (1 to 10) */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-[#6743ee]" />
                    Competency Rating Rubric (1 - 10)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Calibrated against {candidate.role} Senior Bar
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { key: 'technicalDepth' as const, label: 'Technical Depth', desc: 'Core CS & domain rigor' },
                    { key: 'problemSolvingSpeed' as const, label: 'Problem Solving', desc: 'Algorithm & approach speed' },
                    { key: 'systemArchitecture' as const, label: 'System Design', desc: 'Scalability & failovers' },
                    { key: 'communicationClarity' as const, label: 'Communication', desc: 'Clarity & receptiveness' },
                    { key: 'cultureAndLeadership' as const, label: 'Culture / Leadership', desc: 'Ownership & mentorship' }
                  ].map(rubric => {
                    const score = ratings[rubric.key];
                    return (
                      <div key={rubric.key} className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{rubric.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-black ${
                            score >= 8 ? 'bg-emerald-100 text-emerald-800' :
                            score >= 6 ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {score}/10
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{rubric.desc}</p>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={score}
                          onChange={(e) => handleRatingChange(rubric.key, Number(e.target.value))}
                          className="w-full accent-[#6743ee] cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom-Line Recommendation Pills */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Overall Interviewer Recommendation
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['Strong Hire', 'Hire', 'Lean Hire', 'Lean No Hire', 'No Hire'] as const).map(opt => {
                    const isSelected = recommendation === opt;
                    const tokens = getRecommendationColorTokens(opt);

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setRecommendation(opt)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? `${tokens.badgeBg} ${tokens.badgeText} ${tokens.borderColor} ring-2 ${tokens.ringColor} shadow-xs`
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-sm">
                          {opt === 'Strong Hire' ? '🚀' :
                           opt === 'Hire' ? '✅' :
                           opt === 'Lean Hire' ? '👍' :
                           opt === 'Lean No Hire' ? '🤔' : '🛑'}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Raw Interview Notes Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#6743ee]" />
                    <span>Raw Interview Notes & Transcript Observations</span>
                    <span className="text-[11px] font-normal text-slate-400">(Required for AI report synthesis)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {rawNotes.length} characters • ~{rawNotes.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  rows={8}
                  className="w-full text-xs font-mono p-3.5 bg-slate-50/50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6743ee]/30 focus:border-[#6743ee] transition-all leading-relaxed"
                  placeholder="Paste freeform interview notes, questions asked, candidate answers, code structure, trade-offs analyzed, edge case handling, and communication vibes..."
                />
              </div>

              {/* Generate Standardized Report Primary Action Banner */}
              <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-bold text-[#5b43d6] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    AI Standardized Evaluation Report Engine
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Synthesizes raw notes into executive calibrated levels, competency breakdowns, distilled evidence, and committee next steps.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={!rawNotes.trim() || isGenerating}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#6743ee] to-[#7f5eff] hover:from-[#5637d2] hover:to-[#6d4be0] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Report...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Generate AI Evaluation Report</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* 2. STANDARDIZED EVALUATION REPORT VIEW                     */
            /* ========================================================== */
            currentReport && (
              <div className="space-y-6">
                {/* Executive Verdict Banner */}
                <div className={`p-5 rounded-2xl border ${verdictTokens.borderColor} bg-gradient-to-br from-white via-slate-50 to-purple-50/20 shadow-xs space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-xs ${verdictTokens.accentBg}`}>
                        {currentReport.compositeScore}%
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${verdictTokens.badgeBg} ${verdictTokens.badgeText} border ${verdictTokens.borderColor}`}>
                            {currentReport.hiringVerdict}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#5b43d6] border border-purple-200">
                            {currentReport.calibratedLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Evaluated by <strong>{interviewerName}</strong> ({interviewerRole}) on {interviewDate} • Round: <em>{roundName}</em>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        AI Confidence: <strong className="text-slate-800">{currentReport.confidenceScorePercent}%</strong>
                      </span>
                      <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full" 
                          style={{ width: `${currentReport.confidenceScorePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Executive Summary Narrative */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-1">
                    <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Executive Synthesis</h4>
                    <p className="text-xs text-slate-800 leading-relaxed font-sans">
                      {currentReport.executiveSummary}
                    </p>
                  </div>
                </div>

                {/* Competency Rubric Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#6743ee]" />
                      Standardized Competency Breakdown
                    </h3>
                    <span className="text-[11px] text-slate-500">Target Role: {candidate.role}</span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {currentReport.competencyEvaluations.map((comp, idx) => (
                      <div key={idx} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className="md:w-1/3">
                          <span className="font-bold text-slate-900">{comp.competency}</span>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{comp.benchmark}</div>
                        </div>

                        <div className="md:w-1/2 text-slate-600 text-xs">
                          {comp.observations}
                        </div>

                        <div className="md:w-1/6 flex items-center justify-end gap-2">
                          <span className="font-mono font-bold text-slate-800">{comp.score}/10</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            comp.verdict === 'Exceeds Bar' ? 'bg-emerald-100 text-emerald-800' :
                            comp.verdict === 'Meets Bar' ? 'bg-blue-100 text-blue-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {comp.verdict}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Core Strengths & Risk Mitigations (2 Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Distilled Strengths */}
                  <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Key Strengths & Concrete Evidence
                    </h4>
                    <div className="space-y-2.5">
                      {currentReport.coreStrengths.map((str, idx) => (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-emerald-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{str.title}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {str.signalStrength}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-normal">
                            {str.evidence}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risks & Mitigations */}
                  <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Identified Gaps & Recommended Mitigations
                    </h4>
                    <div className="space-y-2.5">
                      {currentReport.riskFactorsOrGaps.map((risk, idx) => (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-amber-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{risk.concern}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              risk.severity === 'High' ? 'bg-rose-100 text-rose-800' :
                              risk.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {risk.severity} Risk
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{risk.context}</p>
                          <div className="text-[10px] text-indigo-700 bg-indigo-50/70 p-1.5 rounded font-medium mt-1">
                            <strong>Mitigation:</strong> {risk.mitigation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scenario & Question Deep-Dives */}
                {currentReport.questionDeepDives.length > 0 && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-[#6743ee]" />
                      Question & Technical Scenario Deep-Dives
                    </h4>
                    <div className="space-y-3">
                      {currentReport.questionDeepDives.map((q, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{q.topic}</span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {q.verdict}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-normal">
                            <strong className="text-slate-900">Candidate Response:</strong> {q.candidateResponseSummary}
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            <strong className="text-slate-700">Trade-offs Weighed:</strong> {q.technicalTradeoffsNoted}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Next Steps */}
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-bold text-[#5b43d6] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#6743ee]" />
                    Hiring Committee Recommended Next Steps
                  </h4>
                  <p className="text-xs text-slate-800 font-medium">
                    {currentReport.recommendedNextSteps}
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer Actions Toolbar */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {activeTab === 'report' ? (
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="px-3 py-1.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>← Edit Notes & Ratings</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const defaultPreset = SAMPLE_FEEDBACK_PRESETS[0];
                  loadPreset(defaultPreset, true);
                }}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors"
              >
                Reset to Default Preset
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Markdown */}
            {currentReport && (
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Copy formatted markdown report for Slack, Notion or Greenhouse"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
            )}

            {/* Bridge to Follow-Up Email */}
            {onOpenEmailDraft && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEmailDraft(candidate);
                }}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-[#5b43d6] border border-purple-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Draft personalized follow-up email citing this feedback"
              >
                <Mail className="w-3.5 h-3.5 text-[#6743ee]" />
                <span>Draft Candidate Email</span>
              </button>
            )}

            {/* Save to Profile Primary Action */}
            <button
              type="button"
              onClick={handleSaveToCandidate}
              className="px-5 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Report Saved to Candidate!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Report to Candidate Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
