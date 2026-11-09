export type PipelineStage = 'screening' | 'technical' | 'interview' | 'offered' | 'rejected' | 'unknown';
export type DecisionStatus = 'pending' | 'advanced' | 'not_proceeding' | 'hired';
export type SourceChannel = 'careers_site' | 'job_board' | 'linkedin' | 'referral' | 'agency' | 'campus' | 'direct' | 'other';

export interface CandidateAnalyticsRecord {
  record_ref: string;
  stage: PipelineStage;
  decision_status: DecisionStatus;
  overall_score?: number | null;
  source_channel?: SourceChannel | null;
  recruiter_label?: string | null;
  applied_at?: string | null;
  hired_at?: string | null;
}

export interface RecruitmentAnalyticsRequest {
  reporting_period: string;
  candidate_records: CandidateAnalyticsRecord[];
  total_recruitment_cost?: string | null;
  cost_currency?: string | null;
  period_hires?: number | null;
}

export interface StageMetric {
  stage: PipelineStage;
  candidates: number;
  share_percent: number;
}

export interface DecisionMetric {
  status: DecisionStatus;
  candidates: number;
  share_percent: number;
}

export interface SourceEffectivenessMetric {
  source_channel: SourceChannel;
  applicants: number;
  hires: number;
  hire_rate_percent: number;
}

export interface RecruiterPerformanceMetric {
  recruiter_label: string;
  candidates: number;
  advanced_or_hired: number;
  hires: number;
  average_overall_score?: number | null;
}

export interface TimeToHireMetric {
  average_days?: number | null;
  median_days?: number | null;
  minimum_days?: number | null;
  maximum_days?: number | null;
  sample_size: number;
}

export interface CostPerHireMetric {
  amount?: number | null;
  currency?: string | null;
  period_hires?: number | null;
  total_recruitment_cost?: number | null;
}

export interface RecruitmentAnalyticsResponse {
  reporting_period: string;
  generated_at: string;
  total_candidates: number;
  hired_count: number;
  rejected_count: number;
  pending_review_count: number;
  advanced_count: number;
  overall_hire_rate_percent: number;
  recruiter_advance_rate_percent?: number | null;
  average_overall_score?: number | null;
  stage_funnel: StageMetric[];
  decision_breakdown: DecisionMetric[];
  source_effectiveness: SourceEffectivenessMetric[];
  recruiter_performance: RecruiterPerformanceMetric[];
  time_to_hire: TimeToHireMetric;
  cost_per_hire: CostPerHireMetric;
  source_attributed_candidates: number;
  recruiter_attributed_candidates: number;
  score_sample_size: number;
  warnings: string[];
  methodology: string[];
  persisted: false;
  candidate_level_data_returned: false;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function fetchRecruitmentAnalytics(
  request: RecruitmentAnalyticsRequest,
): Promise<RecruitmentAnalyticsResponse> {
  const response = await fetch(API_BASE_URL + '/api/v1/analytics/recruitment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = 'Recruitment Analytics Agent failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid analytics input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message if the error response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<RecruitmentAnalyticsResponse>;
}
