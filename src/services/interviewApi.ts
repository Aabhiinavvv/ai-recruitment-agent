export type InterviewRound = 'technical' | 'behavioral' | 'role_specific' | 'hr';

export interface InterviewPlanRequest {
  candidate_id: string;
  job_title: string;
  interview_round: InterviewRound;
  recruiter_approved: boolean;
  recruiter_decision: 'advance';
  candidate_consent_confirmed: boolean;
  job_context: string;
  rubric_criteria: Array<{
    criterion: string;
    weight_percent: number;
    evidence_to_look_for: string[];
  }>;
}

export interface InterviewQuestion {
  question_id: string;
  question: string;
  question_type: 'technical' | 'behavioral' | 'situational' | 'role_specific';
  competency: string;
  rationale: string;
  follow_up_probes: string[];
}

export interface InterviewPlanResponse {
  session_id: string;
  candidate_id: string;
  job_title: string;
  interview_round: InterviewRound;
  questions: InterviewQuestion[];
  generation_mode: 'ollama' | 'deterministic_fallback';
  model_name?: string | null;
  warnings: string[];
  status: 'prepared_for_recruiter_led_interview';
  requires_human_review: true;
  audio_recording_enabled: false;
  video_recording_enabled: false;
  persistence_enabled: false;
  note: string;
}

export interface InterviewAnswerRequest {
  session_id: string;
  candidate_id: string;
  job_title: string;
  interview_round: InterviewRound;
  question_id: string;
  question: string;
  competency: string;
  answer: string;
  evidence_to_look_for: string[];
  transcript_processing_consent_confirmed: boolean;
}

export interface InterviewAnswerEvaluationResponse {
  session_id: string;
  candidate_id: string;
  question_id: string;
  competency: string;
  score: number | null;
  assessment: string;
  evidence_quotes: string[];
  strengths: string[];
  gaps: string[];
  follow_up_question: string;
  review_flags: string[];
  evaluation_mode: 'ollama' | 'manual_review_fallback';
  model_name?: string | null;
  decision_status: 'pending_human_review';
  requires_human_review: true;
  automated_pass_reject: false;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = 'Interview Agent request failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message if the error response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function createInterviewPlan(
  request: InterviewPlanRequest,
): Promise<InterviewPlanResponse> {
  return postJson<InterviewPlanResponse>('/api/v1/interviews/plan', request);
}

export function evaluateInterviewAnswer(
  request: InterviewAnswerRequest,
): Promise<InterviewAnswerEvaluationResponse> {
  return postJson<InterviewAnswerEvaluationResponse>('/api/v1/interviews/evaluate', request);
}
