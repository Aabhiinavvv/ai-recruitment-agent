import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CalendarRange,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import {
  createWorkforceForecast,
  type WorkforcePlanningResponse,
  type WorkforceScenario,
} from '../services/workforcePlanningApi';

interface WorkforcePlanningPanelProps {
  onAudit?: (action: string, subject: string) => void;
}

const numberFormat = new Intl.NumberFormat('en-IN');

const parseHistory = (text: string) => {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return rows.map((line, index) => {
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length !== 4) {
      throw new Error('History row ' + (index + 1) + ' must contain: YYYY-MM,new requisitions,hires,exits.');
    }
    const [month, demandText, hiresText, exitsText] = parts;
    const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthPattern.test(month)) {
      throw new Error('History row ' + (index + 1) + ' has an invalid month. Use YYYY-MM.');
    }
    const parseCount = (value: string, label: string) => {
      if (!/^\d+$/.test(value)) {
        throw new Error(label + ' in history row ' + (index + 1) + ' must be a non-negative whole number.');
      }
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count > 100000) {
        throw new Error(label + ' in history row ' + (index + 1) + ' is outside the supported range.');
      }
      return count;
    };
    return {
      month,
      new_requisitions: parseCount(demandText, 'New requisitions'),
      hires_completed: parseCount(hiresText, 'Hires completed'),
      employee_exits: parseCount(exitsText, 'Employee exits'),
    };
  });
};

