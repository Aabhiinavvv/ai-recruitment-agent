import { 
  Candidate, 
  HiringBrief, 
  InterviewRoundFeedback, 
  StandardizedEvaluationReport, 
  InterviewCompetencyScores, 
  InterviewRecommendationType,
  StandardizedCompetencyEvaluation,
  StandardizedStrengthItem,
  StandardizedRiskItem,
  StandardizedQuestionDeepDive
} from '../types';

export interface SampleFeedbackPreset {
  id: string;
  label: string;
  roundName: string;
  roundType: InterviewRoundFeedback['roundType'];
  interviewerName: string;
  interviewerRole: string;
  ratings: InterviewCompetencyScores;
  recommendation: InterviewRecommendationType;
  notes: string;
}

export const SAMPLE_FEEDBACK_PRESETS: SampleFeedbackPreset[] = [
  {
    id: 'preset-senior-distributed',
    label: 'Senior Distributed Systems — Strong Hire',
    roundName: 'Technical Architecture & Concurrency',
    roundType: 'system_design',
    interviewerName: 'Elena Rostova',
    interviewerRole: 'Staff Infrastructure Architect',
    ratings: {
      technicalDepth: 9,
      problemSolvingSpeed: 9,
      systemArchitecture: 10,
      communicationClarity: 9,
      cultureAndLeadership: 8
    },
    recommendation: 'Strong Hire',
    notes: `Candidate drove the distributed event-streaming architecture problem with exceptional command.

Problem Asked:
- Design a real-time analytics aggregation engine processing 250k events/sec with strict idempotency and under 50ms p99 read latency.

Key Observations & Technical Highlights:
- Immediately established functional and non-functional requirements (throughput, backpressure tolerance, disaster recovery).
- Proposed partitioning by entity_id hash with Kafka/Redpanda consumer groups and partitioned RocksDB state stores.
- Walked through exactly how to handle out-of-order events using sliding event-time watermarks instead of wall-clock timestamps.
- When asked about network partitions (split-brain scenarios), correctly explained Raft quorum leasing and why fencing tokens are essential to prevent stale writes.
- Demonstrated acute production empathy: discussed observability metrics (lag per consumer partition, GC pauses in JVM/Go runtimes, disk spillover).

Communication & Culture:
- Communicated with remarkable clarity and structured diagrammatic thinking.
- Welcomed feedback proactively: when I pushed on hot-partition bottlenecks, candidate immediately proposed virtual buckets and salt keys without getting defensive.
- Clear mentor mentality; described how they previously coached 3 junior engineers through asynchronous RPC migrations.

Areas for Future Ramp-Up:
- Has slightly less day-to-day exposure to Kubernetes CRD controllers, but conceptual fundamentals in Linux cgroups and container scheduling are very solid.`
  },
  {
    id: 'preset-ai-ml-systems',
    label: 'AI/ML Systems & LLM Agents — Strong Hire',
    roundName: 'AI Engineering & Production LLMs',
    roundType: 'technical',
    interviewerName: 'David Chen',
    interviewerRole: 'Principal AI Systems Engineer',
    ratings: {
      technicalDepth: 10,
      problemSolvingSpeed: 8,
      systemArchitecture: 9,
      communicationClarity: 9,
      cultureAndLeadership: 9
    },
    recommendation: 'Strong Hire',
    notes: `Superb discussion on production LLM inference optimization and multi-agent coordination.

Discussion Points & Technical Scenarios:
- Evaluated candidate on architecting an enterprise RAG system querying 10M+ technical PDFs with hybrid dense/sparse search.
- Candidate immediately articulated the trade-off between HNSW vector indexing vs. BM25 keyword boosting and recommended reciprocal rank fusion (RRF).
- Outlined an elegant context-window compaction strategy using hierarchical summarization and semantic caching with Redis to cut token inference costs by ~60%.
- Addressed prompt injection attacks by proposing input sandboxing, schema-constrained decoding (Pydantic/Instructor), and dual-model validation guards.
- Code exercise: Implemented an asynchronous token-streaming generator in Python/FastAPI with proper cancellation hooks when the HTTP client disconnects.

Communication & Problem Solving:
- Clear, pragmatic communication. Does not fall into theoretical traps—focuses heavily on cost-per-query and TTFT (time-to-first-token) latency benchmarks.
- Strong cultural alignment with our high-autonomy engineering values.`
  },
  {
    id: 'preset-frontend-design',
    label: 'Frontend Platform & React 19 — Lean Hire',
    roundName: 'Frontend Systems & Web Performance',
    roundType: 'coding',
    interviewerName: 'Marcus Vance',
    interviewerRole: 'Senior Frontend Lead',
    ratings: {
      technicalDepth: 7,
      problemSolvingSpeed: 8,
      systemArchitecture: 6,
      communicationClarity: 9,
      cultureAndLeadership: 8
    },
    recommendation: 'Lean Hire',
    notes: `Solid interactive frontend specialist with great UI polish, but borderline depth on large-scale state synchronizations.

Notes & Coding Exercise:
- Task: Build a virtualized infinite scroll grid with optimistic mutations and offline queueing.
- Candidate produced clean, idiomatic React 19 code using custom hooks and windowing within 35 minutes.
- Component structure and design tokens were exceptional; thoughtful accessibility (ARIA landmarks, keyboard focus traps).
- Follow-up on state reconciliation: candidate struggled initially when asked how to coordinate concurrent updates from WebSocket push events with active user form inputs.
- Relied heavily on global Zustand store rather than localized CRDT or transaction log approach.

Interviewer Verdict:
- High ceiling for product-facing feature velocity. Would thrive on design systems or user-facing core workflows, but would need mentorship on distributed client-state caching architectures.`
  },
  {
    id: 'preset-junior-mixed',
    label: 'Mid-Level Backend — Lean No Hire',
    roundName: 'Backend Core & Database Systems',
    roundType: 'technical',
    interviewerName: 'Sarah Jenkins',
    interviewerRole: 'Engineering Manager',
    ratings: {
      technicalDepth: 5,
      problemSolvingSpeed: 5,
      systemArchitecture: 4,
      communicationClarity: 7,
      cultureAndLeadership: 6
    },
    recommendation: 'Lean No Hire',
    notes: `Candidate is enthusiastic and possesses basic CRUD fluency, but falls below our senior bar on concurrency and database internals.

Interview Details:
- Candidate struggled to explain database transaction isolation levels (Read Committed vs. Repeatable Read vs. Serializable).
- When asked how to resolve a double-spend race condition on an account balance table, suggested client-side retry loops instead of database row locks (SELECT ... FOR UPDATE) or optimistic version numbers.
- Code exercise completed, but edge cases for null pointers and network timeout handling were skipped until explicitly prompted 3 times.
- Positive note: Very polite and responsive to hints, but overall requires significant technical supervision for independent production ownership.`
  }
];

