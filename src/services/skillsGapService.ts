import {
  Candidate,
  HiringBrief,
  CompetencyGapItem,
  CompetencyHolderInfo,
  SkillCoverageStatus,
  TeamSkillsGapReport
} from '../types';
import { ROLE_REQUIREMENTS } from '../data/roles';

export const SKILL_SYNONYM_MAP: Record<string, string[]> = {
  'natural language processing': ['nlp', 'natural language processing', 'llms', 'transformers'],
  'machine learning': ['machine learning', 'ml', 'scikit learn', 'xgboost'],
  'deep learning': ['deep learning', 'dl', 'pytorch', 'tensorflow', 'neural networks'],
  'mlops': ['mlops', 'model deployment', 'model serving', 'triton'],
  'model deployment': ['model deployment', 'mlops', 'inference', 'model serving'],
  'cloud computing': ['cloud computing', 'aws', 'gcp', 'azure', 'sagemaker'],
  'cloud computing (aws, azure, gcp)': ['cloud computing', 'aws', 'gcp', 'azure'],
  'cloud platforms (aws, azure, gcp)': ['cloud computing', 'aws', 'gcp', 'azure'],
  'containerization (docker, kubernetes)': ['docker', 'kubernetes', 'k8s', 'containerization'],
  'database management (sql/nosql)': ['sql', 'nosql', 'postgresql', 'mongodb', 'database'],
  'api development (restful, graphql)': ['rest', 'restful', 'graphql', 'api'],
  'version control (git)': ['git', 'github', 'gitlab'],
  'ci/cd pipelines (jenkins, gitlab ci)': ['ci/cd', 'jenkins', 'gitlab ci', 'github actions'],
  'monitoring and logging (prometheus, elk stack)': ['prometheus', 'grafana', 'elk', 'monitoring'],
  'javascript': ['javascript', 'js', 'es6'],
  'typescript': ['typescript', 'ts'],
  'frontend development (html, css, javascript, react, vue.js)': ['react', 'javascript', 'html', 'css', 'vue.js'],
  'backend development (python, java, node.js, ruby, go)': ['python', 'java', 'node.js', 'go', 'ruby'],
  'big data technologies (hadoop, spark)': ['spark', 'hadoop', 'ray', 'big data'],
  'ui/ux design principles': ['ui/ux', 'figma', 'design systems'],
  'user experience (ux) design': ['ux', 'ui/ux', 'user research', 'figma']
};

export function getAliasesForSkill(skill: string): string[] {
  const lower = skill.toLowerCase().trim();
  const aliases = new Set<string>([lower]);

  if (SKILL_SYNONYM_MAP[lower]) {
    SKILL_SYNONYM_MAP[lower].forEach(a => aliases.add(a));
  }

  // Also extract tokens inside parentheses e.g. "Containerization (Docker, Kubernetes)"
  const parenMatch = lower.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    parenMatch[1]
      .split(/[,/]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2)
      .forEach(token => aliases.add(token));
  }

  return Array.from(aliases);
}

/**
 * Evaluates whether a candidate holds a given required skill and returns their 1-10 proficiency score (or null if missing/below bar).
 */
export function getCandidateSkillProficiency(candidate: Candidate, requiredSkill: string): number | null {
  const aliases = getAliasesForSkill(requiredSkill);
  const skillEntries = Object.entries(candidate.skill_scores || {});

  let bestScore: number | null = null;

  for (const [candSkill, rawScore] of skillEntries) {
    const candLower = candSkill.toLowerCase().trim();
    const isMatch = aliases.some(alias =>
      candLower === alias ||
      (alias.length >= 4 && candLower.includes(alias)) ||
      (candLower.length >= 4 && alias.includes(candLower))
    );

    if (isMatch && rawScore >= 6) {
      bestScore = bestScore === null ? rawScore : Math.max(bestScore, rawScore);
    }
  }

  return bestScore;
}

/**
 * Aggregates technical & domain skills across high-scoring candidates and identifies gaps compared to the Hiring Brief.
 */
