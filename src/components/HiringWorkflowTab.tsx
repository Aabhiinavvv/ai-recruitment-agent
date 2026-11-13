import React, { useState, useMemo } from 'react';
import {
  Candidate,
  HiringBrief,
  OutreachDraft,
  AuditEvent,
  RoundType,
  HiringStage,
  EmailDraftType,
  ScheduledInterview,
  InterviewRoundFeedback,
} from '../types';
import { ROLE_REQUIREMENTS } from '../data/roles';
import { SAMPLE_RESUME_PRESETS, SampleResumePreset } from '../data/sampleResumes';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { generateCandidatePersona } from '../services/personaGenerator';
import { generateInterviewEmailConfirmation } from '../services/interviewSchedulerService';
import { parseResumeText, ParsedResumeData } from '../services/resumeParser';
import { extractTextFromResumeFile } from '../services/resumeFileReader';
import { TeamSkillsGapAnalysis } from './TeamSkillsGapAnalysis';
import { SkillRadarChart } from './SkillRadarChart';
import { CandidateRubricRadarChart } from './CandidateRubricRadarChart';
import { CandidateStageDropdown } from './CandidateStageDropdown';
import { CandidateComparisonModal } from './CandidateComparisonModal';
import { CandidatePrivateNotes } from './CandidatePrivateNotes';
import { EmailDraftModal } from './EmailDraftModal';
import { BulkActionToolbar } from './BulkActionToolbar';
import { CandidateKanbanBoard } from './CandidateKanbanBoard';
import { LinkedInImportModal } from './LinkedInImportModal';
import { WorkforceGraph } from './WorkforceGraph';
import { CandidatePersonaModal } from './CandidatePersonaModal';
import { InterviewSchedulerModal } from './InterviewSchedulerModal';
import { ScheduledInterviewsSection } from './ScheduledInterviewsSection';
import { RecruitmentIntensityHeatmap } from './RecruitmentIntensityHeatmap';
import { InterviewFeedbackModal } from './InterviewFeedbackModal';
import { SplitPaneComparisonView } from './SplitPaneComparisonView';
import { CandidateScoreTrajectorySection } from './CandidateScoreTrajectorySection';
import { OutreachQueueSection } from './OutreachQueueSection';
import { ExportReportModal } from './ExportReportModal';
import {
  Briefcase,
  Upload,
  CheckCircle2,
  XCircle,
  Sparkles,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Mail,
  FileCode,
  Search,
  Tag,
  X,
  Scale,
  CheckSquare,
  Square,
  Kanban,
  ListFilter,
  Check,
  Calendar,
  Flame,
  ClipboardCheck,
  MoreVertical,
  Plus,
  UserPlus,
  RotateCcw,
  ArrowUpDown,
  FileText,
  ExternalLink,
  Radar,
  TrendingUp,
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
  selectedCandidateId?: string | null;
  onSelectCandidateId?: (id: string | null) => void;
}

