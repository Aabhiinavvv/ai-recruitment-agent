import React, { useState, useMemo } from 'react';
import { OutreachDraft, Candidate, HiringBrief } from '../types';
import { recruitmentAgent } from '../services/recruitmentAgent';
import {
  Mail,
  Clock,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  Download,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PhoneCall,
  Eye,
  Trash2,
  Filter,
} from 'lucide-react';

interface OutreachQueueSectionProps {
  outreachQueue: OutreachDraft[];
  setOutreachQueue: React.Dispatch<React.SetStateAction<OutreachDraft[]>>;
  candidates: Candidate[];
  brief: HiringBrief | null;
  onInspectCandidate?: (candidateId: string) => void;
  appendAudit: (actor: string, action: string, subject: string) => void;
}

export const OutreachQueueSection: React.FC<OutreachQueueSectionProps> = ({
  outreachQueue,
  setOutreachQueue,
  candidates,
  brief,
  onInspectCandidate,
  appendAudit,
}) => {
  // Global HR Default Follow-Up SLA window (default: 3 days)
  const [globalReminderDays, setGlobalReminderDays] = useState<number>(3);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'waiting' | 'responded' | 'drafts'>('all');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper to compute follow-up status for any draft
  const getDraftReminderStatus = (draft: OutreachDraft) => {
    const thresholdDays = draft.reminder_days ?? globalReminderDays;
    const isResponded = draft.response_status === 'responded';
    const isSent = draft.status === 'Sent / Dispatched' || Boolean(draft.sent_at);

    // Compute days elapsed since sent
    let daysSinceSent = 0;
    if (draft.sent_at) {
      const sentTime = new Date(draft.sent_at).getTime();
      const now = Date.now();
      daysSinceSent = Math.max(0, Math.floor((now - sentTime) / (1000 * 60 * 60 * 24)));
    } else if (isSent) {
      // Default to 1 day if marked sent without exact timestamp
      daysSinceSent = 1;
    }

    const isOverdue = isSent && !isResponded && daysSinceSent >= thresholdDays;
    const daysOverdue = Math.max(0, daysSinceSent - thresholdDays);
    const daysRemaining = Math.max(0, thresholdDays - daysSinceSent);

    return {
      thresholdDays,
      daysSinceSent,
      isSent,
      isResponded,
      isOverdue,
      daysOverdue,
      daysRemaining,
    };
  };

  // Aggregated counts for filter pills & badges
  const summary = useMemo(() => {
    let overdueCount = 0;
    let waitingCount = 0;
    let respondedCount = 0;
    let draftsCount = 0;

    outreachQueue.forEach((d) => {
      const status = getDraftReminderStatus(d);
      if (status.isOverdue) overdueCount++;
      else if (status.isSent && !status.isResponded) waitingCount++;
      else if (status.isResponded) respondedCount++;
      else draftsCount++;
    });

    return {
      total: outreachQueue.length,
      overdueCount,
      waitingCount,
      respondedCount,
      draftsCount,
    };
  }, [outreachQueue, globalReminderDays]);

  // Filtered list
  const filteredQueue = useMemo(() => {
    return outreachQueue.filter((draft) => {
      const status = getDraftReminderStatus(draft);
      if (activeFilter === 'overdue') return status.isOverdue;
      if (activeFilter === 'waiting') return status.isSent && !status.isResponded && !status.isOverdue;
      if (activeFilter === 'responded') return status.isResponded;
      if (activeFilter === 'drafts') return !status.isSent && !status.isResponded;
      return true;
    });
  }, [outreachQueue, activeFilter, globalReminderDays]);

  // Handler: Update candidate per-draft reminder threshold
  const handleUpdateDraftReminderDays = (draftId: string, days: number) => {
    const validDays = Math.max(1, Math.min(30, days));
    setOutreachQueue((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, reminder_days: validDays } : d))
    );
    const draft = outreachQueue.find((d) => d.id === draftId);
    showToast(`Updated reminder threshold to ${validDays} day${validDays > 1 ? 's' : ''} for ${draft?.candidate_name || 'candidate'}`);
    appendAudit('Recruiter', `Set follow-up reminder rule to ${validDays} days`, `${draft?.candidate_name} (${draft?.candidate_id})`);
  };

  // Handler: Toggle candidate response status
  const handleToggleResponseStatus = (draftId: string) => {
    setOutreachQueue((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        const willBeResponded = d.response_status !== 'responded';
        return {
          ...d,
          response_status: willBeResponded ? 'responded' : 'waiting',
          responded_at: willBeResponded ? new Date().toISOString() : undefined,
        };
      })
    );
    const draft = outreachQueue.find((d) => d.id === draftId);
    const isNowResponded = draft?.response_status !== 'responded';
    showToast(isNowResponded ? `Marked ${draft?.candidate_name} as Responded` : `Marked ${draft?.candidate_name} as Awaiting Response`);
    appendAudit(
      'Recruiter',
      isNowResponded ? 'Marked candidate as responded to outreach' : 'Reset outreach status to awaiting response',
      `${draft?.candidate_name} (${draft?.candidate_id})`
    );
  };

  // Handler: Snooze reminder by adding N days
  const handleSnoozeReminder = (draftId: string, additionalDays: number = 2) => {
    setOutreachQueue((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        const currentThreshold = d.reminder_days ?? globalReminderDays;
        return { ...d, reminder_days: currentThreshold + additionalDays };
      })
    );
    const draft = outreachQueue.find((d) => d.id === draftId);
    showToast(`Snoozed follow-up reminder for ${draft?.candidate_name} (+${additionalDays} days)`);
    appendAudit(
      'Recruiter',
      `Snoozed follow-up reminder by ${additionalDays} days`,
      `${draft?.candidate_name} (${draft?.candidate_id})`
    );
  };

  // Handler: Mark initial draft as Dispatched / Sent
  const handleMarkAsSent = (draftId: string) => {
    const nowIso = new Date().toISOString();
    setOutreachQueue((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? {
              ...d,
              status: 'Sent / Dispatched',
              sent_at: d.sent_at || nowIso,
              response_status: 'waiting',
            }
          : d
      )
    );
    const draft = outreachQueue.find((d) => d.id === draftId);
    showToast(`Marked outreach as Sent to ${draft?.candidate_name}`);
    appendAudit('Recruiter', 'Dispatched outreach message to candidate', `${draft?.candidate_name} (${draft?.candidate_id})`);
  };

  // Handler: Generate and dispatch automated follow-up reminder email
  const handleSendFollowUpReminder = (draft: OutreachDraft) => {
    const { daysSinceSent } = getDraftReminderStatus(draft);
    const reminder = recruitmentAgent.generateFollowUpReminderEmail(
      draft,
      Math.max(1, daysSinceSent),
      brief?.job_title || 'AI/ML Engineer',
      brief?.company_name || 'Anthropic Tech'
    );

    const nowIso = new Date().toISOString();
    const updatedCount = (draft.follow_up_sent_count || 0) + 1;

    setOutreachQueue((prev) =>
      prev.map((d) =>
        d.id === draft.id
          ? {
              ...d,
              subject: reminder.subject,
              body: reminder.body,
              call_script: reminder.call_script,
              follow_up_sent_count: updatedCount,
              last_follow_up_at: nowIso,
              sent_at: nowIso, // reset timer for next follow-up window
              status: 'Sent / Dispatched',
            }
          : d
      )
    );

    showToast(`Dispatched Follow-Up Reminder #${updatedCount} to ${draft.candidate_name}`);
    appendAudit(
      'Automated Reminder Bot',
      `Dispatched follow-up reminder #${updatedCount} (Candidate had not responded after ${daysSinceSent} days)`,
      `${draft.candidate_name} (${draft.candidate_id})`
    );
  };

  // Handler: Batch send all due reminders
  const handleBatchSendAllDueReminders = () => {
    const dueDrafts = outreachQueue.filter((d) => getDraftReminderStatus(d).isOverdue);
    if (dueDrafts.length === 0) return;

    const nowIso = new Date().toISOString();
    setOutreachQueue((prev) =>
      prev.map((d) => {
        const status = getDraftReminderStatus(d);
        if (!status.isOverdue) return d;

        const reminder = recruitmentAgent.generateFollowUpReminderEmail(
          d,
          Math.max(1, status.daysSinceSent),
          brief?.job_title || 'AI/ML Engineer',
          brief?.company_name || 'Anthropic Tech'
        );

        return {
          ...d,
          subject: reminder.subject,
          body: reminder.body,
          call_script: reminder.call_script,
          follow_up_sent_count: (d.follow_up_sent_count || 0) + 1,
          last_follow_up_at: nowIso,
          sent_at: nowIso,
          status: 'Sent / Dispatched',
        };
      })
    );

    showToast(`Dispatched automated follow-up reminders to ${dueDrafts.length} candidate(s)`);
    appendAudit(
      'Automated Reminder Bot',
      `Dispatched batch follow-up reminders to ${dueDrafts.length} candidate(s) with no response`,
      `${dueDrafts.map((d) => d.candidate_name).join(', ')}`
    );
  };

  const handleDownloadDraft = (draft: OutreachDraft) => {
    const text = `To: ${draft.candidate_email}\nSubject: ${draft.subject}\nStatus: ${draft.status}\nSent At: ${draft.sent_at || 'Not sent'}\n\n${draft.body}\n\nCall Script:\n${draft.call_script}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.candidate_id.toLowerCase()}-outreach.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteDraft = (draftId: string) => {
    const draft = outreachQueue.find((d) => d.id === draftId);
    setOutreachQueue((prev) => prev.filter((d) => d.id !== draftId));
    showToast(`Removed outreach for ${draft?.candidate_name || draftId}`);
    appendAudit('Recruiter', 'Removed outreach draft from queue', `${draft?.candidate_name} (${draft?.candidate_id})`);
  };

  return (
    <section
      id="outreach-queue-section"
      aria-label="Outreach & Follow-Up Reminder Queue"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {toastMessage}
          </span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header and HR Follow-Up Rule Config */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#6743ee]" />
            <h2 className="text-sm font-semibold text-slate-900">
              Outreach Queue & Automated Follow-Up Reminders
            </h2>
            <span className="text-slate-400 font-normal text-xs tabular-nums">
              ({summary.total})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks candidate outreach, highlights non-responders exceeding the reminder threshold, and automates polite follow-up nudges.
          </p>
        </div>

        {/* Global HR Reminder Setting & Batch Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <label htmlFor="global-reminder-select" className="font-medium whitespace-nowrap">
              HR Default Reminder:
            </label>
            <select
              id="global-reminder-select"
              value={globalReminderDays}
              onChange={(e) => {
                const val = Number(e.target.value);
                setGlobalReminderDays(val);
                showToast(`Default reminder set to ${val} days without response`);
                appendAudit('Recruiter', `Changed global follow-up reminder rule to ${val} days`, 'Outreach Queue');
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#6743ee] cursor-pointer"
            >
              <option value={1}>1 Day (Urgent)</option>
              <option value={2}>2 Days</option>
              <option value={3}>3 Days (Standard)</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days (Weekly)</option>
            </select>
          </div>

          {summary.overdueCount > 0 && (
            <button
              type="button"
              onClick={handleBatchSendAllDueReminders}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Automatically send personalized reminder emails to all overdue candidates"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Send All Due Reminders ({summary.overdueCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs with Overdue Highlight Badge */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {[
          { id: 'all' as const, label: 'All Outreach', count: summary.total },
          {
            id: 'overdue' as const,
            label: '⚠️ Follow-Up Due (> threshold)',
            count: summary.overdueCount,
            alert: summary.overdueCount > 0,
          },
          { id: 'waiting' as const, label: 'Awaiting Response', count: summary.waitingCount },
          { id: 'responded' as const, label: '✓ Responded', count: summary.respondedCount },
          { id: 'drafts' as const, label: 'Pending Drafts', count: summary.draftsCount },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white font-semibold'
                  : tab.alert
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] tabular-nums font-mono px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : tab.alert
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Overdue Summary Alert Banner if non-responders exist */}
      {summary.overdueCount > 0 && activeFilter !== 'responded' && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{summary.overdueCount} candidate{summary.overdueCount > 1 ? 's haven\'t' : ' hasn\'t'} responded</strong> within{' '}
              {globalReminderDays} days of initial outreach. Automated reminders are suggested below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter('overdue')}
            className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer shrink-0"
          >
            Filter to Overdue ({summary.overdueCount}) →
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredQueue.length === 0 ? (
        <div className="p-8 text-center space-y-2 bg-slate-50 border border-slate-200 rounded-lg">
          <Clock className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs text-slate-600 font-medium">
            {activeFilter === 'overdue'
              ? 'Great news! No candidates currently exceed the follow-up reminder threshold.'
              : 'No outreach items match your selected filter.'}
          </p>
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="text-xs text-[#6743ee] font-semibold hover:underline cursor-pointer"
            >
              View all {summary.total} outreach records
            </button>
          )}
        </div>
      ) : (
        /* Outreach Queue Cards List */
        <div className="space-y-3.5">
          {filteredQueue.map((draft) => {
            const status = getDraftReminderStatus(draft);
            const isExpanded = expandedDraftId === draft.id;

            return (
              <div
                key={draft.id}
                className={`rounded-xl border transition-all p-4 space-y-3 text-xs ${
                  status.isOverdue
                    ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-300/70 shadow-2xs'
                    : status.isResponded
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {/* Top Status & Highlight Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {draft.candidate_name}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {draft.candidate_id}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{draft.candidate_email}</span>

                    {/* Prominent Highlighting Badge */}
                    {status.isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>
                          {status.daysSinceSent}d without response ({status.daysOverdue > 0 ? `${status.daysOverdue}d overdue` : 'due today'})
                        </span>
                      </span>
                    ) : status.isResponded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Responded</span>
                      </span>
                    ) : status.isSent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                        <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                        <span>{status.daysRemaining}d until reminder</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700">
                        Draft (not dispatched)
                      </span>
                    )}

                    {draft.follow_up_sent_count && draft.follow_up_sent_count > 0 ? (
                      <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                        (Reminder #{draft.follow_up_sent_count} sent)
                      </span>
                    ) : null}
                  </div>

                  {/* Per-Candidate HR Reminder Window Setter */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Remind after:</span>
                      <select
                        aria-label={`Set follow-up reminder days for ${draft.candidate_name}`}
                        value={status.thresholdDays}
                        onChange={(e) => handleUpdateDraftReminderDays(draft.id, Number(e.target.value))}
                        className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days (default)</option>
                        <option value={4}>4 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleResponseStatus(draft.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        status.isResponded
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      }`}
                      title={status.isResponded ? 'Mark candidate as awaiting response' : 'Mark candidate as responded to clear reminder'}
                    >
                      {status.isResponded ? 'Undo Response' : 'Mark Responded'}
                    </button>
                  </div>
                </div>

                {/* Overdue Alert Action Bar */}
                {status.isOverdue && (
                  <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-3 text-amber-950">
                    <div className="space-y-0.5">
                      <div className="font-semibold flex items-center gap-1.5">
                        <BellRing className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Automated Follow-Up Reminder Triggered</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Candidate received initial outreach {status.daysSinceSent} days ago (HR SLA: {status.thresholdDays} days).
                        Click below to dispatch an AI-generated polite follow-up nudge.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSnoozeReminder(draft.id, 2)}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-md text-[11px] font-medium cursor-pointer"
                        title="Give candidate 2 additional days before reminding again"
                      >
                        +2 Days Snooze
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendFollowUpReminder(draft)}
                        className="px-3 py-1 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Send Follow-Up Reminder</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Subject & Body Editable Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700">Subject</label>
                    <div className="flex items-center gap-2 text-[11px]">
                      {draft.availability && draft.availability !== 'N/A' && (
                        <span className="text-slate-500">
                          Availability: <strong className="text-slate-700">{draft.availability}</strong>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedDraftId((prev) => (prev === draft.id ? null : draft.id))}
                        className="text-[#6743ee] hover:underline font-medium cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? 'Collapse' : 'Expand Draft'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOutreachQueue((prev) =>
                        prev.map((d) => (d.id === draft.id ? { ...d, subject: val } : d))
                      );
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#6743ee]"
                  />

                  {isExpanded && (
                    <div className="space-y-2 pt-1 animate-fade-in">
                      <label className="text-[11px] font-semibold text-slate-700">Email Message Body</label>
                      <textarea
                        value={draft.body}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOutreachQueue((prev) =>
                            prev.map((d) => (d.id === draft.id ? { ...d, body: val } : d))
                          );
                        }}
                        rows={5}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-sans focus:outline-none focus:border-[#6743ee]"
                      />

                      {draft.call_script && (
                        <div className="p-2.5 bg-purple-50/60 border border-purple-200/80 rounded-lg space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-[#6743ee]" />
                            <span>Recruiter Phone / Voicemail Script</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            {draft.call_script}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Bottom Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                  <div className="flex flex-wrap items-center gap-2">
                    {!status.isSent && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsSent(draft.id)}
                        className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Dispatch Outreach</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendFollowUpReminder(draft)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                      title="Generate automated reminder nudge"
                    >
                      <Sparkles className="w-3 h-3 text-[#6743ee]" />
                      <span>{status.isOverdue ? 'Dispatch Reminder' : 'New Reminder'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(draft.id, `Subject: ${draft.subject}\n\n${draft.body}`)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === draft.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadDraft(draft)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-slate-400" />
                      <span>Download .txt</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {onInspectCandidate && (
                      <button
                        type="button"
                        onClick={() => onInspectCandidate(draft.candidate_id)}
                        className="px-2.5 py-1.5 text-[#6743ee] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Candidate Profile</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                      title="Remove from outreach queue"
                      aria-label={`Remove outreach for ${draft.candidate_name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
