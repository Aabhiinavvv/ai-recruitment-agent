import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HiringWorkflowTab } from './components/HiringWorkflowTab';
import { AIInterviewTab } from './components/AIInterviewTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { FairnessModal } from './components/FairnessModal';
import { ResumeToolsModal } from './components/ResumeToolsModal';
import { Candidate, HiringBrief, OutreachDraft, AuditEvent, InterviewRoundFeedback, ScheduledInterview } from './types';
import { ROLE_REQUIREMENTS, SAMPLE_CANDIDATES } from './data/roles';
import { recruitmentAgent } from './services/recruitmentAgent';
import { generateInterviewEmailConfirmation, getFormatDisplayLabel } from './services/interviewSchedulerService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  fetchWorkspaceRecords,
  saveAuditEventApi,
  saveCandidatesApi,
  saveHiringBriefApi,
  saveOutreachDraftsApi,
  saveScheduledInterviewApi,
  seedWorkspaceRecordsApi,
} from './services/workspaceApi';

function createInitialBrief(): HiringBrief {
  const { jd, rubric } = recruitmentAgent.generateJobDescription({
    company_name: 'Anthropic Tech',
    job_title: 'AI/ML Engineer',
    location: 'San Francisco, CA / Remote',
    headcount: 2,
    salary_budget: '$160,000 – $210,000',
    timeline: 'Within 30 days',
    requirements: ROLE_REQUIREMENTS['AI/ML Engineer'].join(', '),
  });

  return {
    company_name: 'Anthropic Tech',
    job_title: 'AI/ML Engineer',
    location: 'San Francisco, CA / Remote',
    headcount: 2,
    salary_budget: '$160,000 – $210,000',
    timeline: 'Within 30 days',
    requirements: ROLE_REQUIREMENTS['AI/ML Engineer'].join(', '),
    jd,
    status: 'Approved by recruiter — publishing integration required',
    evaluation_rubric: rubric,
  };
}

const INITIAL_OUTREACH_QUEUE: OutreachDraft[] = [
  {
    id: 'draft-overdue-1',
    type: 'round',
    candidate_id: 'CAN-8291',
    candidate_name: 'Marcus Vance',
    candidate_email: 'marcus.vance@example.com',
    candidate_phone: '+1-555-018-9921',
    round_name: 'technical',
    interview_format: 'Technical Architecture Deep-Dive (Google Meet)',
    subject: 'Interview Invitation: Technical Systems Round at Anthropic Tech',
    body: 'Dear Marcus Vance,\n\nWe were highly impressed by your evaluation score (93%) and your background in distributed GPU clusters. We would love to invite you to our Technical Systems Deep-Dive.\n\nPlease select a convenient slot via our calendar or reply with your availability.\n\nBest regards,\nRecruitment Team',
    call_script: 'Hi Marcus Vance, calling from Anthropic Tech to follow up on your technical systems interview invitation.',
    availability: 'Weekdays, 11:00 AM – 3:00 PM EST',
    status: 'Sent / Dispatched',
    sent_at: '2026-11-07T14:30:00.000Z',
    reminder_days: 3,
    response_status: 'waiting',
    follow_up_sent_count: 0,
  },
  {
    id: 'draft-pending-2',
    type: 'round',
    candidate_id: 'CAN-9821',
    candidate_name: 'Alex Rivera',
    candidate_email: 'alex.rivera@example.com',
    candidate_phone: '+1-555-019-2831',
    round_name: 'coding',
    interview_format: 'Video interview with live coding exercise',
    subject: 'Interview Invitation: AI/ML Engineer at Anthropic Tech',
    body: 'Dear Alex Rivera,\n\nWe were impressed by your background and would love to invite you to the Coding Round for the AI/ML Engineer position.\n\nIn this round, you will be invited to complete an adaptive coding exercise.\n\nPlease let us know if the suggested availability works for you.\n\nBest regards,\nRecruitment Team',
    call_script: 'Hi Alex Rivera, calling from Anthropic Tech to invite you to our upcoming coding round.',
    availability: 'Upcoming weekdays, 10:00 AM – 4:00 PM EST',
    status: 'Sent / Dispatched',
    sent_at: '2026-11-10T10:00:00.000Z',
    reminder_days: 3,
    response_status: 'waiting',
    follow_up_sent_count: 0,
  },
  {
    id: 'draft-responded-3',
    type: 'round',
    candidate_id: 'CAN-5502',
    candidate_name: 'Jordan Blake',
    candidate_email: 'jordan.blake@example.com',
    candidate_phone: '+1-555-017-3342',
    round_name: 'hr',
    interview_format: 'Final Alignment Discussion',
    subject: 'Final Alignment Conversation: Jordan Blake & Anthropic Tech',
    body: 'Dear Jordan Blake,\n\nFollowing your strong coding assessment, we would love to schedule your final alignment conversation.\n\nBest regards,\nRecruitment Team',
    call_script: 'Hi Jordan, following up regarding your interview schedule.',
    availability: 'Confirmed for Friday at 2:00 PM EST',
    status: 'Sent / Dispatched',
    sent_at: '2026-11-06T11:00:00.000Z',
    reminder_days: 3,
    response_status: 'responded',
    responded_at: '2026-11-08T15:20:00.000Z',
  },
];

