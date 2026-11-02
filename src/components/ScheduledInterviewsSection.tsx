import React, { useState } from 'react';
import { ScheduledInterview, Candidate } from '../types';
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Plus, 
  CalendarCheck, 
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  downloadICSFile, 
  generateGoogleCalendarUrl, 
  formatTime12h, 
  formatTimezoneDual 
} from '../services/interviewSchedulerService';

interface ScheduledInterviewsSectionProps {
  scheduledInterviews: ScheduledInterview[];
  onOpenScheduler: (candidate?: Candidate) => void;
  candidates: Candidate[];
}

export const ScheduledInterviewsSection: React.FC<ScheduledInterviewsSectionProps> = ({
  scheduledInterviews,
  onOpenScheduler,
  candidates,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<string | null>(null);

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLinkIndex(id);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  if (scheduledInterviews.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6743ee] shrink-0 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Interview Scheduler & Shared Calendar</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  0 Scheduled
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate AI-optimized time slots based on panel availability and dispatch calendar invitations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenScheduler(candidates[0])}
            className="px-3.5 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule New Interview</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Upcoming Scheduled Interviews
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {scheduledInterviews.length} {scheduledInterviews.length === 1 ? 'Session' : 'Sessions'} Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Calendar invites dispatched with Google Meet links and multi-panel shared availability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onOpenScheduler(candidates[0])}
            className="px-3 py-1.5 bg-gradient-to-r from-[#6743ee] to-teal-600 hover:from-[#5637d2] hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Another</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse list' : 'Expand list'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* List of interviews */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {scheduledInterviews.map((interview) => {
            const dualTime = formatTimezoneDual(interview.startTime, interview.durationMinutes);
            const isCopied = copiedLinkIndex === interview.id;

            return (
              <div 
                key={interview.id} 
                className="p-4 bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200 hover:border-purple-300 transition-all shadow-2xs space-y-3"
              >
                {/* Candidate name & status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-slate-900 text-sm">{interview.candidateName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({interview.candidateId})</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {interview.status}
                  </span>
                </div>

                {/* Round & Date */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#5b43d6]">
                    {interview.roundName} ({interview.durationMinutes} min)
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{interview.dateStr}</span>
                    <span className="text-slate-300">·</span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatTime12h(interview.startTime)} – {formatTime12h(interview.endTime)} EST</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {dualTime}
                  </div>
                </div>

                {/* Panel Interviewers */}
                <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium truncate">
                    Panel: <strong className="text-slate-800">{interview.panelInterviewerNames.join(', ')}</strong>
                  </span>
                </div>

                {/* Actions row */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Google Meet join button */}
                    <a
                      href={interview.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors shadow-2xs text-[11px]"
                    >
                      <Video className="w-3 h-3" />
                      <span>Join Meet</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(interview.meetingLink, interview.id)}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                      title="Copy meeting link"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Add to Google Calendar */}
                    <a
                      href={generateGoogleCalendarUrl(interview)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
                      title="Add to Google Calendar"
                    >
                      <Calendar className="w-3 h-3 text-[#6743ee]" />
                      <span>Google Cal</span>
                    </a>

                    {/* Download .ics */}
                    <button
                      type="button"
                      onClick={() => downloadICSFile(interview)}
                      className="p-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs"
                      title="Download .ics Calendar Invite"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
