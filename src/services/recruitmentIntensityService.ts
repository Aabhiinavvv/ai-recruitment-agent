import { 
  Candidate, 
  HiringStage, 
  StageIntensityLevel, 
  StageSlaConfig, 
  CandidateStageDwellInfo, 
  CandidateHeatmapRow, 
  PipelineBottleneckAnalytics 
} from '../types';

export const PIPELINE_STAGES: HiringStage[] = ['Screening', 'Technical', 'Interview', 'Offered'];

/**
 * Stage SLA Configurations across different hiring velocity modes
 */
export const SLA_PRESETS: Record<'standard' | 'fastTrack' | 'thorough', Record<HiringStage, StageSlaConfig>> = {
  standard: {
    Screening: { stage: 'Screening', label: 'Screening', targetDays: 2.0, warningDays: 3.5, bottleneckDays: 5.0 },
    Technical: { stage: 'Technical', label: 'Technical Round', targetDays: 4.0, warningDays: 6.0, bottleneckDays: 8.0 },
    Interview: { stage: 'Interview', label: 'Panel Interview', targetDays: 5.0, warningDays: 7.5, bottleneckDays: 10.0 },
    Offered: { stage: 'Offered', label: 'Offer & Decision', targetDays: 3.0, warningDays: 5.0, bottleneckDays: 7.0 },
    Rejected: { stage: 'Rejected', label: 'Not Proceeding', targetDays: 1.5, warningDays: 3.0, bottleneckDays: 5.0 },
  },
  fastTrack: {
    Screening: { stage: 'Screening', label: 'Screening', targetDays: 1.0, warningDays: 2.0, bottleneckDays: 3.0 },
    Technical: { stage: 'Technical', label: 'Technical Round', targetDays: 2.5, warningDays: 4.0, bottleneckDays: 5.5 },
    Interview: { stage: 'Interview', label: 'Panel Interview', targetDays: 3.0, warningDays: 5.0, bottleneckDays: 7.0 },
    Offered: { stage: 'Offered', label: 'Offer & Decision', targetDays: 2.0, warningDays: 3.5, bottleneckDays: 5.0 },
    Rejected: { stage: 'Rejected', label: 'Not Proceeding', targetDays: 1.0, warningDays: 2.0, bottleneckDays: 3.0 },
  },
  thorough: {
    Screening: { stage: 'Screening', label: 'Screening', targetDays: 3.0, warningDays: 5.0, bottleneckDays: 7.0 },
    Technical: { stage: 'Technical', label: 'Technical Round', targetDays: 6.0, warningDays: 8.5, bottleneckDays: 12.0 },
    Interview: { stage: 'Interview', label: 'Panel Interview', targetDays: 7.0, warningDays: 10.0, bottleneckDays: 14.0 },
    Offered: { stage: 'Offered', label: 'Offer & Decision', targetDays: 4.0, warningDays: 6.0, bottleneckDays: 9.0 },
    Rejected: { stage: 'Rejected', label: 'Not Proceeding', targetDays: 2.0, warningDays: 4.0, bottleneckDays: 6.0 },
  }
};

export const DEFAULT_STAGE_SLAS = SLA_PRESETS.standard;

/**
 * Determines stage intensity classification based on dwell time vs SLA thresholds
 */
export function classifyIntensity(days: number, config: StageSlaConfig): StageIntensityLevel {
  if (days <= 0) return 'unreached';
  if (days >= config.bottleneckDays) return 'bottleneck';
  if (days >= config.warningDays) return 'elevated';
  if (days > config.targetDays) return 'moderate';
  return 'optimal';
}

/**
 * Common bottleneck blocker diagnosis templates
 */
