import {
  AuditEvent,
  Candidate,
  HiringBrief,
  OutreachDraft,
  ScheduledInterview,
} from '../types';

export interface WorkspaceSnapshot {
  initialized: boolean;
  brief: HiringBrief | null;
  candidates: Candidate[];
  scheduledInterviews: ScheduledInterview[];
  outreachQueue: OutreachDraft[];
  events: AuditEvent[];
}

async function apiRequest<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function fetchWorkspaceRecords(
  token: string
): Promise<WorkspaceSnapshot> {
  return apiRequest<WorkspaceSnapshot>('/api/workspace', token, {
    method: 'GET',
  });
}

export async function seedWorkspaceRecordsApi(
  token: string,
  data: Omit<WorkspaceSnapshot, 'initialized'>,
  reset: boolean = false
): Promise<WorkspaceSnapshot> {
  return apiRequest<WorkspaceSnapshot>('/api/workspace/seed', token, {
    method: 'POST',
    body: JSON.stringify({ ...data, reset }),
  });
}

export async function saveHiringBriefApi(
  token: string,
  brief: HiringBrief
): Promise<void> {
  await apiRequest('/api/brief', token, {
    method: 'PUT',
    body: JSON.stringify({ brief }),
  });
}

export async function saveCandidatesApi(
  token: string,
  candidates: Candidate[]
): Promise<void> {
  await apiRequest('/api/candidates', token, {
    method: 'PUT',
    body: JSON.stringify({ candidates }),
  });
}

export async function saveScheduledInterviewApi(
  token: string,
  interview: ScheduledInterview
): Promise<void> {
  await apiRequest('/api/interviews', token, {
    method: 'POST',
    body: JSON.stringify({ interview }),
  });
}

export async function saveOutreachDraftsApi(
  token: string,
  drafts: OutreachDraft[]
): Promise<void> {
  await apiRequest('/api/outreach', token, {
    method: 'PUT',
    body: JSON.stringify({ drafts }),
  });
}

export async function saveAuditEventApi(
  token: string,
  event: AuditEvent
): Promise<void> {
  await apiRequest('/api/audit', token, {
    method: 'POST',
    body: JSON.stringify({ event }),
  });
}