/**
 * Returns color tokens for recommendation types
 */
export function getRecommendationColorTokens(verdict: InterviewRecommendationType): {
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  accentBg: string;
  ringColor: string;
} {
  switch (verdict) {
    case 'Strong Hire':
      return {
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        borderColor: 'border-emerald-300',
        accentBg: 'bg-emerald-500',
        ringColor: 'ring-emerald-400'
      };
    case 'Hire':
      return {
        badgeBg: 'bg-teal-100',
        badgeText: 'text-teal-800',
        borderColor: 'border-teal-300',
        accentBg: 'bg-teal-600',
        ringColor: 'ring-teal-400'
      };
    case 'Lean Hire':
      return {
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
        borderColor: 'border-blue-300',
        accentBg: 'bg-blue-600',
        ringColor: 'ring-blue-400'
      };
    case 'Lean No Hire':
      return {
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        borderColor: 'border-amber-300',
        accentBg: 'bg-amber-600',
        ringColor: 'ring-amber-400'
      };
    case 'No Hire':
    default:
      return {
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-800',
        borderColor: 'border-rose-300',
        accentBg: 'bg-rose-600',
        ringColor: 'ring-rose-400'
      };
  }
}

/**
 * AI Standardization Engine: Synthesizes raw notes into an executive evaluation report
 */
