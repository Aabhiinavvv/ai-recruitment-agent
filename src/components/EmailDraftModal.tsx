import React, { useState, useEffect } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  OutreachDraft, 
  EmailDraftType, 
  EmailDraftTone,
  FollowUpEmailResult
} from '../types';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { 
  Mail, 
  Sparkles, 
  X, 
  Check, 
  Copy, 
  Send, 
  Download, 
  PhoneCall, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Award, 
  Calendar, 
  RefreshCw,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';

interface EmailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  brief: HiringBrief | null;
  initialType?: EmailDraftType;
  onQueueDraft: (draft: OutreachDraft, reasonCategory: string) => void;
}

export const EmailDraftModal: React.FC<EmailDraftModalProps> = ({
  isOpen,
  onClose,
  candidate,
  brief,
  initialType = 'progress',
  onQueueDraft,
}) => {
  if (!isOpen || !candidate) return null;

  const [emailType, setEmailType] = useState<EmailDraftType>(initialType);
  const [reasonCategory, setReasonCategory] = useState<string>(
    initialType === 'progress' ? 'next_round_invitation' : 'skills_gap'
  );
  const [tone, setTone] = useState<EmailDraftTone>('professional');
  const [specificFeedback, setSpecificFeedback] = useState<string>('');
  const [nextRoundName, setNextRoundName] = useState<string>(
    candidate.current_round === 'coding' ? 'Technical Architecture Deep-Dive' :
    candidate.current_round === 'technical' ? 'Engineering Leadership & Culture Round' :
    'Final Alignment Conversation'
  );
  const [schedulingLink, setSchedulingLink] = useState<string>('https://calendar.google.com/calendar/u/0/r');
  const [includeNextSteps, setIncludeNextSteps] = useState<boolean>(true);
  const [includeTalentPoolNote, setIncludeTalentPoolNote] = useState<boolean>(true);
  const [includeRecruiterNotes, setIncludeRecruiterNotes] = useState<boolean>(false);

  // Output draft state
  const [draftResult, setDraftResult] = useState<FollowUpEmailResult | null>(null);
  const [editableSubject, setEditableSubject] = useState<string>('');
  const [editableBody, setEditableBody] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showCallScript, setShowCallScript] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [queuedFeedback, setQueuedFeedback] = useState<boolean>(false);

  // Reset or initialize when modal opens or candidate changes
  useEffect(() => {
    const isReject = candidate.decision_status?.includes('Not proceeding') || candidate.recruiter_decision === 'reject';
    const chosenType = initialType || (isReject ? 'rejection' : 'progress');
    setEmailType(chosenType);
    setReasonCategory(chosenType === 'progress' ? 'next_round_invitation' : 'skills_gap');
    setSpecificFeedback('');
    setQueuedFeedback(false);
  }, [candidate.candidate_id, initialType]);

  // Core generator function
  const handleGenerate = (typeOverride?: EmailDraftType, categoryOverride?: string) => {
    setIsGenerating(true);
    const activeType = typeOverride || emailType;
    const activeCategory = categoryOverride || reasonCategory;

    setTimeout(() => {
      const result = recruitmentAgent.draftFollowUpEmail({
        candidate,
        jobTitle: brief?.job_title || candidate.role || 'Software Engineer',
        companyName: brief?.company_name || 'Anthropic Tech',
        emailType: activeType,
        reasonCategory: activeCategory,
        specificFeedback,
        tone,
        nextRoundName,
        schedulingLink,
        includeNextSteps,
        includeTalentPoolNote,
        recruiterNotes: includeRecruiterNotes ? candidate.private_notes : undefined
      });

      setDraftResult(result);
      setEditableSubject(result.subject);
      setEditableBody(result.body);
      setIsGenerating(false);
    }, 150);
  };

  // Run generation automatically when relevant params change
  useEffect(() => {
    handleGenerate();
  }, [
    candidate.candidate_id, 
    emailType, 
    reasonCategory, 
    tone, 
    includeNextSteps, 
    includeTalentPoolNote,
    includeRecruiterNotes
  ]);

  const handleTypeChange = (newType: EmailDraftType) => {
    setEmailType(newType);
    const defaultCat = newType === 'progress' ? 'next_round_invitation' : 'skills_gap';
    setReasonCategory(defaultCat);
    handleGenerate(newType, defaultCat);
  };

  const handleSelectSkillTag = (skill: string) => {
    setSpecificFeedback(prev => {
      if (!prev) return skill;
      if (prev.includes(skill)) return prev;
      return `${prev}, ${skill}`;
    });
  };

  const handleCopyToClipboard = async () => {
    const fullText = `Subject: ${editableSubject}\n\n${editableBody}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadTxt = () => {
    const text = `To: ${candidate.email}\nCandidate: ${candidate.name} (${candidate.candidate_id})\nType: ${emailType.toUpperCase()}\nSubject: ${editableSubject}\n\n${editableBody}\n\n--------------------\nRECRUITER PHONE SCRIPT:\n${draftResult?.call_script || 'N/A'}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${candidate.candidate_id.toLowerCase()}-${emailType}-email-draft.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePushToQueue = () => {
    const newDraft: OutreachDraft = {
      id: `draft-${Date.now()}`,
      type: emailType,
      candidate_id: candidate.candidate_id,
      candidate_name: candidate.name,
      candidate_email: candidate.email,
      candidate_phone: candidate.phone,
      subject: editableSubject,
      body: editableBody,
      call_script: draftResult?.call_script || '',
      availability: emailType === 'progress' ? 'Scheduled via calendar link' : 'N/A',
      status: 'Draft — not sent or scheduled'
    };

    onQueueDraft(newDraft, reasonCategory);
    setQueuedFeedback(true);
    setTimeout(() => {
      setQueuedFeedback(false);
      onClose();
    }, 1200);
  };

  const progressReasonOptions = [
    { id: 'next_round_invitation', label: 'Invitation to Next Interview Round', desc: `Advance to ${nextRoundName}` },
    { id: 'technical_excellence', label: 'Exceptional Technical Score & Stack Fit', desc: `Scores ${candidate.overall_score}% on rubric` },
    { id: 'coding_performance', label: 'Outstanding Coding Assessment Results', desc: 'Exceeded algorithmic & quality bar' },
    { id: 'offer_stage', label: 'Formal Offer Recommendation & Discussion', desc: 'Unanimous hiring committee pass' },
    { id: 'custom', label: 'Custom Progression Reason', desc: 'Provide recruiter-specific context below' }
  ];

  const rejectionReasonOptions = [
    { id: 'skills_gap', label: 'Core Technical Skills Gap', desc: candidate.missing_skills?.length > 0 ? `Missing: ${candidate.missing_skills.slice(0, 3).join(', ')}` : 'Specific technology divergence' },
    { id: 'seniority_mismatch', label: 'Seniority & Production Scale Requirement', desc: 'Role calls for deeper staff/lead tenure' },
    { id: 'competitive_cohort', label: 'Highly Competitive Applicant Cohort', desc: 'Met evaluation standard, but cohort was exceptionally qualified' },
    { id: 'rubric_score_threshold', label: 'Rubric Score Below Qualification Cutoff', desc: `Scored ${candidate.overall_score}%, below role threshold` },
    { id: 'talent_pool_future', label: 'Talent Pool Archiving & Future Consideration', desc: 'Warm rejection with active talent community invite' },
    { id: 'custom', label: 'Custom Rejection Feedback', desc: 'Provide recruiter-specific context below' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-[#6743ee] to-[#8a72ff] rounded-xl shadow-md text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Automated AI Follow-Up Email Generator
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  emailType === 'progress' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {emailType === 'progress' ? 'Progression Mode' : 'Constructive Rejection Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>Candidate: <strong className="text-white font-semibold">{candidate.name}</strong></span>
                <span>•</span>
                <span className="font-mono">{candidate.email}</span>
                <span>•</span>
                <span>Score: <strong className="text-purple-300">{candidate.overall_score}%</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content with split view */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
          
          {/* Left Column: Configuration Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* 1. Email Type Toggle */}
            <div className="p-1 bg-slate-200/80 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleTypeChange('progress')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  emailType === 'progress'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Advance / Progress</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('rejection')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  emailType === 'rejection'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Polite Rejection</span>
              </button>
            </div>

            {/* 2. Specific Reason Selector */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Select Specific Reason:</span>
                <span className="text-[10px] text-purple-600 font-semibold">AI Powered</span>
              </label>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(emailType === 'progress' ? progressReasonOptions : rejectionReasonOptions).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReasonCategory(opt.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                      reasonCategory === opt.id
                        ? emailType === 'progress'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold ring-1 ring-emerald-300'
                          : 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{opt.label}</span>
                      {reasonCategory === opt.id && <Check className="w-3.5 h-3.5 shrink-0 text-current" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Chips: Skills to Highlight or Mention */}
            {emailType === 'rejection' && candidate.missing_skills?.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Click missing skill to cite in rejection reason:
                </span>
                <div className="flex flex-wrap gap-1">
                  {candidate.missing_skills.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSelectSkillTag(skill)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{skill}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {emailType === 'progress' && candidate.strengths?.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Click strength to emphasize in progress email:
                </span>
                <div className="flex flex-wrap gap-1">
                  {candidate.strengths.slice(0, 4).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSelectSkillTag(st)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{st}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Tone Selector */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Email Tone:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'warm', label: 'Warm & Encouraging' },
                  { id: 'professional', label: 'Professional & Direct' },
                  { id: 'constructive', label: 'Constructive & Mentoring' },
                  { id: 'concise', label: 'Concise & Executive' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id as EmailDraftTone)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-medium text-center border transition-all ${
                      tone === t.id
                        ? 'bg-purple-100 text-[#5b43d6] border-purple-300 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Custom Specific Feedback / Notes Input */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Specific Feedback / Custom Context:</span>
                <span className="text-[10px] text-slate-400">Optional</span>
              </label>
              <textarea
                value={specificFeedback}
                onChange={(e) => setSpecificFeedback(e.target.value)}
                placeholder={emailType === 'progress' 
                  ? "e.g., We particularly loved your solution for the token bucket rate limiter..."
                  : "e.g., Need hands-on experience deploying Kubernetes clusters at 50k QPS..."}
                rows={2}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>

            {/* 5. Additional Options */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
              {emailType === 'progress' && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeNextSteps}
                      onChange={(e) => setIncludeNextSteps(e.target.checked)}
                      className="accent-[#6743ee]"
                    />
                    <span>Include Next Steps & Scheduling Link</span>
                  </label>

                  {includeNextSteps && (
                    <div className="space-y-1.5 pl-5 pt-1">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block">Next Round Title:</label>
                        <input
                          type="text"
                          value={nextRoundName}
                          onChange={(e) => setNextRoundName(e.target.value)}
                          className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block">Calendar Booking Link:</label>
                        <input
                          type="text"
                          value={schedulingLink}
                          onChange={(e) => setSchedulingLink(e.target.value)}
                          className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {emailType === 'rejection' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTalentPoolNote}
                    onChange={(e) => setIncludeTalentPoolNote(e.target.checked)}
                    className="accent-[#6743ee]"
                  />
                  <span>Include Talent Community Archiving Note</span>
                </label>
              )}

              {candidate.private_notes && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRecruiterNotes}
                    onChange={(e) => setIncludeRecruiterNotes(e.target.checked)}
                    className="accent-[#6743ee]"
                  />
                  <span>Incorporate Saved Recruiter Notes</span>
                </label>
              )}
            </div>

            {/* Regenerate Trigger Button */}
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#6743ee] to-indigo-600 hover:from-[#5637d2] hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Drafting with AI...' : 'Regenerate Draft with AI'}</span>
            </button>
          </div>

          {/* Right Column: Generated Email Preview & Polish (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* Subject Line & Suggestions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#6743ee]" />
                  <span>Subject Line</span>
                </label>
                <span className="text-[10px] text-slate-400">Click any suggested subject to apply</span>
              </div>

              <input
                type="text"
                value={editableSubject}
                onChange={(e) => setEditableSubject(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />

              {draftResult?.suggested_subjects && draftResult.suggested_subjects.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    AI Suggested Alternatives:
                  </span>
                  <div className="space-y-1">
                    {draftResult.suggested_subjects.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditableSubject(s)}
                        className={`w-full text-left px-2.5 py-1 rounded text-[11px] truncate transition-colors ${
                          editableSubject === s 
                            ? 'bg-purple-100 text-[#5b43d6] font-bold border border-purple-200' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                        }`}
                      >
                        • {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email Body Editor */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Personalized Email Body</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {editableBody.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <textarea
                value={editableBody}
                onChange={(e) => setEditableBody(e.target.value)}
                rows={13}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#6743ee] flex-1 resize-y"
              />
            </div>

            {/* Cited Objective Reasons Banner */}
            {draftResult?.reasons_cited && draftResult.reasons_cited.length > 0 && (
              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#5b43d6] uppercase tracking-wider flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Objective Criteria Cited in this AI Draft:
                </span>
                <ul className="text-[11px] text-slate-700 space-y-0.5 list-disc list-inside">
                  {draftResult.reasons_cited.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Accompanying Recruiter Phone Call Script Accordion */}
            {draftResult?.call_script && (
              <details className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-2xs">
                <summary className="font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View 30-Second Telephone Touchpoint Script</span>
                </summary>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 mt-2 text-slate-700 italic">
                  "{draftResult.call_script}"
                </div>
              </details>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Email'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              title="Download text file"
            >
              <Download className="w-4 h-4" />
              <span>Download (.txt)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handlePushToQueue}
              disabled={queuedFeedback}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs ${
                queuedFeedback
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#6743ee] hover:bg-[#5637d2] text-white'
              }`}
            >
              {queuedFeedback ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Queue!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Save to Outreach Queue & Log Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
