export interface CandidateEvidence {
  evidence_id: string;
  field: string;
  quote: string;
  source_file: string;
  page_number: number | null;
  source_section?: string | null;
}

export interface CandidateSkill {
  name: string;
  confidence: number;
  evidence_ids: string[];
}

export interface CandidateProfile {
  candidate_id: string;
  source_file: string;
  full_name: string | null;
  email: string | null;
  phone_numbers: string[];
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: CandidateSkill[];
  work_experience: Array<{ raw_entry: string; title?: string | null; company?: string | null; date_range?: string | null; evidence_ids: string[] }>;
  education: Array<{ raw_entry: string; qualification?: string | null; institution?: string | null; date_range?: string | null; evidence_ids: string[] }>;
  projects: Array<{ title?: string | null; details: string; evidence_ids: string[] }>;
  certifications: string[];
  profile_links: string[];
  named_entities: Array<{ text: string; label: string; evidence_ids: string[] }>;
  nlp_engine: string;
  evidence: CandidateEvidence[];
  field_confidence: Record<string, number>;
  extraction_status: 'parsed' | 'needs_review';
  review_flags: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'review' }>;
  privacy: { redaction_applied: boolean; redacted_entities: string[]; redaction_engine: string; redacted_resume_text: string };
}

export interface ResumeFileResult {
  file_name: string;
  success: boolean;
  parser_used: string | null;
  candidate_profile: CandidateProfile | null;
  warnings: string[];
  error: string | null;
}

export interface CandidateIntelligenceBatchResponse {
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  consent_confirmed: boolean;
  results: ResumeFileResult[];
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function uploadResumeBatch(
  files: File[],
  consentConfirmed: boolean,
): Promise<CandidateIntelligenceBatchResponse> {
  if (!consentConfirmed) throw new Error('Confirm candidate notice and authorisation before processing.');
  if (files.length === 0) throw new Error('Choose at least one resume.');

  const body = new FormData();
  files.forEach((file) => body.append('files', file, file.name));
  body.append('consent_confirmed', 'true');

  const response = await fetch(
    API_BASE_URL + '/api/v1/candidate-intelligence/resumes/batch',
    { method: 'POST', body },
  );

  if (!response.ok) {
    let message = 'Candidate Intelligence API failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
    } catch {
      // Keep the HTTP status message if the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<CandidateIntelligenceBatchResponse>;
}
