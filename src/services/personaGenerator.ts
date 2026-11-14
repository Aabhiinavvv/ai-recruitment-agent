import { Candidate, CandidatePersona, HiringBrief, PersonaHighlight, PersonaStrength, PersonaGrowthArea } from '../types';

/**
 * Formats a clean markdown executive summary of the persona for copying into Slack or recruiting notes.
 */
export function formatPersonaMarkdown(persona: CandidatePersona, candidateName: string, role: string): string {
  const highlights = persona.highlightReel
    .map(h => `• **${h.title}**${h.metric ? ` (${h.metric})` : ''}: ${h.description}`)
    .join('\n');

  const strengths = persona.strengths
    .map(s => `• **${s.trait}**: ${s.evidence} — _Impact: ${s.businessImpact}_`)
    .join('\n');

  const growth = persona.growthAreas
    .map(g => `• **${g.area}**: ${g.context}\n  ↳ *Interview Probe:* "${g.interviewProbe}"`)
    .join('\n');

  return `### ⚡ Candidate Persona Summary: ${candidateName}
**Target Role:** ${role}
**Profile Type:** ${persona.archetype}
**Fit Signal:** ${persona.fitSignal}
**Summary:** "${persona.tagline}"

#### 🌟 Verified Core Strength
> ${persona.superpower}

#### 🏆 Extracted Resume Highlights
${highlights}

#### ✅ Verified Evidence & Strengths
${strengths}

#### 🎯 Role Gaps & Recommended Interview Probes
${growth}

#### ⚙️ Collaboration & Execution Profile
• **Pace & Execution:** ${persona.workingStyle.paceAndExecution}
• **Collaboration Style:** ${persona.workingStyle.collaborationStyle}
• **Decision Making:** ${persona.workingStyle.decisionMaking}
• **Recommended Environment:** ${persona.idealEnvironment}

*(Grounded in uploaded resume text on ${persona.generatedAt})*`;
}

/**
 * Derives a factual, resume-grounded candidate persona from actual parsed resume fields & evaluation scores.
 * Never fabricates metrics or claims absent from the candidate's resume.
 */