export function generateStandardizedEvaluationReport(
  candidate: Candidate,
  input: {
    roundName: string;
    roundType: InterviewRoundFeedback['roundType'];
    interviewerName: string;
    interviewerRole: string;
    rawNotes: string;
    ratings: InterviewCompetencyScores;
    overallRecommendation: InterviewRecommendationType;
  },
  brief: HiringBrief | null
): StandardizedEvaluationReport {
  const { ratings, rawNotes, overallRecommendation, roundName } = input;
  const notesLower = rawNotes.toLowerCase();

  // 1. Calculate Composite Score (0-100)
  const weightedRating = (
    ratings.technicalDepth * 0.30 +
    ratings.problemSolvingSpeed * 0.20 +
    ratings.systemArchitecture * 0.25 +
    ratings.communicationClarity * 0.15 +
    ratings.cultureAndLeadership * 0.10
  ); // 1.0 - 10.0 scale

  let compositeScore = Math.round(weightedRating * 10);
  // Reconcile with recommendation
  if (overallRecommendation === 'Strong Hire' && compositeScore < 85) compositeScore = 88;
  if (overallRecommendation === 'Hire' && compositeScore < 75) compositeScore = 78;
  if (overallRecommendation === 'No Hire' && compositeScore > 60) compositeScore = 52;

  // 2. Determine Calibrated Level
  let calibratedLevel = 'L4 / Mid-Level Software Engineer';
  if (compositeScore >= 88 && (ratings.systemArchitecture >= 8 || ratings.technicalDepth >= 9)) {
    calibratedLevel = 'L6 / Staff / Principal Engineer Track';
  } else if (compositeScore >= 80) {
    calibratedLevel = 'L5 / Senior Software Engineer';
  } else if (compositeScore >= 68) {
    calibratedLevel = 'L4 / Solid Mid-Level Engineer';
  } else {
    calibratedLevel = 'L3 / Associate / High Supervision';
  }

  // 3. Extract & Synthesize Core Strengths from notes
  const coreStrengths: StandardizedStrengthItem[] = [];

  if (ratings.technicalDepth >= 8 || notesLower.includes('deep') || notesLower.includes('command') || notesLower.includes('exceptional')) {
    coreStrengths.push({
      title: 'Deep Technical & Foundational Competence',
      evidence: extractRelevantSnippet(rawNotes, ['technical', 'command', 'architecture', 'fundamentals', 'code']) || 
        `Demonstrated high-rigor mastery in ${candidate.role} domain with score of ${ratings.technicalDepth}/10.`,
      signalStrength: ratings.technicalDepth >= 9 ? 'Exceptional' : 'Strong'
    });
  }

  if (ratings.systemArchitecture >= 8 || notesLower.includes('scale') || notesLower.includes('distributed') || notesLower.includes('partition') || notesLower.includes('trade-off')) {
    coreStrengths.push({
      title: 'Architectural Trade-Off & Scalability Intuition',
      evidence: extractRelevantSnippet(rawNotes, ['scale', 'partition', 'watermark', 'redis', 'cache', 'kafka', 'latency', 'trade-off']) || 
        'Proactively factored high-throughput constraints, failure modes, and operational telemetry into system blueprints.',
      signalStrength: ratings.systemArchitecture >= 9 ? 'Exceptional' : 'Strong'
    });
  }

  if (ratings.problemSolvingSpeed >= 8 || notesLower.includes('quick') || notesLower.includes('rapid') || notesLower.includes('clean')) {
    coreStrengths.push({
      title: 'Methodical Problem-Solving & Edge Case Coverage',
      evidence: extractRelevantSnippet(rawNotes, ['problem', 'edge case', 'idiomatic', 'speed', 'minutes', 'solved']) || 
        'Deconstructed complex requirements systematically, validating assumptions before committing to code or topology.',
      signalStrength: 'Strong'
    });
  }

  if (ratings.communicationClarity >= 8 || notesLower.includes('clarity') || notesLower.includes('diagram') || notesLower.includes('proactive')) {
    coreStrengths.push({
      title: 'Crisp Technical Communication & Receptive Collaboration',
      evidence: extractRelevantSnippet(rawNotes, ['communicat', 'clarity', 'feedback', 'defensive', 'mentor', 'team']) || 
        'Articulated engineering decisions clearly, accepted interviewer pushback constructively, and explained complex concepts without ambiguity.',
      signalStrength: ratings.communicationClarity >= 9 ? 'Exceptional' : 'Solid'
    });
  }

  if (coreStrengths.length === 0) {
    coreStrengths.push({
      title: 'Functional Execution & Baseline Proficiency',
      evidence: 'Completed required interview tasks within allocated time; demonstrated fundamental coding and domain concepts.',
      signalStrength: 'Solid'
    });
  }

  // 4. Extract Risks & Growth Gaps
  const riskFactorsOrGaps: StandardizedRiskItem[] = [];

  if (ratings.systemArchitecture < 7 || notesLower.includes('struggled') || notesLower.includes('borderline') || notesLower.includes('concurrency')) {
    riskFactorsOrGaps.push({
      concern: 'Distributed Concurrency & High-Scale Systems Nuances',
      context: extractRelevantSnippet(rawNotes, ['struggle', 'borderline', 'guidance', 'concurrency', 'race condition', 'lock', 'reconcil']) || 
        'Exhibited initial hesitation or gaps when stress-testing state synchronization, network partitioning, or concurrency race conditions.',
      severity: ratings.systemArchitecture < 5 ? 'High' : 'Medium',
      mitigation: 'Pair with Senior/Staff mentors on critical distributed state systems; require architecture design doc peer review during first 90 days.'
    });
  }

  if (ratings.technicalDepth < 7 || notesLower.includes('missing') || notesLower.includes('null') || notesLower.includes('timeout')) {
    riskFactorsOrGaps.push({
      concern: 'Defensive Programming & Edge-Case Proactivity',
      context: extractRelevantSnippet(rawNotes, ['edge case', 'null', 'timeout', 'prompted', 'retry']) || 
        'Did not anticipate edge cases or error recovery paths until explicitly questioned by the interviewer.',
      severity: 'Medium',
      mitigation: 'Integrate robust automated static linting and chaos testing checklists into onboarding tickets.'
    });
  }

  if (notesLower.includes('kubernetes') || notesLower.includes('crd') || notesLower.includes('less exposure')) {
    riskFactorsOrGaps.push({
      concern: 'Specialized Cloud Orchestration Tooling Gap',
      context: 'Candidate has slightly less production hands-on exposure with Kubernetes custom controllers or specific orchestrator internals.',
      severity: 'Low',
      mitigation: 'Strong underlying Linux fundamentals indicate fast 2-4 week ramp-up through pair programming.'
    });
  }

  // Fallback benign risk if candidate is overall stellar
  if (riskFactorsOrGaps.length === 0) {
    riskFactorsOrGaps.push({
      concern: 'High Domain Caliber — Flight Risk / Comp Expectations',
      context: 'Candidate performance is at top quartile of interview pool. Likely considering multiple competitive offers.',
      severity: 'Low',
      mitigation: 'Expedite scheduling of final executive sync and calibrate offer package near 75th percentile.'
    });
  }

  // 5. Standardized Competency Evaluations
  const competencyEvaluations: StandardizedCompetencyEvaluation[] = [
    {
      competency: 'Technical Depth & Domain Core',
      score: ratings.technicalDepth,
      benchmark: 'Senior Bar: 7.5+',
      verdict: ratings.technicalDepth >= 8 ? 'Exceeds Bar' : ratings.technicalDepth >= 7 ? 'Meets Bar' : 'Below Bar',
      observations: ratings.technicalDepth >= 8 
        ? `Exhibited authoritative mastery of ${candidate.role} fundamentals, internals, and execution standards.`
        : `Demonstrated satisfactory basic competence but lacked deep internal knowledge on low-level primitives.`
    },
    {
      competency: 'System Architecture & Scale',
      score: ratings.systemArchitecture,
      benchmark: 'Senior Bar: 7.0+',
      verdict: ratings.systemArchitecture >= 8 ? 'Exceeds Bar' : ratings.systemArchitecture >= 6 ? 'Meets Bar' : 'Below Bar',
      observations: ratings.systemArchitecture >= 8
        ? 'Deep understanding of partitioning, backpressure, state stores, and latency SLAs under load.'
        : 'Able to architect basic single-node services; needs guidance on multi-region high availability topologies.'
    },
    {
      competency: 'Problem-Solving & Agility',
      score: ratings.problemSolvingSpeed,
      benchmark: 'Target Bar: 7.0+',
      verdict: ratings.problemSolvingSpeed >= 8 ? 'Exceeds Bar' : ratings.problemSolvingSpeed >= 6 ? 'Meets Bar' : 'Below Bar',
      observations: ratings.problemSolvingSpeed >= 8
        ? 'Rapidly mapped ambiguities to structured engineering steps and edge-case boundaries.'
        : 'Required occasional hints to overcome blockers in algorithmic complexity.'
    },
    {
      competency: 'Communication & Team Synergy',
      score: ratings.communicationClarity,
      benchmark: 'Target Bar: 7.0+',
      verdict: ratings.communicationClarity >= 8 ? 'Exceeds Bar' : ratings.communicationClarity >= 6 ? 'Meets Bar' : 'Below Bar',
      observations: ratings.communicationClarity >= 8
        ? 'Articulate, empathetic, and highly collaborative. Takes feedback seamlessly.'
        : 'Adequate communication; could be more succinct during technical tradeoff discussions.'
    },
    {
      competency: 'Culture, Ownership & Leadership',
      score: ratings.cultureAndLeadership,
      benchmark: 'Target Bar: 7.0+',
      verdict: ratings.cultureAndLeadership >= 8 ? 'Exceeds Bar' : ratings.cultureAndLeadership >= 6 ? 'Meets Bar' : 'Below Bar',
      observations: ratings.cultureAndLeadership >= 8
        ? 'Demonstrated strong bias for action, incident empathy, and mentorship orientation.'
        : 'Standard team contributor mindset with potential to grow into leadership.'
    }
  ];

  // 6. Question Deep Dives
  const questionDeepDives: StandardizedQuestionDeepDive[] = parseQuestionsFromNotes(rawNotes);

  // 7. Executive Summary
  const executiveSummary = generateExecutiveSummary(candidate, input, compositeScore, calibratedLevel);

  // 8. Next steps recommendations
  let recommendedNextSteps = '';
  if (overallRecommendation === 'Strong Hire') {
    recommendedNextSteps = `Fast-track candidate to Final Executive Alignment with Engineering Leadership. Recommend extending offer at ${calibratedLevel} with compensation benchmarked at top quartile.`;
  } else if (overallRecommendation === 'Hire') {
    recommendedNextSteps = `Proceed to final culture & team match round. Align with hiring manager on team placement and specific project ownership.`;
  } else if (overallRecommendation === 'Lean Hire') {
    recommendedNextSteps = `Review feedback in debrief committee. If proceeding, recommend a focused 30-minute bar-raiser interview on system architecture depth or offer at calibrated level ${calibratedLevel}.`;
  } else if (overallRecommendation === 'Lean No Hire') {
    recommendedNextSteps = `Hold for team debrief. Candidate shows promise but does not meet the senior bar for this specific role. Consider keeping profile warm for mid-level openings or downstream pipeline.`;
  } else {
    recommendedNextSteps = `Send courteous standardized rejection follow-up citing candidate strengths while noting alignment with currently prioritized seniority requirements.`;
  }

  const onboardingFocusAreas = [
    `Complete deep-dive into internal ${brief?.job_title || 'engineering'} architectural blueprints and RFC repo within Week 1.`,
    `Shadow senior team members during production deployments and weekly on-call rotation syncs.`,
    `Establish initial milestone deliverable targeting end of Month 1 to validate end-to-end service delivery velocity.`
  ];

  return {
    executiveSummary,
    calibratedLevel,
    hiringVerdict: overallRecommendation,
    compositeScore,
    confidenceScorePercent: Math.min(98, Math.max(82, 85 + (rawNotes.length > 500 ? 8 : 2))),
    coreStrengths,
    riskFactorsOrGaps,
    competencyEvaluations,
    questionDeepDives,
    onboardingFocusAreas,
    recommendedNextSteps,
    generatedAt: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    engineVersion: 'AI Recruitment Intelligence v3.8'
  };
}

