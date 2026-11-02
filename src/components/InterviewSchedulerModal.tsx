import React, { useState, useEffect, useMemo } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  InterviewerMember, 
  AISlotSuggestion, 
  ScheduledInterview, 
  RoundType, 
  InterviewFormatType,
  AuditEvent 
} from '../types';
import { 
  DEFAULT_INTERVIEWERS, 
  ROUND_CONFIGS, 
  generateAISlotSuggestions, 
  generateGoogleCalendarUrl, 
  downloadICSFile, 
  generateMeetingLink, 
  generateInterviewEmailConfirmation,
  formatTime12h,
  formatTimezoneDual
} from '../services/interviewSchedulerService';
import { 
  X, 
  Calendar, 
  Clock, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Video, 
  Send, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  ChevronRight, 
  ArrowRight, 
  CalendarCheck, 
  RotateCcw, 
  Layers, 
  ShieldCheck, 
  Flame, 
  Compass, 
  Award,
  Link2
} from 'lucide-react';

interface InterviewSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  candidatesList?: Candidate[];
  onSelectCandidate?: (candidate: Candidate) => void;
  brief: HiringBrief | null;
  onConfirmSchedule: (scheduledInterview: ScheduledInterview) => void;
}

export const InterviewSchedulerModal: React.FC<InterviewSchedulerModalProps> = ({
  isOpen,
  onClose,
  candidate,
  candidatesList = [],
  onSelectCandidate,
  brief,
  onConfirmSchedule,
}) => {
  // Wizard steps: 1 = Config & Panel, 2 = AI Slot Selection, 3 = Confirmation & Dispatch
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Selected candidate
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidate.candidate_id);
  const activeCandidate = useMemo(() => {
    return candidatesList.find(c => c.candidate_id === selectedCandidateId) || candidate;
  }, [candidatesList, selectedCandidateId, candidate]);

  // Interview round configuration
  const [selectedRoundKey, setSelectedRoundKey] = useState<RoundType>(
    candidate.current_round === 'hr' ? 'hr' : candidate.current_round === 'technical' ? 'technical' : 'coding'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [formatType, setFormatType] = useState<InterviewFormatType>('video_meet');
  const [customMeetingLink, setCustomMeetingLink] = useState<string>(() => generateMeetingLink(candidate.name));

  // Panel Interviewers selection
  const [interviewers, setInterviewers] = useState<InterviewerMember[]>(DEFAULT_INTERVIEWERS);
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>(['int-2']); // Default to David Chen (Tech Lead)

  // Custom date/time picker option vs AI Slot
  const [isCustomTimeOverride, setIsCustomTimeOverride] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    return tomorrow.toISOString().split('T')[0];
  });
  const [customTime, setCustomTime] = useState<string>('14:00');

  // AI-suggested slots
  const [selectedSlot, setSelectedSlot] = useState<AISlotSuggestion | null>(null);
  const [isGeneratingSlots, setIsGeneratingSlots] = useState<boolean>(false);
  const [showCalendarMatrix, setShowCalendarMatrix] = useState<boolean>(false);

  // Completed interview object
  const [confirmedInterview, setConfirmedInterview] = useState<ScheduledInterview | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedEmailText, setCopiedEmailText] = useState<boolean>(false);
  const [autoSendEmailNotice, setAutoSendEmailNotice] = useState<boolean>(true);

  // Sync when candidate prop changes
  useEffect(() => {
    setSelectedCandidateId(candidate.candidate_id);
    setCustomMeetingLink(generateMeetingLink(candidate.name));
  }, [candidate]);

  // Round config details
  const activeRoundConfig = useMemo(() => {
    return ROUND_CONFIGS.find(r => r.key === selectedRoundKey) || ROUND_CONFIGS[0];
  }, [selectedRoundKey]);

  // Auto-set duration and recommended interviewers when round changes
  const handleSelectRound = (roundKey: RoundType) => {
    setSelectedRoundKey(roundKey);
    const config = ROUND_CONFIGS.find(r => r.key === roundKey);
    if (config) {
      setDurationMinutes(config.defaultDuration);
      setSelectedInterviewerIds(config.recommendedInterviewers);
    }
  };

  // Toggle panel member
  const handleToggleInterviewer = (id: string) => {
    setSelectedInterviewerIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Filter selected panel members
  const selectedPanelMembers = useMemo(() => {
    return interviewers.filter(i => selectedInterviewerIds.includes(i.id));
  }, [interviewers, selectedInterviewerIds]);

  // Generate AI suggested slots
  const aiSlotSuggestions = useMemo(() => {
    if (selectedPanelMembers.length === 0) return [];
    return generateAISlotSuggestions(selectedPanelMembers, durationMinutes, 5);
  }, [selectedPanelMembers, durationMinutes]);

  // Set default selected slot on load or change
  useEffect(() => {
    if (aiSlotSuggestions.length > 0 && !selectedSlot) {
      setSelectedSlot(aiSlotSuggestions[0]);
    }
  }, [aiSlotSuggestions, selectedSlot]);

  // Re-generate slots animation
  const handleRefreshSlots = () => {
    setIsGeneratingSlots(true);
    setTimeout(() => {
      setIsGeneratingSlots(false);
      if (aiSlotSuggestions.length > 0) {
        setSelectedSlot(aiSlotSuggestions[0]);
      }
    }, 350);
  };

  // Dispatch and confirm booking
  const handleDispatchCalendarInvite = () => {
    const dateStr = isCustomTimeOverride ? customDate : selectedSlot?.dateStr || customDate;
    const startTime = isCustomTimeOverride ? customTime : selectedSlot?.startTime || '14:00';
    const [h, m] = startTime.split(':').map(Number);
    const endMins = h * 60 + m + durationMinutes;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const scheduled: ScheduledInterview = {
      id: `interview-${Date.now()}`,
      candidateId: activeCandidate.candidate_id,
      candidateName: activeCandidate.name,
      candidateEmail: activeCandidate.email,
      candidatePhone: activeCandidate.phone,
      jobTitle: brief?.job_title || activeCandidate.role || 'AI/ML Engineer',
      companyName: brief?.company_name || 'Anthropic Tech',
      roundName: activeRoundConfig.name,
      roundType: selectedRoundKey,
      durationMinutes,
      format: formatType,
      meetingLink: customMeetingLink,
      dateStr,
      startTime,
      endTime,
      timezone: 'America/New_York (EST)',
      panelInterviewerIds: selectedInterviewerIds,
      panelInterviewerNames: selectedPanelMembers.map(m => m.name),
      calendarInviteSent: autoSendEmailNotice,
      calendarInviteSentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    };

    setConfirmedInterview(scheduled);
    onConfirmSchedule(scheduled);
    setCurrentStep(3);
  };

  const handleCopyMeetingLink = () => {
    navigator.clipboard.writeText(customMeetingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmailText = () => {
    if (!confirmedInterview) return;
    const { subject, body } = generateInterviewEmailConfirmation(confirmedInterview);
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopiedEmailText(true);
    setTimeout(() => setCopiedEmailText(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6743ee] shrink-0 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  AI Interview Scheduler & Calendar Invites
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] border border-purple-200">
                  Shared Team Availability
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate AI-suggested time slots based on the hiring team's calendars and send automated calendar invites.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Step indicators */}
            <div className="flex items-center gap-1.5 text-xs font-semibold mr-2">
              <span className={`px-2 py-0.5 rounded-md ${currentStep === 1 ? 'bg-[#6743ee] text-white font-bold' : 'bg-slate-200 text-slate-600'}`}>
                1. Config
              </span>
              <span className="text-slate-300">›</span>
              <span className={`px-2 py-0.5 rounded-md ${currentStep === 2 ? 'bg-[#6743ee] text-white font-bold' : 'bg-slate-200 text-slate-600'}`}>
                2. AI Slots
              </span>
              <span className="text-slate-300">›</span>
              <span className={`px-2 py-0.5 rounded-md ${currentStep === 3 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-600'}`}>
                3. Dispatch
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              title="Close scheduler (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: INTERVIEW SETUP & PANEL SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Candidate Info Selector Strip */}
              <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/60 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#6743ee] text-white font-black text-sm flex items-center justify-center shadow-2xs">
                      {activeCandidate.overall_score}%
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{activeCandidate.name}</span>
                      <span className="text-[11px] text-slate-500">{activeCandidate.email} · {activeCandidate.candidate_id}</span>
                    </div>
                  </div>

                  {candidatesList.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Switch Candidate:</span>
                      <select
                        value={selectedCandidateId}
                        onChange={(e) => {
                          setSelectedCandidateId(e.target.value);
                          const target = candidatesList.find(c => c.candidate_id === e.target.value);
                          if (target && onSelectCandidate) onSelectCandidate(target);
                        }}
                        className="text-xs font-bold bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                      >
                        {candidatesList.map(c => (
                          <option key={c.candidate_id} value={c.candidate_id}>
                            {c.name} ({c.overall_score}%) — {c.candidate_id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-purple-100">
                    <span className="text-slate-400 text-[10px] block">Target Role</span>
                    <span className="font-bold text-slate-800 truncate block">{brief?.job_title || activeCandidate.role}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-purple-100">
                    <span className="text-slate-400 text-[10px] block">Technical Competency</span>
                    <span className="font-bold text-[#5b43d6] block">{activeCandidate.dimension_scores?.technical}% Match</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-purple-100">
                    <span className="text-slate-400 text-[10px] block">Current Stage</span>
                    <span className="font-bold text-slate-800 block">{activeCandidate.stage || 'Screening'}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-purple-100">
                    <span className="text-slate-400 text-[10px] block">Candidate Timezone</span>
                    <span className="font-bold text-slate-800 block">Eastern / Pacific</span>
                  </div>
                </div>
              </div>

              {/* Round Selection & Duration */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>Select Interview Round & Format:</span>
                  <span className="text-[11px] text-slate-500 font-normal">Pre-configured evaluation agendas</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ROUND_CONFIGS.map((round) => {
                    const isSelected = selectedRoundKey === round.key;
                    return (
                      <div
                        key={round.key}
                        onClick={() => handleSelectRound(round.key)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50/80 border-[#6743ee] ring-2 ring-[#6743ee]/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900">{round.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-[#6743ee] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {round.defaultDuration}m
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {round.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Duration and Format Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Interview Duration
                  </label>
                  <div className="flex items-center gap-2">
                    {[30, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          durationMinutes === mins
                            ? 'bg-[#6743ee] text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Meeting Format & Virtual Room
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormatType('video_meet')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        formatType === 'video_meet'
                          ? 'bg-[#00897b] text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Google Meet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatType('video_zoom')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        formatType === 'video_zoom'
                          ? 'bg-[#2d8cff] text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Zoom Meeting</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Meeting Link input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Auto-Generated Video Conference Link</span>
                  <span className="text-[10px] text-emerald-600 font-medium">Ready for calendar invite</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Link2 className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={customMeetingLink}
                      onChange={(e) => setCustomMeetingLink(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMeetingLink}
                    className="px-3 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Hiring Team Shared Panel Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-900 block">
                      Hiring Team Panel Interviewers ({selectedInterviewerIds.length} Selected)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      AI will analyze their shared calendars to find mutual openings.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCalendarMatrix(prev => !prev)}
                    className="text-xs font-bold text-[#6743ee] hover:underline flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{showCalendarMatrix ? 'Hide Calendar Matrix' : 'Inspect Team Availability Matrix'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {interviewers.map((member) => {
                    const isSelected = selectedInterviewerIds.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        onClick={() => handleToggleInterviewer(member.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-purple-50/50 border-[#6743ee]/80 ring-1 ring-[#6743ee]/30 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 accent-[#6743ee] rounded cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">{member.name}</span>
                            <span className="text-[10px] font-semibold text-slate-500 font-mono">
                              {member.timezone.split(' ')[0].replace('America/', '')}
                            </span>
                          </div>
                          <span className="text-[11px] text-purple-800 font-medium block truncate">
                            {member.role}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>{member.email}</span>
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">
                              {member.workingHours.start}–{member.workingHours.end}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Team Calendar Matrix Drawer */}
                {showCalendarMatrix && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-fadeIn">
                    <span className="text-xs font-bold text-slate-900 block">
                      Hiring Team Calendar Commitments (Next 5 Days)
                    </span>
                    <div className="space-y-2 text-xs">
                      {selectedPanelMembers.map(m => (
                        <div key={m.id} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{m.name} ({m.role.split('/')[0]})</span>
                            <span className="text-[10px] text-slate-500">{m.busySlots.length} scheduled blocks</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.busySlots.slice(0, 4).map((s, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                Day +{s.dayOffset}: {s.startTime}–{s.endTime} ({s.title})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: AI-SUGGESTED TIME SLOTS */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-teal-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900">
                      AI Generated {aiSlotSuggestions.length} Mutual Time Slots
                    </span>
                    <p className="text-[11px] text-slate-600">
                      Checked across {selectedPanelMembers.length} hiring team calendars for {durationMinutes}-min session.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshSlots}
                    disabled={isGeneratingSlots}
                    className="px-2.5 py-1 bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/70 rounded-lg font-semibold flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3 h-3 ${isGeneratingSlots ? 'animate-spin' : ''}`} />
                    <span>Recalculate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomTimeOverride(prev => !prev)}
                    className="px-2.5 py-1 bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold transition-all shadow-2xs"
                  >
                    {isCustomTimeOverride ? 'Use AI Slots' : 'Custom Slot'}
                  </button>
                </div>
              </div>

              {/* AI Slot Suggestions Grid */}
              {!isCustomTimeOverride ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiSlotSuggestions.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id;
                      const dualTime = formatTimezoneDual(slot.startTime, slot.durationMinutes);

                      return (
                        <div
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                            isSelected
                              ? 'bg-purple-50/70 border-[#6743ee] ring-2 ring-[#6743ee]/30 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Top Row: Date & Match Score */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#6743ee]" />
                              <span className="text-xs font-bold text-slate-900">{slot.dayLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {slot.matchScore}% Match
                              </span>
                            </div>
                          </div>

                          {/* Time & Recommendation Tag */}
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)} EST
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {dualTime}
                            </div>
                          </div>

                          {/* Recommendation Tag Pill */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-[#5b43d6] flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-500" />
                              {slot.recommendationTag}
                            </span>
                            <span className="text-[11px] text-slate-400">·</span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              All {selectedPanelMembers.length} panel members 100% free
                            </span>
                          </div>

                          {/* AI Rationale */}
                          <p className="text-[11px] text-slate-600 italic bg-white/80 p-2 rounded-lg border border-purple-100/70">
                            "{slot.rationale}"
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {aiSlotSuggestions.length === 0 && (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                      <span className="text-xs font-bold text-slate-800 block">No mutual openings found</span>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        The selected panel members have overlapping commitments. Try unselecting 1 panel member or use the custom slot selector below.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Custom Time Slot Selector */
                <div className="p-4 bg-white rounded-xl border border-purple-200 space-y-4 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#6743ee]" />
                    <span className="text-xs font-bold text-slate-900">Set Custom Date and Time</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Interview Date</label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time (EST)</label>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Custom slot selected: {customDate} at {formatTime12h(customTime)} EST ({durationMinutes} minutes)
                  </p>
                </div>
              )}

              {/* Selected Slot Summary Card */}
              {(selectedSlot || isCustomTimeOverride) && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950 block">
                        Selected Slot: {isCustomTimeOverride ? customDate : selectedSlot?.dayLabel} at {formatTime12h(isCustomTimeOverride ? customTime : selectedSlot?.startTime || '')} EST
                      </span>
                      <span className="text-[11px] text-emerald-800">
                        {durationMinutes} min session · Google Meet room prepared · {selectedPanelMembers.length} panel members confirmed
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-all self-end sm:self-auto"
                  >
                    <span>Proceed to Dispatch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DISPATCH CALENDAR INVITE & CONFIRMATION */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {!confirmedInterview ? (
                /* Pre-Dispatch Review */
                <div className="space-y-5">
                  <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-[#6743ee]" />
                        <span className="text-xs font-bold text-slate-900">Calendar Event Preview</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5b43d6]">
                        Ready to Dispatch
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Candidate</span>
                          <span className="font-bold text-slate-900">{activeCandidate.name} ({activeCandidate.email})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Interview Round</span>
                          <span className="font-bold text-[#5b43d6]">{activeRoundConfig.name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Scheduled Date & Time</span>
                          <span className="font-bold text-slate-900">
                            {isCustomTimeOverride ? customDate : selectedSlot?.dateStr} · {formatTime12h(isCustomTimeOverride ? customTime : selectedSlot?.startTime || '')} EST ({durationMinutes} mins)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Video Meeting Room</span>
                          <span className="font-bold text-emerald-700 font-mono truncate block">{customMeetingLink}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-purple-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Invited Interview Panel</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selectedPanelMembers.map(m => (
                            <span key={m.id} className="px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-900 font-semibold text-[11px]">
                              {m.name} ({m.role.split('/')[0]})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Automation Options */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <span className="font-bold text-slate-900 block">Dispatch Automations:</span>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoSendEmailNotice}
                        onChange={(e) => setAutoSendEmailNotice(e.target.checked)}
                        className="accent-[#6743ee] rounded"
                      />
                      <span>Automatically dispatch calendar invite email and agenda to candidate ({activeCandidate.email})</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="accent-[#6743ee] rounded"
                      />
                      <span>Advance candidate stage to "Interview" and log audit trail event</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-3 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                    >
                      ← Back to Slot Selection
                    </button>

                    <button
                      type="button"
                      onClick={handleDispatchCalendarInvite}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#6743ee] to-teal-600 hover:from-[#5637d2] hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Calendar Invite & Confirm Booking</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Post-Dispatch Success Screen */
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3 shadow-2xs">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xs">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-base">
                        Interview Confirmed & Calendar Invites Dispatched!
                      </h4>
                      <p className="text-xs text-emerald-800 max-w-lg mx-auto mt-1">
                        Calendar invitations have been prepared for {confirmedInterview.candidateName} and {confirmedInterview.panelInterviewerNames.length} panel interviewers for {confirmedInterview.dateStr} at {formatTime12h(confirmedInterview.startTime)} EST.
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Add to Google Calendar */}
                    <a
                      href={generateGoogleCalendarUrl(confirmedInterview)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all"
                    >
                      <Calendar className="w-4 h-4 text-[#6743ee]" />
                      <span>Add to Google Calendar</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>

                    {/* Download .ics file */}
                    <button
                      type="button"
                      onClick={() => downloadICSFile(confirmedInterview)}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Download .ics Calendar File</span>
                    </button>

                    {/* Copy Email text */}
                    <button
                      type="button"
                      onClick={handleCopyEmailText}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all"
                    >
                      {copiedEmailText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-purple-600" />}
                      <span>{copiedEmailText ? 'Copied Email Text!' : 'Copy Email Confirmation'}</span>
                    </button>
                  </div>

                  {/* Confirmation Details Card */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 block">Meeting & Dial-in Credentials:</span>
                    <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                      <div>Video Link: <a href={confirmedInterview.meetingLink} target="_blank" rel="noreferrer" className="text-[#6743ee] underline">{confirmedInterview.meetingLink}</a></div>
                      <div>Format: {confirmedInterview.format.replace('_', ' ').toUpperCase()}</div>
                      <div>Panel: {confirmedInterview.panelInterviewerNames.join(', ')}</div>
                      <div>Candidate: {confirmedInterview.candidateName} ({confirmedInterview.candidateEmail})</div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
                    >
                      Done & Return to Workflow
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls (when step 1 or 2) */}
        {currentStep < 3 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            {currentStep === 1 ? (
              <span className="text-slate-500">
                Step 1 of 3: Select interview round and panel interviewers
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold"
              >
                ← Back to Config
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>

              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <span>Generate AI Slots</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!selectedSlot && !isCustomTimeOverride}
                  className="px-4 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <span>Next: Review & Dispatch</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