const BLOCKER_DIAGNOSES: Record<HiringStage, string[]> = {
  Screening: [
    "Recruiter resume calibration & rubric review queue",
    "Awaiting verification of candidate digital portfolio sources",
    "Candidate submitted incomplete work highlights"
  ],
  Technical: [
    "Panel reviewer backlog (coding evaluation pending lead sign-off)",
    "Candidate requested extra time for live coding prep",
    "Disagreement between rubrics on system design complexity"
  ],
  Interview: [
    "Shared calendar scheduling conflict across panel interviewers",
    "Waiting for candidate interview time confirmation",
    "Hiring manager debrief synchronization delayed"
  ],
  Offered: [
    "Executive compensation & equity allocation committee approval",
    "Candidate negotiating competing counter-offer",
    "Background verification check pending confirmation"
  ],
  Rejected: [
    "Rejection rationale draft queued for recruiter approval"
  ]
};

/**
 * Resolves candidate's stage dwell record with consistent, realistic data
 */
export function resolveCandidateDwells(
  candidate: Candidate,
  slas: Record<HiringStage, StageSlaConfig> = DEFAULT_STAGE_SLAS
): CandidateHeatmapRow {
  const currentStage: HiringStage = candidate.stage || (
    candidate.decision_status?.includes('Advanced') || candidate.decision_status?.includes('Hired')
      ? 'Interview'
      : candidate.decision_status?.includes('Not proceeding')
      ? 'Rejected'
      : 'Screening'
  );

  // Deterministic seed based on candidate ID string
  const seed = candidate.candidate_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const candidateDwellData = candidate.stage_dwell_times || {};

  // Stage order index: 0 = Screening, 1 = Technical, 2 = Interview, 3 = Offered
  const stageOrder: HiringStage[] = ['Screening', 'Technical', 'Interview', 'Offered'];
  const currentIndex = stageOrder.indexOf(currentStage === 'Rejected' ? 'Screening' : currentStage);

  const stageDwells: Record<HiringStage, CandidateStageDwellInfo> = {} as any;
  let totalPipelineDays = 0;
  let worstLevel: StageIntensityLevel = 'optimal';
  let primaryBottleneckStage: HiringStage | undefined = undefined;

  for (let idx = 0; idx < stageOrder.length; idx++) {
    const stage = stageOrder[idx];
    const config = slas[stage];
    let days = 0;
    let isCurrent = stage === currentStage;
    let blockerReason: string | undefined = undefined;

    // Has candidate reached this stage?
    if (idx < currentIndex) {
      // Completed stage in past
      if (candidateDwellData[stage] !== undefined) {
        days = candidateDwellData[stage]!;
      } else {
        // Deterministic realistic dwell for past stage (typically within or near target)
        const baseVariance = (seed % 10) / 10;
        days = Math.round((config.targetDays * (0.6 + baseVariance * 0.7)) * 10) / 10;
      }
    } else if (idx === currentIndex) {
      // Currently active stage
      if (candidateDwellData[stage] !== undefined) {
        days = candidateDwellData[stage]!;
      } else {
        // High variation for current stage to expose realistic bottlenecks
        if (candidate.candidate_id === 'CAN-9821') {
          // Alex Rivera: High dwell in Technical (6.8 days vs 4.0d SLA)
          days = 6.8;
          blockerReason = "Pending technical coding challenge review by David Chen";
        } else if (candidate.candidate_id === 'CAN-4150') {
          // Priya Chen: Elevated in Screening (4.6 days vs 2.0d SLA)
          days = 4.6;
          blockerReason = "Pending recruiter rubric calibration on classical ML vs LLM balance";
        } else {
          // Other candidates: Seed-derived realistic dwell
          const multiplier = 0.5 + ((seed * (idx + 1)) % 100) / 45; // 0.5 to ~2.7x
          days = Math.round((config.targetDays * multiplier) * 10) / 10;
        }
      }

      if (days >= config.warningDays) {
        const blockerList = BLOCKER_DIAGNOSES[stage];
        blockerReason = blockerReason || blockerList[seed % blockerList.length];
      }
    } else {
      // Future stage not yet reached
      days = 0;
    }

    const intensityLevel = days > 0 ? classifyIntensity(days, config) : 'unreached';
    const isOverdue = days > config.targetDays;
    const overdueDays = Math.max(0, Math.round((days - config.targetDays) * 10) / 10);

    stageDwells[stage] = {
      stage,
      days,
      intensityLevel,
      slaTarget: config.targetDays,
      isCurrent,
      isOverdue,
      overdueDays,
      blockerReason
    };

    totalPipelineDays += days;

    // Track worst intensity level
    if (intensityLevel === 'bottleneck') {
      worstLevel = 'bottleneck';
      primaryBottleneckStage = stage;
    } else if (intensityLevel === 'elevated' && worstLevel !== 'bottleneck') {
      worstLevel = 'elevated';
      primaryBottleneckStage = stage;
    } else if (intensityLevel === 'moderate' && worstLevel === 'optimal') {
      worstLevel = 'moderate';
      primaryBottleneckStage = stage;
    }
  }

  return {
    candidate,
    currentStage,
    stageDwells,
    totalPipelineDays: Math.round(totalPipelineDays * 10) / 10,
    worstIntensityLevel: worstLevel,
    hasBottleneck: worstLevel === 'bottleneck' || worstLevel === 'elevated',
    primaryBottleneckStage
  };
}

