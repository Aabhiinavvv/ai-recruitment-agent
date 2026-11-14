import type { ResumeAIInsights } from '../types';

export interface ResumeInsightsRequest {
  candidateName: string;
  resumeText: string;
  targetRole: string;
  jobDescription?: string;
  requiredSkills?: string[];
  experienceYears?: string;
  educationSummary?: string;
  overallScore?: number;
}

export async function generateResumeAIInsights(
  payload: ResumeInsightsRequest,
  idToken?: string | null
): Promise<ResumeAIInsights> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/ai/resume-insights', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `AI analysis failed (${response.status})`);
  }
  return data.insights as ResumeAIInsights;
}