const INITIAL_EVENTS: AuditEvent[] = [
  {
    timestamp: '10:14:00 AM',
    actor: 'AI Agent',
    action: 'AI drafted job description and evaluation rubric',
    subject: 'AI/ML Engineer',
  },
  {
    timestamp: '10:15:20 AM',
    actor: 'Recruiter',
    action: 'Approved job description for multi-channel distribution',
    subject: 'AI/ML Engineer',
  },
  {
    timestamp: '10:16:45 AM',
    actor: 'AI Screener',
    action: 'Screened resume with 6-dimension evaluation (Score: 88%)',
    subject: 'AI/ML Engineer: CAN-9821',
  },
];

function createInitialScheduledInterviews(jobTitle: string, companyName: string): ScheduledInterview[] {
  return [
    {
      id: 'interview-init-1',
      candidateId: 'CAN-9821',
      candidateName: 'Alex Rivera',
      candidateEmail: 'alex.rivera@example.com',
      candidatePhone: '+1-555-019-2831',
      jobTitle,
      companyName,
      roundName: 'Technical Live Coding Round',
      roundType: 'coding',
      durationMinutes: 45,
      format: 'video_zoom',
      meetingLink: 'https://zoom.us/j/84291043721?pwd=ALE492',
      zoomMeetingId: '842 9104 3721',
      zoomPasscode: 'ALE492',
      dateStr: '2026-11-04',
      startTime: '14:00',
      endTime: '14:45',
      timezone: 'America/New_York (EST)',
      panelInterviewerIds: ['int-2'],
      panelInterviewerNames: ['David Chen'],
      calendarInviteSent: true,
      calendarInviteSentAt: '10:18 AM',
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    },
  ];
}

