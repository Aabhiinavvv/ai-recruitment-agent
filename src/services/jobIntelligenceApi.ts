export interface JobIntelligenceRequest {
  company_name: string;
  job_title: string;
  location: string;
  headcount: number;
  salary_budget: string;
  hiring_timeline: string;
  requirements: string;
}

export interface JobRubricCriterion {
  criterion: string;
  weight_percent: number;
  evidence_to_look_for?: string[];
}

export interface JobIntelligenceResponse {
  status: 'draft_ready' | 'needs_clarification';
  job_description_markdown: string | null;
  rubric: {
    scoring_scale: string;
    criteria: JobRubricCriterion[];
    decision_boundary: string;
  } | null;
  required_skills: string[];
  preferred_skills: string[];
  clarification_questions: string[];
  review_flags: Array<{
    category: string;
    evidence: string;
    action: string;
  }>;
  warnings: string[];
  generation_mode: 'ollama' | 'template_fallback' | 'not_generated';
  model_name: string | null;
  requires_company_approval: boolean;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function generateJobDraft(
  request: JobIntelligenceRequest,
): Promise<JobIntelligenceResponse> {
  const response = await fetch(
    API_BASE_URL + '/api/v1/job-intelligence/draft',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    let detail = 'Job Intelligence API failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
      else if (Array.isArray(payload.detail)) {
        detail = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<JobIntelligenceResponse>;
}