/**
 * Extracts a relevant paragraph or sentence from raw notes matching search terms
 */
function extractRelevantSnippet(text: string, keywords: string[]): string | null {
  const sentences = text.split(/\n+|\.\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length > 25 && keywords.some(k => trimmed.toLowerCase().includes(k.toLowerCase()))) {
      return trimmed.replace(/^[-•*]\s*/, '');
    }
  }
  return null;
}

/**
 * Parses questions/scenarios discussed from raw notes
 */
function parseQuestionsFromNotes(notes: string): StandardizedQuestionDeepDive[] {
  const result: StandardizedQuestionDeepDive[] = [];
  const lines = notes.split('\n');

  let currentTopic = '';
  let responseBuf: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('problem') || trimmed.toLowerCase().startsWith('task:') || trimmed.toLowerCase().startsWith('discussion')) {
      if (currentTopic && responseBuf.length > 0) {
        result.push({
          topic: currentTopic,
          candidateResponseSummary: responseBuf.join(' ').slice(0, 240) + '...',
          technicalTradeoffsNoted: 'Explicit trade-offs analyzed regarding throughput, state consistency, and failover latency.',
          verdict: 'Clear demonstration of high-level proficiency'
        });
      }
      currentTopic = trimmed.replace(/^[-•*]\s*/, '').replace(/^[A-Za-z\s]+:\s*/, '');
      responseBuf = [];
    } else if (currentTopic && trimmed.length > 10) {
      responseBuf.push(trimmed.replace(/^[-•*]\s*/, ''));
    }
  }

  if (currentTopic && responseBuf.length > 0) {
    result.push({
      topic: currentTopic,
      candidateResponseSummary: responseBuf.join(' ').slice(0, 240) + '...',
      technicalTradeoffsNoted: 'Structured trade-off formulation balancing architectural elegance with immediate delivery constraints.',
      verdict: 'Strong engineering execution'
    });
  }

  // Fallback structured questions if notes were freeform
  if (result.length === 0) {
    result.push(
      {
        topic: 'Domain Architecture & Scalability Exercise',
        candidateResponseSummary: 'Candidate demonstrated solid command over system requirements, edge case identification, and modular service separation.',
        technicalTradeoffsNoted: 'Weighed synchronous HTTP vs. asynchronous queueing patterns and evaluated database storage indexing strategies.',
        verdict: 'Meets high technical bar'
      },
      {
        topic: 'Live Problem-Solving & Implementation',
        candidateResponseSummary: 'Decomposed problem into modular testable components with clean separation of concerns and clear algorithmic explanations.',
        technicalTradeoffsNoted: 'Balanced time complexity with code readability and defensive error-handling hooks.',
        verdict: 'Verified problem-solving competency'
      }
    );
  }

  return result;
}

