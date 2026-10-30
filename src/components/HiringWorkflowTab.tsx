import React, { useState, useMemo } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  OutreachDraft, 
  AuditEvent, 
  RoundType,
  HiringStage,
  EmailDraftType
} from '../types';
import { ROLE_REQUIREMENTS } from '../data/roles';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { SkillRadarChart } from './SkillRadarChart';
import { CandidateDimensionRadar } from './CandidateDimensionRadar';
import { CandidateStageDropdown } from './CandidateStageDropdown';
import { CandidateComparisonModal } from './CandidateComparisonModal';
import { CandidatePrivateNotes } from './CandidatePrivateNotes';
import { EmailDraftModal } from './EmailDraftModal';
import { BulkActionToolbar } from './BulkActionToolbar';
import { WorkforceGraph } from './WorkforceGraph';
import { 
  Briefcase, 
  FileCheck, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Send,
  Mail,
  UserCheck,
  Shield,
  FileCode,
  ListTodo,
  FileText,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  SlidersHorizontal,
  Award,
  TrendingUp,
  Eye,
  Filter,
  RotateCcw,
  Search,
  Tag,
  X,
  Layers,
  Scale,
  CheckSquare,
  Square,
  MinusSquare
} from 'lucide-react';

interface HiringWorkflowTabProps {
  brief: HiringBrief | null;
  setBrief: React.Dispatch<React.SetStateAction<HiringBrief | null>>;
  candidates: Candidate[];
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  outreachQueue: OutreachDraft[];
  setOutreachQueue: React.Dispatch<React.SetStateAction<OutreachDraft[]>>;
  events: AuditEvent[];
  setEvents: React.Dispatch<React.SetStateAction<AuditEvent[]>>;
  cutoffScore?: number;
}

export const getCandidateStage = (cand: Candidate): HiringStage => {
  if (cand.stage) return cand.stage;
  if (cand.decision_status?.includes('Not proceeding') || cand.recruiter_decision === 'reject') {
    return 'Rejected';
  }
  if (cand.decision_status?.includes('Hired')) {
    return 'Offered';
  }
  if (cand.current_round === 'coding' || cand.current_round === 'technical') {
    return 'Technical';
  }
  if (cand.current_round === 'hr') {
    return 'Interview';
  }
  return 'Screening';
};

