export type WorkforceScenario = 'conservative' | 'base' | 'accelerated';

export interface MonthlyWorkforceRecord {
  month: string;
  new_requisitions: number;
  hires_completed: number;
  employee_exits: number;
}

export interface WorkforcePlanningRequest {
  planning_unit: string;
  historical_months: MonthlyWorkforceRecord[];
  current_headcount: number;
  target_headcount: number;
  open_requisitions_backlog: number;
  monthly_hiring_capacity: number;
  annual_attrition_rate_percent: string;
  forecast_months: number;
  scenario: WorkforceScenario;
}

export interface HistoricalSummary {
  months_supplied: number;
  average_new_requisitions: number;
  average_hires_completed: number;
  total_employee_exits: number;
  demand_trend_per_month: number;
}

export interface MonthlyWorkforceForecast {
  month: string;
  forecast_new_requisitions: number;
  demand_lower_bound: number;
  demand_upper_bound: number;
  hiring_capacity: number;
  planned_hires: number;
  opening_backlog: number;
  closing_backlog: number;
  expected_attrition: number;
  projected_headcount: number;
  workforce_gap_to_target: number;
}

export interface WorkforcePlanningResponse {
  planning_unit: string;
  generated_at: string;
  scenario: WorkforceScenario;
  forecast_months: number;
  forecast_method: 'ordinary_least_squares_linear_trend';
  historical_summary: HistoricalSummary;
  scenario_capacity_multiplier: number;
  current_headcount: number;
  target_headcount: number;
  opening_requisitions_backlog: number;
  monthly_hiring_capacity_baseline: number;
  forecast_new_requisitions_total: number;
  planned_hires_total: number;
  forecast_ending_backlog: number;
  forecast_ending_headcount: number;
  forecast_workforce_gap_to_target: number;
  estimated_capacity_shortfall: number;
  trend_residual_mae: number;
  forecast: MonthlyWorkforceForecast[];
  warnings: string[];
  assumptions: string[];
  persisted: false;
  employee_or_candidate_level_data_returned: false;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

export async function createWorkforceForecast(
  request: WorkforcePlanningRequest,
): Promise<WorkforcePlanningResponse> {
  const response = await fetch(API_BASE_URL + '/api/v1/workforce-planning/forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = 'Workforce Planning Agent failed with status ' + response.status + '.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: string }) => item.msg || 'Invalid workforce planning input')
          .join('; ');
      }
    } catch {
      // Keep the HTTP status message if the error response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<WorkforcePlanningResponse>;
}