function AppContent() {
  const {
    user,
    idToken,
    authReady,
    isSigningIn,
    authError,
    signInWithGoogle,
    signOutUser,
    clearAuthError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'workflow' | 'interview' | 'architecture'>('workflow');

  // AI settings
  const [provider, setProvider] = useState<'Groq' | 'Gemini'>('Gemini');
  const [model, setModel] = useState<string>('gemini-4-hydrogen');
  const [cutoffScore, setCutoffScore] = useState<number>(75);

  // Modals
  const [isFairnessOpen, setIsFairnessOpen] = useState<boolean>(false);
  const [isResumeToolsOpen, setIsResumeToolsOpen] = useState<boolean>(false);

  // Workflow Data
  const [brief, setBrief] = useState<HiringBrief | null>(() => createInitialBrief());
  const [candidates, setCandidates] = useState<Candidate[]>(SAMPLE_CANDIDATES);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    SAMPLE_CANDIDATES[2]?.candidate_id || SAMPLE_CANDIDATES[0]?.candidate_id || null
  );
  const selectedCandidate =
    candidates.find((c) => c.candidate_id === selectedCandidateId) || candidates[0] || null;
  const [outreachQueue, setOutreachQueue] = useState<OutreachDraft[]>(INITIAL_OUTREACH_QUEUE);
  const [events, setEvents] = useState<AuditEvent[]>(INITIAL_EVENTS);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>(() =>
    createInitialScheduledInterviews('AI/ML Engineer', 'Anthropic Tech')
  );
  const [activeScheduledSessionId, setActiveScheduledSessionId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const hydratedUidRef = useRef<string | null>(null);
  const suppressNextSyncRef = useRef<boolean>(false);
  const persistedEventCountRef = useRef<number>(0);

  // Update agent config whenever settings change
  useEffect(() => {
    recruitmentAgent.configure(undefined, provider, model, cutoffScore);
  }, [provider, model, cutoffScore]);

  // Hydrate or seed authenticated user's persisted workspace
  useEffect(() => {
    if (!authReady) return;
    if (!user || !idToken) {
      hydratedUidRef.current = null;
      return;
    }
    if (hydratedUidRef.current === user.uid) return;

    let cancelled = false;
    (async () => {
      try {
        setSyncError(null);
        const snapshot = await fetchWorkspaceRecords(idToken);
        if (cancelled) return;

        if (!snapshot.initialized) {
          const seeded = await seedWorkspaceRecordsApi(
            idToken,
            {
              brief,
              candidates,
              scheduledInterviews,
              outreachQueue,
              events,
            },
            false
          );
          if (cancelled) return;
          hydratedUidRef.current = user.uid;
          persistedEventCountRef.current = seeded.events.length;
          if (seeded.brief) setBrief(seeded.brief);
        } else {
          suppressNextSyncRef.current = true;
          hydratedUidRef.current = user.uid;
          persistedEventCountRef.current = snapshot.events.length;
          if (snapshot.brief) setBrief(snapshot.brief);
          if (snapshot.candidates.length > 0) {
            setCandidates(snapshot.candidates);
            setSelectedCandidateId(snapshot.candidates[0]?.candidate_id || null);
          }
          setScheduledInterviews(snapshot.scheduledInterviews);
          setOutreachQueue(snapshot.outreachQueue);
          setEvents(snapshot.events);
          setTimeout(() => {
            suppressNextSyncRef.current = false;
          }, 300);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load workspace records:', err);
          setSyncError('Could not load saved workspace records right now. Changes remain active in your session.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid, idToken]);

  // Auto-persist Hiring Brief changes when signed in
  useEffect(() => {
    if (!user || !idToken || hydratedUidRef.current !== user.uid || suppressNextSyncRef.current || !brief) {
      return;
    }
    const timer = setTimeout(() => {
      saveHiringBriefApi(idToken, brief).catch((err) => {
        console.error('Failed to save brief:', err);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [brief, user, idToken]);

  // Auto-persist Candidate changes when signed in
  useEffect(() => {
    if (!user || !idToken || hydratedUidRef.current !== user.uid || suppressNextSyncRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveCandidatesApi(idToken, candidates).catch((err) => {
        console.error('Failed to save candidates:', err);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [candidates, user, idToken]);

  // Auto-persist Outreach Queue changes when signed in
  useEffect(() => {
    if (!user || !idToken || hydratedUidRef.current !== user.uid || suppressNextSyncRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveOutreachDraftsApi(idToken, outreachQueue).catch((err) => {
        console.error('Failed to save outreach drafts:', err);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [outreachQueue, user, idToken]);

  // Auto-persist newly appended Audit Events across all tabs
  useEffect(() => {
    if (
      !user ||
      !idToken ||
      hydratedUidRef.current !== user.uid ||
      suppressNextSyncRef.current
    ) {
      return;
    }
    if (events.length <= persistedEventCountRef.current) {
      return;
    }
    const newEvents = events.slice(persistedEventCountRef.current);
    persistedEventCountRef.current = events.length;
    (async () => {
      for (const evt of newEvents) {
        try {
          await saveAuditEventApi(idToken, evt);
        } catch (err) {
          console.error('Failed to save audit event:', err);
        }
      }
    })();
  }, [events, user, idToken]);

  const handleLoadSamples = () => {
    const freshBrief = createInitialBrief();
    const freshInterviews = createInitialScheduledInterviews(freshBrief.job_title, freshBrief.company_name);
    const resetEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor: 'System',
      action: 'Loaded realistic demo candidate evaluations',
      subject: 'Workspace Refresh',
    };
    const nextEvents = [...INITIAL_EVENTS, resetEvent];

    suppressNextSyncRef.current = true;
    setBrief(freshBrief);
    setCandidates(SAMPLE_CANDIDATES);
    setSelectedCandidateId(SAMPLE_CANDIDATES[2]?.candidate_id || SAMPLE_CANDIDATES[0]?.candidate_id || null);
    setScheduledInterviews(freshInterviews);
    setOutreachQueue(INITIAL_OUTREACH_QUEUE);
    setEvents(nextEvents);

    if (user && idToken) {
      persistedEventCountRef.current = nextEvents.length;
      seedWorkspaceRecordsApi(
        idToken,
        {
          brief: freshBrief,
          candidates: SAMPLE_CANDIDATES,
          scheduledInterviews: freshInterviews,
          outreachQueue: INITIAL_OUTREACH_QUEUE,
          events: nextEvents,
        },
        true
      )
        .catch((err) => console.error('Failed to reset saved workspace:', err))
        .finally(() => {
          setTimeout(() => {
            suppressNextSyncRef.current = false;
          }, 300);
        });
    } else {
      setTimeout(() => {
        suppressNextSyncRef.current = false;
      }, 100);
    }
  };

  const appendAudit = (actor: string, action: string, subject: string) => {
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor,
      action,
      subject,
    };
    setEvents((prev) => [...prev, newEvent]);
  };

  const handleConfirmScheduledInterview = (scheduled: ScheduledInterview) => {
    setScheduledInterviews((prev) => [scheduled, ...prev]);
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== scheduled.candidateId) return c;
        return {
          ...c,
          stage: 'Interview',
          recruiter_decision: 'advance',
          decision_status: 'Advanced by recruiter',
          current_round: scheduled.roundType,
        };
      })
    );

    if (user && idToken && hydratedUidRef.current === user.uid) {
      saveScheduledInterviewApi(idToken, scheduled).catch((err) => {
        console.error('Failed to save scheduled interview:', err);
      });
    }

    const { subject, body } = generateInterviewEmailConfirmation(scheduled);
    const platformLabel = getFormatDisplayLabel(scheduled.format);
    const draft: OutreachDraft = {
      id: `draft-${Date.now()}`,
      type: 'round',
      candidate_id: scheduled.candidateId,
      candidate_name: scheduled.candidateName,
      candidate_email: scheduled.candidateEmail,
      candidate_phone: scheduled.candidatePhone,
      round_name: scheduled.roundType,
      interview_format: `${platformLabel} (${scheduled.meetingLink})`,
      subject,
      body,
      call_script: `Hi ${scheduled.candidateName}, calling from ${scheduled.companyName} to confirm your upcoming ${scheduled.roundName} on ${scheduled.dateStr} via ${platformLabel}. Calendar invite and meeting link have been dispatched.`,
      availability: `${scheduled.dateStr} at ${scheduled.startTime} EST`,
      status: 'Sent / Dispatched',
      sent_at: new Date().toISOString(),
      reminder_days: 3,
      response_status: 'waiting',
    };
    setOutreachQueue((prev) => [draft, ...prev]);
    appendAudit(
      'Scheduler',
      `Scheduled ${scheduled.durationMinutes}m ${scheduled.roundName} (${platformLabel}) on ${scheduled.dateStr} at ${scheduled.startTime} EST`,
      `${scheduled.candidateName} (${scheduled.candidateId})`
    );
  };

  const handleLaunchOnlineInterview = (interview: ScheduledInterview) => {
    setSelectedCandidateId(interview.candidateId);
    setActiveScheduledSessionId(interview.id);
    setActiveTab('interview');
    appendAudit(
      'Recruiter',
      `Opened AI Online Interview Room for scheduled ${getFormatDisplayLabel(interview.format)}`,
      `${interview.candidateName} (${interview.candidateId})`
    );
  };

  const handleSaveInterviewFeedback = (candidateId: string, feedback: InterviewRoundFeedback) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        const currentReports = c.interview_feedback_reports || [];
        return {
          ...c,
          interview_feedback_reports: [feedback, ...currentReports],
          stage: c.stage === 'Screening' ? 'Interview' : c.stage,
        };
      })
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      <Header
        brief={brief}
        candidateCount={candidates.length}
        onLoadSamples={handleLoadSamples}
        userEmail={user?.email}
        userName={user?.displayName}
        isSigningIn={isSigningIn}
        onSignIn={signInWithGoogle}
        onSignOut={signOutUser}
      />

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          cutoffScore={cutoffScore}
          setCutoffScore={setCutoffScore}
          onLoadSamples={handleLoadSamples}
          onOpenFairness={() => setIsFairnessOpen(true)}
          onOpenResumeTools={() => setIsResumeToolsOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-4">
          {authReady && !user && (
            <div className="max-w-6xl mx-auto px-4 py-2.5 bg-white border border-purple-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-700">
                Sign in with your Google account to save and access your candidate, interview, and audit records across sessions.
              </span>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="px-3.5 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </div>
          )}

          {(authError || syncError) && (
            <div className="max-w-6xl mx-auto px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
              <span>{authError || syncError}</span>
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  setSyncError(null);
                }}
                className="font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'workflow' && (
            <HiringWorkflowTab
              brief={brief}
              setBrief={setBrief}
              candidates={candidates}
              setCandidates={setCandidates}
              outreachQueue={outreachQueue}
              setOutreachQueue={setOutreachQueue}
              events={events}
              setEvents={setEvents}
              cutoffScore={cutoffScore}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidateId={setSelectedCandidateId}
              scheduledInterviews={scheduledInterviews}
              onConfirmScheduledInterview={handleConfirmScheduledInterview}
              onLaunchOnlineInterview={handleLaunchOnlineInterview}
            />
          )}

          {activeTab === 'interview' && (
            <AIInterviewTab
              brief={brief}
              candidates={candidates}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidateId={setSelectedCandidateId}
              onSaveFeedback={handleSaveInterviewFeedback}
              onAppendAudit={appendAudit}
              resumeReadinessScore={selectedCandidate?.overall_score || 85}
              scheduledInterviews={scheduledInterviews}
              activeScheduledSessionId={activeScheduledSessionId}
              onConfirmSchedule={handleConfirmScheduledInterview}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureTab />
          )}
        </main>
      </div>

      {/* Modals */}
      <FairnessModal
        isOpen={isFairnessOpen}
        onClose={() => setIsFairnessOpen(false)}
      />

      <ResumeToolsModal
        isOpen={isResumeToolsOpen}
        onClose={() => setIsResumeToolsOpen(false)}
        currentResumeText={selectedCandidate?.resume_text || ''}
        candidateName={selectedCandidate?.name || 'Candidate'}
        roleTitle={brief?.job_title || 'Software Engineer'}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

