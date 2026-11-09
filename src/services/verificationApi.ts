export type VerificationType =
  | 'identity'
  | 'employment'
  | 'education'
  | 'address'
  | 'professional_license'
  | 'reference';

export type VerificationOutcome =
  | 'verified'
  | 'unable_to_verify'
  | 'discrepancy'
  | 'not_applicable';

export type EvidenceSourceType =
  | 'candidate_document'
  | 'issuer_confirmation'
  | 'licensed_provider_report'
  | 'reference_confirmation'
  | 'other';

export interface VerificationCaseRequest {
  candidate_id: string;
  job_title: string;
  recruiter_approved: boolean;
  recruiter_decision: 'advance';
  candidate_consent_confirmed: boolean;
  check_types: VerificationType[];
  jurisdiction: string;
}

export interface VerificationCheck {
  check_id: string;
  check_type: VerificationType;
  title: string;
  purpose: string;
  evidence_to_review: string[];
  status: 'awaiting_authorized_review';
  execution_mode: 'manual_or_future_authorized_provider';
}

export interface VerificationCaseResponse {
  case_id: string;
  candidate_id: string;
  job_title: string;
  jurisdiction: string;
  checks: VerificationCheck[];
  case_status: 'review_required';
  requires_recruiter_review: true;
  provider_execution_enabled: false;
  persistence_enabled: false;
  final_hiring_decision_enabled: false;
  notice: string;
}

export interface VerificationReviewRequest {
  case_id: string;
  candidate_id: string;
  check_id: string;
  check_type: VerificationType;
  outcome: VerificationOutcome;
  reviewer_attested: boolean;
  source_checked: boolean;
  evidence_source_type?: EvidenceSourceType | null;
  evidence_reference?: string | null;
  evidence_summary?: string | null;
  reviewer_note: string;
}

export interface VerificationReviewResponse {
  case_id: string;
  candidate_id: string;
  check_id: string;
  check_type: VerificationType;
  outcome: VerificationOutcome;
  evidence_source_type?: EvidenceSourceType | null;
  evidence_reference?: string | null;
  evidence_summary?: string | null;
  reviewer_note: string;
  reviewed_at: string;
  review_state: 'returned_to_client_for_recruiter_review';
  requires_recruiter_review: true;
  persisted: false;
  hiring_decision_enabled: false;
  notice: string;
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
    let message = 'Background Verification Agent failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid input')
          .join('; ');
      }
    } catch {
      // Preserve the HTTP status message if the error response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function createVerificationCase(
  request: VerificationCaseRequest,
): Promise<VerificationCaseResponse> {
  return postJson<VerificationCaseResponse>('/api/v1/verification/cases', request);
}

export function submitVerificationReview(
  request: VerificationReviewRequest,
): Promise<VerificationReviewResponse> {
  return postJson<VerificationReviewResponse>('/api/v1/verification/reviews', request);
}
