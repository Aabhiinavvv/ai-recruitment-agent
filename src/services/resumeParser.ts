import { getAliasesForSkill } from './skillsGapService';

export interface ParsedResumeData {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  location: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  summaryText: string;
  workHighlights: string;
  workHighlightBullets: string[];
  educationEntries: string[];
  experienceEntries: string[];
  detectedTitle: string;
  detectedDegree: string;
  detectedExperienceYears: string;
  extractedSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  matchRatePercent: number;
  extractedFieldCount: number;
}

const KNOWN_SKILLS_TAXONOMY: string[] = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'SQL',
  'React', 'Next.js', 'Vue.js', 'Angular', 'HTML', 'CSS', 'Tailwind CSS', 'Redux', 'GraphQL', 'REST API', 'Node.js', 'Express.js', 'FastAPI', 'Django', 'Flask', 'Spring Boot', '.NET',
  'PyTorch', 'TensorFlow', 'Scikit Learn', 'Hugging Face', 'LangChain', 'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'LLM', 'RAG', 'MLOps', 'XGBoost', 'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Airflow', 'Kafka',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Snowflake', 'BigQuery', 'DynamoDB', 'Firebase', 'Supabase',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Linux', 'Git', 'Prometheus', 'Grafana',
  'Figma', 'UI/UX', 'Design Systems', 'Product Management', 'Agile', 'Scrum', 'Jira', 'Tableau', 'Power BI', 'Excel', 'Data Analysis', 'Statistical Analysis',
  'Testing', 'Jest', 'Playwright', 'Cypress', 'Selenium', 'Pytest', 'Microservices', 'System Design', 'Cybersecurity', 'OAuth'
];

const NON_NAME_WORDS = new Set([
  'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 'objective', 'about',
  'experience', 'education', 'skills', 'projects', 'certifications', 'contact',
  'portfolio', 'github', 'linkedin', 'email', 'phone', 'address', 'page',
  'confidential', 'engineer', 'developer', 'manager', 'designer', 'analyst', 'architect',
  'consultant', 'specialist', 'director', 'intern', 'scientist', 'lead', 'senior'
]);

const SECTION_HEADING_REGEX =
  /^(?:summary|professional\s+summary|executive\s+summary|profile|about(?:\s+me)?|objective|career\s+objective|experience|work\s+experience|professional\s+experience|employment(?:\s+history)?|career\s+history|projects|key\s+projects|education|academic\s+background|skills|technical\s+skills|core\s+competencies|technologies|tools|certifications|awards|publications|languages)\b[:\s-]*$/i;