const MetricCard: React.FC<{ label: string; value: string; note?: string; icon: React.ReactNode }> = ({
  label, value, note, icon,
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">{icon}{label}</div>
    <p className="mt-2 break-words text-xl font-extrabold text-slate-900">{value}</p>
    {note && <p className="mt-1 text-[10px] text-slate-500">{note}</p>}
  </div>
);

export const WorkforcePlanningPanel: React.FC<WorkforcePlanningPanelProps> = ({ onAudit }) => {
  const [planningUnit, setPlanningUnit] = useState('Organisation');
  const [historyText, setHistoryText] = useState('');
  const [currentHeadcount, setCurrentHeadcount] = useState('');
  const [targetHeadcount, setTargetHeadcount] = useState('');
  const [openBacklog, setOpenBacklog] = useState('0');
  const [monthlyCapacity, setMonthlyCapacity] = useState('');
  const [attritionRate, setAttritionRate] = useState('');
  const [forecastMonths, setForecastMonths] = useState('6');
  const [scenario, setScenario] = useState<WorkforceScenario>('base');
  const [forecast, setForecast] = useState<WorkforcePlanningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateCount = (value: string, label: string, max = 10000000) => {
    if (!/^\d+$/.test(value.trim())) throw new Error(label + ' must be a non-negative whole number.');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > max) throw new Error(label + ' is outside the supported range.');
    return number;
  };

  const generate = async () => {
    setError(null);
    setForecast(null);
    try {
      const historicalMonths = parseHistory(historyText);
      if (historicalMonths.length < 3) {
        throw new Error('Enter at least three consecutive months of actual requisitions, hires and exits.');
      }
      const current = validateCount(currentHeadcount, 'Current headcount');
      const target = validateCount(targetHeadcount, 'Target headcount');
      const backlog = validateCount(openBacklog, 'Open requisition backlog', 100000);
      const capacity = validateCount(monthlyCapacity, 'Monthly hiring capacity', 100000);
      const horizon = validateCount(forecastMonths, 'Forecast horizon', 18);
      if (horizon < 1) throw new Error('Forecast horizon must be between 1 and 18 months.');
      if (!attritionRate.trim() || !/^\d+(\.\d{1,2})?$/.test(attritionRate.trim())) {
        throw new Error('Enter an annual attrition rate from 0 to 100 (up to two decimal places).');
      }
      const attrition = Number(attritionRate);
      if (attrition < 0 || attrition > 100) {
        throw new Error('Annual attrition rate must be between 0 and 100.');
      }
      setLoading(true);
      const result = await createWorkforceForecast({
        planning_unit: planningUnit.trim() || 'Organisation',
        historical_months: historicalMonths,
        current_headcount: current,
        target_headcount: target,
        open_requisitions_backlog: backlog,
        monthly_hiring_capacity: capacity,
        annual_attrition_rate_percent: attrition.toFixed(2),
        forecast_months: horizon,
        scenario,
      });
      setForecast(result);
      onAudit?.(
        'Generated workforce demand and capacity scenario',
        result.planning_unit + ' — ' + result.scenario + ' scenario',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate workforce forecast.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!forecast) return;
    const blob = new Blob([JSON.stringify(forecast, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'workforce-forecast-' + forecast.planning_unit.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const chartData = forecast?.forecast.map((item) => ({
    ...item,
    month: item.month,
    target_headcount: forecast.target_headcount,
  })) ?? [];

  return (
    <section className="space-y-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent 9 — Workforce Planning & Predictive Hiring</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Forecast monthly requisition demand, recruiting capacity, backlog, attrition and projected headcount.
              Compare conservative, base and accelerated hiring scenarios.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          Scenario planning · Estimates only
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">1. Historical aggregate inputs</h3>
        <p className="text-xs leading-5 text-slate-500">
          Enter actual consecutive monthly totals. One row per month, oldest first; do not enter employee or candidate names.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Planning unit / department</span>
          <input value={planningUnit} onChange={(event) => setPlanningUnit(event.target.value)} maxLength={80} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Monthly history (CSV rows)</span>
          <textarea
            rows={7}
            value={historyText}
            onChange={(event) => setHistoryText(event.target.value)}
            placeholder={'2026-01,8,6,1\n2026-02,9,7,1\n2026-03,10,7,1'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs leading-5 text-slate-800"
          />
        </label>
        <p className="text-[11px] text-slate-500">Format: YYYY-MM,new requisitions,hires completed,employee exits. At least 3 consecutive months; 6–12+ months is preferable.</p>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-bold text-slate-900">2. Workforce and recruiting assumptions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Current headcount</span>
            <input type="number" min="0" step="1" value={currentHeadcount} onChange={(event) => setCurrentHeadcount(event.target.value)} placeholder="e.g. 240" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Target headcount</span>
            <input type="number" min="0" step="1" value={targetHeadcount} onChange={(event) => setTargetHeadcount(event.target.value)} placeholder="e.g. 280" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Open requisition backlog</span>
            <input type="number" min="0" step="1" value={openBacklog} onChange={(event) => setOpenBacklog(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Monthly hiring capacity</span>
            <input type="number" min="0" step="1" value={monthlyCapacity} onChange={(event) => setMonthlyCapacity(event.target.value)} placeholder="e.g. 12 hires/month" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Annual attrition rate (%)</span>
            <input type="number" min="0" max="100" step="0.01" value={attritionRate} onChange={(event) => setAttritionRate(event.target.value)} placeholder="e.g. 12" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Forecast horizon</span>
            <select value={forecastMonths} onChange={(event) => setForecastMonths(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              {[3, 6, 9, 12, 18].map((month) => <option key={month} value={month}>{month} months</option>)}
            </select>
          </label>
        </div>
        <label className="block max-w-sm space-y-1">
          <span className="text-xs font-semibold text-slate-700">Hiring scenario</span>
          <select value={scenario} onChange={(event) => setScenario(event.target.value as WorkforceScenario)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="conservative">Conservative — 75% capacity</option>
            <option value="base">Base — 100% capacity</option>
            <option value="accelerated">Accelerated — 125% capacity</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {loading ? 'Calculating workforce scenario…' : 'Generate workforce forecast'}
      </button>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      {forecast && (
        <div className="space-y-5 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workforce projection — {forecast.planning_unit}</h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {forecast.forecast_months}-month horizon · {forecast.scenario} scenario · {forecast.forecast_method.replaceAll('_', ' ')}
              </p>
            </div>
            <button type="button" onClick={exportReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" />Export forecast
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Ending projected headcount" value={numberFormat.format(forecast.forecast_ending_headcount)} note={'Target: ' + numberFormat.format(forecast.target_headcount)} icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Workforce gap" value={(forecast.forecast_workforce_gap_to_target > 0 ? '+' : '') + numberFormat.format(forecast.forecast_workforce_gap_to_target)} note="Positive = projected shortage" icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Planned hires" value={numberFormat.format(forecast.planned_hires_total)} note={numberFormat.format(forecast.forecast_new_requisitions_total) + ' forecast new requisitions'} icon={<BarChart3 className="h-4 w-4" />} />
            <MetricCard label="Ending open backlog" value={numberFormat.format(forecast.forecast_ending_backlog)} note={numberFormat.format(forecast.estimated_capacity_shortfall) + ' estimated unfilled demand'} icon={<CalendarRange className="h-4 w-4" />} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Forecast demand vs hiring capacity</h4>
              <p className="mt-1 text-[11px] text-slate-500">New requisition demand is estimated from historical trend; capacity reflects the selected scenario.</p>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="forecast_new_requisitions" name="Forecast requisitions" fill="#d69e2e" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="hiring_capacity" name="Monthly hiring capacity" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-800">Projected headcount vs target</h4>
              <p className="mt-1 text-[11px] text-slate-500">Headcount includes planned hires less expected attrition.</p>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="projected_headcount" name="Projected headcount" stroke="#0d9488" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="target_headcount" name="Headcount target" stroke="#64748b" strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="text-xs font-bold text-slate-800">Monthly hiring plan and open backlog</h4>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead><tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Month</th><th className="py-2 pr-3">New demand</th><th className="py-2 pr-3">Capacity</th><th className="py-2 pr-3">Planned hires</th><th className="py-2 pr-3">Attrition</th><th className="py-2 pr-3">Closing backlog</th><th className="py-2">Projected HC</th>
                </tr></thead>
                <tbody>{forecast.forecast.map((item) => (
                  <tr key={item.month} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-3 font-medium">{item.month}</td><td className="py-2 pr-3">{item.forecast_new_requisitions} ({item.demand_lower_bound}–{item.demand_upper_bound})</td><td className="py-2 pr-3">{item.hiring_capacity}</td><td className="py-2 pr-3">{item.planned_hires}</td><td className="py-2 pr-3">{item.expected_attrition}</td><td className="py-2 pr-3">{item.closing_backlog}</td><td className="py-2">{item.projected_headcount}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {forecast.warnings.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-950">Forecast caveats</p>
              {forecast.warnings.map((warning, index) => <p key={index} className="text-xs leading-5 text-amber-900">• {warning}</p>)}
            </div>
          )}

          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Forecast assumptions and methodology</summary>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-600">
              {forecast.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">In-sample trend residual MAE: {forecast.trend_residual_mae.toFixed(1)} requisitions.</p>
          </details>
        </div>
      )}

      <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Aggregate-only forecasting. No employee names, candidate records, salary information or individual performance data are accepted. Forecasts support planning discussion and are not staffing commitments or automated personnel decisions.
      </p>
    </section>
  );
};
