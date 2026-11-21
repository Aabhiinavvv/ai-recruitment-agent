import { ATSTier, Candidate, HiringBrief, ResumeATSBreakdown } from '../types';
import { resumeContainsSkill } from './resumeParser';

export interface ComputeATSScoreInput {
  resumeText: string;
  requiredSkills: string[];
  jdText?: string;
  email?: string;
  phone?: string;
  extractedSkills?: string[];
  skillScores?: Record<string, number>;
}

const ACTION_VERBS = [
  'architected',
  'built',
  'designed',
  'developed',
  'engineered',
  'led',
  'managed',
  'implemented',
  'launched',
  'reduced',
  'improved',
  'increased',
  'scaled',
  'optimized',
  'automated',
  'deployed',
  'delivered',
  'mentored',
  'created',
  'migrated',
  'integrated',
  'spearheaded',
  'streamlined',
];

const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(val)));

export function getAtsTier(score: number): ATSTier {
  if (score >= 85) return 'Excellent';
  if (score >= 72) return 'Strong';
  if (score >= 55) return 'Moderate';
  return 'Needs Optimization';
}

export function getAtsBadgeColors(score: number): {
  badge: string;
  text: string;
  bar: string;
  border: string;
} {
  if (score >= 85) {
    return {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      text: 'text-emerald-700',
      bar: 'bg-emerald-600',
      border: 'border-emerald-200',
    };
  }
  if (score >= 72) {
    return {
      badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      text: 'text-indigo-700',
      bar: 'bg-[#6743ee]',
      border: 'border-indigo-200',
    };
  }
  if (score >= 55) {
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      text: 'text-amber-700',
      bar: 'bg-amber-500',
      border: 'border-amber-200',
    };
  }
  return {
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    text: 'text-rose-700',
    bar: 'bg-rose-500',
    border: 'border-rose-200',
  };
}

