import { getAliasesForSkill } from './skillsGapService';

export interface ParsedResumeData {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workHighlights: string;
  detectedTitle: string;
  detectedDegree: string;
  detectedExperienceYears: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchRatePercent: number;
  extractedFieldCount: number;
}

export function resumeContainsSkill(lowerText: string, skill: string): boolean {
  const aliases = getAliasesForSkill(skill);
  return aliases.some((alias) => {
    if (alias.length <= 3) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerText);
    }
    return lowerText.includes(alias);
  });
}

export function parseResumeText(
  text: string,
  requiredSkills: string[] = []
): ParsedResumeData {
  const cleanText = text.trim();
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  let candidateName = '';
  let candidateEmail = '';
  let candidatePhone = '';
  let githubUrl = '';
  let linkedinUrl = '';
  let portfolioUrl = '';
  let workHighlights = '';
  let detectedTitle = '';
  let detectedDegree = '';
  let detectedExperienceYears = '';

  // 1. Email Extraction
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = cleanText.match(emailRegex);
  if (emailMatch) {
    candidateEmail = emailMatch[1].trim();
  }

  // 2. Phone Extraction
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const phoneMatch = cleanText.match(phoneRegex);
  if (phoneMatch) {
    candidatePhone = phoneMatch[0].trim();
  }

  // 3. GitHub Link Extraction
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
  const ghMatch = cleanText.match(githubRegex);
  if (ghMatch) {
    githubUrl = ghMatch[0].startsWith('http') ? ghMatch[0] : `https://${ghMatch[0]}`;
  }

  // 4. LinkedIn Link Extraction
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
  const liMatch = cleanText.match(linkedinRegex);
  if (liMatch) {
    linkedinUrl = liMatch[0].startsWith('http') ? liMatch[0] : `https://${liMatch[0]}`;
  }

  // 5. Portfolio URL Extraction (excluding github and linkedin)
  const portfolioRegex = /(?:https?:\/\/)?([a-zA-Z0-9_-]+\.(?:dev|me|io|ai|tech|app|org)(?:\/[^\s,|]*)?)/i;
  const portMatch = cleanText.match(portfolioRegex);
  if (portMatch && !portMatch[0].includes('github.com') && !portMatch[0].includes('linkedin.com')) {
    portfolioUrl = portMatch[0].startsWith('http') ? portMatch[0] : `https://${portMatch[0]}`;
  }

  // 6. Candidate Name and Title Extraction
  const topLines = lines.slice(0, 5);
  for (const line of topLines) {
    if (line.includes('@') || line.includes('github.com') || line.includes('linkedin.com')) {
      continue;
    }

    if (line.includes(' - ') || line.includes(' | ') || line.includes(' — ')) {
      const parts = line.split(/\s*[-|—]\s*/);
      if (parts[0] && parts[0].length < 45 && !parts[0].toLowerCase().includes('resume')) {
        candidateName = parts[0].replace(/^(Name:\s*)/i, '').trim();
      }
      if (parts[1] && parts[1].length < 65) {
        detectedTitle = parts[1].trim();
      }
      break;
    }

    const nameCandidate = line.replace(/^(Name:\s*|Candidate:\s*)/i, '').trim();
    const words = nameCandidate.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      words.every(w => /^[A-Za-z.'-]+$/.test(w)) &&
      !line.toLowerCase().includes('resume') &&
      !line.toLowerCase().includes('curriculum') &&
      !line.toLowerCase().includes('profile') &&
      !line.toLowerCase().includes('summary') &&
      !line.toLowerCase().includes('education') &&
      !line.toLowerCase().includes('experience') &&
      !candidateName
    ) {
      // Convert ALL CAPS names to Title Case
      candidateName = nameCandidate === nameCandidate.toUpperCase()
        ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        : nameCandidate;
      break;
    }
  }

  // Fallback candidate name from email local part if still empty
  if (!candidateName && candidateEmail) {
    const local = candidateEmail.split('@')[0].replace(/[0-9]+/g, '');
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 1) {
      candidateName = parts
        .slice(0, 3)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // If no title found from name line, search for common title patterns
  if (!detectedTitle) {
    const titleRegex = /(?:Senior|Lead|Staff|Principal|Junior|Mid-Level)?\s*(?:Software|Machine Learning|AI|ML|Frontend|Backend|Full[- ]Stack|DevOps|Data|Cloud|Platform|Systems|Research)\s*(?:Engineer|Architect|Developer|Scientist|Analyst)/i;
    const titleMatch = cleanText.match(titleRegex);
    if (titleMatch) {
      detectedTitle = titleMatch[0].trim();
    }
  }

  // 7. Degree Extraction
  const degreeRegex = /(?:Ph\.?D\.?|M\.?S\.?|B\.?S\.?|M\.?Tech\.?|B\.?Tech\.?|Master(?:'s)?\s+(?:of\s+Science)?|Bachelor(?:'s)?\s+(?:of\s+Science)?)\s*(?:in\s+[A-Za-z\s]{2,32})?/i;
  const degreeMatch = cleanText.match(degreeRegex);
  if (degreeMatch) {
    detectedDegree = degreeMatch[0].trim().replace(/\n/g, ' ').slice(0, 48);
  }

  // 8. Experience Years Extraction
  const expRegex = /(\d+(?:\.\d+)?)\+?\s*years?(?:\s+of)?(?:\s+production|\s+industry|\s+professional|\s+experience)/i;
  const expMatch = cleanText.match(expRegex);
  if (expMatch) {
    detectedExperienceYears = `${expMatch[1]}+ years`;
  } else {
    const years = cleanText.match(/\b(20[0-2][0-9])\b/g);
    if (years && years.length >= 2) {
      const numYears = years.map(Number);
      const minYear = Math.min(...numYears);
      const currentYear = new Date().getFullYear();
      const diff = currentYear - minYear;
      if (diff > 0 && diff <= 25) {
        detectedExperienceYears = `~${diff} years (since ${minYear})`;
      }
    }
  }

  // 9. Work Highlights Extraction
  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ');
    if (isBullet) {
      const content = trimmed.replace(/^[-•*]\s*/, '');
      const hasMetrics = /%|\$|\b\d+M\b|\b\d+k\b|reduced|architected|increased|deployed|improved|spearheaded|built|designed|led/i.test(content);
      if (hasMetrics && content.length > 25 && content.length < 220) {
        workHighlights = content;
        break;
      }
    }
  }

  if (!workHighlights) {
    const summaryIndex = lines.findIndex(l => /SUMMARY|OVERVIEW|OBJECTIVE|ABOUT/i.test(l));
    if (summaryIndex !== -1 && lines[summaryIndex + 1]) {
      workHighlights = lines[summaryIndex + 1].slice(0, 180);
    }
  }

  // 10. Required Skills Matching (with synonym support)
  const lowerText = cleanText.toLowerCase();
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of requiredSkills) {
    if (resumeContainsSkill(lowerText, skill)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const totalSkills = requiredSkills.length;
  const matchRatePercent = totalSkills > 0 ? Math.round((matchedSkills.length / totalSkills) * 100) : 0;

  let extractedFieldCount = 0;
  if (candidateName) extractedFieldCount++;
  if (candidateEmail) extractedFieldCount++;
  if (candidatePhone) extractedFieldCount++;
  if (githubUrl) extractedFieldCount++;
  if (linkedinUrl) extractedFieldCount++;
  if (portfolioUrl) extractedFieldCount++;
  if (workHighlights) extractedFieldCount++;
  if (detectedDegree) extractedFieldCount++;
  if (detectedExperienceYears) extractedFieldCount++;

  return {
    candidateName,
    candidateEmail,
    candidatePhone,
    githubUrl,
    linkedinUrl,
    portfolioUrl,
    workHighlights,
    detectedTitle,
    detectedDegree,
    detectedExperienceYears,
    matchedSkills,
    missingSkills,
    matchRatePercent,
    extractedFieldCount
  };
}