export const HiringWorkflowTab: React.FC<HiringWorkflowTabProps> = ({
  brief,
  setBrief,
  candidates,
  setCandidates,
  outreachQueue,
  setOutreachQueue,
  events,
  setEvents,
  cutoffScore = 75,
}) => {
  // Step 1: Form state
  const [selectedRolePreset, setSelectedRolePreset] = useState<string>("AI/ML Engineer");
  const [companyName, setCompanyName] = useState<string>("Anthropic Tech");
  const [jobTitle, setJobTitle] = useState<string>("AI/ML Engineer");
  const [location, setLocation] = useState<string>("San Francisco, CA / Remote");
  const [headcount, setHeadcount] = useState<number>(1);
  const [salaryBudget, setSalaryBudget] = useState<string>("$160,000 – $210,000");
  const [timeline, setTimeline] = useState<string>("Within 30 days");
  const [requirementsText, setRequirementsText] = useState<string>(
    ROLE_REQUIREMENTS["AI/ML Engineer"].join(", ")
  );

  // Step 3: Screen resume state
  const [candidateNameInput, setCandidateNameInput] = useState<string>("");
  const [candidateEmailInput, setCandidateEmailInput] = useState<string>("");
  const [resumeTextInput, setResumeTextInput] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [portfolioUrl, setPortfolioUrl] = useState<string>("");
  const [workHighlights, setWorkHighlights] = useState<string>("");
  const [processingConsent, setProcessingConsent] = useState<boolean>(true);
  const [memoryConsent, setMemoryConsent] = useState<boolean>(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Candidate list sorting & filtering state
  const [sortField, setSortField] = useState<'score' | 'technical' | 'experience' | 'name'>('score');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSkillTag, setSelectedSkillTag] = useState<string | null>(null);

  // Expanded cards
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  // Candidate Compare Mode state
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Automated Email Template Generator Modal state
  const [emailModalCandidate, setEmailModalCandidate] = useState<Candidate | null>(null);
  const [emailModalInitialType, setEmailModalInitialType] = useState<EmailDraftType>('progress');
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);

  const handleOpenEmailDraftModal = (cand: Candidate, type?: EmailDraftType) => {
    const isReject = cand.decision_status?.includes('Not proceeding') || cand.recruiter_decision === 'reject';
    const chosenType = type || (isReject ? 'rejection' : 'progress');
    setEmailModalCandidate(cand);
    setEmailModalInitialType(chosenType);
    setShowEmailModal(true);
    appendAudit("Recruiter", `Opened AI follow-up email draft generator (${chosenType})`, `${cand.name} (${cand.candidate_id})`);
  };

  const handleQueueEmailDraft = (draft: OutreachDraft, reasonCategory: string) => {
    setOutreachQueue(prev => [draft, ...prev]);
    appendAudit(
      "Recruiter",
      `Queued AI-drafted ${draft.type} email for delivery (Reason: ${reasonCategory.replace(/_/g, ' ')})`,
      `${draft.candidate_name} (${draft.candidate_id})`
    );
  };

  // Bulk Action Selection State & Handlers
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const handleToggleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateIds(prev => 
      prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = sortedCandidates.map(c => c.candidate_id);
    setSelectedCandidateIds(filteredIds);
    appendAudit("Recruiter", `Selected all ${filteredIds.length} filtered candidates for bulk action`, `${filteredIds.length} Candidates`);
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds([]);
  };

  const handleSelectAboveCutoff = () => {
    const above = candidates.filter(c => c.overall_score >= cutoffScore).map(c => c.candidate_id);
    setSelectedCandidateIds(above);
    appendAudit("Recruiter", `Bulk selected ${above.length} candidates scoring above cutoff (>=${cutoffScore}%)`, `${above.length} Candidates`);
  };

  const handleBulkStageChange = (newStage: HiringStage, candidateIds: string[]) => {
    setCandidates(prev => prev.map(c => {
      if (!candidateIds.includes(c.candidate_id)) return c;
      let decision_status = c.decision_status;
      let recruiter_decision = c.recruiter_decision;
      let current_round = c.current_round;

      if (newStage === 'Rejected') {
        recruiter_decision = 'reject';
        decision_status = 'Not proceeding (recruiter decision)';
      } else if (newStage === 'Offered') {
        recruiter_decision = 'advance';
        decision_status = 'Hired by recruiter';
      } else if (newStage === 'Technical') {
        recruiter_decision = 'advance';
        decision_status = 'Advanced by recruiter';
        current_round = 'coding';
      } else if (newStage === 'Interview') {
        recruiter_decision = 'advance';
        decision_status = 'Advanced by recruiter';
        current_round = 'technical';
      } else if (newStage === 'Screening') {
        recruiter_decision = 'hold';
        decision_status = 'Pending recruiter review';
      }

      return {
        ...c,
        stage: newStage,
        decision_status,
        recruiter_decision,
        current_round
      };
    }));

    appendAudit(
      "Recruiter",
      `Bulk updated hiring stage to "${newStage}" for ${candidateIds.length} candidate(s)`,
      candidateIds.join(', ')
    );
  };

  const handleBulkAdvance = (candidateIds: string[]) => {
    setCandidates(prev => prev.map(c => {
      if (!candidateIds.includes(c.candidate_id)) return c;
      return {
        ...c,
        recruiter_decision: 'advance',
        decision_status: 'Advanced by recruiter'
      };
    }));

    appendAudit("Recruiter", `Bulk advanced ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkReject = (candidateIds: string[]) => {
    setCandidates(prev => prev.map(c => {
      if (!candidateIds.includes(c.candidate_id)) return c;
      return {
        ...c,
        recruiter_decision: 'reject',
        decision_status: 'Not proceeding (recruiter decision)'
      };
    }));

    appendAudit("Recruiter", `Bulk rejected ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkAssignCoding = (candidateIds: string[]) => {
    if (!brief) return;
    const challenge = recruitmentAgent.generateCodingChallenge(brief.job_title, 'Medium');
    setCandidates(prev => prev.map(c => {
      if (!candidateIds.includes(c.candidate_id)) return c;
      return {
        ...c,
        rounds: {
          ...c.rounds,
          coding: {
            ...c.rounds.coding,
            challenge_version: (c.rounds.coding?.challenge_version || 0) + 1,
            challenge,
            candidate_submission: challenge.starter_code
          }
        }
      };
    }));

    appendAudit("Agent", `Bulk assigned adaptive coding challenges to ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkQueueEmails = (drafts: OutreachDraft[], description: string) => {
    setOutreachQueue(prev => [...drafts, ...prev]);
    appendAudit(
      "Agent & Recruiter",
      `Bulk generated & queued ${drafts.length} follow-up emails (${description})`,
      `${drafts.length} Candidates`
    );
  };

  const appendAudit = (actor: string, action: string, subject: string) => {
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor,
      action,
      subject,
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const handleToggleCompareCandidate = (candidateId: string) => {
    setSelectedCompareIds(prev => {
      let next: string[];
      if (prev.includes(candidateId)) {
        next = prev.filter(id => id !== candidateId);
      } else if (prev.length >= 2) {
        next = [prev[0], candidateId];
      } else {
        next = [...prev, candidateId];
      }

      // If user just selected the 2nd candidate, auto open the comparison modal
      if (next.length === 2 && !prev.includes(candidateId)) {
        setShowCompareModal(true);
        const cA = candidates.find(c => c.candidate_id === next[0]);
        const cB = candidates.find(c => c.candidate_id === next[1]);
        appendAudit(
          "Recruiter",
          `Initiated candidate head-to-head radar comparison`,
          `${cA?.name || next[0]} vs ${cB?.name || next[1]}`
        );
      }
      return next;
    });
  };

  const handleLaunchCompare = (idA?: string, idB?: string) => {
    let finalA = idA;
    let finalB = idB;

    if (!finalA || !finalB) {
      if (selectedCompareIds.length >= 2) {
        finalA = selectedCompareIds[0];
        finalB = selectedCompareIds[1];
      } else if (selectedCompareIds.length === 1) {
        finalA = selectedCompareIds[0];
        const other = candidates.find(c => c.candidate_id !== finalA)?.candidate_id;
        finalB = other;
      } else if (sortedCandidates.length >= 2) {
        finalA = sortedCandidates[0]?.candidate_id;
        finalB = sortedCandidates[1]?.candidate_id;
      }
    }

    if (finalA && finalB && finalA !== finalB) {
      setSelectedCompareIds([finalA, finalB]);
      setShowCompareModal(true);
      const cA = candidates.find(c => c.candidate_id === finalA);
      const cB = candidates.find(c => c.candidate_id === finalB);
      appendAudit(
        "Recruiter",
        `Initiated candidate head-to-head radar comparison`,
        `${cA?.name || finalA} vs ${cB?.name || finalB}`
      );
    }
  };

  const handleRolePresetChange = (role: string) => {
    setSelectedRolePreset(role);
    setJobTitle(role);
    if (ROLE_REQUIREMENTS[role]) {
      setRequirementsText(ROLE_REQUIREMENTS[role].join(", "));
    }
  };

  const handleGenerateJd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !requirementsText.trim()) return;

    const { jd, rubric } = recruitmentAgent.generateJobDescription({
      company_name: companyName,
      job_title: jobTitle,
      location,
      headcount,
      salary_budget: salaryBudget,
      timeline,
      requirements: requirementsText,
    });

    const newBrief: HiringBrief = {
      company_name: companyName,
      job_title: jobTitle,
      location,
      headcount,
      salary_budget: salaryBudget,
      timeline,
      requirements: requirementsText,
      jd,
      status: 'Draft — recruiter review required',
      evaluation_rubric: rubric,
    };

    setBrief(newBrief);
    appendAudit("AI Agent", "AI drafted inclusive job description & rubric", jobTitle);
  };

  const handleApproveJd = () => {
    if (!brief) return;
    setBrief({
      ...brief,
      status: 'Approved by recruiter — publishing integration required',
    });
    appendAudit("Recruiter", "Approved job description for distribution", brief.job_title);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setResumeTextInput(content);
      if (!candidateNameInput) {
        setCandidateNameInput(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  const handleScreenResume = () => {
    if (!brief) return;
    if (!resumeTextInput.trim()) return;

    const requiredSkills = brief.requirements.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);

    const digitalSources = [];
    if (githubUrl.trim()) {
      digitalSources.push({
        source_type: "GitHub",
        source_ref: "github",
        source_location: githubUrl.trim(),
        content: "Candidate-provided link only; page content was not accessed or verified."
      });
    }
    if (linkedinUrl.trim()) {
      digitalSources.push({
        source_type: "LinkedIn",
        source_ref: "linkedin",
        source_location: linkedinUrl.trim(),
        content: "Candidate-provided link only."
      });
    }
    if (workHighlights.trim()) {
      digitalSources.push({
        source_type: "Candidate-submitted work highlights",
        source_ref: "work_highlights",
        source_location: "",
        content: workHighlights.trim()
      });
    }

    const screenedCandidate = recruitmentAgent.screenResume(
      candidateNameInput,
      candidateEmailInput,
      resumeTextInput,
      brief.job_title,
      requiredSkills,
      digitalSources,
      memoryConsent
    );

    setCandidates(prev => [screenedCandidate, ...prev]);
    setSelectedCandidateId(screenedCandidate.candidate_id);
    setExpandedCandidates(prev => ({ ...prev, [screenedCandidate.candidate_id]: true }));

    appendAudit(
      "AI Screener",
      `Screened resume with 6-dimension evaluation (Score: ${screenedCandidate.overall_score}%)`,
      `${brief.job_title}: ${screenedCandidate.candidate_id}`
    );

    // Reset screening form inputs
    setCandidateNameInput("");
    setCandidateEmailInput("");
    setResumeTextInput("");
    setGithubUrl("");
    setLinkedinUrl("");
    setPortfolioUrl("");
    setWorkHighlights("");
  };

  const toggleExpand = (candidateId: string) => {
    setExpandedCandidates(prev => ({
      ...prev,
      [candidateId]: !prev[candidateId]
    }));
  };

  // Recruiter actions on candidate
  const handleRecruiterDecision = (candidateId: string, decision: 'advance' | 'reject') => {
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      const status = decision === 'advance' 
        ? 'Advanced by recruiter' 
        : 'Not proceeding (recruiter decision)';
      return {
        ...c,
        recruiter_decision: decision,
        decision_status: status
      };
    }));

    const cand = candidates.find(c => c.candidate_id === candidateId);
    appendAudit(
      "Recruiter",
      `Recruiter marked candidate as ${decision === 'advance' ? 'Advanced' : 'Not proceeding'}`,
      `${brief?.job_title || 'Role'}: ${candidateId}`
    );

    // If advanced, auto-prepare round draft
    if (decision === 'advance' && cand) {
      const draft: OutreachDraft = {
        id: `draft-${Date.now()}`,
        type: 'round',
        candidate_id: cand.candidate_id,
        candidate_name: cand.name,
        candidate_email: cand.email,
        candidate_phone: cand.phone,
        round_name: 'coding',
        interview_format: 'Video interview with live coding exercise',
        subject: `Interview Invitation: ${brief?.job_title} at ${brief?.company_name || 'Our Company'}`,
        body: `Dear ${cand.name},\n\nWe were impressed by your background and would love to invite you to the Coding Round for the ${brief?.job_title} position.\n\nIn this round, you will be invited to complete an adaptive coding exercise and discuss system design.\n\nPlease let us know if the suggested availability works for you.\n\nBest regards,\nRecruitment Team`,
        call_script: `Hi ${cand.name}, this is the recruiter for ${brief?.company_name}. We're excited about your resume and would like to confirm your availability for the technical coding round.`,
        availability: "Upcoming weekdays, 10:00 AM – 4:00 PM EST",
        status: 'Draft — not sent or scheduled'
      };
      setOutreachQueue(prev => [...prev, draft]);
    } else if (decision === 'reject' && cand) {
      const draft: OutreachDraft = {
        id: `draft-${Date.now()}`,
        type: 'rejection',
        candidate_id: cand.candidate_id,
        candidate_name: cand.name,
        candidate_email: cand.email,
        candidate_phone: cand.phone,
        subject: `Application update regarding ${brief?.job_title} position`,
        body: `Dear ${cand.name},\n\nThank you very much for taking the time to apply for the ${brief?.job_title} role at ${brief?.company_name || 'our company'}. After careful consideration, we have decided to move forward with candidates whose experience more closely matches our immediate technical requirements.\n\nWe sincerely appreciate your interest and wish you the very best in your job search.\n\nWarm regards,\nRecruitment Team`,
        call_script: `Hi ${cand.name}, calling with an update regarding your application for the ${brief?.job_title} position. While your background is impressive, we have chosen to proceed with another profile for this role. We appreciate your time.`,
        availability: "N/A",
        status: 'Draft — not sent or scheduled'
      };
      setOutreachQueue(prev => [...prev, draft]);
    }
  };

  // Recruiter hiring stage update with automatic AuditEvent logging
  const handleStageChange = (candidateId: string, newStage: HiringStage) => {
    const candidate = candidates.find(c => c.candidate_id === candidateId);
    if (!candidate) return;
    const previousStage = getCandidateStage(candidate);
    if (previousStage === newStage) return;

    // 1. Update candidate state
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;

      let decision_status = c.decision_status;
      let recruiter_decision = c.recruiter_decision;
      let current_round = c.current_round;

      if (newStage === 'Rejected') {
        recruiter_decision = 'reject';
        decision_status = 'Not proceeding (recruiter decision)';
      } else if (newStage === 'Offered') {
        recruiter_decision = 'advance';
        decision_status = 'Hired by recruiter';
      } else if (newStage === 'Technical') {
        recruiter_decision = 'advance';
        decision_status = 'Advanced by recruiter';
        current_round = 'coding';
      } else if (newStage === 'Interview') {
        recruiter_decision = 'advance';
        decision_status = 'Advanced by recruiter';
        current_round = 'technical';
      } else if (newStage === 'Screening') {
        recruiter_decision = 'hold';
        decision_status = 'Pending recruiter review';
      }

      return {
        ...c,
        stage: newStage,
        decision_status,
        recruiter_decision,
        current_round,
      };
    }));

    // 2. Automatically append an entry to the AuditEvent log
    appendAudit(
      "Recruiter",
      `Updated candidate hiring stage to "${newStage}" (from "${previousStage}")`,
      `${brief?.job_title || 'Role'}: ${candidate.name} (${candidateId})`
    );
  };

  // Recruiter private notes update with local state persistence and AuditEvent logging
  const handleSaveCandidateNotes = (candidateId: string, notes: string) => {
    const candidate = candidates.find(c => c.candidate_id === candidateId);
    if (!candidate) return;

    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      return {
        ...c,
        private_notes: notes,
        notes_updated_at: `Today at ${formattedTime}`,
      };
    }));

    appendAudit(
      "Recruiter",
      "Saved confidential recruiter notes",
      `${candidate.name} (${candidateId})`
    );
  };

  // Coding round actions
  const handleGenerateCoding = (candidateId: string) => {
    if (!brief) return;
    const challenge = recruitmentAgent.generateCodingChallenge(brief.job_title, 'Medium');
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      return {
        ...c,
        rounds: {
          ...c.rounds,
          coding: {
            ...c.rounds.coding,
            challenge_version: (c.rounds.coding?.challenge_version || 0) + 1,
            challenge,
            candidate_submission: challenge.starter_code
          }
        }
      };
    }));
    appendAudit("Agent", "Agent planned & generated adaptive coding challenge", candidateId);
  };

  const handleEvaluateCoding = (candidateId: string) => {
    const candidate = candidates.find(c => c.candidate_id === candidateId);
    const round = candidate?.rounds.coding;
    if (!round?.challenge || !round.candidate_submission) return;

    const evaluation = recruitmentAgent.evaluateCodingSubmission(round.challenge, round.candidate_submission);
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      return {
        ...c,
        rounds: {
          ...c.rounds,
          coding: {
            ...c.rounds.coding,
            evaluation
          }
        }
      };
    }));
    appendAudit("Agent", `Agent evaluated coding submission (Score: ${evaluation.score}/100)`, candidateId);
  };

  const handleRoundDecision = (candidateId: string, roundName: RoundType, decision: 'pass' | 'not_proceeding') => {
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      const roundData = c.rounds[roundName] || {};
      const nextRound: RoundType = roundName === 'coding' ? 'technical' : roundName === 'technical' ? 'hr' : 'hr';
      return {
        ...c,
        current_round: decision === 'pass' ? nextRound : c.current_round,
        decision_status: decision === 'pass' && roundName === 'hr' ? 'Hired by recruiter' : c.decision_status,
        rounds: {
          ...c.rounds,
          [roundName]: {
            ...roundData,
            decision
          }
        }
      };
    }));
    appendAudit("Recruiter", `Recruiter ${decision === 'pass' ? 'passed' : 'ended process after'} ${roundName} round`, candidateId);
  };

  // Generate Technical Questions
  const handleGenerateTechnicalQuestions = (candidateId: string) => {
    if (!brief) return;
    const questions = recruitmentAgent.generateRoundQuestions('technical', brief.job_title);
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      return {
        ...c,
        rounds: {
          ...c.rounds,
          technical: {
            ...c.rounds.technical,
            questions,
            answers: questions.map(() => "")
          }
        }
      };
    }));
    appendAudit("Agent", "Agent generated technical interview questions", candidateId);
  };

  // Evaluate Technical Questions
  const handleEvaluateTechnical = (candidateId: string) => {
    const candidate = candidates.find(c => c.candidate_id === candidateId);
    const round = candidate?.rounds.technical;
    if (!round?.questions || !round.answers) return;

    const evaluation = recruitmentAgent.reflectOnInterviewAnswers('technical', round.questions, round.answers);
    setCandidates(prev => prev.map(c => {
      if (c.candidate_id !== candidateId) return c;
      return {
        ...c,
        rounds: {
          ...c.rounds,
          technical: {
            ...c.rounds.technical,
            evaluation
          }
        }
      };
    }));
    appendAudit("Agent", "Agent reflected on technical interview evidence", candidateId);
  };

  // Outreach draft approval
  const handleApproveDraft = (draftId: string) => {
    setOutreachQueue(prev => prev.map(d => {
      if (d.id !== draftId) return d;
      return {
        ...d,
        status: 'Recruiter approved — integration required; not sent or called'
      };
    }));
    appendAudit("Recruiter", "Approved communication draft", draftId);
  };

  const handleDownloadDraft = (draft: OutreachDraft) => {
    const text = `To: ${draft.candidate_email}\nSubject: ${draft.subject}\n\n${draft.body}\n\nCall Script:\n${draft.call_script}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.candidate_id.toLowerCase()}-${draft.type}-draft.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sorted and filtered candidates based on active sorting criteria
  const sortedCandidates = useMemo(() => {
    let result = [...candidates];

    // Filter by decision status
    if (statusFilter !== 'all') {
      result = result.filter(c => {
        if (statusFilter === 'advanced') {
          return c.decision_status.includes('Advanced') || c.decision_status.includes('Hired');
        }
        if (statusFilter === 'pending') {
          return c.decision_status.includes('Pending');
        }
        if (statusFilter === 'not_proceeding') {
          return c.decision_status.includes('Not proceeding');
        }
        if (['Screening', 'Technical', 'Interview', 'Offered', 'Rejected'].includes(statusFilter)) {
          return getCandidateStage(c) === statusFilter;
        }
        return true;
      });
    }

    // Filter by search query (name or skill tags)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => {
        // Match by candidate name, ID, or email
        const matchesName = c.name.toLowerCase().includes(q) || 
                            c.candidate_id.toLowerCase().includes(q) ||
                            c.email.toLowerCase().includes(q);

        // Match by skill tags in skill_scores
        const skillKeys = Object.keys(c.skill_scores || {});
        const matchesSkills = skillKeys.some(skill => skill.toLowerCase().includes(q));

        // Match by strengths or weaknesses
        const matchesStrengths = c.strengths?.some(s => s.toLowerCase().includes(q));
        const matchesWeaknesses = c.detailed_weaknesses?.some(w => w.skill.toLowerCase().includes(q));

        return matchesName || matchesSkills || matchesStrengths || matchesWeaknesses;
      });
    }

    // Filter by selected skill tag pill
    if (selectedSkillTag) {
      const targetSkill = selectedSkillTag.toLowerCase();
      result = result.filter(c => {
        const skillKeys = Object.keys(c.skill_scores || {});
        return skillKeys.some(skill => skill.toLowerCase() === targetSkill);
      });
    }

    // Rank and sort candidates
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'score') {
        comparison = b.overall_score - a.overall_score;
      } else if (sortField === 'technical') {
        comparison = (b.dimension_scores?.technical ?? 0) - (a.dimension_scores?.technical ?? 0);
      } else if (sortField === 'experience') {
        comparison = (b.dimension_scores?.experience ?? 0) - (a.dimension_scores?.experience ?? 0);
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      }
      
      if (comparison === 0) {
        comparison = a.candidate_id.localeCompare(b.candidate_id);
      }

      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [candidates, sortField, sortDirection, statusFilter, searchQuery, selectedSkillTag]);

  // Unique skill tags across candidates in the pool with counts
  const availableSkillTags = useMemo(() => {
    const map = new Map<string, number>();
    candidates.forEach(c => {
      Object.keys(c.skill_scores || {}).forEach(skill => {
        map.set(skill, (map.get(skill) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skill, count]) => ({ skill, count }));
  }, [candidates]);

  // Aggregate stats of candidate score distribution
  const scoreStats = useMemo(() => {
    if (candidates.length === 0) return { max: 0, min: 0, avg: 0 };
    const scores = candidates.map(c => c.overall_score);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { max, min, avg };
  }, [candidates]);

  // Active candidate for the radar chart
  const activeCandidate = candidates.find(c => c.candidate_id === selectedCandidateId) || sortedCandidates[0] || candidates[0];

  // Candidates for comparison modal
  const compareCandA = candidates.find(c => c.candidate_id === selectedCompareIds[0]) || sortedCandidates[0] || candidates[0];
  const compareCandB = candidates.find(c => c.candidate_id === selectedCompareIds[1]) || sortedCandidates.find(c => c.candidate_id !== compareCandA?.candidate_id) || sortedCandidates[1] || candidates[1];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. Hiring Brief Section */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 text-[#6743ee] rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">1. Hiring Brief</h2>
            <p className="text-xs text-slate-500">Define the organizational requirements and technical criteria</p>
          </div>
        </div>

        {/* Role Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preset Job Role Templates</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(ROLE_REQUIREMENTS).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRolePresetChange(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedRolePreset === role
                    ? 'bg-[#6743ee] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGenerateJd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Anthropic Tech"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA / Remote"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Headcount / Vacancies</label>
              <input
                type="number"
                min="1"
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Budget</label>
              <input
                type="text"
                value={salaryBudget}
                onChange={(e) => setSalaryBudget(e.target.value)}
                placeholder="e.g. $160,000 – $210,000"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hiring Timeline</label>
              <input
                type="text"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. Within 30 days"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Required Skills and Eligibility Criteria (comma or line separated) *
            </label>
            <textarea
              value={requirementsText}
              onChange={(e) => setRequirementsText(e.target.value)}
              rows={3}
              required
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate JD Draft with AI Agent
          </button>
        </form>
      </section>

      {/* 2. Review and Approve JD */}
      {brief && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Review and Approve Job Description</h2>
                <p className="text-xs text-slate-500">Recruiter must inspect and approve before candidate screening</p>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${
              brief.status.includes('Approved') 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {brief.status}
            </span>
          </div>

          <textarea
            value={brief.jd}
            onChange={(e) => setBrief({ ...brief, jd: e.target.value })}
            disabled={brief.status.includes('Approved')}
            rows={10}
            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
          />

          {!brief.status.includes('Approved') ? (
            <button
              onClick={handleApproveJd}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve JD for Publication & Candidate Screening
            </button>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                JD Approved by Recruiter
              </div>
              <p>Job Distribution Agent prepared the approved multi-channel checklist (LinkedIn, Indeed, Internal Careers, Tech Boards). Candidates can now be screened.</p>
            </div>
          )}

          {/* Evaluation Rubric preview */}
          {brief.evaluation_rubric && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="font-bold text-slate-800">Job Intelligence Agent: 6-Dimension Rubric</div>
              <p className="text-slate-500">{brief.evaluation_rubric.scoring_scale}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {brief.evaluation_rubric.criteria.map((c, i) => (
                  <div key={i} className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800 block">{c.criterion}</span>
                    <span className="text-[10px] text-purple-600 font-bold">{c.weight_percent}% Weight</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. Screen Candidate Resumes */}
      {brief && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">3. Screen Candidate Resumes</h2>
              <p className="text-xs text-slate-500">
                Parsing → Information extraction → PII redaction → 6-Dimension semantic matching
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Name (Optional)</label>
              <input
                type="text"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                placeholder="e.g. Elena Rostova"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Email (for Persistent Memory)</label>
              <input
                type="email"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
                placeholder="e.g. elena.rostova@example.com"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              />
            </div>
          </div>

          {/* Upload or paste */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">Resume Content (PDF / TXT upload or paste)</label>
              <label className="text-xs font-medium text-[#6743ee] cursor-pointer hover:underline flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                Upload file
                <input type="file" accept=".txt,.pdf" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              value={resumeTextInput}
              onChange={(e) => setResumeTextInput(e.target.value)}
              rows={5}
              placeholder="Paste candidate resume text or upload above..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
            />
          </div>

          {/* Digital Profile Sources Accordion */}
          <details className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <summary className="font-semibold text-slate-700 cursor-pointer">
              Candidate-submitted digital profile sources (Optional)
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="GitHub Profile URL"
                className="text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
              />
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn Profile URL"
                className="text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
              />
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="Portfolio URL"
                className="text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <textarea
              value={workHighlights}
              onChange={(e) => setWorkHighlights(e.target.value)}
              placeholder="Candidate-submitted project, hackathon, or research highlights..."
              rows={2}
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 mt-2"
            />
          </details>

          {/* Consent Checkboxes */}
          <div className="space-y-2 text-xs text-slate-600 pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={processingConsent}
                onChange={(e) => setProcessingConsent(e.target.checked)}
                className="mt-0.5 accent-[#6743ee]"
              />
              <span>I confirm these resumes were submitted for hiring and may be processed for this role.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={memoryConsent}
                onChange={(e) => setMemoryConsent(e.target.checked)}
                className="mt-0.5 accent-[#6743ee]"
              />
              <span>I confirm the candidate gave informed consent to retain full hiring history in organizational memory.</span>
            </label>
          </div>

          <button
            onClick={handleScreenResume}
            disabled={!resumeTextInput.trim() || !processingConsent || !brief.status.includes('Approved')}
            className="px-5 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Screen Candidate Resume
          </button>
        </section>
      )}

      {/* 4. Candidate Insights Radar & Overview */}
      {candidates.length > 0 && (
        <section className="space-y-6">
          <SkillRadarChart
            skillScores={activeCandidate?.skill_scores}
            overallScore={activeCandidate?.overall_score}
            selected={activeCandidate?.decision_status === 'Advanced by recruiter' || activeCandidate?.decision_status === 'Hired by recruiter'}
          />

          {/* 5. Candidate Ranking & Recruiter Supervision */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>4. Recruiter Supervision & Candidate Pipeline</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-[#5b43d6]">
                    {candidates.length} {candidates.length === 1 ? 'Candidate' : 'Candidates'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Ranked by multi-dimensional AI evaluation scores. The recruiter oversees evidence and approves each decision.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-purple-50 text-[#5b43d6] border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#6743ee]" />
                  <span>
                    {sortField === 'score'
                      ? `Ranked by AI Score (${sortDirection === 'desc' ? 'Highest first' : 'Lowest first'})`
                      : `Sorted by ${sortField}`}
                  </span>
                </span>
              </div>
            </div>

            {/* Candidate Sorting Component */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left title & quick rank */}
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 text-[#6743ee] shadow-2xs">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Rank & Sort Candidates</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        Showing {sortedCandidates.length} of {candidates.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Rank candidates by overall AI evaluation score, technical strength, or experience.
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSortField('score');
                      setSortDirection('desc');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                      sortField === 'score' && sortDirection === 'desc'
                        ? 'bg-[#6743ee] text-white shadow-xs ring-2 ring-[#6743ee]/30'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-[#6743ee]'
                    }`}
                    title="Rank all candidates by their AI-generated evaluation score (Highest First)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rank by AI Score</span>
                    {sortField === 'score' && sortDirection === 'desc' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCandidates(sortedCandidates);
                      appendAudit(
                        "Recruiter",
                        `Saved pipeline ranking order (${sortField === 'score' ? 'AI evaluation score' : sortField})`,
                        brief?.job_title || 'Role Pipeline'
                      );
                    }}
                    className="px-2.5 py-1.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium transition-all shadow-2xs"
                    title="Persist this ranked order into the candidate list"
                  >
                    Lock Pipeline Order
                  </button>

                  {/* Compare Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompareMode(prev => !prev);
                      if (!isCompareMode && selectedCompareIds.length < 2 && sortedCandidates.length >= 2) {
                        setSelectedCompareIds([sortedCandidates[0].candidate_id, sortedCandidates[1].candidate_id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                      isCompareMode
                        ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-500/30'
                        : selectedCompareIds.length > 0
                        ? 'bg-teal-50 text-teal-800 border border-teal-300'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-teal-700'
                    }`}
                    title="Toggle Compare Mode to pick 2 candidates and view their radar charts side-by-side"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Compare Mode</span>
                    {selectedCompareIds.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isCompareMode ? 'bg-white/25 text-white' : 'bg-teal-200 text-teal-900'
                      }`}>
                        {selectedCompareIds.length}/2
                      </span>
                    )}
                  </button>

                  {/* Quick Launch Compare Modal */}
                  {candidates.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleLaunchCompare()}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs bg-gradient-to-r from-[#6743ee] to-teal-600 hover:from-[#5637d2] hover:to-teal-700 text-white"
                      title="View side-by-side radar charts and strength differences"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Compare Radars</span>
                    </button>
                  )}

                  {(sortField !== 'score' || sortDirection !== 'desc' || statusFilter !== 'all' || searchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSortField('score');
                        setSortDirection('desc');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                      title="Reset sorting and filters to default AI Score rank"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sorting Criteria Tabs & Direction Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Sort By:
                  </span>

                  {/* 1. Overall AI Score */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'score') {
                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortField('score');
                        setSortDirection('desc');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sortField === 'score'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-[#6743ee]" />
                    <span>AI Evaluation Score</span>
                    {sortField === 'score' && (
                      sortDirection === 'desc' 
                        ? <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#6743ee]" /> 
                        : <ArrowUpNarrowWide className="w-3.5 h-3.5 text-[#6743ee]" />
                    )}
                  </button>

                  {/* 2. Technical Skills */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'technical') {
                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortField('technical');
                        setSortDirection('desc');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sortField === 'technical'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Technical (30%)</span>
                    {sortField === 'technical' && (
                      sortDirection === 'desc' 
                        ? <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#6743ee]" /> 
                        : <ArrowUpNarrowWide className="w-3.5 h-3.5 text-[#6743ee]" />
                    )}
                  </button>

                  {/* 3. Experience */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'experience') {
                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortField('experience');
                        setSortDirection('desc');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sortField === 'experience'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Experience (20%)</span>
                    {sortField === 'experience' && (
                      sortDirection === 'desc' 
                        ? <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#6743ee]" /> 
                        : <ArrowUpNarrowWide className="w-3.5 h-3.5 text-[#6743ee]" />
                    )}
                  </button>

                  {/* 4. Candidate Name */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'name') {
                        setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortField('name');
                        setSortDirection('asc');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sortField === 'name'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Name (A-Z)</span>
                    {sortField === 'name' && (
                      sortDirection === 'asc' 
                        ? <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#6743ee]" /> 
                        : <ArrowUpNarrowWide className="w-3.5 h-3.5 text-[#6743ee]" />
                    )}
                  </button>
                </div>

                {/* Direction Toggle */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] text-slate-500 font-medium">Direction:</span>
                  <button
                    type="button"
                    onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-md text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#6743ee]" />
                    <span>{sortDirection === 'desc' ? 'High to Low' : 'Low to High'}</span>
                  </button>
                </div>
              </div>

              {/* Dedicated Search Bar by Name or Skill Tags */}
              <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Search Bar Input */}
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search candidates by name or skill tags (e.g. Python, MLOps, Alex, Deep Learning)..."
                      className="w-full text-xs pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6743ee]/30 focus:border-[#6743ee] shadow-2xs transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status & Stage Filter Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-500">Stage:</span>
                    {(['all', 'Screening', 'Technical', 'Interview', 'Offered', 'Rejected'] as const).map(status => {
                      const count = status === 'all' 
                        ? candidates.length 
                        : candidates.filter(c => getCandidateStage(c) === status).length;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatusFilter(status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            statusFilter === status
                              ? 'bg-slate-800 text-white font-bold shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {status === 'all' ? `All (${count})` : `${status} (${count})`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Skill Tag Filter Chips */}
                {availableSkillTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                      <Tag className="w-3 h-3 text-[#6743ee]" />
                      Skill Tags:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSkillTag(null)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                        selectedSkillTag === null
                          ? 'bg-[#6743ee] text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Skills
                    </button>
                    {availableSkillTags.slice(0, 10).map(({ skill, count }) => {
                      const isActive = selectedSkillTag === skill;
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            if (selectedSkillTag === skill) {
                              setSelectedSkillTag(null);
                            } else {
                              setSelectedSkillTag(skill);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                            isActive
                              ? 'bg-[#6743ee] text-white font-semibold shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-[#6743ee]/50 hover:bg-purple-50 hover:text-[#5b43d6]'
                          }`}
                        >
                          <span>{skill}</span>
                          <span className={`text-[10px] px-1 py-0.2 rounded-full ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    {selectedSkillTag && (
                      <button
                        type="button"
                        onClick={() => setSelectedSkillTag(null)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" />
                        Clear filter
                      </button>
                    )}
                  </div>
                )}

                {/* Active Filter Notification Bar */}
                {(searchQuery.trim() || selectedSkillTag || statusFilter !== 'all') && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-purple-50/70 border border-purple-200/80 rounded-lg text-[11px] text-[#5b43d6]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">Active filters:</span>
                      {searchQuery.trim() && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-purple-900 border border-purple-200 font-medium">
                          Search: "{searchQuery.trim()}"
                        </span>
                      )}
                      {selectedSkillTag && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-purple-900 border border-purple-200 font-medium">
                          Skill: {selectedSkillTag}
                        </span>
                      )}
                      {statusFilter !== 'all' && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-purple-900 border border-purple-200 font-medium capitalize">
                          Status: {statusFilter.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-slate-500 ml-1">
                        — found {sortedCandidates.length} matching {sortedCandidates.length === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSkillTag(null);
                        setStatusFilter('all');
                      }}
                      className="text-xs font-bold text-[#6743ee] hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Score Benchmark Metrics Strip */}
              {scoreStats.max > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>Top AI Score: <strong className="text-[#6743ee] font-bold">{scoreStats.max}%</strong></span>
                    <span>•</span>
                    <span>Average: <strong className="text-slate-800 font-bold">{scoreStats.avg}%</strong></span>
                    <span>•</span>
                    <span>Lowest: <strong className="text-slate-700 font-bold">{scoreStats.min}%</strong></span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Click any candidate card to focus on their Skill Radar snapshot above.
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Compare Mode Banner */}
            {(isCompareMode || selectedCompareIds.length > 0) && (
              <div className="p-4 bg-gradient-to-r from-purple-50/90 via-teal-50/70 to-purple-50/90 border border-purple-200 rounded-xl space-y-2.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#6743ee] text-white rounded-lg shadow-2xs shrink-0">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Candidate Head-to-Head Compare Mode</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          selectedCompareIds.length === 2 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-purple-100 text-[#5b43d6] border border-purple-300'
                        }`}>
                          {selectedCompareIds.length === 2 ? '2 of 2 selected — Ready to Compare' : `${selectedCompareIds.length} of 2 selected`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {selectedCompareIds.length === 2
                          ? 'Both candidates selected. Click "Launch Side-by-Side Comparison" to analyze their 6-dimension radars.'
                          : selectedCompareIds.length === 1
                          ? 'Select 1 more candidate from the list below to complete the side-by-side comparison pair.'
                          : 'Click "Compare" on any two candidate cards below to evaluate their radar charts side-by-side.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedCompareIds.length === 2 ? (
                      <button
                        type="button"
                        onClick={() => handleLaunchCompare()}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#6743ee] to-teal-600 hover:from-[#5637d2] hover:to-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Launch Side-by-Side Comparison</span>
                      </button>
                    ) : (
                      sortedCandidates.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleLaunchCompare(sortedCandidates[0].candidate_id, sortedCandidates[1].candidate_id);
                          }}
                          className="px-3 py-1.5 bg-white text-[#6743ee] border border-purple-300 hover:bg-purple-50 rounded-lg text-xs font-bold transition-all shadow-2xs"
                        >
                          Auto-Select Top 2
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompareIds([]);
                        setIsCompareMode(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg text-xs"
                      title="Exit Compare Mode"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Candidate Pills in Selection */}
                {selectedCompareIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-200/60 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comparing Pair:</span>
                    {selectedCompareIds.map((id, idx) => {
                      const cand = candidates.find(c => c.candidate_id === id);
                      const isA = idx === 0;
                      return (
                        <div 
                          key={id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shadow-2xs ${
                            isA 
                              ? 'bg-purple-100 border-purple-300 text-[#5b43d6]' 
                              : 'bg-teal-100 border-teal-300 text-teal-800'
                          }`}
                        >
                          <span className="font-bold text-[10px] uppercase">{isA ? 'Candidate A:' : 'Candidate B:'}</span>
                          <strong className="font-bold">{cand?.name || id}</strong>
                          <span className="text-[10px] opacity-80">({cand?.overall_score}%)</span>
                          <button
                            type="button"
                            onClick={() => handleToggleCompareCandidate(id)}
                            className="hover:text-rose-600 ml-1 p-0.5 rounded hover:bg-black/5"
                            title="Remove candidate from comparison"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    {selectedCompareIds.length === 1 && (
                      <span className="text-slate-500 italic text-[11px]">+ Select 1 more candidate from the list below</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Candidate List Selection & Bulk Control Strip */}
            {sortedCandidates.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 bg-slate-100/90 border border-slate-200/90 rounded-xl text-xs">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const isAllSelected = sortedCandidates.length > 0 && sortedCandidates.every(c => selectedCandidateIds.includes(c.candidate_id));
                      if (isAllSelected) {
                        handleDeselectAll();
                      } else {
                        handleSelectAllFiltered();
                      }
                    }}
                    className="flex items-center gap-2 font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    {sortedCandidates.length > 0 && sortedCandidates.every(c => selectedCandidateIds.includes(c.candidate_id)) ? (
                      <CheckSquare className="w-4 h-4 text-[#6743ee]" />
                    ) : sortedCandidates.some(c => selectedCandidateIds.includes(c.candidate_id)) ? (
                      <MinusSquare className="w-4 h-4 text-[#6743ee]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {selectedCandidateIds.length > 0 
                        ? `${selectedCandidateIds.length} of ${sortedCandidates.length} Selected` 
                        : `Select All Filtered (${sortedCandidates.length})`}
                    </span>
                  </button>

                  {selectedCandidateIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-[11px] text-slate-500 hover:text-rose-600 underline font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAboveCutoff}
                    className="px-2 py-1 rounded bg-white hover:bg-purple-50 text-slate-700 hover:text-[#5b43d6] border border-slate-200 text-[11px] font-medium flex items-center gap-1 shadow-2xs transition-colors"
                    title={`Select candidates with AI evaluation score >= ${cutoffScore}%`}
                  >
                    <Award className="w-3 h-3 text-[#6743ee]" />
                    <span>Select Above Cutoff (≥{cutoffScore}%)</span>
                  </button>

                  <span className="hidden sm:inline text-[11px] text-slate-400">
                    Check cards to enable bulk action toolbar
                  </span>
                </div>
              </div>
            )}

            {/* Candidate List with Rank Indicators */}
            <div className="space-y-4">
              {sortedCandidates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-slate-600 font-medium text-xs">No candidates match the current filter or search criteria.</p>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                    className="px-3 py-1 bg-[#6743ee] text-white text-xs font-semibold rounded-lg hover:bg-[#5637d2]"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                sortedCandidates.map((cand, index) => {
                  const isExpanded = !!expandedCandidates[cand.candidate_id];
                  const codingRound = cand.rounds.coding;
                  const techRound = cand.rounds.technical;
                  const isTopRanked = index === 0 && sortField === 'score' && sortDirection === 'desc';
                  const isSelectedInRadar = cand.candidate_id === activeCandidate?.candidate_id;
                  const isSelectedForBulk = selectedCandidateIds.includes(cand.candidate_id);

                  return (
                    <div
                      key={cand.candidate_id}
                      className={`border rounded-xl overflow-hidden bg-white shadow-xs transition-all ${
                        isSelectedForBulk
                          ? 'border-[#6743ee] ring-2 ring-[#6743ee]/30 bg-purple-50/15'
                          : isSelectedInRadar
                          ? 'border-[#6743ee] ring-2 ring-[#6743ee]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Header bar */}
                      <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Bulk Selection Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectCandidate(cand.candidate_id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-[#6743ee] transition-colors shrink-0"
                            title={isSelectedForBulk ? "Deselect candidate" : "Select candidate for bulk actions"}
                          >
                            {isSelectedForBulk ? (
                              <CheckSquare className="w-5 h-5 text-[#6743ee]" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>

                          {/* Score Box with Rank Position Badge */}
                          <div className="relative shrink-0">
                            <div className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center shadow-2xs ${
                              isTopRanked
                                ? 'bg-gradient-to-tr from-[#6743ee] to-[#8a72ff] text-white'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {cand.overall_score}%
                            </div>
                            {sortField === 'score' && (
                              <span className={`absolute -top-1.5 -left-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black border shadow-2xs ${
                                isTopRanked
                                  ? 'bg-amber-400 text-slate-900 border-amber-300'
                                  : 'bg-white text-purple-900 border-purple-200'
                              }`}>
                                #{index + 1}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{cand.name}</span>
                              <span className="text-xs text-slate-400 font-mono">({cand.candidate_id})</span>
                              {isTopRanked && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                  <Award className="w-3 h-3 text-amber-600" />
                                  Top Ranked AI Match
                                </span>
                              )}
                              {isSelectedInRadar ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#6743ee]/10 text-[#6743ee] border border-[#6743ee]/30 flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  Active in Radar
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedCandidateId(cand.candidate_id)}
                                  className="px-2 py-0.5 rounded-full text-[10px] text-slate-500 hover:text-[#6743ee] hover:bg-purple-50 border border-slate-200 transition-colors flex items-center gap-1"
                                  title="View this candidate's radar insights in the overview section"
                                >
                                  <Eye className="w-3 h-3" />
                                  Inspect Radar
                                </button>
                              )}
                              {cand.private_notes && (
                                <span 
                                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-[#6743ee] border border-purple-200 flex items-center gap-1"
                                  title={`Confidential recruiter note recorded (${cand.notes_updated_at || 'Saved'})`}
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  Notes
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              <span>{cand.email}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-800">Stage: {getCandidateStage(cand)}</span>
                              <span>•</span>
                              <span className="font-medium text-slate-600">Round: {cand.current_round.toUpperCase()}</span>
                              <span>•</span>
                              <span className="text-slate-600">Tech Score: {cand.dimension_scores.technical}%</span>
                            </div>

                            {/* Candidate Verified Skill Tags with Instant Filtering */}
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {Object.entries(cand.skill_scores || {}).slice(0, 6).map(([skill, score]) => {
                                const isSkillMatch = searchQuery.trim() && skill.toLowerCase().includes(searchQuery.toLowerCase().trim());
                                const isFilterMatch = selectedSkillTag && skill.toLowerCase() === selectedSkillTag.toLowerCase();
                                const isHighlighted = isSkillMatch || isFilterMatch;

                                return (
                                  <button
                                    key={skill}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedSkillTag === skill) {
                                        setSelectedSkillTag(null);
                                      } else {
                                        setSelectedSkillTag(skill);
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                      isHighlighted
                                        ? 'bg-[#6743ee] text-white font-bold ring-2 ring-[#6743ee]/30'
                                        : 'bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 border border-slate-200'
                                    }`}
                                    title={`Click to filter list by skill tag: ${skill}`}
                                  >
                                    <Tag className="w-2.5 h-2.5 opacity-60" />
                                    <span>{skill}</span>
                                    <span className={`text-[9px] font-bold ${isHighlighted ? 'text-white/90' : 'text-slate-400'}`}>
                                      {score}/10
                                    </span>
                                  </button>
                                );
                              })}
                              {Object.keys(cand.skill_scores || {}).length > 6 && (
                                <span className="text-[10px] text-slate-400 ml-0.5">
                                  +{Object.keys(cand.skill_scores || {}).length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Compare Selection Button on Card */}
                          <button
                            type="button"
                            onClick={() => handleToggleCompareCandidate(cand.candidate_id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              selectedCompareIds.includes(cand.candidate_id)
                                ? selectedCompareIds[0] === cand.candidate_id
                                  ? 'bg-purple-100 text-[#5b43d6] border border-purple-300 shadow-2xs font-bold ring-1 ring-purple-300'
                                  : 'bg-teal-100 text-teal-800 border border-teal-300 shadow-2xs font-bold ring-1 ring-teal-300'
                                : isCompareMode
                                ? 'bg-purple-50 text-[#6743ee] hover:bg-purple-100 border border-purple-200'
                                : 'bg-white text-slate-600 hover:text-[#6743ee] hover:bg-slate-50 border border-slate-200'
                            }`}
                            title={
                              selectedCompareIds.includes(cand.candidate_id)
                                ? "Selected for comparison (Click to remove)"
                                : "Select this candidate for side-by-side radar comparison"
                            }
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>
                              {selectedCompareIds.includes(cand.candidate_id)
                                ? selectedCompareIds[0] === cand.candidate_id ? 'Compare [A]' : 'Compare [B]'
                                : 'Compare'}
                            </span>
                          </button>

                          {/* AI Follow-Up Email Trigger Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEmailDraftModal(cand)}
                            className="px-2.5 py-1 bg-white hover:bg-purple-50 text-[#6743ee] hover:text-[#5637d2] border border-purple-200 hover:border-purple-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                            title="Draft personalized follow-up email based on progression or rejection reasons"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#6743ee]" />
                            <span>Draft Email</span>
                          </button>

                          {/* Hiring Stage Dropdown Menu */}
                          <CandidateStageDropdown
                            currentStage={getCandidateStage(cand)}
                            onStageChange={(newStage) => handleStageChange(cand.candidate_id, newStage)}
                            candidateName={cand.name}
                            candidateId={cand.candidate_id}
                          />

                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            cand.decision_status.includes('Advanced') || cand.decision_status.includes('Hired')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : cand.decision_status.includes('Not proceeding')
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {cand.decision_status}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRecruiterDecision(cand.candidate_id, 'advance')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Advance
                            </button>
                            <button
                              onClick={() => handleRecruiterDecision(cand.candidate_id, 'reject')}
                              className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors"
                            >
                              Reject
                            </button>
                          </div>

                          <button
                            onClick={() => toggleExpand(cand.candidate_id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title={isExpanded ? "Collapse candidate details" : "Expand candidate details"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="p-5 space-y-6 text-xs">
                        {/* 6 Dimension Radar Chart & Breakdown */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#6743ee]" />
                              Individual Evaluation Radar & Dimension Evidence
                            </span>
                            {sortedCandidates.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const other = sortedCandidates.find(c => c.candidate_id !== cand.candidate_id);
                                  if (other) {
                                    handleLaunchCompare(cand.candidate_id, other.candidate_id);
                                  }
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-purple-50 text-[#6743ee] font-bold border border-purple-200 hover:border-purple-300 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                                title="Open head-to-head comparison with another candidate"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Compare Side-by-Side</span>
                              </button>
                            )}
                          </div>
                          <CandidateDimensionRadar
                            scores={cand.dimension_scores}
                            candidateName={cand.name}
                            evidence={cand.dimension_evidence}
                            cutoffScore={cutoffScore}
                          />
                        </div>

                        {/* Pipeline Stage Progression Stepper */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#6743ee]" />
                              Hiring Stage Pipeline Journey
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Active Stage: <strong className="text-slate-900 font-bold">{getCandidateStage(cand)}</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                            {(['Screening', 'Technical', 'Interview', 'Offered'] as const).map((stg, idx) => {
                              const candStage = getCandidateStage(cand);
                              const stagesOrder = ['Screening', 'Technical', 'Interview', 'Offered'];
                              const isCurrent = candStage === stg;
                              const isPassed = stagesOrder.indexOf(candStage) > idx;
                              const isRejected = candStage === 'Rejected';

                              return (
                                <button
                                  key={stg}
                                  type="button"
                                  onClick={() => handleStageChange(cand.candidate_id, stg)}
                                  className={`p-2 rounded-lg border text-left transition-all ${
                                    isCurrent
                                      ? 'bg-purple-100/70 border-purple-300 text-[#5b43d6] font-bold ring-2 ring-purple-400/20'
                                      : isPassed && !isRejected
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                                      : isRejected
                                      ? 'bg-slate-100/70 border-slate-200 text-slate-400'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                  title={`Click to transition stage to ${stg}`}
                                >
                                  <div className="text-[9px] text-slate-400 uppercase font-mono tracking-wider flex items-center justify-between">
                                    <span>Step {idx + 1}</span>
                                    {isPassed && !isRejected && <span className="text-emerald-600">✓</span>}
                                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#6743ee]" />}
                                  </div>
                                  <div className="font-bold mt-0.5">{stg}</div>
                                </button>
                              );
                            })}
                          </div>
                          {getCandidateStage(cand) === 'Rejected' && (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center justify-between">
                              <span className="flex items-center gap-1 font-semibold">
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                Candidate is currently marked as Rejected.
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStageChange(cand.candidate_id, 'Screening')}
                                className="text-xs font-bold text-rose-700 hover:underline"
                              >
                                Reopen to Screening
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Strengths & Missing skills */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
                            <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Demonstrated Strengths
                            </span>
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                              {cand.strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                            <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              Gaps & Missing Skills
                            </span>
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                              {cand.missing_skills.length > 0 ? (
                                cand.missing_skills.map((s, i) => <li key={i}>{s}</li>)
                              ) : (
                                <li>All required primary competencies evidenced.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Interview Rounds & Verification Sub-tabs inside candidate card */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-[#6743ee]" />
                            Interview Rounds & Adaptive Assessments
                          </h4>

                          {/* Round 1: Coding Challenge */}
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">Adaptive Coding Challenge</span>
                              {!codingRound?.challenge && (
                                <button
                                  onClick={() => handleGenerateCoding(cand.candidate_id)}
                                  className="px-3 py-1 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg"
                                >
                                  Agent: Plan & Generate Coding Task
                                </button>
                              )}
                            </div>

                            {codingRound?.challenge && (
                              <div className="space-y-3">
                                <div>
                                  <span className="font-bold text-slate-900">{codingRound.challenge.title}</span>
                                  <p className="text-slate-600 mt-1">{codingRound.challenge.prompt}</p>
                                </div>

                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    Candidate Coding Submission:
                                  </label>
                                  <textarea
                                    value={codingRound.candidate_submission || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCandidates(prev => prev.map(c => {
                                        if (c.candidate_id !== cand.candidate_id) return c;
                                        return {
                                          ...c,
                                          rounds: {
                                            ...c.rounds,
                                            coding: { ...c.rounds.coding, candidate_submission: val }
                                          }
                                        };
                                      }));
                                    }}
                                    rows={5}
                                    className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEvaluateCoding(cand.candidate_id)}
                                    className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg"
                                  >
                                    Agent: Evaluate Submission
                                  </button>
                                  <button
                                    onClick={() => handleRoundDecision(cand.candidate_id, 'coding', 'pass')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                                  >
                                    Recruiter: Pass Coding Round
                                  </button>
                                  <button
                                    onClick={() => handleRoundDecision(cand.candidate_id, 'coding', 'not_proceeding')}
                                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg"
                                  >
                                    End Process
                                  </button>
                                </div>

                                {codingRound.evaluation && (
                                  <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg space-y-1 text-slate-700">
                                    <span className="font-bold text-purple-900 block">
                                      AI Review: {codingRound.evaluation.score}/100 (Advisory)
                                    </span>
                                    <p><strong>Correctness:</strong> {codingRound.evaluation.correctness}</p>
                                    <p><strong>Complexity:</strong> {codingRound.evaluation.complexity}</p>
                                    <p><strong>Strengths:</strong> {codingRound.evaluation.strengths.join(", ")}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Round 2: Technical Interview */}
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">Technical Interview Round</span>
                              {!techRound?.questions && (
                                <button
                                  onClick={() => handleGenerateTechnicalQuestions(cand.candidate_id)}
                                  className="px-3 py-1 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg"
                                >
                                  Agent: Generate Questions
                                </button>
                              )}
                            </div>

                            {techRound?.questions && (
                              <div className="space-y-3">
                                {techRound.questions.map((q, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-semibold text-slate-800 block">Q{idx + 1}: {q}</span>
                                    <textarea
                                      value={techRound.answers?.[idx] || ""}
                                      onChange={(e) => {
                                        const newAns = [...(techRound.answers || [])];
                                        newAns[idx] = e.target.value;
                                        setCandidates(prev => prev.map(c => {
                                          if (c.candidate_id !== cand.candidate_id) return c;
                                          return {
                                            ...c,
                                            rounds: {
                                              ...c.rounds,
                                              technical: { ...c.rounds.technical, answers: newAns }
                                            }
                                          };
                                        }));
                                      }}
                                      placeholder="Candidate response..."
                                      rows={2}
                                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                                    />
                                  </div>
                                ))}

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEvaluateTechnical(cand.candidate_id)}
                                    className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg"
                                  >
                                    Agent: Reflect on Evidence
                                  </button>
                                  <button
                                    onClick={() => handleRoundDecision(cand.candidate_id, 'technical', 'pass')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                                  >
                                    Recruiter: Pass Technical Round
                                  </button>
                                </div>

                                {techRound.evaluation && (
                                  <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg space-y-1 text-slate-700">
                                    <span className="font-bold text-purple-900 block">AI Evidence Reflection:</span>
                                    <p>{techRound.evaluation.evidence}</p>
                                    <p><strong>Strengths:</strong> {techRound.evaluation.strengths.join(", ")}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Document Verification & Onboarding status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-indigo-600" />
                              Verification & Document Validation
                            </span>
                            <div className="space-y-1.5 text-[11px]">
                              {Object.entries(cand.verification_checks).map(([check, status]) => (
                                <div key={check} className="flex justify-between py-1 border-b border-slate-200">
                                  <span className="capitalize text-slate-600">{check} check:</span>
                                  <span className={`font-semibold ${
                                    status === 'verified' ? 'text-emerald-700' : 'text-amber-700'
                                  }`}>
                                    {status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ListTodo className="w-3.5 h-3.5 text-purple-600" />
                              Onboarding Agent Checklist
                            </span>
                            <p className="text-[11px] text-slate-500">
                              Post-offer structured checklist (Contracts, IT accounts, Hardware delivery, Team intro).
                            </p>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                              Status: {cand.decision_status === 'Hired by recruiter' ? 'In Progress' : 'Pending Formal Acceptance'}
                            </span>
                          </div>
                        </div>

                        {/* Recruiter Private Notes */}
                        <CandidatePrivateNotes
                          candidate={cand}
                          onSaveNotes={handleSaveCandidateNotes}
                        />

                        {/* AI Follow-Up Email Generator Callout & Triggers */}
                        <div className="p-4 bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-purple-50/90 border border-purple-200/90 rounded-xl space-y-3 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-gradient-to-tr from-[#6743ee] to-[#8a72ff] text-white rounded-lg shadow-2xs shrink-0">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-[#6743ee]" />
                                  <span>Automated AI Follow-Up Email Generator</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-purple-100 text-[#5b43d6] border border-purple-200">
                                    Adaptive Reasons
                                  </span>
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Draft personalized emails tailored to {cand.name}'s specific strengths, evaluation scores ({cand.overall_score}%), or identified skill gaps with one click.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEmailDraftModal(cand, 'progress')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                                title="Draft personalized progression / interview invitation email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Draft Progress Email</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEmailDraftModal(cand, 'rejection')}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                                title="Draft personalized constructive rejection email citing specific gaps"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Draft Rejection Email</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200/60 text-[11px] text-slate-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <span><strong>Active Candidate Context:</strong></span>
                              <span className="px-1.5 py-0.5 rounded bg-white text-purple-900 border border-purple-200 font-medium">
                                Technical: {cand.dimension_scores.technical}%
                              </span>
                              {cand.missing_skills.length > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-white text-rose-800 border border-rose-200 font-medium">
                                  Gap: {cand.missing_skills.slice(0, 2).join(', ')}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-medium">
                                  All core competencies verified
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">Includes live phone touchpoint script & queue syncing</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>

            {/* Sticky Floating Bulk Action Toolbar */}
            <BulkActionToolbar
              selectedCandidateIds={selectedCandidateIds}
              allFilteredCandidates={sortedCandidates}
              allCandidates={candidates}
              brief={brief}
              cutoffScore={cutoffScore}
              onSelectAll={handleSelectAllFiltered}
              onDeselectAll={handleDeselectAll}
              onSelectAboveCutoff={handleSelectAboveCutoff}
              onBulkStageChange={handleBulkStageChange}
              onBulkAdvance={handleBulkAdvance}
              onBulkReject={handleBulkReject}
              onBulkAssignCoding={handleBulkAssignCoding}
              onBulkQueueEmails={handleBulkQueueEmails}
              onLaunchCompare={(idA, idB) => handleLaunchCompare(idA, idB)}
            />
          </div>
        </section>
      )}

      {/* 5. Outreach & Scheduling Draft Queue */}
      {outreachQueue.length > 0 && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                5. Recruiter Review: Outreach & Scheduling Drafts ({outreachQueue.length})
              </h2>
              <p className="text-xs text-slate-500">
                Review invitation and phone call scripts. Approval marks ready for recruiter dispatch.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {outreachQueue.map((draft) => (
              <div key={draft.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900">
                    To: {draft.candidate_name} ({draft.candidate_email}) — <span className="capitalize">{draft.type} draft</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    draft.status.includes('approved') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {draft.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-700">Subject:</span>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOutreachQueue(prev => prev.map(d => d.id === draft.id ? { ...d, subject: val } : d));
                    }}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-700">Email Body:</span>
                  <textarea
                    value={draft.body}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOutreachQueue(prev => prev.map(d => d.id === draft.id ? { ...d, body: val } : d));
                    }}
                    rows={4}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {!draft.status.includes('approved') && (
                    <button
                      onClick={() => handleApproveDraft(draft.id)}
                      className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg"
                    >
                      Approve Draft
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadDraft(draft)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Draft (.txt)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Workforce Graph */}
      <WorkforceGraph job={brief} candidates={candidates} />

      {/* 7. Workflow Activity Audit Log */}
      {events.length > 0 && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Workflow Activity Audit Log ({events.length})</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
            {[...events].reverse().map((evt, idx) => (
              <div key={idx} className="text-xs text-slate-600 flex items-center justify-between py-1 border-b border-slate-100">
                <span>
                  <strong className="text-slate-800">{evt.actor}</strong>: {evt.action} — <span className="text-slate-500 font-mono text-[11px]">{evt.subject}</span>
                </span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">{evt.timestamp}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Candidate Head-to-Head Side-by-Side Comparison Modal */}
      {showCompareModal && compareCandA && compareCandB && (
        <CandidateComparisonModal
          candidateA={compareCandA}
          candidateB={compareCandB}
          allCandidates={candidates}
          onSelectCandidateA={(newA) => {
            setSelectedCompareIds([newA.candidate_id, compareCandB.candidate_id]);
          }}
          onSelectCandidateB={(newB) => {
            setSelectedCompareIds([compareCandA.candidate_id, newB.candidate_id]);
          }}
          onClose={() => setShowCompareModal(false)}
          cutoffScore={cutoffScore}
        />
      )}

      {/* 9. Automated AI Email Template Generator Modal */}
      {showEmailModal && emailModalCandidate && (
        <EmailDraftModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          candidate={emailModalCandidate}
          brief={brief}
          initialType={emailModalInitialType}
          onQueueDraft={handleQueueEmailDraft}
        />
      )}
    </div>
  );
};
