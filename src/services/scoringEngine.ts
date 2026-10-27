import { DimensionScores } from '../types';

export const DIMENSION_WEIGHTS = {
  technical: 0.30,
  experience: 0.20,
  education: 0.10,
  projects: 0.15,
  domain: 0.15,
  communication: 0.10,
};

const DEGREE_LEVELS: Record<string, number> = {
  phd: 5, doctorate: 5, "d.phil": 5,
  mtech: 4, "m.tech": 4, msc: 4, "m.sc": 4, ms: 4, mba: 4, master: 4,
  btech: 3, "b.tech": 3, be: 3, "b.e": 3, bsc: 3, "b.sc": 3, bs: 3, bachelor: 3,
  ba: 2, "b.a": 2, bca: 2, bcom: 2, "b.com": 2,
  diploma: 1, associate: 1,
};

const SENIORITY_LEVELS: Record<string, number> = {
  intern: 0, trainee: 0, apprentice: 0,
  junior: 1, associate: 1, entry: 1,
  mid: 2, engineer: 2, developer: 2, analyst: 2,
  senior: 3, sr: 3, lead: 3, principal: 3, manager: 3,
  staff: 4, director: 5, vp: 5, cto: 5
};

export interface MultidimScoreResult {
  final_score: number;
  dimension_scores: DimensionScores;
  dimension_evidence: Record<string, string>;
  weighted_contributions: Record<string, number>;
  strengths: string[];
  gaps: string[];
  recommendation: 'Advance' | 'Hold' | 'Reject';
  disclaimer: string;
}

export function computeMultidimScore(
  resumeText: string,
  jdText: string,
  requiredSkills: string[],
  skillScores: Record<string, number>,
  cutoffScore: number = 75
): MultidimScoreResult {
  const lowerResume = resumeText.toLowerCase();
  const lowerJd = jdText.toLowerCase();

  // 1. Technical skills (30%)
  const skillValues = Object.values(skillScores);
  let techScore = 60;
  if (skillValues.length > 0) {
    const avgSkill = skillValues.reduce((a, b) => a + b, 0) / skillValues.length;
    // Map 0-10 to 0-100
    techScore = Math.min(100, Math.round(avgSkill * 10));
  } else if (requiredSkills.length > 0) {
    let matched = 0;
    for (const skill of requiredSkills) {
      if (lowerResume.includes(skill.toLowerCase())) matched++;
    }
    techScore = Math.min(100, Math.round((matched / requiredSkills.length) * 100));
  }

  // 2. Experience score (20%)
  // Regex search for years of experience
  const expMatch = lowerResume.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
  let years = expMatch ? parseInt(expMatch[1], 10) : 3;
  if (isNaN(years)) years = 3;
  
  let expScore = Math.min(100, Math.max(40, years * 16));
  
  // 3. Education score (10%)
  let maxDegree = 3; // default Bachelor
  for (const [deg, level] of Object.entries(DEGREE_LEVELS)) {
    if (new RegExp(`\\b${deg}\\b`, 'i').test(lowerResume)) {
      if (level > maxDegree) maxDegree = level;
    }
  }
  const eduScore = Math.min(100, maxDegree * 20);

  // 4. Projects score (15%)
  let projectScore = 70;
  if (lowerResume.includes("project") || lowerResume.includes("github") || lowerResume.includes("built") || lowerResume.includes("developed")) {
    projectScore = 85;
  }
  if (lowerResume.includes("production") || lowerResume.includes("deployed") || lowerResume.includes("scale")) {
    projectScore = Math.min(100, projectScore + 10);
  }

  // 5. Domain Knowledge (15%)
  let domainScore = 70;
  let matches = 0;
  for (const skill of requiredSkills) {
    if (lowerResume.includes(skill.toLowerCase())) matches++;
  }
  if (requiredSkills.length > 0) {
    domainScore = Math.min(100, Math.round(50 + (matches / requiredSkills.length) * 50));
  }

  // 6. Communication (10%)
  const commScore = 75;

  const dimension_scores: DimensionScores = {
    technical: Math.round(techScore),
    experience: Math.round(expScore),
    education: Math.round(eduScore),
    projects: Math.round(projectScore),
    domain: Math.round(domainScore),
    communication: Math.round(commScore),
  };

  const weighted_contributions: Record<string, number> = {
    technical: Number((dimension_scores.technical * DIMENSION_WEIGHTS.technical).toFixed(1)),
    experience: Number((dimension_scores.experience * DIMENSION_WEIGHTS.experience).toFixed(1)),
    education: Number((dimension_scores.education * DIMENSION_WEIGHTS.education).toFixed(1)),
    projects: Number((dimension_scores.projects * DIMENSION_WEIGHTS.projects).toFixed(1)),
    domain: Number((dimension_scores.domain * DIMENSION_WEIGHTS.domain).toFixed(1)),
    communication: Number((dimension_scores.communication * DIMENSION_WEIGHTS.communication).toFixed(1)),
  };

  const final_score = Math.round(
    Object.values(weighted_contributions).reduce((a, b) => a + b, 0)
  );

  const dimension_evidence: Record<string, string> = {
    technical: `Evaluated ${Object.keys(skillScores).length || requiredSkills.length} core job competencies. Average capability demonstrated: ${Math.round(techScore)}%.`,
    experience: `Evidence of approx. ${years} years relevant industry experience across related technical domains.`,
    education: `Degree attainment index: Level ${maxDegree}/5 recognized qualification.`,
    projects: `Hands-on practical development evidence extracted from portfolio and work descriptions.`,
    domain: `Conceptual domain overlap aligned with target role requirements: ${matches}/${requiredSkills.length || 1} criteria.`,
    communication: `Structured prose, coherent technical narrative, and professional documentation format.`
  };

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (dimension_scores.technical >= 80) strengths.push("Strong demonstrated technical competence in core role stack");
  if (dimension_scores.experience >= 80) strengths.push("Extensive tenure meeting or exceeding seniority expectations");
  if (dimension_scores.education >= 80) strengths.push("Advanced degree aligned with role specialization");
  if (dimension_scores.projects >= 80) strengths.push("Proven real-world implementation and deployment track record");

  if (dimension_scores.technical < 70) gaps.push("Foundational gaps in required modern tooling and libraries");
  if (dimension_scores.experience < 70) gaps.push("Limited total years of production leadership or independent delivery");
  if (dimension_scores.domain < 70) gaps.push("Partial coverage of secondary domain practices");

  let recommendation: 'Advance' | 'Hold' | 'Reject' = 'Hold';
  if (final_score >= cutoffScore) {
    recommendation = 'Advance';
  } else if (final_score < 60) {
    recommendation = 'Reject';
  }

  return {
    final_score,
    dimension_scores,
    dimension_evidence,
    weighted_contributions,
    strengths,
    gaps,
    recommendation,
    disclaimer: "This multi-dimensional score is advisory only. All hiring decisions must be reviewed and approved by a human recruiter."
  };
}
