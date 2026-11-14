import type {
  Candidate,
  HiringBrief,
  ResumeAIInsights,
  ResumePatternInsight,
  ResumeProbeArea,
} from '../types';

export function buildLocalResumeInsights(
  candidate: Candidate,
  brief?: HiringBrief | null
): ResumeAIInsights {
  const text = (candidate.resume_text || candidate.resume_profile || '').trim();
  const lower = text.toLowerCase();
  const targetRole = brief?.job_title || candidate.role || 'Target Role';

  // 1. Detect timeline years & career span
  const yearMatches = Array.from(text.matchAll(/\b(199\d|20[0-2]\d)\b/g)).map((m) =>
    Number(m[1])
  );
  const minYear = yearMatches.length > 0 ? Math.min(...yearMatches) : null;
  const maxYear = yearMatches.length > 0 ? Math.max(...yearMatches) : null;
  const hasPresent = /\b(present|current|now)\b/i.test(text);
  const currentYear = new Date().getFullYear();
  const effectiveEnd = hasPresent && maxYear ? Math.max(maxYear, currentYear) : maxYear;
  const spanYears =
    minYear && effectiveEnd && effectiveEnd >= minYear ? effectiveEnd - minYear : null;

  // 2. Detect quantified impact statements
  const metricSentences = text
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 15 &&
        s.length < 220 &&
        /(\d+(?:\.\d+)?%|\$\d+|\d+x\b|\d+[kmb]\+?|\b\d{2,}\s*(?:ms|users|requests|engineers|services|tb|gb)\b)/i.test(
          s
        )
    );

  // 3. Detect progression / leadership / architecture verbs
  const hasArchitecture = /\b(architect(?:ed|ure)?|designed|distributed|scalable|system design|microservices|pipeline)\b/i.test(
    text
  );
  const hasLeadership = /\b(led|lead|mentored|managed|spearheaded|owned|founded|head of|principal|staff)\b/i.test(
    text
  );
  const hasSeniorTitle = /\b(senior|sr\.?|staff|principal|lead|manager|director)\b/i.test(
    `${candidate.detected_title || ''} ${text.slice(0, 500)}`
  );

  // 4. Skill categorization (Depth vs Breadth)
  const skills = candidate.extracted_skills?.length
    ? candidate.extracted_skills
    : Object.entries(candidate.skill_scores || {})
        .filter(([, score]) => score >= 7)
        .map(([skill]) => skill);

  const mlKeywords = ['pytorch', 'tensorflow', 'llm', 'rag', 'nlp', 'machine learning', 'deep learning', 'transformers', 'langchain', 'cuda', 'mlops'];
  const backendKeywords = ['node', 'python', 'go', 'java', 'rust', 'fastapi', 'express', 'postgresql', 'sql', 'redis', 'kafka', 'graphql', 'rest'];
  const cloudKeywords = ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd'];
  const frontendKeywords = ['react', 'typescript', 'javascript', 'next.js', 'tailwind', 'css', 'html'];

  const countMatches = (keywords: string[]) =>
    skills.filter((s) => keywords.some((k) => s.toLowerCase().includes(k))).length +
    keywords.filter((k) => lower.includes(k)).length;

  const domainCounts = [
    { name: 'AI/ML', count: countMatches(mlKeywords) },
    { name: 'Backend & Data', count: countMatches(backendKeywords) },
    { name: 'Cloud & Infra', count: countMatches(cloudKeywords) },
    { name: 'Frontend & UI', count: countMatches(frontendKeywords) },
  ].filter((d) => d.count > 0);

  domainCounts.sort((a, b) => b.count - a.count);
  const primaryDomain = domainCounts[0]?.name || targetRole;
  const isBroadGeneralist = domainCounts.length >= 3;

  // 5. Build Career Patterns
  const careerPatterns: ResumePatternInsight[] = [];

  if (metricSentences.length >= 2) {
    careerPatterns.push({
      category: 'Ownership & Impact',
      pattern: 'Metric-Driven Execution',
      insight: `Candidate consistently frames work around measurable outcomes (${metricSentences.length} quantified achievements cited), indicating strong product and performance accountability.`,
      evidence: metricSentences[0],
      signal: 'positive',
    });
  } else {
    careerPatterns.push({
      category: 'Ownership & Impact',
      pattern: 'Responsibility-First Framing',
      insight:
        'Resume emphasizes responsibilities and technologies built, with limited quantified business or latency metrics.',
      evidence:
        candidate.work_highlights?.[0] ||
        'Few numerical impact figures detected across role bullets.',
      signal: 'watch',
    });
  }

  if (hasLeadership || hasSeniorTitle) {
    careerPatterns.push({
      category: 'Leadership',
      pattern: hasArchitecture
        ? 'Technical Architecture & Mentorship'
        : 'Ownership & Team Coordination',
      insight:
        'Signals progression beyond individual task execution into system design ownership, cross-functional alignment, or mentoring peers.',
      evidence:
        candidate.detected_title ||
        'Leadership/ownership indicators present across experience entries.',
      signal: 'positive',
    });
  }

  careerPatterns.push({
    category: 'Depth vs Breadth',
    pattern: isBroadGeneralist
      ? `Cross-Stack Generalist (${domainCounts.length} domains)`
      : `Focused ${primaryDomain} Specialist`,
    insight: isBroadGeneralist
      ? `Demonstrates versatility across ${domainCounts.map((d) => d.name).join(', ')}, well suited for end-to-end product delivery.`
      : `Concentrated depth in ${primaryDomain} (${skills.slice(0, 5).join(', ') || 'core stack'}), ideal for specialized technical ownership.`,
    evidence:
      skills.length > 0
        ? `Core documented stack: ${skills.slice(0, 6).join(', ')}`
        : 'Derived from documented project and skill references.',
    signal: 'neutral',
  });

  if (spanYears !== null && spanYears >= 1) {
    careerPatterns.push({
      category: 'Consistency',
      pattern:
        spanYears >= 5
          ? `Multi-Year Continuity (~${spanYears} yr timeline)`
          : `Early-to-Mid Trajectory (~${spanYears} yr timeline)`,
      insight:
        spanYears >= 5
          ? 'Timeline spans multiple years of sustained industry engineering, supporting higher autonomy expectations.'
          : 'Compact career timeline suggests fast learning velocity; validate production scale depth during interview.',
      evidence: `Resume timeline spans ${minYear}–${effectiveEnd}.`,
      signal: spanYears >= 4 ? 'positive' : 'neutral',
    });
  }

  // 6. Key Insights
  const keyInsights: string[] = [];
  keyInsights.push(
    `Overall rubric alignment is ${candidate.overall_score}% for ${targetRole} (Technical: ${candidate.dimension_scores.technical}%, Experience: ${candidate.dimension_scores.experience}%).`
  );
  if (skills.length > 0) {
    keyInsights.push(
      `Strongest verified stack signals cluster around ${skills.slice(0, 5).join(', ')}.`
    );
  }
  if (candidate.missing_skills.length > 0) {
    keyInsights.push(
      `Target role requirements not explicitly named in the resume: ${candidate.missing_skills.slice(0, 4).join(', ')}.`
    );
  } else {
    keyInsights.push(
      'All core target role requirements appear covered in the candidate’s documented experience.'
    );
  }
  if (candidate.education_summary) {
    keyInsights.push(`Academic foundation: ${candidate.education_summary}.`);
  }

  // 7. Validation Probes
  const riskOrProbeAreas: ResumeProbeArea[] = [];
  if (candidate.missing_skills.length > 0) {
    const gap = candidate.missing_skills.slice(0, 2).join(' and ');
    riskOrProbeAreas.push({
      concern: `Unverified depth in target requirement(s): ${gap}`,
      suggestedQuestion: `We noticed ${gap} isn't highlighted on your resume—what adjacent tools or similar production problems have you solved, and how would you ramp up here?`,
    });
  }
  if (metricSentences.length === 0) {
    riskOrProbeAreas.push({
      concern: 'Limited quantified production metrics or scale numbers',
      suggestedQuestion:
        'Pick your most impactful recent project—what specific before/after metrics (latency, throughput, cost, or user impact) improved because of your work?',
    });
  } else {
    riskOrProbeAreas.push({
      concern: 'Individual vs. team contribution attribution on high-impact projects',
      suggestedQuestion: `In "${metricSentences[0].slice(0, 90)}${metricSentences[0].length > 90 ? '...' : ''}", which architectural decisions were solely yours versus team-driven?`,
    });
  }

  // 8. Brief Summary & TL;DR
  const titleLabel = candidate.detected_title || candidate.role || targetRole;
  const expLabel =
    candidate.experience_years ||
    (spanYears ? `${spanYears}+ years timeline` : 'relevant experience');
  const topSkillsPhrase =
    skills.length > 0 ? skills.slice(0, 4).join(', ') : primaryDomain;

  const tldrHeadline = `${titleLabel} · ${expLabel} focused on ${topSkillsPhrase}`;

  const briefSummary = [
    `${candidate.name} presents as a ${titleLabel} (${expLabel}) with primary strength in ${primaryDomain}${skills.length > 0 ? ` (${skills.slice(0, 5).join(', ')})` : ''}.`,
    metricSentences.length > 0
      ? `Resume shows outcome-oriented delivery with ${metricSentences.length} quantified impact point(s) and aligns at ${candidate.overall_score}% for ${targetRole}.`
      : `Profile scores ${candidate.overall_score}% against the ${targetRole} rubric with solid foundational alignment.`,
    candidate.missing_skills.length > 0
      ? `Recommended focus in interview: validate hands-on depth in ${candidate.missing_skills.slice(0, 3).join(', ')}.`
      : `Ready for deeper technical architecture and role-fit calibration.`,
  ].join(' ');

  return {
    tldrHeadline,
    briefSummary,
    careerPatterns: careerPatterns.slice(0, 4),
    keyInsights: keyInsights.slice(0, 4),
    riskOrProbeAreas: riskOrProbeAreas.slice(0, 3),
    workStyleSignals: {
      seniorityCalibration: hasSeniorTitle
        ? 'Senior / Lead Trajectory'
        : spanYears && spanYears >= 3
          ? 'Mid-to-Senior IC'
          : 'Early-to-Mid IC',
      technicalDepthVsBreadth: isBroadGeneralist
        ? 'Cross-Stack Generalist'
        : `${primaryDomain} Specialist`,
      impactOrientation:
        metricSentences.length >= 2
          ? 'Metric & Outcome Driven'
          : 'Architecture & Delivery Focused',
    },
    engine: 'local-pattern-engine',
    generatedAt: new Date().toISOString(),
  };
}
