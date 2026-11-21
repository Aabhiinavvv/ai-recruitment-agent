export interface SendGmailPayload {
  to: string;
  subject: string;
  body: string;
  accessToken: string;
}

export interface SendGmailResponse {
  ok: boolean;
  id: string;
  threadId?: string;
  to: string;
}

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

export async function sendCandidateEmailViaGmail({
  to,
  subject,
  body,
  accessToken,
}: SendGmailPayload): Promise<SendGmailResponse> {
  const cleanTo = to.trim();
  if (!isValidEmailAddress(cleanTo)) {
    throw new Error('Please enter a valid candidate email address.');
  }
  if (!subject.trim()) {
    throw new Error('Email subject cannot be empty.');
  }
  if (!body.trim()) {
    throw new Error('Email body cannot be empty.');
  }
  if (!accessToken) {
    throw new GmailAuthError('Please connect your Gmail account before sending.');
  }

  const res = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: cleanTo,
      subject: subject.trim(),
      body,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || data?.requiresReauth) {
      throw new GmailAuthError(
        data?.error || 'Your Gmail session expired or lacks send permission. Please reconnect Gmail.'
      );
    }
    throw new Error(data?.error || `Failed to send email (${res.status}).`);
  }

  return data as SendGmailResponse;
}