export function analyzeTeamSkillsGap(
  candidates: Candidate[],
  brief: HiringBrief | null,
  scoreThreshold: number = 75
): TeamSkillsGapReport {
  const roleTitle = brief?.job_title || 'AI/ML Engineer';

  // Parse required skills from Hiring Brief or fallback role template
  const rawReqText = brief?.requirements || '';
  const parsedSkills = rawReqText
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const requiredSkills = parsedSkills.length > 0
    ? Array.from(new Set(parsedSkills))
    : (ROLE_REQUIREMENTS[roleTitle] || ROLE_REQUIREMENTS['AI/ML Engineer']);

  // Partition candidates into High-Scoring Cohort vs Near-Cutoff
  const activePool = candidates.filter(
    c => !c.decision_status?.includes('Not proceeding') && c.stage !== 'Rejected'
  );

  const cohortCandidates = activePool
    .filter(c => c.overall_score >= scoreThreshold)
    .sort((a, b) => b.overall_score - a.overall_score);

  const nearCutoffCandidates = activePool
    .filter(c => c.overall_score < scoreThreshold && c.overall_score >= Math.max(55, scoreThreshold - 15))
    .sort((a, b) => b.overall_score - a.overall_score);

  const cohortSize = cohortCandidates.length;

  const competencies: CompetencyGapItem[] = requiredSkills.map(skill => {
    const holders: CompetencyHolderInfo[] = [];

    for (const cand of cohortCandidates) {
      const score = getCandidateSkillProficiency(cand, skill);
      if (score !== null) {
        holders.push({
          candidateId: cand.candidate_id,
          candidateName: cand.name,
          overallScore: cand.overall_score,
          skillScore: score
        });
      }
    }

    const nearCutoffHolders: CompetencyHolderInfo[] = [];
    for (const cand of nearCutoffCandidates) {
      const score = getCandidateSkillProficiency(cand, skill);
      if (score !== null && score >= 7) {
        nearCutoffHolders.push({
          candidateId: cand.candidate_id,
          candidateName: cand.name,
          overallScore: cand.overall_score,
          skillScore: score
        });
      }
    }

    const coveredCount = holders.length;
    const coveragePercent = cohortSize > 0 ? Math.round((coveredCount / cohortSize) * 100) : 0;
    const avgProficiency = coveredCount > 0
      ? Math.round((holders.reduce((sum, h) => sum + h.skillScore, 0) / coveredCount) * 10) / 10
      : 0;

    let status: SkillCoverageStatus = 'missing';
    if (coveredCount === 0) {
      status = 'missing';
    } else if (coveredCount === 1 && cohortSize > 1) {
      status = 'thin';
    } else if (coveragePercent < 45 && cohortSize >= 3) {
      status = 'thin';
    } else {
      status = 'covered';
    }

    return {
      skill,
      status,
      coveredCount,
      cohortSize,
      coveragePercent,
      avgProficiency,
      holders,
      nearCutoffHolders
    };
  });

  // Sort: Covered (highest coverage & proficiency first), then Thin, then Missing
  const statusOrder: Record<SkillCoverageStatus, number> = {
    missing: 0,
    thin: 1,
    covered: 2
  };

  competencies.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    if (b.coveragePercent !== a.coveragePercent) {
      return b.coveragePercent - a.coveragePercent;
    }
    return b.avgProficiency - a.avgProficiency;
  });

  const coveredSkillsCount = competencies.filter(c => c.status === 'covered').length;
  const thinSkillsCount = competencies.filter(c => c.status === 'thin').length;
  const missingSkillsCount = competencies.filter(c => c.status === 'missing').length;
  const totalRequiredSkills = competencies.length;

  const overallCoveragePercent = totalRequiredSkills > 0
    ? Math.round(((coveredSkillsCount + thinSkillsCount * 0.5) / totalRequiredSkills) * 100)
    : 0;

  const cohortAvgScore = cohortSize > 0
    ? Math.round(cohortCandidates.reduce((sum, c) => sum + c.overall_score, 0) / cohortSize)
    : 0;

  // Identify bonus skills held by high-scoring cohort that weren't in the brief
  const requiredAliasSet = new Set<string>();
  requiredSkills.forEach(req => {
    getAliasesForSkill(req).forEach(a => requiredAliasSet.add(a));
  });

  const bonusMap = new Map<string, number[]>();
  cohortCandidates.forEach(cand => {
    Object.entries(cand.skill_scores || {}).forEach(([sk, val]) => {
      if (val >= 7) {
        const lower = sk.toLowerCase().trim();
        const isAlreadyRequired = Array.from(requiredAliasSet).some(
          alias => lower === alias || (alias.length >= 4 && lower.includes(alias))
        );
        if (!isAlreadyRequired) {
          const existing = bonusMap.get(sk) || [];
          existing.push(val);
          bonusMap.set(sk, existing);
        }
      }
    });
  });

  const surplusSkills = Array.from(bonusMap.entries())
    .map(([skill, scores]) => ({
      skill,
      holderCount: scores.length,
      avgProficiency: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    }))
    .sort((a, b) => b.holderCount - a.holderCount || b.avgProficiency - a.avgProficiency)
    .slice(0, 5);

  return {
    roleTitle,
    scoreThreshold,
    cohortCandidates,
    totalRequiredSkills,
    coveredSkillsCount,
    thinSkillsCount,
    missingSkillsCount,
    overallCoveragePercent,
    cohortAvgScore,
    competencies,
    surplusSkills
  };
}
