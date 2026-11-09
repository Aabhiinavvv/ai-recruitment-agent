export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
export type PayFrequency = 'annual' | 'monthly' | 'hourly';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';

export type OfferStatus =
  | 'draft_pending_approval'
  | 'approved_not_sent'
  | 'sent_outside_platform'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export type OfferEvent =
  | 'approve'
  | 'mark_sent'
  | 'record_acceptance'
  | 'record_decline'
  | 'withdraw'
  | 'mark_expired';

export type OnboardingTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface OfferDraftRequest {
  candidate_id: string;
  job_title: string;
  company_name: string;
  recruiter_hire_approved: boolean;
  verification_review_completed: boolean;
  unresolved_verification_items: number;
  employment_type: EmploymentType;
  currency: string;
  compensation_amount: string;
  pay_frequency: PayFrequency;
  work_mode: WorkMode;
  work_location_label: string;
  start_date: string;
  offer_expiry_date: string;
  probation_months?: number | null;
  benefits: string[];
  additional_terms: string[];
}

export interface OfferDraftResponse {
  offer_id: string;
  candidate_id: string;
  job_title: string;
  company_name: string;
  employment_type: EmploymentType;
  currency: string;
  compensation_amount: string;
  pay_frequency: PayFrequency;
  work_mode: WorkMode;
  work_location_label: string;
  start_date: string;
  offer_expiry_date: string;
  probation_months?: number | null;
  benefits: string[];
  additional_terms: string[];
  draft_text: string;
  status: OfferStatus;
  requires_recruiter_approval: true;
  offer_dispatch_enabled: false;
  signature_enabled: false;
  persistence_enabled: false;
  legally_binding: false;
  notice: string;
}

export interface OfferEventRequest {
  offer_id: string;
  candidate_id: string;
  current_status: OfferStatus;
  event: OfferEvent;
  recruiter_attested: boolean;
  candidate_response_confirmed: boolean;
  event_reference?: string | null;
  offer_expiry_date: string;
  reviewer_note: string;
}

export interface OfferEventResponse {
  offer_id: string;
  candidate_id: string;
  previous_status: OfferStatus;
  current_status: OfferStatus;
  event: OfferEvent;
  event_reference?: string | null;
  reviewer_note: string;
  status_recorded: 'returned_to_client_for_recruiter_review';
  recruiter_attested: true;
  persisted: false;
  dispatch_performed: false;
  signature_performed: false;
  hiring_decision_enabled: false;
}

export interface OnboardingPlanRequest {
  offer_id: string;
  candidate_id: string;
  job_title: string;
  employment_type: EmploymentType;
  offer_status: 'accepted';
  recruiter_start_approved: boolean;
  start_date: string;
}

export interface OnboardingTask {
  task_id: string;
  title: string;
  description: string;
  owner: 'hr' | 'manager' | 'it' | 'candidate' | 'recruiter';
  status: OnboardingTaskStatus;
  evidence_required: boolean;
}

export interface OnboardingPlanResponse {
  plan_id: string;
  offer_id: string;
  candidate_id: string;
  job_title: string;
  employment_type: EmploymentType;
  start_date: string;
  tasks: OnboardingTask[];
  status: 'onboarding_plan_created';
  requires_human_oversight: true;
  external_account_creation_enabled: false;
  document_collection_enabled: false;
  persistence_enabled: false;
  notice: string;
}

export interface OnboardingTaskEventRequest {
  plan_id: string;
  offer_id: string;
  candidate_id: string;
  task_id: string;
  current_status: OnboardingTaskStatus;
  target_status: OnboardingTaskStatus;
  reviewer_attested: boolean;
  reviewer_note: string;
}

export interface OnboardingTaskEventResponse {
  plan_id: string;
  offer_id: string;
  candidate_id: string;
  task_id: string;
  previous_status: OnboardingTaskStatus;
  current_status: OnboardingTaskStatus;
  reviewer_note: string;
  status_recorded: 'returned_to_client_for_recruiter_review';
  reviewer_attested: true;
  persisted: false;
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
    let message = 'Offer & Onboarding Agent failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message if the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function createOfferDraft(request: OfferDraftRequest): Promise<OfferDraftResponse> {
  return postJson<OfferDraftResponse>('/api/v1/onboarding/offers/drafts', request);
}

export function recordOfferEvent(request: OfferEventRequest): Promise<OfferEventResponse> {
  return postJson<OfferEventResponse>('/api/v1/onboarding/offers/events', request);
}

export function createOnboardingPlan(request: OnboardingPlanRequest): Promise<OnboardingPlanResponse> {
  return postJson<OnboardingPlanResponse>('/api/v1/onboarding/plans', request);
}

export function recordOnboardingTaskEvent(
  request: OnboardingTaskEventRequest,
): Promise<OnboardingTaskEventResponse> {
  return postJson<OnboardingTaskEventResponse>('/api/v1/onboarding/tasks/events', request);
}
