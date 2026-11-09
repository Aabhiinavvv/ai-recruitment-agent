import type { CandidateProfile } from './candidateIntelligenceApi';

export interface MatchJobRubricCriterion {
  criterion: string;
  weight_percent: number;
  evidence_to_look_for: string[];
}

export interface MatchJobContext {
  job_id: string;
  job_title: string;
  approved_for_matching: boolean;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  education_requirements: string[];
  minimum_experience_months: number | null;
  rubric: {
    scoring_scale: string;
    criteria: MatchJobRubricCriterion[];
    decision_boundary: string;
  };
}

export interface CriterionMatch {
  criterion: string;
  weight_percent: number;
  score: number | null;
  status: 'scored' | 'not_evaluable';
  rationale: string;
  evidence_ids: string[];
}

export interface SkillMatch {
  skill: string;
  status: 'matched' | 'not_detected';
  evidence_ids: string[];
}

export interface CandidateMatchResult {
  rank: number;
  candidate_id: string;
  source_file: string;
  evidence_alignment_index: number | null;
  evidence_coverage_percent: number;
  scored_weight_percent: number;
  required_skill_matches: SkillMatch[];
  preferred_skill_matches: SkillMatch[];
  criteria: CriterionMatch[];
  strengths_supported_by_evidence: string[];
  not_detected_or_unverified: string[];
  review_flags: string[];
  retrieval_method: string;
  decision_boundary: string;
  recruiter_decision: 'pending_review';
}

export interface CandidateMatchBatchResponse {
  job_id: string;
  job_title: string;
  processed_candidates: number;
  results: CandidateMatchResult[];
  methodology: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function matchCandidates(
  job: MatchJobContext,
  candidates: CandidateProfile[],
): Promise<CandidateMatchBatchResponse> {
  if (!job.approved_for_matching) {
    throw new Error('Only a recruiter-approved job can be used for matching.');
  }
  if (!candidates.length) throw new Error('Upload and extract at least one candidate resume.');

  // Do not send contact details, location, portfolio URLs, or named entities to the
  // matching service. Only job-related structured fields and linked evidence are needed.
  const jobRelatedCandidates = candidates.map((profile, index) => ({
    candidate_id: profile.candidate_id,
    source_file: 'candidate-resume-' + (index + 1),
    skills: profile.skills,
    work_experience: profile.work_experience,
    education: profile.education,
    projects: profile.projects,
    evidence: profile.evidence,
    field_confidence: profile.field_confidence,
    extraction_status: profile.extraction_status,
    review_flags: profile.review_flags,
  }));

  const response = await fetch(API_BASE_URL + '/api/v1/matching/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job, candidates: jobRelatedCandidates }),
  });

  if (!response.ok) {
    let message = 'Candidate matching API failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail.map((item: { msg?: string }) => item.msg || 'Invalid input').join('; ');
      }
    } catch {
      // Keep the HTTP status message if the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<CandidateMatchBatchResponse>;
}