export function resumeContainsSkill(lowerText: string, skill: string): boolean {
  const aliases = getAliasesForSkill(skill);
  return aliases.some((alias) => {
    if (alias.length <= 4 || /^[a-z0-9.+#-]+$/i.test(alias)) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lowerText);
    }
    return lowerText.includes(alias);
  });
}

function cleanPossibleName(raw: string): string {
  return raw
    .replace(/^(?:name|candidate(?:\s+name)?)\s*[:\-]\s*/i, '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
    .replace(/https?:\/\/\S+|(?:www\.)?(?:linkedin|github)\.com\/\S+/gi, ' ')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?){2,4}\d{2,5}/g, ' ')
    .replace(/^[\s•·|\-—*]+|[\s•·|\-—*]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function looksLikePersonName(candidate: string): boolean {
  if (!candidate || candidate.length < 3 || candidate.length > 52) return false;
  if (/\d/.test(candidate)) return false;

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  const lowerWords = words.map((w) => w.toLowerCase().replace(/[.,'’-]/g, ''));
  if (lowerWords.some((w) => NON_NAME_WORDS.has(w))) return false;

  // Support Unicode letters, periods (middle initials), apostrophes, hyphens
  return words.every((w) => /^[\p{L}\p{M}][\p{L}\p{M}.'’-]*$/u.test(w));
}

function toTitleCaseIfAllCaps(name: string): string {
  if (name === name.toUpperCase() && /[A-Z]/.test(name)) {
    return name
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return name;
}

export function extractNameFromFileName(fileName?: string): string {
  if (!fileName) return '';
  const stem = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(resume|cv|curriculum|vitae|profile|final|updated|draft|copy|v\d+|\d{4})\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!looksLikePersonName(stem)) return '';
  return toTitleCaseIfAllCaps(stem);
}

function splitResumeSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = { header: [] };
  let current = 'header';

  for (const line of lines) {
    const cleaned = line.replace(/[:\-–—]+$/, '').trim();
    if (cleaned.length <= 45 && SECTION_HEADING_REGEX.test(cleaned)) {
      const lower = cleaned.toLowerCase();
      if (lower.includes('summary') || lower.includes('profile') || lower.includes('about') || lower.includes('objective')) {
        current = 'summary';
      } else if (lower.includes('experience') || lower.includes('employment') || lower.includes('career')) {
        current = 'experience';
      } else if (lower.includes('project')) {
        current = 'projects';
      } else if (lower.includes('education') || lower.includes('academic')) {
        current = 'education';
      } else if (lower.includes('skill') || lower.includes('technolog') || lower.includes('competenc') || lower.includes('tool')) {
        current = 'skills';
      } else {
        current = 'other';
      }
      if (!sections[current]) sections[current] = [];
      continue;
    }

    // Handle inline "Summary: ..." or "Skills: ..." headings inside a line
    const inlineMatch = line.match(/^(Summary|Profile|Objective|Skills|Technical Skills|Core Competencies|Education|Experience)\s*[:\-]\s*(.+)$/i);
    if (inlineMatch) {
      const keyRaw = inlineMatch[1].toLowerCase();
      const body = inlineMatch[2].trim();
      const key =
        keyRaw.includes('summary') || keyRaw.includes('profile') || keyRaw.includes('objective')
          ? 'summary'
          : keyRaw.includes('skill') || keyRaw.includes('competenc')
          ? 'skills'
          : keyRaw.includes('education')
          ? 'education'
          : 'experience';
      current = key;
      if (!sections[current]) sections[current] = [];
      if (body) sections[current].push(body);
      continue;
    }

    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }

  return sections;
}

export function parseResumeText(
  text: string,
  requiredSkills: string[] = [],
  fileNameHint?: string
): ParsedResumeData {
  const cleanText = text.trim();
  const lines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let candidateName = '';
  let candidateEmail = '';
  let candidatePhone = '';
  let location = '';
  let githubUrl = '';
  let linkedinUrl = '';
  let portfolioUrl = '';
  let summaryText = '';
  let workHighlights = '';
  let detectedTitle = '';
  let detectedDegree = '';
  let detectedExperienceYears = '';

  // 1. Email Extraction
  const emailMatch = cleanText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    candidateEmail = emailMatch[1].trim();
  }

  // 2. Phone Extraction (supports US & International formats, rejects year ranges like 2020 - 2024)
  const phoneCandidates = cleanText.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?|\d{2,5}[\s.-])\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{2,4})?/g) || [];
  for (const rawPhone of phoneCandidates) {
    const trimmed = rawPhone.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15 && !/^(19|20)\d{2}[\s.-]*(19|20)\d{2}$/.test(trimmed)) {
      candidatePhone = trimmed;
      break;
    }
  }

  // 3. GitHub & LinkedIn & Portfolio URLs
  const ghMatch = cleanText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (ghMatch) {
    githubUrl = ghMatch[0].startsWith('http') ? ghMatch[0] : `https://${ghMatch[0]}`;
  }

  const liMatch = cleanText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9._%-]+)/i);
  if (liMatch) {
    linkedinUrl = liMatch[0].startsWith('http') ? liMatch[0] : `https://${liMatch[0]}`;
  }

  const portMatch = cleanText.match(
    /(?:https?:\/\/)?([a-zA-Z0-9_-]+\.(?:dev|me|io|ai|tech|app|design|org)(?:\/[^\s,|]*)?)/i
  );
  if (
    portMatch &&
    !portMatch[0].toLowerCase().includes('github.com') &&
    !portMatch[0].toLowerCase().includes('linkedin.com') &&
    !cleanText.includes(`@${portMatch[0]}`)
  ) {
    portfolioUrl = portMatch[0].startsWith('http') ? portMatch[0] : `https://${portMatch[0]}`;
  }

  // 4. Candidate Name, Location, and Title Extraction from Top Lines
  const topLines = lines.slice(0, 14);

  for (let i = 0; i < topLines.length; i++) {
    const rawLine = topLines[i];
    if (/^(curriculum vitae|resume|cv|page \d+)$/i.test(rawLine)) continue;

    // Explicit "Name: ..." label
    const explicitNameMatch = rawLine.match(/^(?:Full\s+)?Name\s*[:\-]\s*(.+)$/i);
    if (explicitNameMatch) {
      const cleaned = cleanPossibleName(explicitNameMatch[1]);
      if (cleaned) {
        candidateName = toTitleCaseIfAllCaps(cleaned);
        break;
      }
    }

    // Split by separators like |, •, ·, —, -
    const segments = rawLine
      .split(/\s*(?:\||•|·|—|\s+-\s+)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      const seg = segments[sIdx];
      const cleanedSeg = cleanPossibleName(seg);
      if (!candidateName && looksLikePersonName(cleanedSeg)) {
        candidateName = toTitleCaseIfAllCaps(cleanedSeg);
        // Check adjacent segment for title or location
        const nextSeg = segments[sIdx + 1];
        if (nextSeg && !nextSeg.includes('@') && !/\d{4,}/.test(nextSeg) && nextSeg.length <= 65) {
          if (/^[A-Za-z\s.'-]+,\s*[A-Za-z\s.'-]{2,25}$/.test(nextSeg)) {
            location = location || nextSeg;
          } else if (!detectedTitle) {
            detectedTitle = nextSeg;
          }
        }
        break;
      }
    }

    if (candidateName) break;
  }

  // Fallback name from filename hint ONLY if filename looks like an actual person's name
  if (!candidateName && fileNameHint) {
    candidateName = extractNameFromFileName(fileNameHint);
  }

  // Fallback name from email local part if still empty (better than generic CAN-xxxx)
  if (!candidateName && candidateEmail) {
    const local = candidateEmail.split('@')[0].replace(/[0-9]+/g, '');
    const parts = local.split(/[._-]+/).filter((p) => p.length >= 2);
    if (parts.length >= 2) {
      candidateName = parts
        .slice(0, 3)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // Extract location from top 10 lines if not yet found
  if (!location) {
    for (const line of lines.slice(0, 10)) {
      const locMatch = line.match(
        /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)?),\s*([A-Z]{2}|India|UK|USA|United States|Canada|Germany|Australia|Singapore|Remote)\b/
      );
      if (locMatch) {
        location = locMatch[0].trim();
        break;
      }
    }
  }

  // Sections parsing
  const sections = splitResumeSections(lines);

  // 5. Title extraction
  if (!detectedTitle) {
    const titleRegex =
      /(?:Senior|Staff|Principal|Lead|Junior|Associate|Mid-Level|Chief|Head of|VP of)?\s*(?:Software|Machine Learning|AI|ML|MLOps|Frontend|Front-End|Backend|Back-End|Full[- ]Stack|DevOps|Site Reliability|SRE|Data|Cloud|Platform|Systems|Mobile|iOS|Android|Embedded|Security|QA|Test|Product|UX|UI\/UX|Design|Project|Program|Business|Financial|Research|Solutions)\s*(?:Engineer|Architect|Developer|Scientist|Analyst|Manager|Designer|Lead|Consultant|Specialist)/i;

    // Prefer checking top 8 lines first (headline directly under name)
    for (const line of lines.slice(0, 8)) {
      if (line.includes('@') || (candidateName && line.toLowerCase() === candidateName.toLowerCase())) continue;
      const m = line.match(titleRegex);
      if (m) {
        detectedTitle = m[0].trim();
        break;
      }
    }
    if (!detectedTitle) {
      const m = cleanText.match(titleRegex);
      if (m) detectedTitle = m[0].trim();
    }
  }

  // 6. Education & Degree Extraction
  const educationLines = sections.education || [];
  const educationEntries: string[] = [];
  const degreeRegex =
    /(?:Ph\.?D\.?|Doctor(?:ate)?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?B\.?A\.?|M\.?C\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?A\.?|B\.?C\.?A\.?|B\.?B\.?A\.?|B\.?Des\.?|Master(?:'s)?(?:\s+of\s+[A-Za-z\s]{2,25})?|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z\s]{2,25})?|Diploma)\s*(?:in\s+[A-Za-z\s&,]{2,40})?/i;

  for (const eduLine of educationLines) {
    if (eduLine.length > 6 && eduLine.length < 180) {
      educationEntries.push(eduLine.replace(/^[-•*▪◦]\s*/, ''));
    }
  }

  if (educationEntries.length > 0) {
    detectedDegree = educationEntries[0].slice(0, 100);
  } else {
    const degreeMatch = cleanText.match(degreeRegex);
    if (degreeMatch) {
      detectedDegree = degreeMatch[0].trim().replace(/\s+/g, ' ').slice(0, 85);
    }
  }

  // 7. Experience Years Extraction
  const expRegex =
    /(\d+(?:\.\d+)?)\+?\s*years?(?:\s+of)?(?:\s+(?:production|industry|professional|hands-on|relevant|total))?(?:\s+experience)?/i;
  const expMatch = cleanText.match(expRegex);
  if (expMatch) {
    detectedExperienceYears = `${expMatch[1]}+ years`;
  } else {
    const expSource = (sections.experience || lines).join('\n');
    const yearMatches = expSource.match(/\b(199\d|20[0-2]\d)\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const nums = yearMatches.map(Number).filter((y) => y <= new Date().getFullYear() + 1);
      if (nums.length >= 2) {
        const minYear = Math.min(...nums);
        const diff = new Date().getFullYear() - minYear;
        if (diff > 0 && diff <= 30) {
          detectedExperienceYears = `~${diff} years (since ${minYear})`;
        }
      }
    }
  }

  // 8. Real Summary Paragraph Extraction
  if (sections.summary && sections.summary.length > 0) {
    summaryText = sections.summary.join(' ').replace(/\s+/g, ' ').trim().slice(0, 420);
  }

  // 9. Real Work Highlights & Experience Entries Extraction
  const workHighlightBullets: string[] = [];
  const experienceEntries: string[] = [];
  const candidatePoolLines = [
    ...(sections.experience || []),
    ...(sections.projects || []),
    ...(sections.experience?.length || sections.projects?.length ? [] : lines),
  ];

  for (const line of candidatePoolLines) {
    const trimmed = line.trim();
    const isBullet = /^[-•*▪◦→]\s+/.test(trimmed);
    const cleanedLine = trimmed.replace(/^[-•*▪◦→]\s+/, '').trim();

    if (isBullet && cleanedLine.length >= 20 && cleanedLine.length <= 260) {
      if (workHighlightBullets.length < 6 && !workHighlightBullets.includes(cleanedLine)) {
        workHighlightBullets.push(cleanedLine);
      }
    } else if (
      !isBullet &&
      cleanedLine.length >= 10 &&
      cleanedLine.length <= 120 &&
      (/\b(199\d|20[0-2]\d)\b/.test(cleanedLine) || /present|current/i.test(cleanedLine)) &&
      experienceEntries.length < 5
    ) {
      experienceEntries.push(cleanedLine);
    }
  }

  // If resume didn't use bullet characters, pick high-signal achievement sentences from experience/projects
  if (workHighlightBullets.length === 0) {
    for (const line of candidatePoolLines) {
      if (line.includes('@')) continue;
      if (
        line.length >= 28 &&
        line.length <= 240 &&
        /%|\$|\b\d+M\b|\b\d+k\b|\b(built|developed|led|architected|designed|managed|implemented|reduced|improved|launched|created|delivered|analyzed)\b/i.test(
          line
        )
      ) {
        workHighlightBullets.push(line);
        if (workHighlightBullets.length >= 4) break;
      }
    }
  }

  workHighlights = workHighlightBullets[0] || summaryText.slice(0, 200) || '';

  // 10. Real Skills Extraction from BOTH resume's own Skills section AND full-text taxonomy scan
  const extractedSkillsSet = new Map<string, string>(); // lower -> display

  // 10a. Parse explicit Skills section tokens
  if (sections.skills && sections.skills.length > 0) {
    for (const skillLine of sections.skills) {
      const withoutCategoryLabel = skillLine.replace(/^[A-Za-z\s/&]+:\s*/, '');
      const tokens = withoutCategoryLabel
        .split(/[,|•·;/]+/)
        .map((t) => t.replace(/^[-*]\s*/, '').trim())
        .filter((t) => t.length >= 2 && t.length <= 36 && !/\d{4}/.test(t));

      for (const tok of tokens) {
        const key = tok.toLowerCase();
        if (!extractedSkillsSet.has(key)) {
          extractedSkillsSet.set(key, tok);
        }
      }
    }
  }

  // 10b. Scan entire resume against curated broad taxonomy
  const lowerText = cleanText.toLowerCase();
  for (const taxSkill of KNOWN_SKILLS_TAXONOMY) {
    if (resumeContainsSkill(lowerText, taxSkill)) {
      const key = taxSkill.toLowerCase();
      if (!extractedSkillsSet.has(key)) {
        extractedSkillsSet.set(key, taxSkill);
      }
    }
  }

  // 11. Target Job Brief Required Skills Matching
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of requiredSkills) {
    if (resumeContainsSkill(lowerText, skill)) {
      matchedSkills.push(skill);
      const key = skill.toLowerCase();
      if (!extractedSkillsSet.has(key)) {
        extractedSkillsSet.set(key, skill);
      }
    } else {
      missingSkills.push(skill);
    }
  }

  const extractedSkills = Array.from(extractedSkillsSet.values()).slice(0, 24);
  const totalSkills = requiredSkills.length;
  const matchRatePercent = totalSkills > 0 ? Math.round((matchedSkills.length / totalSkills) * 100) : 0;

  let extractedFieldCount = 0;
  if (candidateName) extractedFieldCount++;
  if (candidateEmail) extractedFieldCount++;
  if (candidatePhone) extractedFieldCount++;
  if (location) extractedFieldCount++;
  if (githubUrl) extractedFieldCount++;
  if (linkedinUrl) extractedFieldCount++;
  if (portfolioUrl) extractedFieldCount++;
  if (summaryText || workHighlights) extractedFieldCount++;
  if (detectedDegree) extractedFieldCount++;
  if (detectedExperienceYears) extractedFieldCount++;

  return {
    candidateName,
    candidateEmail,
    candidatePhone,
    location,
    githubUrl,
    linkedinUrl,
    portfolioUrl,
    summaryText,
    workHighlights,
    workHighlightBullets,
    educationEntries,
    experienceEntries,
    detectedTitle,
    detectedDegree,
    detectedExperienceYears,
    extractedSkills,
    matchedSkills,
    missingSkills,
    matchRatePercent,
    extractedFieldCount,
  };
}