/**
 * Generates executive summary narrative
 */
function generateExecutiveSummary(
  candidate: Candidate,
  input: {
    roundName: string;
    interviewerName: string;
    overallRecommendation: InterviewRecommendationType;
    ratings: InterviewCompetencyScores;
  },
  compositeScore: number,
  calibratedLevel: string
): string {
  const { interviewerName, roundName, overallRecommendation } = input;
  const firstName = candidate.name.split(' ')[0];

  if (overallRecommendation === 'Strong Hire') {
    return `${firstName} delivered an exemplary interview during the ${roundName} round with ${interviewerName}. Demonstrating a composite evaluation score of ${compositeScore}/100, the candidate calibrated at ${calibratedLevel}. The technical assessment highlighted mastery over high-scale architectural design, robust error recovery, and exceptional clarity of thought. Unanimous recommendation for prompt offer extension.`;
  }
  if (overallRecommendation === 'Hire') {
    return `${firstName} successfully met the standard evaluation bar during the ${roundName} evaluation with ${interviewerName}, achieving a composite score of ${compositeScore}/100 (${calibratedLevel}). The candidate demonstrated solid domain execution and strong team collaborative aptitude with minor areas identified for 90-day onboarding mentorship.`;
  }
  if (overallRecommendation === 'Lean Hire') {
    return `${firstName} showed good baseline competency during ${roundName} with ${interviewerName} (${compositeScore}/100), calibrating at ${calibratedLevel}. While execution on immediate requirements was sound, questions remain regarding autonomous ownership on complex distributed state architectures. Recommended for committee debrief.`;
  }
  if (overallRecommendation === 'Lean No Hire') {
    return `${firstName} demonstrated enthusiasm and foundational concepts during ${roundName} (${compositeScore}/100), but fell short of the senior technical threshold expected for ${candidate.role}. Recommendation is to not advance for this specific opening, but retain in the talent network for junior/mid-level tracks.`;
  }
  return `${firstName} did not demonstrate the requisite technical depth or problem-solving autonomy during ${roundName} (${compositeScore}/100). The interview identified critical gaps in core engineering practices and architectural edge-case handling. Recommendation is not to proceed.`;
}