/**
 * Calculates aggregate pipeline metrics, primary bottleneck, and AI action recommendations
 */
export function calculatePipelineBottlenecks(
  candidates: Candidate[],
  slas: Record<HiringStage, StageSlaConfig> = DEFAULT_STAGE_SLAS
): PipelineBottleneckAnalytics {
  const rows = candidates.map(c => resolveCandidateDwells(c, slas));

  const stageBreakdowns: Record<HiringStage, {
    totalDays: number;
    count: number;
    activeCount: number;
    stalledCount: number;
    slaTarget: number;
  }> = {
    Screening: { totalDays: 0, count: 0, activeCount: 0, stalledCount: 0, slaTarget: slas.Screening.targetDays },
    Technical: { totalDays: 0, count: 0, activeCount: 0, stalledCount: 0, slaTarget: slas.Technical.targetDays },
    Interview: { totalDays: 0, count: 0, activeCount: 0, stalledCount: 0, slaTarget: slas.Interview.targetDays },
    Offered: { totalDays: 0, count: 0, activeCount: 0, stalledCount: 0, slaTarget: slas.Offered.targetDays },
    Rejected: { totalDays: 0, count: 0, activeCount: 0, stalledCount: 0, slaTarget: slas.Rejected.targetDays },
  };

  let totalCandidatesAtRisk = 0;
  let totalCandidatesEvaluated = 0;
  let candidatesWithinSla = 0;

  rows.forEach(row => {
    if (row.hasBottleneck) totalCandidatesAtRisk++;

    PIPELINE_STAGES.forEach(stage => {
      const info = row.stageDwells[stage];
      if (info && info.days > 0) {
        stageBreakdowns[stage].totalDays += info.days;
        stageBreakdowns[stage].count += 1;
        totalCandidatesEvaluated++;

        if (info.isCurrent) {
          stageBreakdowns[stage].activeCount += 1;
        }

        if (info.intensityLevel === 'bottleneck' || info.intensityLevel === 'elevated') {
          stageBreakdowns[stage].stalledCount += 1;
        } else {
          candidatesWithinSla++;
        }
      }
    });
  });

  // Calculate averages per stage and find the primary bottleneck
  let worstStage: HiringStage = 'Technical';
  let highestOverdueRatio = -1;

  const stageAverages: any = {};

  PIPELINE_STAGES.forEach(stage => {
    const data = stageBreakdowns[stage];
    const avgDays = data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0;
    const bottleneckRatePercent = data.count > 0 ? Math.round((data.stalledCount / data.count) * 100) : 0;
    const overdueRatio = avgDays / data.slaTarget;

    stageAverages[stage] = {
      avgDays,
      activeCount: data.activeCount,
      stalledCount: data.stalledCount,
      slaTarget: data.slaTarget,
      bottleneckRatePercent
    };

    if (overdueRatio > highestOverdueRatio && data.count > 0) {
      highestOverdueRatio = overdueRatio;
      worstStage = stage;
    }
  });

  const overallAvgCycleDays = rows.length > 0 
    ? Math.round((rows.reduce((acc, r) => acc + r.totalPipelineDays, 0) / rows.length) * 10) / 10
    : 0;

  const slaHealthIndexPercent = totalCandidatesEvaluated > 0
    ? Math.round((candidatesWithinSla / totalCandidatesEvaluated) * 100)
    : 100;

  // Generate actionable AI recommendations
  const recommendedActions: string[] = [];

  if (stageAverages.Technical?.bottleneckRatePercent > 30) {
    recommendedActions.push(
      `Expedite ${stageAverages.Technical.stalledCount} overdue technical coding reviews. David Chen & Priya Sharma have multiple reviews pending.`
    );
  }

  if (stageAverages.Screening?.stalledCount > 0) {
    recommendedActions.push(
      `Fast-track ${stageAverages.Screening.stalledCount} candidate(s) stalled in Screening past the ${slas.Screening.targetDays}-day SLA target.`
    );
  }

  if (stageAverages.Interview?.activeCount > 0) {
    recommendedActions.push(
      `Launch AI Interview Scheduler to secure mutual panel availability for ${stageAverages.Interview.activeCount} candidates ready for panel rounds.`
    );
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Pipeline flow is healthy. All candidates are progressing within standard SLA thresholds.");
  }

  return {
    primaryBottleneckStage: worstStage,
    stageAverages,
    overallAvgCycleDays,
    totalCandidatesAtRisk,
    slaHealthIndexPercent,
    recommendedActions
  };
}

