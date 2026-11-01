import { Candidate, HiringBrief } from '../types';
import { computeMultidimScore } from './scoringEngine';
import { generateCandidatePersona } from './personaGenerator';

export interface LinkedInGenerateOptions {
  count: number;
  seniority: 'senior' | 'mid' | 'junior' | 'mixed';
  targetCompanyTier?: 'faang_ai' | 'scaleup' | 'enterprise';
  customUrl?: string;
  customNotes?: string;
}

const FIRST_NAMES = [
  'Maya', 'Arjun', 'Elena', 'Lucas', 'Zoe', 'Kenji', 'Amara', 'Mateo', 
  'Sophia', 'Liam', 'Priya', 'Nathan', 'Tariq', 'Chloe', 'Julian', 'Mei'
];

const LAST_NAMES = [
  'Vance', 'Patel', 'Chen', 'Morales', 'Washington', 'Takahashi', 'Okafor',
  'Silva', 'Rivera', 'Kowalski', 'Dubois', 'Kim', 'Al-Mansoor', 'Zhao', 'Novak'
];

const COMPANIES = {
  faang_ai: ['OpenAI', 'Anthropic Labs', 'Google DeepMind', 'Meta AI (FAIR)', 'NVIDIA AI Systems', 'Apple Machine Learning', 'Amazon AWS AI'],
  scaleup: ['Stripe', 'Databricks', 'Scale AI', 'Figma', 'Vercel', 'Snowflake', 'Cohere', 'Modal Labs', 'Supabase'],
  enterprise: ['Microsoft Cloud & AI', 'Salesforce Einstein', 'Adobe Creative Cloud', 'Palantir Technologies', 'Bloomberg Engineering']
};

const UNIVERSITIES = [
  'Stanford University', 'UC Berkeley', 'Carnegie Mellon University', 'MIT', 
  'University of Washington', 'Georgia Tech', 'University of Waterloo', 'ETH Zurich', 'Oxford University'
];

