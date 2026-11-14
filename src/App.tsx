import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HiringWorkflowTab } from './components/HiringWorkflowTab';
import { CandidateIntelligenceUpload } from './components/CandidateIntelligenceUpload';
import { AIInterviewTab } from './components/AIInterviewTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { FairnessModal } from './components/FairnessModal';
import { ResumeToolsModal } from './components/ResumeToolsModal';
import { Candidate, HiringBrief, OutreachDraft, AuditEvent } from './types';
import { SAMPLE_CANDIDATES } from './data/roles';
import { recruitmentAgent } from './services/recruitmentAgent';
import type { SavedCandidateProfile } from './services/candidateIntelligenceApi';

function candidateFromSavedProfile({ candidate_profile: profile }: SavedCandidateProfile): Candidate {
  const skills = profile.skills.map((skill) => skill.name);
  const profileSummary = [
    profile.headline,
    profile.summary,
    profile.work_experience.map((item) => item.raw_entry).join('\n'),
    profile.education.map((item) => item.raw_entry).join('\n'),
    profile.projects.map((item) => item.details).join('\n'),
  ].filter(Boolean).join('\n\n');

  return {
    candidate_id: profile.candidate_id,
    name: profile.full_name || 'Name not detected',
    email: profile.email || '',
    phone: profile.phone_numbers.join(', '),
    role: profile.headline || 'Uploaded resume',
    resume_text: profile.privacy.redacted_resume_text,
    resume_profile: profileSummary,
    overall_score: 0,
    analysis_status: 'unassessed',
    source_file: profile.source_file,
    extracted_skills: skills,
    decision_status: 'Pending recruiter review',
    safety_warnings: [],
    review_flags: [],
    dimension_scores: {
      technical: 0,
      experience: 0,
      education: 0,
      projects: 0,
      domain: 0,
      communication: 0,
    },
    dimension_evidence: {},
    skill_scores: {},
    strengths: [],
    missing_skills: [],
    detailed_weaknesses: [],
    digital_profile_sources: profile.profile_links.map((link) => ({
      source_type: 'Resume profile link',
      source_ref: 'resume_profile',
      source_location: link,
      content: 'Link extracted from uploaded resume; destination not verified.',
    })),
    current_round: 'coding',
    rounds: {},
    verification_checks: {},
    document_validation: {},
    memory_consent: false,
  };
}

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

  // Workflow Data — a real job brief is created through Job Intelligence Agent 1.
  const [brief, setBrief] = useState<HiringBrief | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [outreachQueue, setOutreachQueue] = useState<OutreachDraft[]>([]);

  const [events, setEvents] = useState<AuditEvent[]>([]);

  // Update agent config whenever settings change
  useEffect(() => {
    recruitmentAgent.configure(apiKey, provider, model, cutoffScore);
  }, [apiKey, provider, model, cutoffScore]);

  const handleLoadSamples = () => {
    setCandidates(SAMPLE_CANDIDATES);
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor: "System",
      action: "Loaded realistic demo candidate evaluations",
      subject: "Workspace Refresh"
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const handleSavedProfilesLoaded = useCallback((profiles: SavedCandidateProfile[]) => {
    setCandidates((current) => {
      const existingById = new Map(current.map((candidate) => [candidate.candidate_id, candidate]));
      const savedCandidates = profiles.map((record) => {
        const extractedCandidate = candidateFromSavedProfile(record);
        return {
          ...existingById.get(extractedCandidate.candidate_id),
          ...extractedCandidate,
        };
      });
      const savedIds = new Set(savedCandidates.map((candidate) => candidate.candidate_id));
      return [...savedCandidates, ...current.filter((candidate) => !savedIds.has(candidate.candidate_id))];
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-slate-900">
      <Header />

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
            <>
            <CandidateIntelligenceUpload brief={brief} onSavedProfilesLoaded={handleSavedProfilesLoaded} />
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
            />
            </>
          )}

          {activeTab === 'interview' && (
            <AIInterviewTab
              resumeReadinessScore={candidates[0]?.overall_score || 85}
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
        currentResumeText={candidates[0]?.resume_text || ""}
        candidateName={candidates[0]?.name || "Candidate"}
        roleTitle={brief?.job_title || "Software Engineer"}
      />
    </div>
  );
}

export default App;