export function computeResumeATSScore(input: ComputeATSScoreInput): ResumeATSBreakdown {
  const rawText = (input.resumeText || '').trim();
  const lowerText = rawText.toLowerCase();
  const normalizedSkills = Array.from(
    new Set((input.requiredSkills || []).map((s) => s.trim()).filter(Boolean))
  );

  // 1. Keyword Match Score (Weight: 40%)
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  if (normalizedSkills.length > 0) {
    for (const skill of normalizedSkills) {
      const foundInText = rawText ? resumeContainsSkill(lowerText, skill) : false;
      const foundInScores =
        input.skillScores &&
        Object.entries(input.skillScores).some(
          ([k, v]) => k.toLowerCase() === skill.toLowerCase() && v >= 6
        );
      const foundInExtracted =
        input.extractedSkills &&
        input.extractedSkills.some((s) => s.toLowerCase() === skill.toLowerCase());

      if (foundInText || foundInScores || foundInExtracted) {
        matchedKeywords.push(skill);
      } else {
        missingKeywords.push(skill);
      }
    }
  } else if (input.extractedSkills && input.extractedSkills.length > 0) {
    matchedKeywords.push(...input.extractedSkills.slice(0, 8));
  }

  let keywordMatchScore = 70;
  if (normalizedSkills.length > 0) {
    const baseRatio = matchedKeywords.length / normalizedSkills.length;
    // Slight credit for breadth of verified skills beyond minimum required list
    const bonusBreadth = Math.min(10, Math.max(0, (input.extractedSkills?.length || 0) - matchedKeywords.length));
    keywordMatchScore = clamp(baseRatio * 90 + bonusBreadth, 15, 100);
  } else if (input.extractedSkills && input.extractedSkills.length > 0) {
    keywordMatchScore = clamp(50 + input.extractedSkills.length * 4, 45, 96);
  }

  // Optional JD keyword alignment nudge if jdText is provided
  if (input.jdText && rawText) {
    const jdTokens = new Set(
      input.jdText
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    );
    const resumeTokens = new Set(
      lowerText
        .replace(/[^a-z0-9+#.\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    );
    if (jdTokens.size > 0) {
      let overlap = 0;
      for (const tok of jdTokens) {
        if (resumeTokens.has(tok)) overlap++;
      }
      const jdCoverage = Math.min(100, Math.round((overlap / Math.min(jdTokens.size, 35)) * 100));
      keywordMatchScore = clamp(keywordMatchScore * 0.8 + jdCoverage * 0.2, 15, 100);
    }
  }

  // 2. Section Completeness Score (Weight: 20%)
  const detectedSections: string[] = [];
  const hasSummary =
    /\b(summary|professional summary|executive summary|profile|about|objective)\b/i.test(rawText) ||
    rawText.split('\n').slice(0, 6).join(' ').length > 140;
  const hasExperience =
    /\b(experience|work experience|professional experience|employment|career history|engineer|developer|manager|architect|scientist)\b/i.test(
      rawText
    );
  const hasSkillsSection =
    /\b(skills|technical skills|core competencies|technologies|tools|proficiencies|stack)\b/i.test(
      rawText
    ) || (input.extractedSkills?.length || 0) >= 3;
  const hasEducation =
    /\b(education|university|college|b\.?s\.?|m\.?s\.?|b\.?tech|m\.?tech|bachelor|master|ph\.?d|degree)\b/i.test(
      rawText
    );
  const hasProjectsOrCerts =
    /\b(projects|key projects|certifications|publications|awards|open[- ]source|portfolio)\b/i.test(
      rawText
    );
  const hasChronology = /\b(199\d|20[0-2]\d|present|current)\b/i.test(rawText);

  if (hasSummary) detectedSections.push('Summary');
  if (hasExperience) detectedSections.push('Experience');
  if (hasSkillsSection) detectedSections.push('Skills');
  if (hasEducation) detectedSections.push('Education');
  if (hasProjectsOrCerts) detectedSections.push('Projects / Certs');

  let sectionScore = 20;
  if (hasSummary) sectionScore += 14;
  if (hasExperience) sectionScore += 24;
  if (hasSkillsSection) sectionScore += 18;
  if (hasEducation) sectionScore += 14;
  if (hasProjectsOrCerts) sectionScore += 5;
  if (hasChronology) sectionScore += 5;
  sectionScore = clamp(sectionScore, 20, 100);

  // 3. Contact & Parseability Score (Weight: 15%)
  const emailPresent = Boolean(
    (input.email && input.email.includes('@')) ||
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText)
  );
  const phonePresent = Boolean(
    (input.phone && input.phone.replace(/\D/g, '').length >= 7) ||
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?|\d{2,5}[\s.-])\d{3,5}[\s.-]?\d{3,5}/.test(rawText)
  );
  const linksOrLocationPresent =
    /\b(linkedin\.com|github\.com|https?:\/\/)\b/i.test(rawText) ||
    /\b([A-Z][a-zA-Z.'-]+,\s*(?:[A-Z]{2}|India|UK|USA|United States|Canada|Remote))\b/.test(rawText);

  let contactScore = 15;
  if (emailPresent) contactScore += 40;
  if (phonePresent) contactScore += 25;
  if (linksOrLocationPresent) contactScore += 20;
  contactScore = clamp(contactScore, 15, 100);

  // 4. Quantified Impact & Action Verbs Score (Weight: 15%)
  const metricMatches =
    rawText.match(
      /(?:\d+(?:\.\d+)?%|\$\d+[\d,.]*[kmb]?|\b\d+\+?\s*(?:years?|yrs?|x|ms|req\/s|rps|users|engineers|microservices|models)\b|\b\d+[km]\+?\b|99\.\d+%)/gi
    ) || [];
  const verbHits = ACTION_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`, 'i').test(rawText));

  const metricPoints = Math.min(50, metricMatches.length * 10);
  const verbPoints = Math.min(35, verbHits.length * 5);
  const impactScore = clamp(15 + metricPoints + verbPoints, 20, 100);

  // 5. Formatting & ATS Readability Score (Weight: 10%)
  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletCount = lines.filter((l) => /^[-•*▪◦→]/.test(l)).length;
  const hasReplacementGarbage = /\uFFFD/.test(rawText);

  let formattingScore = 45;
  if (wordCount >= 140 && wordCount <= 1300) {
    formattingScore += 25;
  } else if (wordCount >= 70 && wordCount < 140) {
    formattingScore += 15;
  } else if (wordCount > 1300) {
    formattingScore += 18;
  } else {
    formattingScore += 5;
  }

  if (bulletCount >= 3 || lines.length >= 10) {
    formattingScore += 20;
  } else if (lines.length >= 5) {
    formattingScore += 10;
  }

  if (!hasReplacementGarbage) {
    formattingScore += 10;
  }
  formattingScore = clamp(formattingScore, 25, 100);

  const overall = clamp(
    keywordMatchScore * 0.4 +
      sectionScore * 0.2 +
      contactScore * 0.15 +
      impactScore * 0.15 +
      formattingScore * 0.1,
    18,
    99
  );

  // Build crisp diagnostic checks & optimization warnings
  const passedChecks: string[] = [];
  const warnings: string[] = [];

  if (normalizedSkills.length > 0) {
    if (matchedKeywords.length === normalizedSkills.length) {
      passedChecks.push(`All ${normalizedSkills.length} role keywords matched`);
    } else if (matchedKeywords.length > 0) {
      passedChecks.push(
        `Matched ${matchedKeywords.length}/${normalizedSkills.length} required ATS keywords`
      );
    }
  } else if (matchedKeywords.length > 0) {
    passedChecks.push(`${matchedKeywords.length} technical keywords parsed`);
  }

  if (emailPresent && phonePresent) {
    passedChecks.push('Contact email & phone cleanly parseable');
  } else {
    if (!emailPresent) warnings.push('Missing parseable email address');
    if (!phonePresent) warnings.push('Missing phone number for ATS callback');
  }

  if (hasExperience && hasEducation && hasSkillsSection) {
    passedChecks.push('Standard ATS sections detected (Experience, Skills, Education)');
  } else {
    if (!hasExperience) warnings.push('No clear Work Experience heading/chronology detected');
    if (!hasSkillsSection) warnings.push('Missing dedicated Skills section for ATS indexing');
    if (!hasEducation) warnings.push('Education section not explicitly detected');
  }

  if (metricMatches.length >= 2) {
    passedChecks.push(`${metricMatches.length} quantified impact metrics detected`);
  } else {
    warnings.push('Low measurable impact density (add %, $, scale, or latency metrics)');
  }

  if (missingKeywords.length > 0) {
    warnings.push(
      `Missing target keywords: ${missingKeywords.slice(0, 4).join(', ')}${
        missingKeywords.length > 4 ? ` (+${missingKeywords.length - 4} more)` : ''
      }`
    );
  }

  if (wordCount < 90 && rawText.length > 0) {
    warnings.push('Resume text is concise (<90 words); sparse context may lower ATS ranking');
  }

  return {
    overall_ats_score: overall,
    keyword_match_score: keywordMatchScore,
    section_completeness_score: sectionScore,
    contact_info_score: contactScore,
    quantified_impact_score: impactScore,
    formatting_score: formattingScore,
    matched_keywords: matchedKeywords,
    missing_keywords: missingKeywords,
    detected_sections: detectedSections,
    passed_checks: passedChecks,
    warnings,
    tier: getAtsTier(overall),
  };
}

export function getCandidateATSScore(
  cand: Candidate,
  brief?: HiringBrief | null
): ResumeATSBreakdown {
  if (cand.ats_analysis && typeof cand.ats_analysis.overall_ats_score === 'number') {
    return cand.ats_analysis;
  }

  const requiredSkills = brief?.requirements
    ? brief.requirements
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : Object.keys(cand.skill_scores || {}).slice(0, 6);

  return computeResumeATSScore({
    resumeText: cand.resume_text || cand.resume_profile || '',
    requiredSkills,
    jdText: brief?.jd,
    email: cand.email,
    phone: cand.phone,
    extractedSkills: cand.extracted_skills || Object.keys(cand.skill_scores || {}),
    skillScores: cand.skill_scores,
  });
}
