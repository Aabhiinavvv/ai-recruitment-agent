export type RoundType = 'coding' | 'technical' | 'hr';

export type HiringStage = 'Screening' | 'Technical' | 'Interview' | 'Offered' | 'Rejected';

export type CandidateDecisionStatus = 
  | 'Pending recruiter review'
  | 'Advanced by recruiter'
  | 'Not proceeding (recruiter decision)'
  | 'Hired by recruiter';

export interface DimensionScores {
  technical: number;
  experience: number;
  education: number;
  projects: number;
  domain: number;
  communication: number;
}

export interface ReviewFlag {
  category: string;
  evidence: string;
  action: string;
}

export interface DetailedWeakness {
  skill: string;
  score: number;
  details: string;
  suggestions: string[];
  example?: string;
}

export interface CodingChallenge {
  title: string;
  prompt: string;
  input_format: string;
  output_format: string;
  constraints: string;
  examples: string;
  starter_code: string;
}

export interface CodingEvaluation {
  score: number;
  correctness: string;
  approach: string;
  complexity: string;
  strengths: string[];
  improvement_areas: string[];
}

export interface RoundEvaluation {
  evidence: string;
  strengths: string[];
  follow_up_areas: string[];
  communication_observations?: string;
}

export interface CandidateCodingRoundState {
  challenge?: CodingChallenge;
  candidate_submission?: string;
  challenge_version?: number;
  evaluation?: CodingEvaluation;
  decision?: 'pass' | 'not_proceeding' | null;
  notes?: string;
}

export interface CandidateInterviewRoundState {
  questions?: string[];
  answers?: string[];
  evaluation?: RoundEvaluation;
  decision?: 'pass' | 'not_proceeding' | null;
  notes?: string;
}

export interface ProfileSource {
  source_type: string;
  source_ref: string;
  source_location: string;
  content: string;
}

export interface OnboardingTask {
  label: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  notes?: string;
}

export interface Candidate {
  candidate_id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  resume_text: string;
  resume_profile: string;
  overall_score: number;
  stage?: HiringStage;
  recruiter_decision?: 'advance' | 'reject' | 'hold';
  decision_status: CandidateDecisionStatus;
  recommendation?: 'Advance' | 'Hold' | 'Reject';
  safety_warnings: string[];
  review_flags: ReviewFlag[];
  review_note?: string;
  private_notes?: string;
  notes_updated_at?: string;
  dimension_scores: DimensionScores;
  dimension_evidence: Record<string, string>;
  skill_scores: Record<string, number>;
  strengths: string[];
  missing_skills: string[];
  detailed_weaknesses: DetailedWeakness[];
  digital_profile_sources: ProfileSource[];
  current_round: RoundType;
  rounds: {
    coding?: CandidateCodingRoundState;
    technical?: CandidateInterviewRoundState;
    hr?: CandidateInterviewRoundState;
  };
  verification_checks: Record<string, 'pending' | 'in_progress' | 'verified' | 'flagged'>;
  document_validation: Record<string, { label: string; status: 'pending' | 'submitted' | 'verified' | 'rejected' }>;
  onboarding?: {
    status: string;
    tasks: Record<string, OnboardingTask>;
  };
  memory_consent: boolean;
  memory_email?: string;
  organizational_memory?: {
    history: Array<{
      recorded_at: string;
      snapshot_json: string;
    }>;
  };
}

export interface JobRubricCriterion {
  criterion: string;
  weight_percent: number;
}

export interface EvaluationRubric {
  scoring_scale: string;
  criteria: JobRubricCriterion[];
  decision_boundary: string;
}

export interface HiringBrief {
  company_name: string;
  job_title: string;
  location: string;
  headcount: number;
  salary_budget: string;
  timeline: string;
  requirements: string;
  jd: string;
  status: 'Draft — recruiter review required' | 'Approved by recruiter — publishing integration required';
  evaluation_rubric?: EvaluationRubric;
}

export interface OutreachDraft {
  id: string;
  type: 'round' | 'rejection' | 'progress' | 'outreach';
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  round_name?: RoundType;
  interview_format?: string;
  subject: string;
  body: string;
  call_script: string;
  availability: string;
  status: 'Draft — not sent or scheduled' | 'Recruiter approved — integration required; not sent or called';
}

export type EmailDraftType = 'progress' | 'rejection';
export type EmailDraftTone = 'warm' | 'professional' | 'constructive' | 'concise';

export interface FollowUpEmailOptions {
  candidate: Candidate;
  jobTitle: string;
  companyName: string;
  emailType: EmailDraftType;
  reasonCategory: string;
  specificFeedback?: string;
  tone?: EmailDraftTone;
  nextRoundName?: string;
  schedulingLink?: string;
  includeNextSteps?: boolean;
  includeTalentPoolNote?: boolean;
  recruiterNotes?: string;
}

export interface FollowUpEmailResult {
  subject: string;
  body: string;
  call_script: string;
  reasons_cited: string[];
  suggested_subjects: string[];
}

export interface AuditEvent {
  timestamp: string;
  actor: string;
  action: string;
  subject: string;
}

export interface InterviewHistoryItem {
  question: string;
  answer: string;
  result: {
    score: number;
    feedback: string;
    improvement?: string;
  };
  motion_alert: number | null;
  timestamp: number;
}