/**
 * Formats standardized evaluation report into clean markdown for sharing in Slack / ATS
 */
export function formatStandardizedReportMarkdown(
  report: StandardizedEvaluationReport,
  candidate: Candidate,
  feedback: InterviewRoundFeedback
): string {
  const strengths = report.coreStrengths
    .map(s => `• **${s.title}** [${s.signalStrength}]: ${s.evidence}`)
    .join('\n');

  const risks = report.riskFactorsOrGaps
    .map(r => `• **${r.concern}** (Severity: ${r.severity})\n  - *Context:* ${r.context}\n  - *Mitigation:* ${r.mitigation}`)
    .join('\n');

  const competencies = report.competencyEvaluations
    .map(c => `| ${c.competency} | **${c.score}/10** | ${c.benchmark} | ${c.verdict} |`)
    .join('\n');

  const deepDives = report.questionDeepDives
    .map(q => `##### ❓ ${q.topic}\n- **Candidate Response:** ${q.candidateResponseSummary}\n- **Trade-offs Evaluated:** ${q.technicalTradeoffsNoted}\n- **Verdict:** ${q.verdict}`)
    .join('\n\n');

  return `### 📋 Standardized Candidate Evaluation Report
**Candidate:** ${candidate.name} (${candidate.candidate_id})  
**Target Role:** ${candidate.role}  
**Interview Round:** ${feedback.roundName} (${feedback.roundType.toUpperCase()})  
**Interviewer:** ${feedback.interviewerName} (${feedback.interviewerRole})  
**Interview Date:** ${feedback.interviewDate}  
**Evaluation Generated:** ${report.generatedAt}  

---

#### 🏆 Bottom-Line Verdict: **${report.hiringVerdict.toUpperCase()}**
- **Composite Score:** **${report.compositeScore}/100** (Confidence: ${report.confidenceScorePercent}%)
- **Calibrated Seniority:** **${report.calibratedLevel}**

#### 📝 Executive Summary
> ${report.executiveSummary}

#### 📊 Competency Rubric Breakdown
| Competency | Score | Target Benchmark | Evaluation Verdict |
| :--- | :---: | :---: | :--- |
${competencies}

#### 🌟 Key Strengths & Evidentiary Signals
${strengths}

#### ⚠️ Risk Factors, Growth Gaps & Mitigations
${risks}

#### 🔍 Question & Technical Scenario Deep-Dives
${deepDives}

#### 🎯 Recommended Next Steps
**${report.recommendedNextSteps}**

---
*(Generated by ${report.engineVersion} • Confidential Recruiting Document)*`;
}
