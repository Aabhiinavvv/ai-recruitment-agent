import React, { useState } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  HiringStage, 
  OutreachDraft, 
  EmailDraftType, 
  EmailDraftTone 
} from '../types';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { 
  CheckSquare, 
  Square, 
  MinusSquare, 
  X, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Download, 
  FileCode, 
  Scale, 
  Layers, 
  Sparkles, 
  ChevronDown, 
  Check,
  Send,
  Award,
  FileText
} from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCandidateIds: string[];
  allFilteredCandidates: Candidate[];
  allCandidates: Candidate[];
  brief: HiringBrief | null;
  cutoffScore?: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectAboveCutoff: () => void;
  onBulkStageChange: (newStage: HiringStage, candidateIds: string[]) => void;
  onBulkAdvance: (candidateIds: string[]) => void;
  onBulkReject: (candidateIds: string[]) => void;
  onBulkAssignCoding?: (candidateIds: string[]) => void;
  onBulkQueueEmails: (drafts: OutreachDraft[], description: string) => void;
  onLaunchCompare?: (idA: string, idB: string) => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCandidateIds,
  allFilteredCandidates,
  allCandidates,
  brief,
  cutoffScore = 75,
  onSelectAll,
  onDeselectAll,
  onSelectAboveCutoff,
  onBulkStageChange,
  onBulkAdvance,
  onBulkReject,
  onBulkAssignCoding,
  onBulkQueueEmails,
  onLaunchCompare,
}) => {
  const [showStageDropdown, setShowStageDropdown] = useState<boolean>(false);
  const [showExportDropdown, setShowExportDropdown] = useState<boolean>(false);
  const [showBatchEmailModal, setShowBatchEmailModal] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Batch Email Config State
  const [batchEmailType, setBatchEmailType] = useState<EmailDraftType>('progress');
  const [batchEmailTone, setBatchEmailTone] = useState<EmailDraftTone>('professional');
  const [batchReasonCategory, setBatchReasonCategory] = useState<string>('next_round_invitation');
  const [batchCustomNotes, setBatchCustomNotes] = useState<string>('');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);

  const selectedCount = selectedCandidateIds.length;
  const hasSelection = selectedCount > 0;
  const selectedCandidates = allCandidates.filter(c => selectedCandidateIds.includes(c.candidate_id));
  
  const isAllFilteredSelected = allFilteredCandidates.length > 0 && 
    allFilteredCandidates.every(c => selectedCandidateIds.includes(c.candidate_id));
  const isPartiallySelected = !isAllFilteredSelected && 
    allFilteredCandidates.some(c => selectedCandidateIds.includes(c.candidate_id));

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3200);
  };

  const handleStageSelect = (stage: HiringStage) => {
    if (!hasSelection) return;
    onBulkStageChange(stage, selectedCandidateIds);
    setShowStageDropdown(false);
    showToast(`Updated ${selectedCount} candidates to stage: ${stage}`);
  };

  const handleAdvanceClick = () => {
    if (!hasSelection) return;
    onBulkAdvance(selectedCandidateIds);
    showToast(`Advanced ${selectedCount} candidates`);
  };

  const handleRejectClick = () => {
    if (!hasSelection) return;
    onBulkReject(selectedCandidateIds);
    showToast(`Marked ${selectedCount} candidates as Rejected`);
  };

  // Export Data: CSV format
  const handleExportCSV = () => {
    if (!hasSelection) return;
    const headers = [
      "Candidate ID", 
      "Name", 
      "Email", 
      "Role", 
      "Overall Score (%)", 
      "Stage", 
      "Decision Status", 
      "Technical Score (%)", 
      "Experience Score (%)", 
      "Strengths", 
      "Missing Skills"
    ];
    const rows = selectedCandidates.map(c => [
      c.candidate_id,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${(c.role || '').replace(/"/g, '""')}"`,
      c.overall_score,
      c.stage || 'Screening',
      `"${c.decision_status.replace(/"/g, '""')}"`,
      c.dimension_scores?.technical || 0,
      c.dimension_scores?.experience || 0,
      `"${(c.strengths || []).join('; ').replace(/"/g, '""')}"`,
      `"${(c.missing_skills || []).join('; ').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDropdown(false);
    showToast(`Exported ${selectedCount} candidates to CSV`);
  };

  // Export Data: JSON format
  const handleExportJSON = () => {
    if (!hasSelection) return;
    const exportPayload = {
      exported_at: new Date().toISOString(),
      role: brief?.job_title || 'Software Engineer',
      company: brief?.company_name || 'Organization',
      count: selectedCandidates.length,
      candidates: selectedCandidates.map(c => ({
        candidate_id: c.candidate_id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
        stage: c.stage || 'Screening',
        overall_score: c.overall_score,
        decision_status: c.decision_status,
        recruiter_decision: c.recruiter_decision,
        dimension_scores: c.dimension_scores,
        strengths: c.strengths,
        missing_skills: c.missing_skills,
        skill_scores: c.skill_scores,
        private_notes: c.private_notes
      }))
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDropdown(false);
    showToast(`Exported ${selectedCount} candidates to JSON`);
  };

  // Generate & Queue Batch AI Emails for all selected candidates
  const handleExecuteBatchEmail = () => {
    if (!hasSelection) return;
    setIsGeneratingBatch(true);

    setTimeout(() => {
      const generatedDrafts: OutreachDraft[] = selectedCandidates.map((cand) => {
        const result = recruitmentAgent.draftFollowUpEmail({
          candidate: cand,
          jobTitle: brief?.job_title || cand.role || 'Software Engineer',
          companyName: brief?.company_name || 'Anthropic Tech',
          emailType: batchEmailType,
          reasonCategory: batchReasonCategory,
          specificFeedback: batchCustomNotes,
          tone: batchEmailTone,
          includeNextSteps: true,
          includeTalentPoolNote: true
        });

        return {
          id: `draft-${cand.candidate_id.toLowerCase()}-${Date.now()}`,
          type: batchEmailType,
          candidate_id: cand.candidate_id,
          candidate_name: cand.name,
          candidate_email: cand.email,
          candidate_phone: cand.phone,
          subject: result.subject,
          body: result.body,
          call_script: result.call_script,
          availability: batchEmailType === 'progress' ? 'Calendar link provided' : 'N/A',
          status: 'Draft — not sent or scheduled'
        };
      });

      onBulkQueueEmails(generatedDrafts, `Batch ${batchEmailType} email (${batchReasonCategory.replace(/_/g, ' ')})`);
      setIsGeneratingBatch(false);
      setShowBatchEmailModal(false);
      showToast(`Generated & queued ${generatedDrafts.length} personalized follow-up emails`);
    }, 250);
  };

  return (
    <>
      {/* Sticky Header Toolbar: Docked at the top of candidate list */}
      <header 
        aria-label="Candidate Bulk Action Toolbar"
        className="sticky top-2 sm:top-3 z-30 my-2.5 transition-all duration-200"
      >
        <div 
          className={`px-3.5 py-2.5 rounded-2xl border shadow-md backdrop-blur-md transition-all flex flex-wrap items-center justify-between gap-2.5 ${
            hasSelection 
              ? 'bg-slate-900/95 text-white border-slate-700 ring-2 ring-[#6743ee]/30' 
              : 'bg-white/95 text-slate-700 border-slate-200/90'
          }`}
        >
          {/* Left section: Master Checkbox, Selection Counter & Quick Helpers */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isAllFilteredSelected ? onDeselectAll : onSelectAll}
              className={`flex items-center gap-2 font-bold text-xs transition-colors cursor-pointer ${
                hasSelection ? 'text-white hover:text-purple-200' : 'text-slate-800 hover:text-[#6743ee]'
              }`}
              title={isAllFilteredSelected ? "Deselect all candidates" : "Select all filtered candidates"}
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-[#8a72ff]" />
              ) : isPartiallySelected ? (
                <MinusSquare className="w-4 h-4 text-[#8a72ff]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {hasSelection 
                  ? `${selectedCount} of ${allFilteredCandidates.length} Selected` 
                  : `Select All Candidates (${allFilteredCandidates.length})`}
              </span>
            </button>

            {hasSelection ? (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#6743ee] text-white shadow-2xs">
                  {selectedCount} Active
                </span>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="text-[11px] text-slate-400 hover:text-white underline transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-3">
                <button
                  type="button"
                  onClick={onSelectAboveCutoff}
                  className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#5b43d6] text-[11px] font-semibold transition-colors flex items-center gap-1 border border-purple-200/70"
                  title={`Select candidates with AI evaluation score >= ${cutoffScore}%`}
                >
                  <Award className="w-3 h-3 text-[#6743ee]" />
                  <span>Select Qualified (≥{cutoffScore}%)</span>
                </button>
                <span className="text-[11px] text-slate-400">
                  Select candidates below to perform bulk actions
                </span>
              </div>
            )}
          </div>

          {/* Right section: Dedicated Bulk Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            
            {/* 1. Update Stage Button with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStageDropdown(prev => !prev)}
                disabled={!hasSelection}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                  hasSelection
                    ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer ring-1 ring-purple-400/40'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={hasSelection ? "Bulk update hiring stage for all selected candidates" : "Select candidates to enable"}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Update Stage</span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>

              {showStageDropdown && hasSelection && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Bulk Move {selectedCount} to:
                  </div>
                  {(['Screening', 'Technical', 'Interview', 'Offered', 'Rejected'] as const).map((stg) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => handleStageSelect(stg)}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-50 hover:text-[#5b43d6] font-semibold flex items-center justify-between transition-colors"
                    >
                      <span>{stg}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Send Batch Email Button */}
            <button
              type="button"
              onClick={() => setShowBatchEmailModal(true)}
              disabled={!hasSelection}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                hasSelection
                  ? 'bg-gradient-to-r from-[#6743ee] to-indigo-600 hover:from-[#5637d2] hover:to-indigo-700 text-white cursor-pointer ring-1 ring-[#8a72ff]/40'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title={hasSelection ? "Draft and queue personalized AI follow-up emails for all selected" : "Select candidates to enable"}
            >
              <Mail className="w-3.5 h-3.5 text-amber-300" />
              <span>Send Batch Email</span>
            </button>

            {/* 3. Export Data Button with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportDropdown(prev => !prev)}
                disabled={!hasSelection}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
                  hasSelection
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={hasSelection ? "Export selected candidate records to CSV or JSON" : "Select candidates to enable"}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {showExportDropdown && hasSelection && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Export {selectedCount} Records:
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Download CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 font-semibold flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#6743ee]" />
                    <span>Download JSON (.json)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Bulk Advance & Reject Buttons */}
            {hasSelection && (
              <>
                <button
                  type="button"
                  onClick={handleAdvanceClick}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                  title="Bulk mark selected as Advanced"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Advance</span>
                </button>

                <button
                  type="button"
                  onClick={handleRejectClick}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                  title="Bulk mark selected as Rejected"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Reject</span>
                </button>
              </>
            )}

            {/* Compare Both (when exactly 2 candidates are checked) */}
            {selectedCount === 2 && onLaunchCompare && (
              <button
                type="button"
                onClick={() => onLaunchCompare(selectedCandidateIds[0], selectedCandidateIds[1])}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 animate-pulse"
                title="Launch head-to-head radar comparison for the 2 selected candidates"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Radars</span>
              </button>
            )}

            {/* Close / Deselect button */}
            {hasSelection && (
              <button
                type="button"
                onClick={onDeselectAll}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-0.5"
                title="Clear candidate selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Temporary Feedback Notification Toast */}
        {feedbackMessage && (
          <div className="mt-1.5 mx-auto max-w-md bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl text-center shadow-lg border border-emerald-500 flex items-center justify-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </header>

      {/* Batch AI Email Generator Modal */}
      {showBatchEmailModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setShowBatchEmailModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#6743ee] rounded-xl text-white shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Send Batch Email (AI Template Generator)</span>
                    <span className="text-[10px] bg-purple-400/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
                      {selectedCount} Selected Recipients
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Generate and queue personalized emails tailored to each candidate's specific evaluation metrics.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBatchEmailModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              
              {/* Selected Recipients Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Target Recipients ({selectedCount}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {selectedCandidates.map(c => (
                    <span 
                      key={c.candidate_id}
                      className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1.5"
                    >
                      <strong className="text-slate-900">{c.name}</strong>
                      <span className="text-[10px] text-purple-600 font-bold">({c.overall_score}%)</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchEmailType('progress');
                    setBatchReasonCategory('next_round_invitation');
                  }}
                  className={`p-3 rounded-xl border text-left font-bold transition-all ${
                    batchEmailType === 'progress'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Progression / Advancement Email</span>
                  </div>
                  <p className="text-[10px] font-normal text-slate-500 mt-1">
                    Invites candidates to next round, citing their specific verified strengths.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBatchEmailType('rejection');
                    setBatchReasonCategory('skills_gap');
                  }}
                  className={`p-3 rounded-xl border text-left font-bold transition-all ${
                    batchEmailType === 'rejection'
                      ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Constructive Rejection Email</span>
                  </div>
                  <p className="text-[10px] font-normal text-slate-500 mt-1">
                    Delivers polite, respectful feedback citing individual gaps & talent pool archiving.
                  </p>
                </button>
              </div>

              {/* Specific Reason Category */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Primary Rationale for Batch Generation:
                </label>
                <select
                  value={batchReasonCategory}
                  onChange={(e) => setBatchReasonCategory(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                >
                  {batchEmailType === 'progress' ? (
                    <>
                      <option value="next_round_invitation">Invitation to Next Interview Round</option>
                      <option value="technical_excellence">Exceptional Technical Scores & Stack Alignment</option>
                      <option value="coding_performance">Standout Coding Challenge Results</option>
                      <option value="offer_stage">Formal Offer Stage Progression</option>
                      <option value="custom">General Progression Notice</option>
                    </>
                  ) : (
                    <>
                      <option value="skills_gap">Core Skills Gap (weaves each candidate's missing skills)</option>
                      <option value="seniority_mismatch">Production Scale & Seniority Calibration</option>
                      <option value="competitive_cohort">Highly Competitive Candidate Cohort</option>
                      <option value="rubric_score_threshold">Evaluation Score Below Cutoff Threshold</option>
                      <option value="talent_pool_future">Talent Pool Archiving & Future Consideration</option>
                    </>
                  )}
                </select>
              </div>

              {/* Tone Selection */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Email Tone:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['warm', 'professional', 'constructive', 'concise'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBatchEmailTone(t)}
                      className={`p-2 rounded-lg text-[11px] capitalize border font-medium text-center transition-all ${
                        batchEmailTone === t
                          ? 'bg-purple-100 text-[#5b43d6] border-purple-300 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Additional Context or Scheduling Guidance (Optional):
                </label>
                <textarea
                  value={batchCustomNotes}
                  onChange={(e) => setBatchCustomNotes(e.target.value)}
                  placeholder="e.g. Please book your slots by end of this week..."
                  rows={2}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-slate-600 text-[11px] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#6743ee] shrink-0 mt-0.5" />
                <span>
                  <strong>Individualized AI generation:</strong> Each email is dynamically tailored with that candidate's real name, evaluated technical strengths, missing skills, and overall score ({brief?.company_name || 'Anthropic Tech'}).
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowBatchEmailModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteBatchEmail}
                disabled={isGeneratingBatch}
                className="px-5 py-2.5 bg-gradient-to-r from-[#6743ee] to-indigo-600 hover:from-[#5637d2] hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isGeneratingBatch 
                    ? `Generating ${selectedCount} Emails...` 
                    : `Generate & Queue ${selectedCount} Emails`}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