const PRESET_CUSTOM_TAGS = ['High Priority', 'Referred', 'Internal', 'Domain Specialist', 'Fast Track'];

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
  selectedCandidateId: controlledSelectedId,
  onSelectCandidateId,
}) => {
  // Top-level workspace section
  const [workspaceSection, setWorkspaceSection] = useState<'pipeline' | 'intake' | 'brief' | 'activity'>('pipeline');

  // Selected candidate tracking (controlled or local fallback)
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(
    candidates[2]?.candidate_id || candidates[0]?.candidate_id || null
  );
  const effectiveSelectedId =
    controlledSelectedId !== undefined ? controlledSelectedId : localSelectedId;

  const selectCandidate = (id: string | null) => {
    setLocalSelectedId(id);
    if (onSelectCandidateId) {
      onSelectCandidateId(id);
    }
  };

  const [justUploadedCandidateId, setJustUploadedCandidateId] = useState<string | null>(null);
  const [isReadingResumeFile, setIsReadingResumeFile] = useState<boolean>(false);
  const [selectedDetailTab, setSelectedDetailTab] = useState<'overview' | 'rounds' | 'resume'>('overview');
  const [showRadarInDetail, setShowRadarInDetail] = useState<boolean>(false);
  const [rubricViewMode, setRubricViewMode] = useState<'radar' | 'grid'>('radar');

  // Job Brief state
  const [selectedRolePreset, setSelectedRolePreset] = useState<string>(brief?.job_title || 'AI/ML Engineer');
  const [companyName, setCompanyName] = useState<string>(brief?.company_name || 'Anthropic Tech');
  const [jobTitle, setJobTitle] = useState<string>(brief?.job_title || 'AI/ML Engineer');
  const [location, setLocation] = useState<string>(brief?.location || 'San Francisco, CA / Remote');
  const [headcount, setHeadcount] = useState<number>(brief?.headcount || 1);
  const [salaryBudget, setSalaryBudget] = useState<string>(brief?.salary_budget || '$160,000 – $210,000');
  const [timeline, setTimeline] = useState<string>(brief?.timeline || 'Within 30 days');
  const [requirementsText, setRequirementsText] = useState<string>(
    brief?.requirements || ROLE_REQUIREMENTS['AI/ML Engineer'].join(', ')
  );

  // Resume screening form state
  const [candidateNameInput, setCandidateNameInput] = useState<string>('');
  const [candidateEmailInput, setCandidateEmailInput] = useState<string>('');
  const [candidatePhoneInput, setCandidatePhoneInput] = useState<string>('');
  const [resumeTextInput, setResumeTextInput] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  const [portfolioUrl, setPortfolioUrl] = useState<string>('');
  const [workHighlights, setWorkHighlights] = useState<string>('');
  const [processingConsent, setProcessingConsent] = useState<boolean>(true);
  const [memoryConsent, setMemoryConsent] = useState<boolean>(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [autoFillNotification, setAutoFillNotification] = useState<string | null>(null);
  const [lastParsedData, setLastParsedData] = useState<ParsedResumeData | null>(null);

  // Candidate list sorting & filtering state
  const [sortField, setSortField] = useState<'score' | 'technical' | 'experience' | 'name'>('score');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSkillTag, setSelectedSkillTag] = useState<string | null>(null);
  const [selectedCustomTag, setSelectedCustomTag] = useState<string | null>(null);

  // Pipeline View Mode
  const [pipelineViewMode, setPipelineViewMode] = useState<'list' | 'kanban' | 'heatmap' | 'compare'>('list');

  // Overflow menus & tag input
  const [openMoreMenuId, setOpenMoreMenuId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Candidate Compare Mode state
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Automated Email Template Generator Modal state
  const [emailModalCandidate, setEmailModalCandidate] = useState<Candidate | null>(null);
  const [emailModalInitialType, setEmailModalInitialType] = useState<EmailDraftType>('progress');
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);

  // Candidate Persona Modal & Generation State
  const [personaModalCandidate, setPersonaModalCandidate] = useState<Candidate | null>(null);
  const [showPersonaModal, setShowPersonaModal] = useState<boolean>(false);
  const [generatingPersonaId, setGeneratingPersonaId] = useState<string | null>(null);

  // LinkedIn Talent Import Modal state
  const [showLinkedInImportModal, setShowLinkedInImportModal] = useState<boolean>(false);

  // AI Interview Scheduler State & Handlers
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([
    {
      id: 'interview-init-1',
      candidateId: 'CAN-9821',
      candidateName: 'Alex Rivera',
      candidateEmail: 'alex.rivera@example.com',
      candidatePhone: '+1-555-019-2831',
      jobTitle: brief?.job_title || 'AI/ML Engineer',
      companyName: brief?.company_name || 'Anthropic Tech',
      roundName: 'Technical Live Coding Round',
      roundType: 'coding',
      durationMinutes: 45,
      format: 'video_meet',
      meetingLink: 'https://meet.google.com/ari-eval-recr',
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
  ]);
  const [showSchedulerModal, setShowSchedulerModal] = useState<boolean>(false);
  const [schedulerCandidate, setSchedulerCandidate] = useState<Candidate | null>(null);

  // Interview Feedback Form & Standardized Evaluation Report State
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackCandidate, setFeedbackCandidate] = useState<Candidate | null>(null);

  // Bulk Action Selection State
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // HR Report & Audit Log Export State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const appendAudit = (actor: string, action: string, subject: string) => {
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor,
      action,
      subject,
    };
    setEvents((prev) => [...prev, newEvent]);
  };

  // Sorted & filtered candidates
  const sortedCandidates = useMemo(() => {
    let result = [...candidates];

    if (statusFilter !== 'all') {
      result = result.filter((c) => {
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const matchesName =
          c.name.toLowerCase().includes(q) ||
          c.candidate_id.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q);
        const matchesSkills = Object.keys(c.skill_scores || {}).some((skill) =>
          skill.toLowerCase().includes(q)
        );
        const matchesTags = (c.custom_tags || []).some((t) => t.toLowerCase().includes(q));
        const matchesStrengths = c.strengths?.some((s) => s.toLowerCase().includes(q));
        return matchesName || matchesSkills || matchesTags || matchesStrengths;
      });
    }

    if (selectedSkillTag) {
      const targetSkill = selectedSkillTag.toLowerCase();
      result = result.filter((c) =>
        Object.keys(c.skill_scores || {}).some((skill) => skill.toLowerCase() === targetSkill)
      );
    }

    if (selectedCustomTag) {
      const targetTag = selectedCustomTag.toLowerCase();
      result = result.filter((c) =>
        (c.custom_tags || []).some((t) => t.toLowerCase() === targetTag)
      );
    }

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
  }, [candidates, sortField, sortDirection, statusFilter, searchQuery, selectedSkillTag, selectedCustomTag]);

  // Active selected candidate for the Selected Candidate Details view
  const activeCandidate = useMemo(() => {
    return (
      candidates.find((c) => c.candidate_id === effectiveSelectedId) ||
      sortedCandidates[0] ||
      candidates[0] ||
      null
    );
  }, [candidates, effectiveSelectedId, sortedCandidates]);

  const availableSkillTags = useMemo(() => {
    const map = new Map<string, number>();
    candidates.forEach((c) => {
      Object.keys(c.skill_scores || {}).forEach((skill) => {
        map.set(skill, (map.get(skill) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skill, count]) => ({ skill, count }));
  }, [candidates]);

  const availableCustomTags = useMemo(() => {
    const set = new Set<string>(PRESET_CUSTOM_TAGS);
    candidates.forEach((c) => {
      (c.custom_tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [candidates]);

  // Count of candidates whose outreach is overdue for a follow-up reminder
  const overdueFollowUpCount = useMemo(() => {
    const now = Date.now();
    return outreachQueue.filter((d) => {
      if (d.response_status === 'responded') return false;
      const thresholdDays = d.reminder_days ?? 3;
      if (!d.sent_at) return false;
      const sentTime = new Date(d.sent_at).getTime();
      const days = Math.floor((now - sentTime) / (1000 * 60 * 60 * 24));
      return days >= thresholdDays;
    }).length;
  }, [outreachQueue]);

  const defaultCompareAId =
    activeCandidate?.candidate_id ||
    sortedCandidates[0]?.candidate_id ||
    candidates[0]?.candidate_id ||
    null;
  const defaultCompareBId =
    sortedCandidates.find((c) => c.candidate_id !== defaultCompareAId)?.candidate_id ||
    candidates.find((c) => c.candidate_id !== defaultCompareAId)?.candidate_id ||
    null;

  const effectiveCompareAId =
    selectedCompareIds[0] && candidates.some((c) => c.candidate_id === selectedCompareIds[0])
      ? selectedCompareIds[0]
      : defaultCompareAId;
  const effectiveCompareBId =
    selectedCompareIds[1] &&
    selectedCompareIds[1] !== effectiveCompareAId &&
    candidates.some((c) => c.candidate_id === selectedCompareIds[1])
      ? selectedCompareIds[1]
      : candidates.find(
          (c) => c.candidate_id === defaultCompareBId && c.candidate_id !== effectiveCompareAId
        )?.candidate_id ||
        sortedCandidates.find((c) => c.candidate_id !== effectiveCompareAId)?.candidate_id ||
        candidates.find((c) => c.candidate_id !== effectiveCompareAId)?.candidate_id ||
        null;

  const compareCandA =
    candidates.find((c) => c.candidate_id === effectiveCompareAId) || sortedCandidates[0] || candidates[0];
  const compareCandB =
    candidates.find((c) => c.candidate_id === effectiveCompareBId) ||
    sortedCandidates.find((c) => c.candidate_id !== compareCandA?.candidate_id) ||
    sortedCandidates[1] ||
    candidates[1];

  const focusSelectedCandidateDetails = (candidateId: string) => {
    selectCandidate(candidateId);
    setSelectedDetailTab('overview');
    setWorkspaceSection('pipeline');
    setPipelineViewMode('list');
    setTimeout(() => {
      document
        .getElementById('selected-candidate-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Direct 1-click resume file upload -> parse -> evaluate -> select & display details
  const handleQuickUploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsReadingResumeFile(true);
    try {
      const extracted = await extractTextFromResumeFile(file);
      const activeBrief: HiringBrief = brief || {
        company_name: companyName,
        job_title: jobTitle,
        location,
        headcount,
        salary_budget: salaryBudget,
        timeline,
        requirements: requirementsText,
        jd: '',
        status: 'Approved by recruiter — publishing integration required',
      };

      if (brief && !brief.status.includes('Approved')) {
        setBrief({
          ...brief,
          status: 'Approved by recruiter — publishing integration required',
        });
      }

      const requiredSkills = activeBrief.requirements
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const parsed = parseResumeText(extracted.text, requiredSkills);

      const screenedCandidate = recruitmentAgent.screenResume(
        parsed.candidateName,
        parsed.candidateEmail,
        extracted.text,
        activeBrief.job_title,
        requiredSkills,
        [],
        true,
        parsed.candidatePhone,
        activeBrief,
        file.name
      );

      setCandidates((prev) => [screenedCandidate, ...prev]);
      setStatusFilter('all');
      setSearchQuery('');
      setSelectedSkillTag(null);
      setSelectedCustomTag(null);
      setJustUploadedCandidateId(screenedCandidate.candidate_id);
      focusSelectedCandidateDetails(screenedCandidate.candidate_id);

      appendAudit(
        'AI Screener',
        `Uploaded & evaluated ${extracted.fileType} resume "${file.name}" (Score: ${screenedCandidate.overall_score}%)`,
        `${activeBrief.job_title}: ${screenedCandidate.name} (${screenedCandidate.candidate_id})`
      );
    } finally {
      setIsReadingResumeFile(false);
    }
  };

  // Handlers
  const handleOpenEmailDraftModal = (cand: Candidate, type?: EmailDraftType) => {
    const isReject =
      cand.decision_status?.includes('Not proceeding') || cand.recruiter_decision === 'reject';
    const chosenType = type || (isReject ? 'rejection' : 'progress');
    setEmailModalCandidate(cand);
    setEmailModalInitialType(chosenType);
    setShowEmailModal(true);
    setOpenMoreMenuId(null);
    appendAudit('Recruiter', `Opened email draft (${chosenType})`, `${cand.name} (${cand.candidate_id})`);
  };

  const handleQueueEmailDraft = (draft: OutreachDraft, reasonCategory: string) => {
    const stampedDraft: OutreachDraft = {
      ...draft,
      sent_at: draft.sent_at || new Date().toISOString(),
      reminder_days: draft.reminder_days ?? 3,
      response_status: draft.response_status ?? 'waiting',
      status: 'Sent / Dispatched',
    };
    setOutreachQueue((prev) => [stampedDraft, ...prev]);
    appendAudit(
      'Recruiter',
      `Queued & dispatched ${draft.type} email draft (${reasonCategory.replace(/_/g, ' ')})`,
      `${draft.candidate_name} (${draft.candidate_id})`
    );
  };

  const handleOpenPersona = (cand: Candidate) => {
    let target = cand;
    if (!cand.persona) {
      const persona = generateCandidatePersona(cand, brief);
      target = { ...cand, persona };
      setCandidates((prev) => prev.map((c) => (c.candidate_id === cand.candidate_id ? target : c)));
      appendAudit(
        'AI Agent',
        `Generated Candidate Persona summary (${persona.archetype})`,
        `${cand.name} (${cand.candidate_id})`
      );
    }
    setPersonaModalCandidate(target);
    setShowPersonaModal(true);
    setOpenMoreMenuId(null);
  };

  const handleRegeneratePersona = (candidateId: string) => {
    setGeneratingPersonaId(candidateId);
    const cand = candidates.find((c) => c.candidate_id === candidateId);
    if (!cand) {
      setGeneratingPersonaId(null);
      return;
    }
    const persona = generateCandidatePersona(cand, brief);
    const updated = { ...cand, persona };
    setCandidates((prev) => prev.map((c) => (c.candidate_id === candidateId ? updated : c)));
    if (personaModalCandidate?.candidate_id === candidateId) {
      setPersonaModalCandidate(updated);
    }
    appendAudit('AI Agent', `Refreshed Candidate Persona (${persona.archetype})`, `${cand.name} (${cand.candidate_id})`);
    setTimeout(() => {
      setGeneratingPersonaId(null);
    }, 300);
  };

  const handleImportLinkedInCandidates = (newCandidates: Candidate[], auditDescription: string) => {
    const stamped = newCandidates.map((c) => ({
      ...c,
      processed_at: c.processed_at || new Date().toISOString(),
    }));
    setCandidates((prev) => [...stamped, ...prev]);
    appendAudit(
      'LinkedIn Talent Agent',
      auditDescription,
      `${newCandidates.length} Candidates (${newCandidates.map((c) => c.name).join(', ')})`
    );
    if (newCandidates.length > 0) {
      focusSelectedCandidateDetails(newCandidates[0].candidate_id);
    }
  };

  const handleOpenScheduler = (cand?: Candidate) => {
    const target = cand || activeCandidate || sortedCandidates[0] || candidates[0] || null;
    setSchedulerCandidate(target);
    setShowSchedulerModal(true);
    setOpenMoreMenuId(null);
    if (target) {
      appendAudit('Recruiter', `Opened Interview Scheduler for ${target.name}`, `${target.name} (${target.candidate_id})`);
    }
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

    const { subject, body } = generateInterviewEmailConfirmation(scheduled);
    const draft: OutreachDraft = {
      id: `draft-${Date.now()}`,
      type: 'round',
      candidate_id: scheduled.candidateId,
      candidate_name: scheduled.candidateName,
      candidate_email: scheduled.candidateEmail,
      candidate_phone: scheduled.candidatePhone,
      round_name: scheduled.roundType,
      interview_format: `${scheduled.format.replace('_', ' ').toUpperCase()} (${scheduled.meetingLink})`,
      subject,
      body,
      call_script: `Hi ${scheduled.candidateName}, calling from ${scheduled.companyName} to confirm your upcoming ${scheduled.roundName} on ${scheduled.dateStr}. Google Meet and calendar invite have been dispatched.`,
      availability: `${scheduled.dateStr} at ${scheduled.startTime} EST`,
      status: 'Sent / Dispatched',
      sent_at: new Date().toISOString(),
      reminder_days: 3,
      response_status: 'waiting',
    };
    setOutreachQueue((prev) => [draft, ...prev]);
    appendAudit(
      'Scheduler',
      `Scheduled ${scheduled.durationMinutes}m ${scheduled.roundName} on ${scheduled.dateStr} at ${scheduled.startTime} EST`,
      `${scheduled.candidateName} (${scheduled.candidateId})`
    );
  };

  const handleOpenFeedbackModal = (cand: Candidate) => {
    setFeedbackCandidate(cand);
    setShowFeedbackModal(true);
    setOpenMoreMenuId(null);
    appendAudit('Recruiter', `Opened Interview Feedback form for ${cand.name}`, `${cand.name} (${cand.candidate_id})`);
  };

  const handleSaveFeedbackReport = (candidateId: string, feedback: InterviewRoundFeedback) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        const existing = c.interview_feedback_reports || [];
        const updatedReports = existing.some((f) => f.id === feedback.id)
          ? existing.map((f) => (f.id === feedback.id ? feedback : f))
          : [feedback, ...existing];
        return {
          ...c,
          interview_feedback_reports: updatedReports,
        };
      })
    );

    if (feedbackCandidate?.candidate_id === candidateId) {
      setFeedbackCandidate((prev) =>
        prev
          ? {
              ...prev,
              interview_feedback_reports: (prev.interview_feedback_reports || []).some(
                (f) => f.id === feedback.id
              )
                ? prev.interview_feedback_reports!.map((f) => (f.id === feedback.id ? feedback : f))
                : [feedback, ...(prev.interview_feedback_reports || [])],
            }
          : null
      );
    }

    appendAudit(
      'Evaluation Engine',
      `Saved standardized evaluation report: ${feedback.overallRecommendation} (${feedback.evaluationReport?.compositeScore || 85}/100)`,
      `${feedback.candidateName} (${candidateId})`
    );
  };

  const handleToggleSelectCandidate = (candidateId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = sortedCandidates.map((c) => c.candidate_id);
    setSelectedCandidateIds(filteredIds);
    appendAudit('Recruiter', `Selected all ${filteredIds.length} candidates for bulk action`, `${filteredIds.length} Candidates`);
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds([]);
  };

  const handleSelectAboveCutoff = () => {
    const above = candidates.filter((c) => c.overall_score >= cutoffScore).map((c) => c.candidate_id);
    setSelectedCandidateIds(above);
    appendAudit('Recruiter', `Selected ${above.length} candidates above cutoff (>=${cutoffScore}%)`, `${above.length} Candidates`);
  };

  const handleBulkStageChange = (newStage: HiringStage, candidateIds: string[]) => {
    setCandidates((prev) =>
      prev.map((c) => {
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
          current_round,
        };
      })
    );
    appendAudit('Recruiter', `Bulk updated stage to "${newStage}" for ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkAdvance = (candidateIds: string[]) => {
    setCandidates((prev) =>
      prev.map((c) =>
        candidateIds.includes(c.candidate_id)
          ? { ...c, recruiter_decision: 'advance', decision_status: 'Advanced by recruiter' }
          : c
      )
    );
    appendAudit('Recruiter', `Bulk advanced ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkReject = (candidateIds: string[]) => {
    setCandidates((prev) =>
      prev.map((c) =>
        candidateIds.includes(c.candidate_id)
          ? { ...c, recruiter_decision: 'reject', decision_status: 'Not proceeding (recruiter decision)' }
          : c
      )
    );
    appendAudit('Recruiter', `Bulk declined ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkAssignCoding = (candidateIds: string[]) => {
    if (!brief) return;
    const challenge = recruitmentAgent.generateCodingChallenge(brief.job_title, 'Medium');
    setCandidates((prev) =>
      prev.map((c) => {
        if (!candidateIds.includes(c.candidate_id)) return c;
        return {
          ...c,
          rounds: {
            ...c.rounds,
            coding: {
              ...c.rounds.coding,
              challenge_version: (c.rounds.coding?.challenge_version || 0) + 1,
              challenge,
              candidate_submission: challenge.starter_code,
            },
          },
        };
      })
    );
    appendAudit('Agent', `Assigned coding challenges to ${candidateIds.length} candidate(s)`, candidateIds.join(', '));
  };

  const handleBulkQueueEmails = (drafts: OutreachDraft[], description: string) => {
    const stamped = drafts.map((d) => ({
      ...d,
      sent_at: d.sent_at || new Date().toISOString(),
      reminder_days: d.reminder_days ?? 3,
      response_status: d.response_status ?? 'waiting',
      status: 'Sent / Dispatched',
    }));
    setOutreachQueue((prev) => [...stamped, ...prev]);
    appendAudit('Recruiter', `Queued & dispatched ${drafts.length} emails (${description})`, `${drafts.length} Candidates`);
  };

  const handleToggleCompareCandidate = (candidateId: string) => {
    setOpenMoreMenuId(null);
    setSelectedCompareIds((prev) => {
      let next: string[];
      if (prev.includes(candidateId)) {
        next = prev.filter((id) => id !== candidateId);
      } else if (prev.length >= 2) {
        next = [prev[0], candidateId];
      } else {
        next = [...prev, candidateId];
      }

      if (next.length === 2 && !prev.includes(candidateId)) {
        setWorkspaceSection('pipeline');
        setPipelineViewMode('compare');
        const cA = candidates.find((c) => c.candidate_id === next[0]);
        const cB = candidates.find((c) => c.candidate_id === next[1]);
        appendAudit('Recruiter', 'Compared two candidates side-by-side', `${cA?.name || next[0]} vs ${cB?.name || next[1]}`);
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
        finalB =
          sortedCandidates.find((c) => c.candidate_id !== finalA)?.candidate_id ||
          candidates.find((c) => c.candidate_id !== finalA)?.candidate_id;
      } else if (activeCandidate && candidates.length >= 2) {
        finalA = activeCandidate.candidate_id;
        finalB =
          sortedCandidates.find((c) => c.candidate_id !== finalA)?.candidate_id ||
          candidates.find((c) => c.candidate_id !== finalA)?.candidate_id;
      } else if (sortedCandidates.length >= 2) {
        finalA = sortedCandidates[0]?.candidate_id;
        finalB = sortedCandidates[1]?.candidate_id;
      }
    }

    if (finalA && finalB && finalA !== finalB) {
      setSelectedCompareIds([finalA, finalB]);
      setWorkspaceSection('pipeline');
      setPipelineViewMode('compare');
      const cA = candidates.find((c) => c.candidate_id === finalA);
      const cB = candidates.find((c) => c.candidate_id === finalB);
      appendAudit('Recruiter', 'Compared two candidates side-by-side', `${cA?.name || finalA} vs ${cB?.name || finalB}`);
    }
  };

  const handleAddCustomTag = (candidateId: string, rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        const current = c.custom_tags || [];
        if (current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return c;
        return { ...c, custom_tags: [...current, trimmed] };
      })
    );
    setNewTagInput('');
    appendAudit('Recruiter', `Added label "${trimmed}" to candidate`, candidateId);
  };

  const handleRemoveCustomTag = (candidateId: string, tagToRemove: string) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        return {
          ...c,
          custom_tags: (c.custom_tags || []).filter((t) => t !== tagToRemove),
        };
      })
    );
    appendAudit('Recruiter', `Removed label "${tagToRemove}" from candidate`, candidateId);
  };

  const handleRolePresetChange = (role: string) => {
    setSelectedRolePreset(role);
    setJobTitle(role);
    if (ROLE_REQUIREMENTS[role]) {
      setRequirementsText(ROLE_REQUIREMENTS[role].join(', '));
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
      status: 'Approved by recruiter — publishing integration required',
      evaluation_rubric: rubric,
    };

    setBrief(newBrief);
    appendAudit('AI Agent', 'Updated job description & evaluation rubric', jobTitle);
  };

  const handleApproveJd = () => {
    if (!brief) return;
    setBrief({
      ...brief,
      status: 'Approved by recruiter — publishing integration required',
    });
    appendAudit('Recruiter', 'Approved job description', brief.job_title);
  };

  const handleSelectSamplePreset = (preset: SampleResumePreset) => {
    setSelectedPresetId(preset.id);
    setUploadedFileName(`${preset.candidateName.replace(/\s+/g, '_')}_Resume.txt`);
    setCandidateNameInput(preset.candidateName);
    setCandidateEmailInput(preset.candidateEmail);
    setResumeTextInput(preset.resumeText);
    setGithubUrl(preset.githubUrl);
    setLinkedinUrl(preset.linkedinUrl);
    setPortfolioUrl(preset.portfolioUrl);
    setWorkHighlights(preset.workHighlights);

    const requiredSkills = brief
      ? brief.requirements.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const parsed = parseResumeText(preset.resumeText, requiredSkills);
    if (parsed.candidatePhone) {
      setCandidatePhoneInput(parsed.candidatePhone);
    }
    setLastParsedData(parsed);
    setAutoFillNotification(`Loaded sample resume for ${preset.name}. Click "Screen & View Candidate Details" below to evaluate.`);
  };

  const handleAutoExtractFromResume = () => {
    if (!resumeTextInput.trim()) {
      setAutoFillNotification('Paste or upload resume text first to extract candidate fields.');
      return;
    }

    const requiredSkills = brief
      ? brief.requirements.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const parsed = parseResumeText(resumeTextInput, requiredSkills);
    setLastParsedData(parsed);

    let filledCount = 0;
    if (parsed.candidateName) {
      setCandidateNameInput(parsed.candidateName);
      filledCount++;
    }
    if (parsed.candidateEmail) {
      setCandidateEmailInput(parsed.candidateEmail);
      filledCount++;
    }
    if (parsed.candidatePhone) {
      setCandidatePhoneInput(parsed.candidatePhone);
      filledCount++;
    }
    if (parsed.githubUrl) {
      setGithubUrl(parsed.githubUrl);
      filledCount++;
    }
    if (parsed.linkedinUrl) {
      setLinkedinUrl(parsed.linkedinUrl);
      filledCount++;
    }
    if (parsed.portfolioUrl) {
      setPortfolioUrl(parsed.portfolioUrl);
      filledCount++;
    }
    if (parsed.workHighlights) {
      setWorkHighlights(parsed.workHighlights);
      filledCount++;
    }

    setAutoFillNotification(
      `Extracted ${filledCount} fields and matched ${parsed.matchedSkills.length} required skills.`
    );
  };

  const handleClearScreeningForm = () => {
    setCandidateNameInput('');
    setCandidateEmailInput('');
    setCandidatePhoneInput('');
    setResumeTextInput('');
    setUploadedFileName(null);
    setGithubUrl('');
    setLinkedinUrl('');
    setPortfolioUrl('');
    setWorkHighlights('');
    setSelectedPresetId(null);
    setLastParsedData(null);
    setAutoFillNotification(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingResumeFile(true);
    try {
      const extracted = await extractTextFromResumeFile(file);
      setResumeTextInput(extracted.text);
      setUploadedFileName(file.name);
      setSelectedPresetId(null);

      const requiredSkills = brief
        ? brief.requirements.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
        : [];
      const parsed = parseResumeText(extracted.text, requiredSkills);
      setLastParsedData(parsed);

      setCandidateNameInput(parsed.candidateName || file.name.replace(/\.[^/.]+$/, ''));
      if (parsed.candidateEmail) setCandidateEmailInput(parsed.candidateEmail);
      if (parsed.candidatePhone) setCandidatePhoneInput(parsed.candidatePhone);
      if (parsed.githubUrl) setGithubUrl(parsed.githubUrl);
      if (parsed.linkedinUrl) setLinkedinUrl(parsed.linkedinUrl);
      if (parsed.portfolioUrl) setPortfolioUrl(parsed.portfolioUrl);
      if (parsed.workHighlights) setWorkHighlights(parsed.workHighlights);

      setAutoFillNotification(
        `Extracted ${extracted.fileType} resume "${file.name}" (${parsed.matchedSkills.length} matched skills). Click "Screen & View Candidate Details" to add & inspect.`
      );
    } finally {
      setIsReadingResumeFile(false);
    }
  };

  const handleScreenResume = () => {
    if (!resumeTextInput.trim()) return;

    const activeBrief: HiringBrief = brief || {
      company_name: companyName,
      job_title: jobTitle,
      location,
      headcount,
      salary_budget: salaryBudget,
      timeline,
      requirements: requirementsText,
      jd: '',
      status: 'Approved by recruiter — publishing integration required',
    };

    if (brief && !brief.status.includes('Approved')) {
      setBrief({
        ...brief,
        status: 'Approved by recruiter — publishing integration required',
      });
    }

    const requiredSkills = activeBrief.requirements
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const digitalSources = [];
    if (githubUrl.trim()) {
      digitalSources.push({
        source_type: 'GitHub',
        source_ref: 'github',
        source_location: githubUrl.trim(),
        content: 'Candidate-provided link.',
      });
    }
    if (linkedinUrl.trim()) {
      digitalSources.push({
        source_type: 'LinkedIn',
        source_ref: 'linkedin',
        source_location: linkedinUrl.trim(),
        content: 'Candidate-provided link.',
      });
    }
    if (portfolioUrl.trim()) {
      digitalSources.push({
        source_type: 'Portfolio',
        source_ref: 'portfolio',
        source_location: portfolioUrl.trim(),
        content: 'Candidate-provided portfolio site.',
      });
    }
    if (workHighlights.trim()) {
      digitalSources.push({
        source_type: 'Candidate-submitted work highlights',
        source_ref: 'work_highlights',
        source_location: '',
        content: workHighlights.trim(),
      });
    }

    const screenedCandidate = recruitmentAgent.screenResume(
      candidateNameInput,
      candidateEmailInput,
      resumeTextInput,
      activeBrief.job_title,
      requiredSkills,
      digitalSources,
      memoryConsent,
      candidatePhoneInput,
      activeBrief,
      uploadedFileName || undefined
    );

    setCandidates((prev) => [screenedCandidate, ...prev]);
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedSkillTag(null);
    setSelectedCustomTag(null);
    setJustUploadedCandidateId(screenedCandidate.candidate_id);
    focusSelectedCandidateDetails(screenedCandidate.candidate_id);

    appendAudit(
      'AI Screener',
      `Screened resume (Score: ${screenedCandidate.overall_score}%)`,
      `${activeBrief.job_title}: ${screenedCandidate.name} (${screenedCandidate.candidate_id})`
    );

    handleClearScreeningForm();
  };

  const handleRecruiterDecision = (candidateId: string, decision: 'advance' | 'reject') => {
    setOpenMoreMenuId(null);
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        const status =
          decision === 'advance' ? 'Advanced by recruiter' : 'Not proceeding (recruiter decision)';
        return {
          ...c,
          recruiter_decision: decision,
          decision_status: status,
        };
      })
    );

    const cand = candidates.find((c) => c.candidate_id === candidateId);
    appendAudit(
      'Recruiter',
      `Marked candidate as ${decision === 'advance' ? 'Advanced' : 'Not proceeding'}`,
      `${brief?.job_title || 'Role'}: ${cand?.name || candidateId}`
    );

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
        body: `Dear ${cand.name},\n\nWe were impressed by your background and would love to invite you to the Coding Round for the ${brief?.job_title} position.\n\nPlease let us know if the suggested availability works for you.\n\nBest regards,\nRecruitment Team`,
        call_script: `Hi ${cand.name}, calling from ${brief?.company_name}. We would like to schedule your technical coding round.`,
        availability: 'Upcoming weekdays, 10:00 AM – 4:00 PM EST',
        status: 'Draft — not sent or scheduled',
      };
      setOutreachQueue((prev) => [draft, ...prev]);
    } else if (decision === 'reject' && cand) {
      const draft: OutreachDraft = {
        id: `draft-${Date.now()}`,
        type: 'rejection',
        candidate_id: cand.candidate_id,
        candidate_name: cand.name,
        candidate_email: cand.email,
        candidate_phone: cand.phone,
        subject: `Application update regarding ${brief?.job_title} position`,
        body: `Dear ${cand.name},\n\nThank you for applying for the ${brief?.job_title} role at ${brief?.company_name || 'our company'}. After careful review, we have decided to move forward with other candidates for this opening.\n\nBest regards,\nRecruitment Team`,
        call_script: `Hi ${cand.name}, calling with an update regarding your application for ${brief?.job_title}.`,
        availability: 'N/A',
        status: 'Draft — not sent or scheduled',
      };
      setOutreachQueue((prev) => [draft, ...prev]);
    }
  };

  const handleStageChange = (candidateId: string, newStage: HiringStage) => {
    const candidate = candidates.find((c) => c.candidate_id === candidateId);
    if (!candidate) return;
    const previousStage = getCandidateStage(candidate);
    if (previousStage === newStage) return;

    setCandidates((prev) =>
      prev.map((c) => {
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
      })
    );

    appendAudit(
      'Recruiter',
      `Moved stage from "${previousStage}" to "${newStage}"`,
      `${candidate.name} (${candidateId})`
    );
  };

  const handleSaveCandidateNotes = (candidateId: string, notes: string) => {
    const candidate = candidates.find((c) => c.candidate_id === candidateId);
    if (!candidate) return;
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setCandidates((prev) =>
      prev.map((c) =>
        c.candidate_id === candidateId
          ? { ...c, private_notes: notes, notes_updated_at: `Today at ${formattedTime}` }
          : c
      )
    );
    appendAudit('Recruiter', 'Updated private candidate notes', `${candidate.name} (${candidateId})`);
  };

  const handleGenerateCoding = (candidateId: string) => {
    if (!brief) return;
    const challenge = recruitmentAgent.generateCodingChallenge(brief.job_title, 'Medium');
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        return {
          ...c,
          rounds: {
            ...c.rounds,
            coding: {
              ...c.rounds.coding,
              challenge_version: (c.rounds.coding?.challenge_version || 0) + 1,
              challenge,
              candidate_submission: challenge.starter_code,
            },
          },
        };
      })
    );
    appendAudit('Agent', 'Generated coding challenge', candidateId);
  };

  const handleEvaluateCoding = (candidateId: string) => {
    const candidate = candidates.find((c) => c.candidate_id === candidateId);
    const round = candidate?.rounds.coding;
    if (!round?.challenge || !round.candidate_submission) return;

    const evaluation = recruitmentAgent.evaluateCodingSubmission(
      round.challenge,
      round.candidate_submission
    );
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        return {
          ...c,
          rounds: {
            ...c.rounds,
            coding: { ...c.rounds.coding, evaluation },
          },
        };
      })
    );
    appendAudit('Agent', `Evaluated coding submission (${evaluation.score}/100)`, candidateId);
  };

  const handleRoundDecision = (
    candidateId: string,
    roundName: RoundType,
    decision: 'pass' | 'not_proceeding'
  ) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        const roundData = c.rounds[roundName] || {};
        const nextRound: RoundType =
          roundName === 'coding' ? 'technical' : roundName === 'technical' ? 'hr' : 'hr';
        return {
          ...c,
          current_round: decision === 'pass' ? nextRound : c.current_round,
          decision_status:
            decision === 'pass' && roundName === 'hr' ? 'Hired by recruiter' : c.decision_status,
          rounds: {
            ...c.rounds,
            [roundName]: { ...roundData, decision },
          },
        };
      })
    );
    appendAudit('Recruiter', `${decision === 'pass' ? 'Passed' : 'Ended'} ${roundName} round`, candidateId);
  };

  const handleGenerateTechnicalQuestions = (candidateId: string) => {
    if (!brief) return;
    const questions = recruitmentAgent.generateRoundQuestions('technical', brief.job_title);
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        return {
          ...c,
          rounds: {
            ...c.rounds,
            technical: {
              ...c.rounds.technical,
              questions,
              answers: questions.map(() => ''),
            },
          },
        };
      })
    );
    appendAudit('Agent', 'Generated technical interview questions', candidateId);
  };

  const handleEvaluateTechnical = (candidateId: string) => {
    const candidate = candidates.find((c) => c.candidate_id === candidateId);
    const round = candidate?.rounds.technical;
    if (!round?.questions || !round.answers) return;

    const evaluation = recruitmentAgent.reflectOnInterviewAnswers(
      'technical',
      round.questions,
      round.answers
    );
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.candidate_id !== candidateId) return c;
        return {
          ...c,
          rounds: {
            ...c.rounds,
            technical: { ...c.rounds.technical, evaluation },
          },
        };
      })
    );
    appendAudit('Agent', 'Evaluated technical interview answers', candidateId);
  };

  const handleApproveDraft = (draftId: string) => {
    setOutreachQueue((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, status: 'Recruiter approved — integration required; not sent or called' }
          : d
      )
    );
    appendAudit('Recruiter', 'Approved communication draft', draftId);
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

  const isJdApproved = brief?.status.includes('Approved');
  const hasActiveFilters = Boolean(
    statusFilter !== 'all' || searchQuery.trim() || selectedSkillTag || selectedCustomTag
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Compact Role Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {brief?.job_title || jobTitle}
            </h1>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-600">{brief?.company_name || companyName}</span>
            <span className="text-slate-300">·</span>
            {isJdApproved ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                JD Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700">
                Draft JD
                {brief && (
                  <button
                    type="button"
                    onClick={handleApproveJd}
                    className="underline font-semibold hover:text-amber-900 cursor-pointer"
                  >
                    Approve now
                  </button>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {brief?.location || location} · {brief?.salary_budget || salaryBudget} · High-scoring cutoff{' '}
            <span className="font-medium text-slate-700 tabular-nums">{cutoffScore}%</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Direct 1-Click Upload Resume */}
          <label
            className="px-3.5 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Upload a PDF, DOCX, TXT, or Markdown resume to immediately evaluate and view candidate details"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isReadingResumeFile ? 'Reading Resume...' : 'Upload Resume'}</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx,.doc,.rtf"
              onChange={handleQuickUploadResume}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={() => setWorkspaceSection('intake')}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            Paste Resume
          </button>

          <button
            type="button"
            onClick={() => setShowLinkedInImportModal(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#0a66c2]" />
            Import LinkedIn
          </button>

          <button
            type="button"
            onClick={() => handleOpenScheduler()}
            disabled={candidates.length === 0}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Schedule
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            title="Export candidate evaluation summaries and recruitment workflow audit logs as formatted PDF or CSV report"
          >
            <Download className="w-3.5 h-3.5 text-[#6743ee]" />
            <span>Export HR Report</span>
          </button>
        </div>
      </div>

      {/* Workspace Section Tabs */}
      <nav
        aria-label="Hiring workspace sections"
        className="flex items-center gap-6 border-b border-slate-200 px-1 overflow-x-auto"
      >
        {[
          {
            id: 'pipeline' as const,
            label: 'Candidates & Details',
            count: candidates.length,
          },
          {
            id: 'intake' as const,
            label: 'Upload / Paste Resume',
          },
          {
            id: 'brief' as const,
            label: 'Job Brief & JD',
          },
          {
            id: 'activity' as const,
            label: 'Interviews & Activity',
            count: scheduledInterviews.length + outreachQueue.length,
            overdueAlert: overdueFollowUpCount,
          },
        ].map((tab) => {
          const isActive = workspaceSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkspaceSection(tab.id)}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'border-[#6743ee] text-[#6743ee]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-slate-400 font-normal tabular-nums">({tab.count})</span>
              )}
              {tab.overdueAlert ? (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {tab.overdueAlert} follow-up due
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* ================================================================= */}
      {/* TAB 1: CANDIDATE PIPELINE, SELECTED CANDIDATE DETAILS & SKILLS GAP */}
      {/* ================================================================= */}
      {workspaceSection === 'pipeline' && (
        <div className="space-y-6">
          {/* 1. Candidate Pipeline List */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Pipeline Header & View Switcher */}
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Candidate Pipeline{' '}
                  <span className="text-slate-400 font-normal tabular-nums">
                    ({sortedCandidates.length}
                    {sortedCandidates.length !== candidates.length ? ` of ${candidates.length}` : ''})
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any candidate to view their full profile below, or upload a resume to evaluate a new applicant.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById('candidate-score-trajectory-section')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  title="View overall score distribution & intake trajectory line chart"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#6743ee]" />
                  <span>Score Trajectory</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchCompare()}
                  disabled={candidates.length < 2}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {selectedCompareIds.length === 2
                      ? 'Compare Selected (2)'
                      : selectedCompareIds.length === 1
                      ? 'Compare (1 selected)'
                      : 'Compare'}
                  </span>
                </button>

                <div
                  role="group"
                  aria-label="Pipeline view mode"
                  className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200"
                >
                  {[
                    { id: 'list' as const, label: 'List', icon: ListFilter },
                    { id: 'kanban' as const, label: 'Board', icon: Kanban },
                    { id: 'heatmap' as const, label: 'Heatmap', icon: Flame },
                    { id: 'compare' as const, label: 'Compare', icon: Scale },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const active = pipelineViewMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setPipelineViewMode(mode.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {pipelineViewMode === 'kanban' ? (
              <div className="p-4">
                <CandidateKanbanBoard
                  candidates={candidates}
                  brief={brief}
                  cutoffScore={cutoffScore}
                  onStageChange={handleStageChange}
                  onOpenEmailModal={handleOpenEmailDraftModal}
                  onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
                  onSaveNotes={handleSaveCandidateNotes}
                  auditEvents={events}
                  onOpenLinkedInImport={() => setShowLinkedInImportModal(true)}
                  onOpenPersona={handleOpenPersona}
                  onLaunchCompare={handleLaunchCompare}
                  onOpenScheduler={handleOpenScheduler}
                  onOpenFeedbackModal={handleOpenFeedbackModal}
                />
              </div>
            ) : pipelineViewMode === 'heatmap' ? (
              <div className="p-4">
                <RecruitmentIntensityHeatmap
                  candidates={candidates}
                  brief={brief}
                  onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
                  onOpenScheduler={handleOpenScheduler}
                  onOpenEmailModal={handleOpenEmailDraftModal}
                  onStageChange={handleStageChange}
                />
              </div>
            ) : pipelineViewMode === 'compare' ? (
              <SplitPaneComparisonView
                candidates={candidates}
                candidateAId={effectiveCompareAId}
                candidateBId={effectiveCompareBId}
                onSelectCandidateA={(idA) =>
                  setSelectedCompareIds([idA, effectiveCompareBId].filter(Boolean) as string[])
                }
                onSelectCandidateB={(idB) =>
                  setSelectedCompareIds([effectiveCompareAId, idB].filter(Boolean) as string[])
                }
                onSelectPair={(idA, idB) => setSelectedCompareIds([idA, idB])}
                onSwapCandidates={() => {
                  if (effectiveCompareAId && effectiveCompareBId) {
                    setSelectedCompareIds([effectiveCompareBId, effectiveCompareAId]);
                  }
                }}
                brief={brief}
                cutoffScore={cutoffScore}
                onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
                onOpenScheduler={handleOpenScheduler}
                onOpenPersona={handleOpenPersona}
                onAdvanceCandidate={(id) => handleRecruiterDecision(id, 'advance')}
                onBackToList={() => setPipelineViewMode('list')}
              />
            ) : (
              <>
                {/* Single Clean Filter & Sort Bar */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, skill, or label..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6743ee]"
                    />
                  </div>

                  <select
                    aria-label="Filter by stage"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee]"
                  >
                    <option value="all">All Stages</option>
                    <option value="Screening">Stage: Screening</option>
                    <option value="Technical">Stage: Technical</option>
                    <option value="Interview">Stage: Interview</option>
                    <option value="Offered">Stage: Offered</option>
                    <option value="Rejected">Stage: Rejected</option>
                    <option value="advanced">Decision: Advanced</option>
                    <option value="pending">Decision: Pending</option>
                  </select>

                  <select
                    aria-label="Filter by label"
                    value={selectedCustomTag || ''}
                    onChange={(e) => setSelectedCustomTag(e.target.value || null)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee]"
                  >
                    <option value="">All Labels</option>
                    {availableCustomTags.map((tag) => (
                      <option key={tag} value={tag}>
                        Label: {tag}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by skill"
                    value={selectedSkillTag || ''}
                    onChange={(e) => setSelectedSkillTag(e.target.value || null)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee]"
                  >
                    <option value="">All Skills</option>
                    {availableSkillTags.map((item) => (
                      <option key={item.skill} value={item.skill}>
                        {item.skill} ({item.count})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <select
                      aria-label="Sort candidates by"
                      value={sortField}
                      onChange={(e) =>
                        setSortField(e.target.value as 'score' | 'technical' | 'experience' | 'name')
                      }
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee]"
                    >
                      <option value="score">Sort: Match Score</option>
                      <option value="technical">Sort: Technical</option>
                      <option value="experience">Sort: Experience</option>
                      <option value="name">Sort: Name</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
                      title={sortDirection === 'desc' ? 'Descending order' : 'Ascending order'}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('all');
                        setSearchQuery('');
                        setSelectedSkillTag(null);
                        setSelectedCustomTag(null);
                      }}
                      className="text-xs font-medium text-[#6743ee] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {/* Active Compare Pair Banner */}
                {selectedCompareIds.length > 0 && (
                  <div className="px-5 py-2.5 bg-purple-50/60 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">Comparing:</span>
                      {selectedCompareIds.map((id, idx) => {
                        const c = candidates.find((item) => item.candidate_id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 font-medium text-slate-900">
                            {idx === 1 && <span className="text-slate-400 mr-1">vs</span>}
                            {c?.name || id}
                            <button
                              type="button"
                              onClick={() => handleToggleCompareCandidate(id)}
                              className="text-slate-400 hover:text-slate-700"
                              aria-label={`Remove ${c?.name || id} from comparison`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      {selectedCompareIds.length === 1 && (
                        <span className="text-slate-500">— select a second candidate to compare</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {selectedCompareIds.length === 2 && (
                        <button
                          type="button"
                          onClick={() => setPipelineViewMode('compare')}
                          className="font-semibold text-[#6743ee] hover:underline cursor-pointer"
                        >
                          Open side-by-side view
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedCompareIds([])}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Bulk Selection Strip / Action Bar */}
                {sortedCandidates.length > 0 && (
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
                )}

                {/* Candidate List */}
                <div className="divide-y divide-slate-200">
                  {sortedCandidates.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-sm text-slate-600">
                        {candidates.length === 0
                          ? 'No candidates in the pipeline yet.'
                          : 'No candidates match your current filters.'}
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusFilter('all');
                              setSearchQuery('');
                              setSelectedSkillTag(null);
                              setSelectedCustomTag(null);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-[#6743ee] hover:underline cursor-pointer"
                          >
                            Reset filters
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setWorkspaceSection('intake')}
                          className="px-3.5 py-1.5 bg-[#6743ee] text-white text-xs font-semibold rounded-lg hover:bg-[#5637d2] cursor-pointer"
                        >
                          Upload or Paste Resume
                        </button>
                      </div>
                    </div>
                  ) : (
                    sortedCandidates.map((cand, index) => {
                      const isSelectedCandidate = activeCandidate?.candidate_id === cand.candidate_id;
                      const isSelectedForBulk = selectedCandidateIds.includes(cand.candidate_id);
                      const isAboveCutoff = cand.overall_score >= cutoffScore;
                      const isMoreOpen = openMoreMenuId === cand.candidate_id;
                      const topSkills = Object.entries(cand.skill_scores || {})
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 4);
                      const latestFeedback = cand.interview_feedback_reports?.[0];

                      return (
                        <div
                          key={cand.candidate_id}
                          id={`candidate-card-${cand.candidate_id}`}
                          onClick={() => selectCandidate(cand.candidate_id)}
                          className={`px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors cursor-pointer ${
                            isSelectedCandidate
                              ? 'bg-purple-50/45'
                              : isSelectedForBulk
                              ? 'bg-slate-50/80'
                              : 'bg-white hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            {/* Selection Checkbox */}
                            <label
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer mt-1 sm:mt-0 text-slate-400 hover:text-[#6743ee] shrink-0"
                              title={`Select ${cand.name} for bulk actions`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelectedForBulk}
                                onChange={() => handleToggleSelectCandidate(cand.candidate_id)}
                                className="sr-only"
                                aria-label={`Select ${cand.name}`}
                              />
                              {isSelectedForBulk ? (
                                <CheckSquare className="w-4 h-4 text-[#6743ee]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                              )}
                            </label>

                            {/* Tabular Match Score */}
                            <div className="w-12 shrink-0 text-left">
                              <div
                                className={`text-base font-bold tabular-nums leading-tight ${
                                  isAboveCutoff ? 'text-slate-900' : 'text-slate-500'
                                }`}
                              >
                                {cand.overall_score}%
                              </div>
                              <div className="text-[11px] text-slate-400 tabular-nums">
                                #{index + 1}
                              </div>
                            </div>

                            {/* Name, Explicit Status & Quiet Metadata */}
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span
                                  className={`text-sm font-semibold ${
                                    isSelectedCandidate ? 'text-[#6743ee]' : 'text-slate-900'
                                  }`}
                                >
                                  {cand.name}
                                </span>

                                <span className="text-slate-300">·</span>

                                {/* Explicit Status Text */}
                                {cand.decision_status.includes('Not proceeding') ? (
                                  <span className="text-xs font-medium text-rose-700">
                                    Not proceeding
                                  </span>
                                ) : cand.decision_status.includes('Hired') ? (
                                  <span className="text-xs font-medium text-emerald-700">Hired</span>
                                ) : cand.decision_status.includes('Advanced') ? (
                                  <span className="text-xs font-medium text-emerald-700">
                                    Advanced
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">Pending review</span>
                                )}

                                {latestFeedback && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-xs font-medium text-[#6743ee]">
                                      {latestFeedback.overallRecommendation}
                                    </span>
                                  </>
                                )}

                                {(cand.custom_tags || []).map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomTag((prev) => (prev === tag ? null : tag));
                                    }}
                                    className="text-[11px] font-medium text-slate-600 hover:text-[#6743ee] bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                                    title={`Filter by label: ${tag}`}
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>

                              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>{cand.email}</span>
                                <span>·</span>
                                <span className="tabular-nums">
                                  Tech {cand.dimension_scores.technical}%
                                </span>
                                {topSkills.length > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">
                                      {topSkills.map(([skill, val]) => `${skill} (${val}/10)`).join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Focused Primary Actions + Selected Details Trigger */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0"
                          >
                            <CandidateStageDropdown
                              currentStage={getCandidateStage(cand)}
                              onStageChange={(newStage) =>
                                handleStageChange(cand.candidate_id, newStage)
                              }
                              candidateName={cand.name}
                              candidateId={cand.candidate_id}
                            />

                            <button
                              type="button"
                              onClick={() => handleOpenFeedbackModal(cand)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {latestFeedback ? 'Evaluation' : 'Feedback'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenScheduler(cand)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Schedule
                            </button>

                            {/* More Actions Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMoreMenuId((prev) =>
                                    prev === cand.candidate_id ? null : cand.candidate_id
                                  )
                                }
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                                aria-label={`More actions for ${cand.name}`}
                                title="More actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {isMoreOpen && (
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-md py-1.5 z-30 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPersona(cand)}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-[#6743ee]" />
                                    <span>Candidate Persona</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEmailDraftModal(cand)}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Draft Follow-Up Email</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCompareCandidate(cand.candidate_id)}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Scale className="w-3.5 h-3.5 text-slate-500" />
                                    <span>
                                      {selectedCompareIds.includes(cand.candidate_id)
                                        ? 'Remove from Compare'
                                        : 'Select to Compare'}
                                    </span>
                                  </button>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecruiterDecision(cand.candidate_id, 'advance')
                                    }
                                    className="w-full px-3.5 py-2 text-left text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Advance Candidate</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecruiterDecision(cand.candidate_id, 'reject')
                                    }
                                    className="w-full px-3.5 py-2 text-left text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Decline Candidate</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => focusSelectedCandidateDetails(cand.candidate_id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                                isSelectedCandidate
                                  ? 'bg-[#6743ee] text-white'
                                  : 'text-[#6743ee] hover:bg-purple-50'
                              }`}
                            >
                              {isSelectedCandidate ? 'Selected' : 'View Details'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </section>

          {/* 2. Selected Candidate Details Panel */}
          {activeCandidate && (
            <section
              id="selected-candidate-panel"
              aria-label="Selected Candidate Details"
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              {/* Newly Uploaded Resume Confirmation Strip */}
              {justUploadedCandidateId === activeCandidate.candidate_id && (
                <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
                  <span className="font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Uploaded resume evaluated for <strong>{activeCandidate.name}</strong> — showing
                    full candidate profile and competency breakdown below.
                  </span>
                  <button
                    type="button"
                    onClick={() => setJustUploadedCandidateId(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-medium shrink-0 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Selected Candidate Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <span>Selected Candidate Details</span>
                    <span>·</span>
                    <span className="font-mono text-slate-500">{activeCandidate.candidate_id}</span>
                    {activeCandidate.persona && (
                      <>
                        <span>·</span>
                        <span className="text-[#6743ee] normal-case font-medium">
                          {activeCandidate.persona.archetype}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-semibold text-slate-900">
                      {activeCandidate.name}
                    </h3>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-medium text-slate-700">
                      Stage: {getCandidateStage(activeCandidate)}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`text-xs font-medium ${
                        activeCandidate.decision_status.includes('Not proceeding')
                          ? 'text-rose-700'
                          : activeCandidate.decision_status.includes('Advanced') ||
                            activeCandidate.decision_status.includes('Hired')
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {activeCandidate.decision_status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{activeCandidate.email}</span>
                    {activeCandidate.phone && (
                      <>
                        <span>·</span>
                        <span>{activeCandidate.phone}</span>
                      </>
                    )}
                    {activeCandidate.digital_profile_sources
                      ?.filter((s) => s.source_location)
                      .map((src, i) => (
                        <React.Fragment key={i}>
                          <span>·</span>
                          <a
                            href={src.source_location}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#6743ee] hover:underline inline-flex items-center gap-1 font-medium"
                          >
                            <span>{src.source_type}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </React.Fragment>
                      ))}
                  </div>
                </div>

                {/* Right: Candidate Switcher, Overall Score & Actions */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <select
                    aria-label="Switch selected candidate"
                    value={activeCandidate.candidate_id}
                    onChange={(e) => selectCandidate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#6743ee]"
                  >
                    {candidates.map((c) => (
                      <option key={c.candidate_id} value={c.candidate_id}>
                        {c.name} ({c.overall_score}%)
                      </option>
                    ))}
                  </select>

                  <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right">
                    <div className="text-sm font-bold text-slate-900 tabular-nums leading-tight">
                      {activeCandidate.overall_score}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {activeCandidate.overall_score >= cutoffScore
                        ? 'Meets cutoff'
                        : 'Below cutoff'}
                    </div>
                  </div>

                  {candidates.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const otherId =
                          sortedCandidates.find((c) => c.candidate_id !== activeCandidate.candidate_id)
                            ?.candidate_id ||
                          candidates.find((c) => c.candidate_id !== activeCandidate.candidate_id)
                            ?.candidate_id;
                        handleLaunchCompare(activeCandidate.candidate_id, otherId);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5 text-[#6743ee]" />
                      <span>Compare Side-by-Side</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenPersona(activeCandidate)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#6743ee]" />
                    <span>Persona Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEmailDraftModal(activeCandidate)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Draft Email</span>
                  </button>

                  {!activeCandidate.decision_status.includes('Advanced') &&
                    !activeCandidate.decision_status.includes('Hired') && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRecruiterDecision(activeCandidate.candidate_id, 'advance')
                        }
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Advance
                      </button>
                    )}
                </div>
              </div>

              {/* Detail Sub-Tabs */}
              <div className="px-5 border-b border-slate-200 bg-slate-50/50 flex items-center gap-6">
                {[
                  { id: 'overview' as const, label: 'Overview & Competency Breakdown' },
                  {
                    id: 'rounds' as const,
                    label: `Interview Rounds & Feedback (${
                      activeCandidate.interview_feedback_reports?.length || 0
                    })`,
                  },
                  { id: 'resume' as const, label: 'Full Resume, Labels & Notes' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedDetailTab(tab.id)}
                    className={`py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                      selectedDetailTab === tab.id
                        ? 'border-[#6743ee] text-[#6743ee]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Detail Tab Content */}
              <div className="p-5 text-xs space-y-5">
                {selectedDetailTab === 'overview' && (
                  <>
                    {/* Executive Profile Summary */}
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="font-semibold text-slate-900">Candidate Executive Summary</div>
                      <p className="text-slate-700 leading-relaxed">
                        {activeCandidate.resume_profile}
                      </p>
                      {activeCandidate.persona && (
                        <p className="text-slate-600 pt-1">
                          <strong className="text-slate-800">Core Strength:</strong>{' '}
                          {activeCandidate.persona.superpower}
                        </p>
                      )}
                    </div>

                    {/* 6-Dimension Evaluation Rubric & Spider Radar Analysis */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              6-Dimension Evaluation Rubric
                            </h4>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100/80 text-[#6743ee] font-semibold">
                              Target Alignment
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Weighted rubric across technical, experience, education, projects, domain &amp; communication vs target requirements
                          </span>
                        </div>

                        {/* View Switcher: Spider Chart vs Matrix Cards */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setRubricViewMode('radar')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              rubricViewMode === 'radar'
                                ? 'bg-white text-[#6743ee] shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Interactive Spider / Radar chart comparing candidate scores with target job requirements"
                          >
                            <Radar className="w-3.5 h-3.5" />
                            <span>Spider Radar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRubricViewMode('grid')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              rubricViewMode === 'grid'
                                ? 'bg-white text-[#6743ee] shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Compact card grid view of individual dimension scores"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Card Matrix</span>
                          </button>
                        </div>
                      </div>

                      {rubricViewMode === 'radar' ? (
                        <CandidateRubricRadarChart
                          candidate={activeCandidate}
                          brief={brief}
                          cutoffScore={cutoffScore}
                        />
                      ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(activeCandidate.dimension_scores).map(([dim, score]) => {
                          const evidenceText =
                            activeCandidate.dimension_evidence?.[dim] ||
                            activeCandidate.dimension_evidence?.[
                              dim.charAt(0).toUpperCase() + dim.slice(1)
                            ];
                          return (
                            <div
                              key={dim}
                              className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800 capitalize">
                                  {dim}
                                </span>
                                <span className="font-bold text-slate-900 tabular-nums">
                                  {score}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    score >= cutoffScore ? 'bg-[#6743ee]' : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                              {evidenceText && (
                                <p className="text-[11px] text-slate-500 leading-snug">
                                  {evidenceText}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>

                    {/* Evaluated Skills Matrix (0-10) + Optional Radar Toggle */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900">
                          Evaluated Skills & Proficiency ({Object.keys(activeCandidate.skill_scores || {}).length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowRadarInDetail((prev) => !prev)}
                          className="text-xs font-medium text-[#6743ee] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Radar className="w-3.5 h-3.5" />
                          <span>{showRadarInDetail ? 'Hide Radar Chart' : 'Show Radar Chart'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {Object.entries(activeCandidate.skill_scores || {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([skill, val]) => (
                            <div
                              key={skill}
                              className="px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-800">{skill}</span>
                                <span
                                  className={`font-semibold tabular-nums ${
                                    val >= 7 ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {val}/10
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    val >= 7 ? 'bg-emerald-600' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${val * 10}%` }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>

                      {showRadarInDetail && (
                        <div className="pt-2">
                          <SkillRadarChart
                            skillScores={activeCandidate.skill_scores}
                            overallScore={activeCandidate.overall_score}
                            selected={
                              activeCandidate.decision_status === 'Advanced by recruiter' ||
                              activeCandidate.decision_status === 'Hired by recruiter'
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Strengths & Missing Skills / Gaps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Verified Strengths & Highlights</span>
                        </h4>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-600">
                          {activeCandidate.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                          {activeCandidate.persona?.highlightReel?.slice(0, 2).map((h, i) => (
                            <li key={`hl-${i}`}>
                              <strong className="text-slate-800">{h.title}:</strong> {h.description}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Missing Competencies & Interview Focus</span>
                        </h4>
                        {activeCandidate.missing_skills.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1.5 text-slate-600">
                            {activeCandidate.missing_skills.map((s, i) => {
                              const weakness = activeCandidate.detailed_weaknesses?.find(
                                (w) => w.skill.toLowerCase() === s.toLowerCase()
                              );
                              return (
                                <li key={i}>
                                  <strong className="text-slate-800">{s}:</strong>{' '}
                                  {weakness?.details ||
                                    'Not directly evidenced in resume; probe during technical round.'}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-slate-600">
                            All required role competencies are well-evidenced in {activeCandidate.name}&apos;s profile.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedDetailTab === 'rounds' && (
                  <div className="space-y-4">
                    {/* Interview Feedback Reports */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4 text-[#6743ee]" />
                          Standardized Interview Evaluations
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleOpenFeedbackModal(activeCandidate)}
                          className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg cursor-pointer"
                        >
                          + Log Interview Feedback
                        </button>
                      </div>

                      {activeCandidate.interview_feedback_reports &&
                      activeCandidate.interview_feedback_reports.length > 0 ? (
                        <div className="space-y-2.5">
                          {activeCandidate.interview_feedback_reports.map((rep) => (
                            <div
                              key={rep.id}
                              className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900">
                                  {rep.roundName} — {rep.overallRecommendation}
                                </span>
                                <span className="text-slate-500 tabular-nums">
                                  Score: {rep.evaluationReport?.compositeScore ?? 85}/100
                                </span>
                              </div>
                              {rep.evaluationReport?.executiveSummary && (
                                <p className="text-slate-600">
                                  {rep.evaluationReport.executiveSummary}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">
                          No interview feedback logged yet for {activeCandidate.name}. Click &ldquo;+ Log
                          Interview Feedback&rdquo; to generate a standardized evaluation report.
                        </p>
                      )}
                    </div>

                    {/* Coding Challenge Round */}
                    <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-slate-500" />
                          Adaptive Coding Challenge
                        </span>
                        {!activeCandidate.rounds.coding?.challenge && (
                          <button
                            type="button"
                            onClick={() => handleGenerateCoding(activeCandidate.candidate_id)}
                            className="px-3 py-1 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg cursor-pointer"
                          >
                            Generate Coding Task
                          </button>
                        )}
                      </div>

                      {activeCandidate.rounds.coding?.challenge && (
                        <div className="space-y-2.5">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {activeCandidate.rounds.coding.challenge.title}
                            </div>
                            <p className="text-slate-600 mt-0.5">
                              {activeCandidate.rounds.coding.challenge.prompt}
                            </p>
                          </div>
                          <textarea
                            value={activeCandidate.rounds.coding.candidate_submission || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCandidates((prev) =>
                                prev.map((c) =>
                                  c.candidate_id === activeCandidate.candidate_id
                                    ? {
                                        ...c,
                                        rounds: {
                                          ...c.rounds,
                                          coding: {
                                            ...c.rounds.coding,
                                            candidate_submission: val,
                                          },
                                        },
                                      }
                                    : c
                                )
                              );
                            }}
                            rows={4}
                            className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEvaluateCoding(activeCandidate.candidate_id)}
                              className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg cursor-pointer"
                            >
                              Evaluate Submission
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRoundDecision(activeCandidate.candidate_id, 'coding', 'pass')
                              }
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                            >
                              Pass Coding Round
                            </button>
                          </div>
                          {activeCandidate.rounds.coding.evaluation && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-slate-700">
                              <div className="font-semibold text-slate-900 tabular-nums">
                                Evaluation Score: {activeCandidate.rounds.coding.evaluation.score}/100
                              </div>
                              <p>{activeCandidate.rounds.coding.evaluation.correctness}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Technical Q&A Round */}
                    <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          Technical Interview Questions
                        </span>
                        {!activeCandidate.rounds.technical?.questions && (
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateTechnicalQuestions(activeCandidate.candidate_id)
                            }
                            className="px-3 py-1 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg cursor-pointer"
                          >
                            Generate Questions
                          </button>
                        )}
                      </div>

                      {activeCandidate.rounds.technical?.questions && (
                        <div className="space-y-3">
                          {activeCandidate.rounds.technical.questions.map((q, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="font-medium text-slate-800">
                                Q{idx + 1}: {q}
                              </div>
                              <textarea
                                value={activeCandidate.rounds.technical?.answers?.[idx] || ''}
                                onChange={(e) => {
                                  const newAns = [
                                    ...(activeCandidate.rounds.technical?.answers || []),
                                  ];
                                  newAns[idx] = e.target.value;
                                  setCandidates((prev) =>
                                    prev.map((c) =>
                                      c.candidate_id === activeCandidate.candidate_id
                                        ? {
                                            ...c,
                                            rounds: {
                                              ...c.rounds,
                                              technical: {
                                                ...c.rounds.technical,
                                                answers: newAns,
                                              },
                                            },
                                          }
                                        : c
                                    )
                                  );
                                }}
                                rows={2}
                                placeholder="Record candidate response..."
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                              />
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEvaluateTechnical(activeCandidate.candidate_id)}
                              className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white font-semibold rounded-lg cursor-pointer"
                            >
                              Evaluate Responses
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRoundDecision(
                                  activeCandidate.candidate_id,
                                  'technical',
                                  'pass'
                                )
                              }
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                            >
                              Pass Technical Round
                            </button>
                          </div>
                          {activeCandidate.rounds.technical.evaluation && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                              {activeCandidate.rounds.technical.evaluation.evidence}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedDetailTab === 'resume' && (
                  <div className="space-y-4">
                    {/* Uploaded / Parsed Resume Text Viewer */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-[#6743ee]" />
                          <span>Resume Document Content</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {activeCandidate.document_validation?.resume?.label || 'Resume Profile'}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-white p-3.5 border border-slate-200 rounded-lg max-h-72 overflow-y-auto leading-relaxed">
                        {activeCandidate.resume_text || activeCandidate.resume_profile}
                      </pre>
                    </div>

                    {/* Custom Labels / Tags Manager */}
                    <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#6743ee]" />
                        <span>Candidate Labels</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(activeCandidate.custom_tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-[#6743ee] rounded text-xs font-medium"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveCustomTag(activeCandidate.candidate_id, tag)
                              }
                              className="hover:text-rose-600"
                              aria-label={`Remove label ${tag}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {PRESET_CUSTOM_TAGS.filter(
                          (preset) => !(activeCandidate.custom_tags || []).includes(preset)
                        ).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              handleAddCustomTag(activeCandidate.candidate_id, preset)
                            }
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddCustomTag(activeCandidate.candidate_id, newTagInput);
                        }}
                        className="flex items-center gap-2 pt-1 max-w-xs"
                      >
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="Custom label..."
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-medium cursor-pointer"
                        >
                          Add
                        </button>
                      </form>
                    </div>

                    <CandidatePrivateNotes
                      candidate={activeCandidate}
                      onSaveNotes={handleSaveCandidateNotes}
                      auditHistory={events}
                    />

                    <div className="p-4 bg-white border border-slate-200 rounded-lg">
                      <h4 className="font-semibold text-slate-900 mb-2">Verification Checks</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {Object.entries(activeCandidate.verification_checks).map(
                          ([check, status]) => (
                            <div
                              key={check}
                              className="p-2 bg-slate-50 border border-slate-200 rounded-md"
                            >
                              <div className="capitalize text-slate-500">{check}</div>
                              <div
                                className={`font-semibold capitalize mt-0.5 ${
                                  status === 'verified' ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {status.replace('_', ' ')}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 3. Candidate Score Distribution & Trajectory Line Chart */}
          <CandidateScoreTrajectorySection
            candidates={candidates}
            cutoffScore={cutoffScore}
            brief={brief}
            onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
            onQuickUploadClick={() => setWorkspaceSection('intake')}
          />

          {/* 4. Team Skills Gap Analysis */}
          <TeamSkillsGapAnalysis
            candidates={candidates}
            brief={brief}
            cutoffScore={cutoffScore}
            onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
            onFilterBySkill={(skill) => {
              setSelectedSkillTag((prev) => (prev === skill ? null : skill));
              setStatusFilter('all');
              setPipelineViewMode('list');
            }}
            onOpenLinkedInImport={() => setShowLinkedInImportModal(true)}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: UPLOAD / PASTE RESUME                                      */}
      {/* ================================================================= */}
      {workspaceSection === 'intake' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Upload or Screen Candidate Resume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a PDF, DOCX, TXT, or Markdown file, paste resume text, or load a sample profile to view full candidate details.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <label className="px-3.5 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isReadingResumeFile ? 'Extracting...' : 'Quick Upload & View Details'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx,.doc,.rtf"
                  onChange={handleQuickUploadResume}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowLinkedInImportModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#0a66c2]" />
                Import LinkedIn
              </button>
              {(resumeTextInput || candidateNameInput || candidateEmailInput) && (
                <button
                  type="button"
                  onClick={handleClearScreeningForm}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Quick-Load Sample Profiles */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Quick-Load Sample Resume
            </label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_RESUME_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectSamplePreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#6743ee] text-white border-[#6743ee]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.name} ({preset.title})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resume Upload & Text Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Resume File or Text *{' '}
                {uploadedFileName && (
                  <span className="text-[#6743ee] font-normal ml-1">({uploadedFileName})</span>
                )}
              </label>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-[#6743ee] hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load file into form (.pdf, .docx, .txt)</span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.docx,.doc,.rtf"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAutoExtractFromResume}
                  className="text-xs font-semibold text-[#6743ee] hover:underline cursor-pointer"
                >
                  Auto-fill fields
                </button>
              </div>
            </div>
            <textarea
              value={resumeTextInput}
              onChange={(e) => setResumeTextInput(e.target.value)}
              rows={7}
              placeholder="Paste candidate resume text here or upload a file above..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#6743ee]"
            />
            {autoFillNotification && (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {autoFillNotification}
              </p>
            )}
          </div>

          {/* Live Skill Match Preview */}
          {(() => {
            const requiredSkillsList = brief
              ? brief.requirements.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
              : [];
            const displayParsed =
              lastParsedData ||
              (resumeTextInput.trim().length > 30
                ? parseResumeText(resumeTextInput, requiredSkillsList)
                : null);

            if (!displayParsed) return null;
            return (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-800">
                  Detected {displayParsed.matchedSkills.length} of {requiredSkillsList.length} required
                  skills ({displayParsed.matchRatePercent}% coverage)
                </span>
                <span className="text-slate-600">
                  {displayParsed.matchedSkills.slice(0, 6).join(', ')}
                </span>
              </div>
            );
          })()}

          {/* Candidate Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                placeholder="e.g. Jordan Lee"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
                placeholder="jordan.lee@example.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={candidatePhoneInput}
                onChange={(e) => setCandidatePhoneInput(e.target.value)}
                placeholder="+1-555-010-2030"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GitHub URL</label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Highlights</label>
              <input
                type="text"
                value={workHighlights}
                onChange={(e) => setWorkHighlights(e.target.value)}
                placeholder="Key project or impact metric..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={processingConsent}
                onChange={(e) => setProcessingConsent(e.target.checked)}
              />
              <span>Candidate consented to automated evaluation against the role rubric.</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={memoryConsent}
                onChange={(e) => setMemoryConsent(e.target.checked)}
              />
              <span>Retain evaluation history for future role matching.</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleScreenResume}
              disabled={!resumeTextInput.trim() || !processingConsent}
              className="px-5 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Screen & View Candidate Details
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: JOB BRIEF & JD                                             */}
      {/* ================================================================= */}
      {workspaceSection === 'brief' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#6743ee]" />
                <h2 className="text-base font-semibold text-slate-900">Hiring Brief & Requirements</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(ROLE_REQUIREMENTS).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRolePresetChange(role)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                      selectedRolePreset === role
                        ? 'bg-[#6743ee] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleGenerateJd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Headcount</label>
                  <input
                    type="number"
                    min="1"
                    value={headcount}
                    onChange={(e) => setHeadcount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Salary Budget
                  </label>
                  <input
                    type="text"
                    value={salaryBudget}
                    onChange={(e) => setSalaryBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Timeline</label>
                  <input
                    type="text"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Required Competencies (comma separated — used in Team Skills Gap Analysis) *
                </label>
                <textarea
                  value={requirementsText}
                  onChange={(e) => setRequirementsText(e.target.value)}
                  rows={2}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Update Brief & Regenerate JD
              </button>
            </form>
          </section>

          {brief && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Job Description Draft</h3>
                {!isJdApproved ? (
                  <button
                    type="button"
                    onClick={handleApproveJd}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Approve JD
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved
                  </span>
                )}
              </div>

              <textarea
                value={brief.jd}
                onChange={(e) => setBrief({ ...brief, jd: e.target.value })}
                rows={8}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
              />

              {brief.evaluation_rubric && (
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-800 mb-2">
                    Evaluation Rubric Weights
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {brief.evaluation_rubric.criteria.map((c, i) => (
                      <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-medium text-slate-800">{c.criterion}</div>
                        <div className="text-xs font-semibold text-[#6743ee] tabular-nums mt-0.5">
                          {c.weight_percent}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: INTERVIEWS, OUTREACH DRAFTS & ACTIVITY LOG                 */}
      {/* ================================================================= */}
      {workspaceSection === 'activity' && (
        <div className="space-y-6">
          <ScheduledInterviewsSection
            scheduledInterviews={scheduledInterviews}
            onOpenScheduler={handleOpenScheduler}
            candidates={candidates}
          />

          <OutreachQueueSection
            outreachQueue={outreachQueue}
            setOutreachQueue={setOutreachQueue}
            candidates={candidates}
            brief={brief}
            onInspectCandidate={(id) => focusSelectedCandidateDetails(id)}
            appendAudit={appendAudit}
          />

          <WorkforceGraph job={brief} candidates={candidates} />

          {events.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Activity Log ({events.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="text-xs text-[#6743ee] hover:text-[#5233c7] hover:underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Export audit events and candidate logs"
                >
                  <Download className="w-3 h-3" />
                  <span>Export Audit Trail</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                {[...events].reverse().map((evt, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between gap-4">
                    <span className="text-slate-600">
                      <strong className="text-slate-900 font-medium">{evt.actor}</strong>: {evt.action}{' '}
                      <span className="text-slate-400">({evt.subject})</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                      {evt.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODALS                                                            */}
      {/* ================================================================= */}
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
          brief={brief}
          onOpenPersonaModal={handleOpenPersona}
        />
      )}

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

      {showLinkedInImportModal && (
        <LinkedInImportModal
          isOpen={showLinkedInImportModal}
          onClose={() => setShowLinkedInImportModal(false)}
          brief={brief}
          onImport={handleImportLinkedInCandidates}
        />
      )}

      {showPersonaModal && personaModalCandidate && (
        <CandidatePersonaModal
          isOpen={showPersonaModal}
          onClose={() => setShowPersonaModal(false)}
          candidate={personaModalCandidate}
          candidatesList={sortedCandidates}
          onSelectCandidate={handleOpenPersona}
          onRegeneratePersona={handleRegeneratePersona}
          isRegenerating={generatingPersonaId === personaModalCandidate.candidate_id}
        />
      )}

      {showSchedulerModal && schedulerCandidate && (
        <InterviewSchedulerModal
          isOpen={showSchedulerModal}
          onClose={() => setShowSchedulerModal(false)}
          candidate={schedulerCandidate}
          candidatesList={sortedCandidates}
          onSelectCandidate={(cand) => setSchedulerCandidate(cand)}
          brief={brief}
          onConfirmSchedule={handleConfirmScheduledInterview}
        />
      )}

      {showFeedbackModal && feedbackCandidate && (
        <InterviewFeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          candidate={feedbackCandidate}
          brief={brief}
          onSaveFeedback={handleSaveFeedbackReport}
          onOpenEmailDraft={(cand) => handleOpenEmailDraftModal(cand)}
        />
      )}

      {showExportModal && (
        <ExportReportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          brief={brief}
          candidates={candidates}
          auditEvents={events}
          outreachQueue={outreachQueue}
          cutoffScore={cutoffScore}
          appendAudit={appendAudit}
        />
      )}
    </div>
  );
};
