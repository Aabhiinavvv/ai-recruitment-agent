import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HiringWorkflowTab } from './components/HiringWorkflowTab';
import { AIInterviewTab } from './components/AIInterviewTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { FairnessModal } from './components/FairnessModal';
import { ResumeToolsModal } from './components/ResumeToolsModal';
import { Candidate, HiringBrief, OutreachDraft, AuditEvent, InterviewRoundFeedback } from './types';
import { ROLE_REQUIREMENTS, SAMPLE_CANDIDATES } from './data/roles';
import { recruitmentAgent } from './services/recruitmentAgent';

export function App() {
  const [activeTab, setActiveTab] = useState<'workflow' | 'interview' | 'architecture'>('workflow');

  // AI settings
  const [provider, setProvider] = useState<'Groq' | 'Gemini'>('Gemini');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [cutoffScore, setCutoffScore] = useState<number>(75);

  // Modals
  const [isFairnessOpen, setIsFairnessOpen] = useState<boolean>(false);
  const [isResumeToolsOpen, setIsResumeToolsOpen] = useState<boolean>(false);

  // Workflow Data
  const [brief, setBrief] = useState<HiringBrief | null>(() => {
    const { jd, rubric } = recruitmentAgent.generateJobDescription({
      company_name: "Anthropic Tech",
      job_title: "AI/ML Engineer",
      location: "San Francisco, CA / Remote",
      headcount: 2,
      salary_budget: "$160,000 – $210,000",
      timeline: "Within 30 days",
      requirements: ROLE_REQUIREMENTS["AI/ML Engineer"].join(", "),
    });

    return {
      company_name: "Anthropic Tech",
      job_title: "AI/ML Engineer",
      location: "San Francisco, CA / Remote",
      headcount: 2,
      salary_budget: "$160,000 – $210,000",
      timeline: "Within 30 days",
      requirements: ROLE_REQUIREMENTS["AI/ML Engineer"].join(", "),
      jd,
      status: 'Approved by recruiter — publishing integration required',
      evaluation_rubric: rubric,
    };
  });

  const [candidates, setCandidates] = useState<Candidate[]>(SAMPLE_CANDIDATES);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    SAMPLE_CANDIDATES[2]?.candidate_id || SAMPLE_CANDIDATES[0]?.candidate_id || null
  );
  const selectedCandidate =
    candidates.find((c) => c.candidate_id === selectedCandidateId) || candidates[0] || null;
  const [outreachQueue, setOutreachQueue] = useState<OutreachDraft[]>([
    {
      id: "draft-overdue-1",
      type: "round",
      candidate_id: "CAN-8291",
      candidate_name: "Marcus Vance",
      candidate_email: "marcus.vance@example.com",
      candidate_phone: "+1-555-018-9921",
      round_name: "technical",
      interview_format: "Technical Architecture Deep-Dive (Google Meet)",
      subject: "Interview Invitation: Technical Systems Round at Anthropic Tech",
      body: "Dear Marcus Vance,\n\nWe were highly impressed by your evaluation score (93%) and your background in distributed GPU clusters. We would love to invite you to our Technical Systems Deep-Dive.\n\nPlease select a convenient slot via our calendar or reply with your availability.\n\nBest regards,\nRecruitment Team",
      call_script: "Hi Marcus Vance, calling from Anthropic Tech to follow up on your technical systems interview invitation.",
      availability: "Weekdays, 11:00 AM – 3:00 PM EST",
      status: "Sent / Dispatched",
      sent_at: "2026-11-07T14:30:00.000Z",
      reminder_days: 3,
      response_status: "waiting",
      follow_up_sent_count: 0
    },
    {
      id: "draft-pending-2",
      type: "round",
      candidate_id: "CAN-9821",
      candidate_name: "Alex Rivera",
      candidate_email: "alex.rivera@example.com",
      candidate_phone: "+1-555-019-2831",
      round_name: "coding",
      interview_format: "Video interview with live coding exercise",
      subject: "Interview Invitation: AI/ML Engineer at Anthropic Tech",
      body: "Dear Alex Rivera,\n\nWe were impressed by your background and would love to invite you to the Coding Round for the AI/ML Engineer position.\n\nIn this round, you will be invited to complete an adaptive coding exercise.\n\nPlease let us know if the suggested availability works for you.\n\nBest regards,\nRecruitment Team",
      call_script: "Hi Alex Rivera, calling from Anthropic Tech to invite you to our upcoming coding round.",
      availability: "Upcoming weekdays, 10:00 AM – 4:00 PM EST",
      status: "Sent / Dispatched",
      sent_at: "2026-11-10T10:00:00.000Z",
      reminder_days: 3,
      response_status: "waiting",
      follow_up_sent_count: 0
    },
    {
      id: "draft-responded-3",
      type: "round",
      candidate_id: "CAN-5502",
      candidate_name: "Jordan Blake",
      candidate_email: "jordan.blake@example.com",
      candidate_phone: "+1-555-017-3342",
      round_name: "hr",
      interview_format: "Final Alignment Discussion",
      subject: "Final Alignment Conversation: Jordan Blake & Anthropic Tech",
      body: "Dear Jordan Blake,\n\nFollowing your strong coding assessment, we would love to schedule your final alignment conversation.\n\nBest regards,\nRecruitment Team",
      call_script: "Hi Jordan, following up regarding your interview schedule.",
      availability: "Confirmed for Friday at 2:00 PM EST",
      status: "Sent / Dispatched",
      sent_at: "2026-11-06T11:00:00.000Z",
      reminder_days: 3,
      response_status: "responded",
      responded_at: "2026-11-08T15:20:00.000Z"
    }
  ]);

  const [events, setEvents] = useState<AuditEvent[]>([
    {
      timestamp: "10:14:00 AM",
      actor: "AI Agent",
      action: "AI drafted job description and evaluation rubric",
      subject: "AI/ML Engineer"
    },
    {
      timestamp: "10:15:20 AM",
      actor: "Recruiter",
      action: "Approved job description for multi-channel distribution",
      subject: "AI/ML Engineer"
    },
    {
      timestamp: "10:16:45 AM",
      actor: "AI Screener",
      action: "Screened resume with 6-dimension evaluation (Score: 88%)",
      subject: "AI/ML Engineer: CAN-9821"
    }
  ]);

  // Update agent config whenever settings change
  useEffect(() => {
    recruitmentAgent.configure(apiKey, provider, model, cutoffScore);
  }, [apiKey, provider, model, cutoffScore]);

  const handleLoadSamples = () => {
    setCandidates(SAMPLE_CANDIDATES);
    setSelectedCandidateId(SAMPLE_CANDIDATES[2]?.candidate_id || SAMPLE_CANDIDATES[0]?.candidate_id || null);
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor: "System",
      action: "Loaded realistic demo candidate evaluations",
      subject: "Workspace Refresh"
    };
    setEvents(prev => [...prev, newEvent]);
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
      />

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          provider={provider}
          setProvider={setProvider}
          apiKey={apiKey}
          setApiKey={setApiKey}
          model={model}
          setModel={setModel}
          cutoffScore={cutoffScore}
          setCutoffScore={setCutoffScore}
          onLoadSamples={handleLoadSamples}
          onOpenFairness={() => setIsFairnessOpen(true)}
          onOpenResumeTools={() => setIsResumeToolsOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
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
        currentResumeText={selectedCandidate?.resume_text || ""}
        candidateName={selectedCandidate?.name || "Candidate"}
        roleTitle={brief?.job_title || "Software Engineer"}
      />
    </div>
  );
}

export default App;