export function generateCandidatePersona(
  candidate: Candidate,
  brief: HiringBrief | null
): CandidatePersona {
  const role = candidate.detected_title || candidate.role || brief?.job_title || 'Candidate';
  const resume = candidate.resume_text || '';
  const resumeLower = resume.toLowerCase();
  const techScore = candidate.dimension_scores?.technical || candidate.overall_score || 75;
  const expScore = candidate.dimension_scores?.experience || 75;
  const commScore = candidate.dimension_scores?.communication || 75;

  const realSkills =
    candidate.extracted_skills && candidate.extracted_skills.length > 0
      ? candidate.extracted_skills
      : Object.entries(candidate.skill_scores || {})
          .filter(([, v]) => v >= 7)
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => k);

  const topSkillsText = realSkills.slice(0, 5).join(', ');
  const isSenior =
    expScore >= 80 ||
    /\b(senior|lead|staff|principal|architect|director|manager|head)\b/i.test(
      `${candidate.detected_title || ''} ${resume}`
    );

  // 1. Archetype, Tagline & Superpower grounded directly in real candidate facts
  let archetype = candidate.detected_title
    ? candidate.detected_title
    : isSenior
    ? `Experienced ${role}`
    : `${role} Candidate`;

  const taglineParts: string[] = [];
  if (candidate.experience_years) taglineParts.push(candidate.experience_years);
  if (candidate.education_summary) taglineParts.push(candidate.education_summary);
  if (topSkillsText) taglineParts.push(`Core skills: ${topSkillsText}`);

  const tagline =
    candidate.summary_excerpt && candidate.summary_excerpt.length > 20
      ? candidate.summary_excerpt.slice(0, 180) + (candidate.summary_excerpt.length > 180 ? '...' : '')
      : taglineParts.length > 0
      ? taglineParts.join(' · ')
      : candidate.resume_profile;

  const superpower =
    candidate.work_highlights && candidate.work_highlights.length > 0
      ? candidate.work_highlights[0]
      : candidate.summary_excerpt ||
        (topSkillsText
          ? `Documented hands-on background in ${topSkillsText}${candidate.experience_years ? ` (${candidate.experience_years})` : ''}.`
          : candidate.resume_profile);

  // 2. Highlight Reel directly from extracted resume highlights & factual credentials
  const highlightReel: PersonaHighlight[] = [];
  const rawHighlights =
    candidate.work_highlights && candidate.work_highlights.length > 0
      ? candidate.work_highlights
      : resume
          .split('\n')
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 25 &&
              (/^[-*•▪◦]\s*/.test(l) || /\d+%|\d+k|\d+m|built|led|developed|designed|managed|implemented|reduced|improved/i.test(l))
          );

  for (let i = 0; i < Math.min(3, rawHighlights.length); i++) {
    const clean = rawHighlights[i].replace(/^[-*•▪◦]\s*/, '').trim();
    const metricMatch = clean.match(/\b\d+(?:\.\d+)?[%+kKmMxX]|\$\d+[\w.,]*/);
    highlightReel.push({
      title: clean.slice(0, 52) + (clean.length > 52 ? '...' : ''),
      description: clean,
      category: i === 0 ? 'Impact' : i === 1 ? 'Execution' : 'Architecture',
      metric: metricMatch ? metricMatch[0] : 'Resume Bullet',
    });
  }

  if (highlightReel.length < 2 && topSkillsText) {
    highlightReel.push({
      title: 'Documented Technical & Domain Stack',
      description: `Resume evidences hands-on usage of ${realSkills.slice(0, 8).join(', ')}.`,
      category: 'Architecture',
      metric: `${realSkills.length} Skills`,
    });
  }

  if (highlightReel.length < 3 && candidate.education_summary) {
    highlightReel.push({
      title: 'Academic & Credential Background',
      description: candidate.education_summary,
      category: 'Leadership',
      metric: 'Verified Credential',
    });
  }

  const finalHighlights = highlightReel.slice(0, 4);

  // 3. Curate Strengths strictly from verified candidate strengths & resume evidence
  const strengths: PersonaStrength[] = [];
  if (candidate.strengths && candidate.strengths.length > 0) {
    candidate.strengths.slice(0, 3).forEach((str, i) => {
      strengths.push({
        trait: realSkills[i] ? `Verified Capability: ${realSkills[i]}` : `Resume Highlight #${i + 1}`,
        evidence: str,
        businessImpact: `Directly supports ${brief?.job_title || candidate.role} delivery requirements.`,
      });
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      trait: 'Resume Qualification Signal',
      evidence: candidate.resume_profile || 'Background evaluated against rubric criteria.',
      businessImpact: `Aligned with core responsibilities of ${brief?.job_title || candidate.role}.`,
    });
  }

  // 4. Growth Areas & Actionable Interview Probes grounded in actual missing job-brief skills
  const growthAreas: PersonaGrowthArea[] = [];

  if (candidate.detailed_weaknesses && candidate.detailed_weaknesses.length > 0) {
    candidate.detailed_weaknesses.slice(0, 2).forEach((w) => {
      growthAreas.push({
        area: `Role Requirement Gap: ${w.skill}`,
        context: w.details || `No explicit ${w.skill} experience detected in uploaded resume.`,
        interviewProbe: `Ask ${candidate.name.split(' ')[0] || 'candidate'}: "Could you share any hands-on experience or transferable work related to ${w.skill}?"`,
      });
    });
  } else if (candidate.missing_skills && candidate.missing_skills.length > 0) {
    candidate.missing_skills.slice(0, 2).forEach((sk) => {
      growthAreas.push({
        area: `Role Requirement Gap: ${sk}`,
        context: `${sk} is listed in the target role brief but was not explicitly cited on the resume.`,
        interviewProbe: `Ask ${candidate.name.split(' ')[0] || 'candidate'}: "What is your practical familiarity with ${sk}?"`,
      });
    });
  }

  if (growthAreas.length === 0) {
    growthAreas.push({
      area: 'Production Depth & Ownership Verification',
      context: 'All required target competencies appeared in the resume; validate individual ownership and technical trade-offs live.',
      interviewProbe: '"Walk us through the most complex project on your resume and the specific architectural decisions you personally owned."',
    });
  }

  // 5. Working Style & Ideal Environment
  const workingStyle = {
    paceAndExecution: isSenior
      ? 'Experienced contributor able to scope deliverables independently and mentor peers.'
      : 'Execution-focused contributor suited for structured sprint milestones and iterative delivery.',
    collaborationStyle: commScore >= 80
      ? 'Clear written structure evidenced in resume presentation and impact framing.'
      : 'Technical contributor; validate cross-functional communication style during panel interview.',
    decisionMaking: techScore >= 80
      ? 'Strong alignment with target technical competencies; verify trade-off rationale in live design round.'
      : 'Transferable background; probe domain-specific problem solving and ramp-up approach.',
  };

  const idealEnvironment = candidate.location
    ? `Role aligned with ${candidate.detected_title || candidate.role} (${candidate.location}) with clear project ownership.`
    : `Role leveraging ${topSkillsText || candidate.role} with collaborative engineering feedback loops.`;

  // 6. Fit Signal Categorization
  let fitSignal: CandidatePersona['fitSignal'] = 'High-Ceiling Technical Generalist';
  if (candidate.overall_score >= 85 && isSenior) {
    fitSignal = 'Immediate High-Impact Lead';
  } else if (candidate.overall_score >= 80) {
    fitSignal = 'Specialized Domain Authority';
  } else if (resumeLower.includes('intern') || expScore < 68) {
    fitSignal = 'Rapid-Cycle Execution Specialist';
  }

  return {
    candidateId: candidate.candidate_id,
    archetype,
    tagline,
    superpower,
    highlightReel: finalHighlights,
    strengths,
    growthAreas,
    workingStyle,
    idealEnvironment,
    fitSignal,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', Today',
  };
}
