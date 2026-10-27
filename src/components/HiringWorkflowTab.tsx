import React, { useState } from 'react';
import { 
  Candidate, 
  HiringBrief, 
  OutreachDraft, 
  AuditEvent, 
  RoundType 
} from '../types';
import { ROLE_REQUIREMENTS } from '../data/roles';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { SkillRadarChart } from './SkillRadarChart';
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
  UserCheck,
  Shield,
  FileCode,
  ListTodo
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
}

export const HiringWorkflowTab: React.FC<HiringWorkflowTabProps> = ({
  brief,
  setBrief,
  candidates,
  setCandidates,
  outreachQueue,
  setOutreachQueue,
  events,
  setEvents,
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

  // Expanded cards
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  const appendAudit = (actor: string, action: string, subject: string) => {
    const newEvent: AuditEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      actor,
      action,
      subject,
    };
    setEvents(prev => [...prev, newEvent]);
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

  // Active candidate for the radar chart
  const activeCandidate = candidates.find(c => c.candidate_id === selectedCandidateId) || candidates[0];

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
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  4. Recruiter Supervision & Candidate Pipeline ({candidates.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Candidates ranked by multi-dimensional job evidence. The recruiter makes all final advancing decisions.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {candidates.map((cand) => {
                const isExpanded = !!expandedCandidates[cand.candidate_id];
                const codingRound = cand.rounds.coding;
                const techRound = cand.rounds.technical;

                return (
                  <div
                    key={cand.candidate_id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs transition-all"
                  >
                    {/* Header bar */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 font-black text-sm flex items-center justify-center">
                          {cand.overall_score}%
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{cand.name}</span>
                            <span className="text-xs text-slate-400 font-mono">({cand.candidate_id})</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                            <span>{cand.email}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">Round: {cand.current_round.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
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
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="p-5 space-y-6 text-xs">
                        {/* 6 Dimension Breakdown */}
                        <div>
                          <h4 className="font-bold text-slate-800 mb-2">6-Dimension Competency Evidence</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {Object.entries(cand.dimension_scores).map(([dim, score]) => (
                              <div key={dim} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                                  {dim}
                                </span>
                                <span className="text-base font-black text-[#6743ee] block mt-0.5">{score}%</span>
                              </div>
                            ))}
                          </div>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
    </div>
  );
};