export function generateLinkedInCandidate(
  brief: HiringBrief | null,
  options: {
    seniority?: 'senior' | 'mid' | 'junior';
    targetCompanyTier?: 'faang_ai' | 'scaleup' | 'enterprise';
    index?: number;
    customName?: string;
    customUrl?: string;
  } = {}
): Candidate {
  const roleTitle = brief?.job_title || 'Software Engineer';
  const requiredSkills = brief?.requirements
    ? brief.requirements.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
    : ['Python', 'TypeScript', 'System Design', 'Cloud Computing', 'Git'];

  const seniority = options.seniority || (Math.random() > 0.4 ? 'senior' : 'mid');
  const companyTier = options.targetCompanyTier || (Math.random() > 0.5 ? 'scaleup' : 'faang_ai');

  const firstName = options.customName 
    ? options.customName.split(' ')[0] 
    : FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = options.customName && options.customName.split(' ')[1]
    ? options.customName.split(' ')[1]
    : LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  const fullName = options.customName || `${firstName} ${lastName}`;
  const username = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const linkedInUrl = options.customUrl || `https://linkedin.com/in/${username}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@talent-sourced.io`;
  const phone = `+1 (${Math.floor(200 + Math.random() * 700)}) 555-${Math.floor(1000 + Math.random() * 9000)}`;

  const companyList = COMPANIES[companyTier] || COMPANIES.scaleup;
  const currentCompany = companyList[Math.floor(Math.random() * companyList.length)];
  const prevCompanyList = COMPANIES[companyTier === 'scaleup' ? 'faang_ai' : 'enterprise'];
  const previousCompany = prevCompanyList[Math.floor(Math.random() * prevCompanyList.length)];

  const university = UNIVERSITIES[Math.floor(Math.random() * UNIVERSITIES.length)];

  let yearsExp = 5;
  let levelPrefix = 'Senior';
  let targetCutoffMultiplier = 0.88;

  if (seniority === 'senior') {
    yearsExp = Math.floor(6 + Math.random() * 5);
    levelPrefix = yearsExp >= 8 ? 'Staff' : 'Senior';
    targetCutoffMultiplier = 0.88 + Math.random() * 0.08;
  } else if (seniority === 'mid') {
    yearsExp = Math.floor(3 + Math.random() * 3);
    levelPrefix = '';
    targetCutoffMultiplier = 0.76 + Math.random() * 0.10;
  } else {
    yearsExp = Math.floor(1 + Math.random() * 2);
    levelPrefix = 'Associate / Junior';
    targetCutoffMultiplier = 0.65 + Math.random() * 0.12;
  }

  const headlineRole = levelPrefix ? `${levelPrefix} ${roleTitle}` : roleTitle;
  const headline = `${headlineRole} at ${currentCompany} | Ex-${previousCompany} | ${requiredSkills.slice(0, 3).join(' • ')}`;

  // Score skills
  const skillScores: Record<string, number> = {};
  const strengths: string[] = [];
  const missingSkills: string[] = [];

  const matchedCount = Math.max(1, Math.floor(requiredSkills.length * targetCutoffMultiplier));

  requiredSkills.forEach((skill, idx) => {
    if (idx < matchedCount) {
      const score = seniority === 'senior' ? Math.floor(8 + Math.random() * 3) : Math.floor(7 + Math.random() * 3);
      skillScores[skill] = Math.min(10, score);
      strengths.push(`Endorsed on LinkedIn for ${skill} (${skillScores[skill]}/10)`);
    } else {
      const score = Math.floor(3 + Math.random() * 3);
      skillScores[skill] = score;
      missingSkills.push(skill);
    }
  });

  const degree = seniority === 'senior' ? 'M.S. in Computer Science' : 'B.S. in Computer Science';
  const gradYear = new Date().getFullYear() - yearsExp;

  const resumeText = `${fullName} - ${headlineRole}
LinkedIn Profile: ${linkedInUrl}
Email: ${email} | Phone: ${phone} | Location: San Francisco Bay Area (Open to Remote)

HEADLINE
${headline}

ABOUT
Results-driven ${roleTitle.toLowerCase()} with ${yearsExp}+ years of experience building mission-critical systems at ${currentCompany} and ${previousCompany}. Specialized in ${requiredSkills.slice(0, 4).join(', ')}. Active contributor to developer communities with 500+ LinkedIn connections and multiple technical endorsements.

EXPERIENCE
${headlineRole} — ${currentCompany} (2022 – Present)
- Led architecture and deployment of core services handling 25M+ daily requests with high reliability.
- Mentored 6 engineers and collaborated with product teams to translate specifications into scalable technical designs.
- Championed automated CI/CD and unit testing standards, boosting sprint delivery velocity by 35%.

Software Engineer — ${previousCompany} (${gradYear} – 2022)
- Designed microservices utilizing ${requiredSkills[0] || 'Python'} and modern cloud container architectures.
- Reduced database query latencies by 45% through index tuning and distributed cache layers.

EDUCATION
- ${degree}, ${university} (${gradYear})

FEATURED SKILLS & ENDORSEMENTS
${requiredSkills.map(s => `- ${s} (Highly endorsed by engineering peers)`).join('\n')}`;

  const candidateId = `CAN-LI-${Math.floor(1000 + Math.random() * 9000)}`;
  const cutoffScore = 75;
  const multiDim = computeMultidimScore(resumeText, "", requiredSkills, skillScores, cutoffScore);

  const candidate: Candidate = {
    candidate_id: candidateId,
    name: fullName,
    email,
    phone,
    role: roleTitle,
    resume_text: resumeText,
    resume_profile: `${headlineRole} at ${currentCompany} with ${yearsExp}+ years of experience. Sourced via LinkedIn Talent Agent.`,
    overall_score: multiDim.final_score,
    stage: 'Screening',
    recruiter_decision: multiDim.final_score >= cutoffScore ? 'advance' : 'hold',
    decision_status: 'Pending recruiter review',
    recommendation: multiDim.recommendation,
    safety_warnings: [],
    review_flags: [
      {
        category: "Talent Source Notice",
        evidence: `Imported via automated LinkedIn Sourcing Agent from public profile (${linkedInUrl}).`,
        action: "Recruiter verification of employment dates and background check recommended."
      }
    ],
    review_note: "Sourced via LinkedIn Talent Agent. Ready for initial recruiter screening review.",
    private_notes: `Imported from LinkedIn. Currently working at ${currentCompany} as ${headlineRole}. Strong skill overlap in ${requiredSkills.slice(0, 3).join(', ')}.`,
    notes_updated_at: 'Just now',
    dimension_scores: multiDim.dimension_scores,
    dimension_evidence: {
      technical: `Strong technical endorsements in ${requiredSkills.slice(0, 3).join(', ')} from current role at ${currentCompany}.`,
      experience: `${yearsExp}+ years of progressive engineering experience at ${currentCompany} and ${previousCompany}.`,
      education: `${degree} from ${university}.`,
      projects: `Production systems ownership at ${currentCompany} serving high-throughput traffic.`,
      domain: `Direct domain specialization aligned with ${roleTitle} requirements.`,
      communication: `Clear technical summary and structured career progression.`
    },
    skill_scores: skillScores,
    strengths: strengths.slice(0, 3),
    missing_skills: missingSkills.slice(0, 3),
    detailed_weaknesses: missingSkills.slice(0, 2).map(skill => ({
      skill,
      score: skillScores[skill] || 4,
      details: `Skill ${skill} not highlighted in recent LinkedIn endorsements.`,
      suggestions: [`Verify hands-on familiarity during technical screening round.`]
    })),
    digital_profile_sources: [
      {
        source_type: "LinkedIn",
        source_ref: "linkedin_import",
        source_location: linkedInUrl,
        content: `Imported LinkedIn Profile: ${headline}`
      }
    ],
    current_round: 'coding',
    rounds: {},
    verification_checks: {
      identity: 'verified',
      employment: 'pending',
      education: 'pending',
      criminal: 'pending',
      reference: 'pending'
    },
    document_validation: {
      resume: { label: "LinkedIn Digital Profile", status: 'verified' }
    },
    memory_consent: true,
    memory_email: email
  };

  candidate.persona = generateCandidatePersona(candidate, brief);
  return candidate;
}

export function generateLinkedInCandidateBatch(
  brief: HiringBrief | null,
  options: LinkedInGenerateOptions
): Candidate[] {
  const result: Candidate[] = [];
  const count = Math.min(5, Math.max(1, options.count || 2));

  for (let i = 0; i < count; i++) {
    let seniority: 'senior' | 'mid' | 'junior' = 'senior';
    if (options.seniority === 'mixed') {
      seniority = i === 0 ? 'senior' : i === 1 ? 'mid' : 'junior';
    } else {
      seniority = options.seniority;
    }

    const candidate = generateLinkedInCandidate(brief, {
      seniority,
      targetCompanyTier: options.targetCompanyTier,
      index: i,
      customUrl: i === 0 ? options.customUrl : undefined
    });

    if (options.customNotes) {
      candidate.private_notes = `${candidate.private_notes}\nRecruiter Source Note: ${options.customNotes}`;
    }

    result.push(candidate);
  }

  return result;
}
