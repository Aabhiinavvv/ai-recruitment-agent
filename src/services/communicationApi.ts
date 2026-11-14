export type CommunicationType =
  | 'application_acknowledgement'
  | 'interview_invitation'
  | 'scheduling_request'
  | 'schedule_confirmation'
  | 'status_update'
  | 'not_selected'
  | 'follow_up';

export interface CommunicationDraftRequest {
  communication_type: CommunicationType;
  candidate_id: string;
  candidate_name: string;
  recipient_email: string;
  job_title: string;
  company_name: string;
  recruiter_decision: 'pending_review' | 'advanced' | 'not_proceeding';
  contact_authorized: boolean;
  recruiter_context?: string;
  interview_round?: string;
  interview_date?: string;
  interview_time?: string;
  timezone?: string;
  interview_format?: string;
  meeting_url?: string;
}

export interface CommunicationDraftResponse {
  draft_id: string;
  communication_type: CommunicationType;
  candidate_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  call_script: string;
  warnings: string[];
  status: 'draft_pending_recruiter_review';
  requires_recruiter_approval: true;
  delivery_enabled: false;
  delivery_note: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function createCommunicationDraft(
  request: CommunicationDraftRequest,
): Promise<CommunicationDraftResponse> {
  const response = await fetch(API_BASE_URL + '/api/v1/communication/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    let message = 'Communication Agent failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid input')
          .join('; ');
      }
    } catch {
      // Preserve the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<CommunicationDraftResponse>;
}

export function mapCommunicationType(type: CommunicationType): 'round' | 'rejection' | 'progress' | 'outreach' {
  if (type === 'not_selected') return 'rejection';
  if (
    type === 'interview_invitation'
    || type === 'scheduling_request'
    || type === 'schedule_confirmation'
  ) return 'round';
  if (type === 'application_acknowledgement') return 'outreach';
  return 'progress';
}
