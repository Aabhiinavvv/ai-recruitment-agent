export type JobStatus = 'not_started' | 'draft' | 'approved';
export type RecruiterDecision = 'pending' | 'advance' | 'not_proceeding' | 'hire_approved';
export type CommunicationStatus = 'not_started' | 'drafted' | 'approved' | 'external_delivery_recorded' | 'responded';
export type InterviewStatus = 'not_started' | 'scheduled' | 'completed' | 'needs_review';
export type VerificationStatus = 'not_started' | 'in_progress' | 'completed' | 'discrepancy' | 'unable_to_verify';
export type OfferStatus = 'not_started' | 'draft' | 'approved' | 'sent' | 'accepted' | 'declined' | 'withdrawn';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';
export type OrchestrationTaskStatus = 'completed' | 'ready' | 'blocked' | 'needs_human_review' | 'waiting_external_action' | 'not_applicable';

export interface CandidateOrchestrationState {
  candidate_ref: string;
  profile_ready: boolean;
  matching_reviewed: boolean;
  recruiter_decision: RecruiterDecision;
  communication_consent_confirmed: boolean;
  communication_status: CommunicationStatus;
  interview_consent_confirmed: boolean;
  interview_status: InterviewStatus;
  verification_consent_confirmed: boolean;
  verification_status: VerificationStatus;
  offer_status: OfferStatus;
  onboarding_status: OnboardingStatus;
}

export interface OrchestrationPlanRequest {
  role_ref: string;
  job_status: JobStatus;
  candidate_count_in_pipeline: number;
  candidate?: CandidateOrchestrationState | null;
  analytics_snapshot_generated: boolean;
  workforce_history_months_available: number;
  workforce_assumptions_confirmed: boolean;
  workforce_forecast_generated: boolean;
}

export interface OrchestrationTask {
  agent_number: number;
  agent_name: string;
  scope_ref: string;
  status: OrchestrationTaskStatus;
  recommended_action: string;
  blockers: string[];
  dependencies: number[];
  requires_human_approval: boolean;
}

export interface OrchestrationCounts {
  total: number;
  completed: number;
  ready: number;
  blocked: number;
  needs_human_review: number;
  waiting_external_action: number;
  not_applicable: number;
}

export interface OrchestrationPlanResponse {
  orchestration_id: string;
  role_ref: string;
  candidate_ref?: string | null;
  tasks: OrchestrationTask[];
  next_actions: OrchestrationTask[];
  counts: OrchestrationCounts;
  completion_percent: number;
  orchestration_mode: 'dependency_aware_plan_only';
  agent_dispatch_enabled: false;
  communication_dispatch_enabled: false;
  provider_execution_enabled: false;
  persistence_enabled: false;
  autonomous_hiring_decisions_enabled: false;
  warnings: string[];
  note: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function createOrchestrationPlan(
  request: OrchestrationPlanRequest,
): Promise<OrchestrationPlanResponse> {
  const response = await fetch(API_BASE_URL + '/api/v1/orchestrator/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    let message = 'AI Recruitment Orchestrator failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid orchestration input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<OrchestrationPlanResponse>;
}