/**
 * Returns clean styling tokens for each intensity tier
 */
export function getIntensityColorTokens(level: StageIntensityLevel): {
  bgClass: string;
  badgeClass: string;
  pillColor: string;
  textColor: string;
  label: string;
  hex: string;
} {
  switch (level) {
    case 'optimal':
      return {
        bgClass: 'bg-emerald-50/90 border-emerald-300/80 text-emerald-950',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        pillColor: 'bg-emerald-500',
        textColor: 'text-emerald-700',
        label: 'Optimal (< SLA)',
        hex: '#10b981'
      };
    case 'moderate':
      return {
        bgClass: 'bg-amber-50/90 border-amber-300/80 text-amber-950',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        pillColor: 'bg-amber-400',
        textColor: 'text-amber-700',
        label: 'Moderate (Near SLA)',
        hex: '#f59e0b'
      };
    case 'elevated':
      return {
        bgClass: 'bg-orange-50/90 border-orange-400/90 text-orange-950',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-400 font-bold',
        pillColor: 'bg-orange-500',
        textColor: 'text-orange-700',
        label: 'Elevated (Attention)',
        hex: '#f97316'
      };
    case 'bottleneck':
      return {
        bgClass: 'bg-rose-100/95 border-rose-500 text-rose-950 shadow-2xs ring-1 ring-rose-400/30',
        badgeClass: 'bg-rose-600 text-white font-black border-rose-700',
        pillColor: 'bg-rose-600',
        textColor: 'text-rose-700 font-black',
        label: 'Critical Bottleneck (> SLA)',
        hex: '#e11d48'
      };
    case 'unreached':
    default:
      return {
        bgClass: 'bg-slate-50/60 border-slate-200 border-dashed text-slate-400',
        badgeClass: 'bg-slate-100 text-slate-400 border-slate-200',
        pillColor: 'bg-slate-300',
        textColor: 'text-slate-400',
        label: 'Not Reached',
        hex: '#94a3b8'
      };
  }
}
