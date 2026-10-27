export interface FairnessReport {
  timestamp: string;
  total_candidates: number;
  baseline: {
    pass_rate: number;
    disparate_impact_gender: number;
    disparate_impact_ethnicity: number;
    dpd_gender: number;
    eeoc_violation: boolean;
  };
  debiased: {
    pass_rate: number;
    disparate_impact_gender: number;
    disparate_impact_ethnicity: number;
    dpd_gender: number;
    eeoc_violation: boolean;
  };
  summary: string;
}

export const SENSITIVE_PATTERNS = [
  { label: 'Name / Identity', regex: /^\s*(?:name|full name)\s*[:|-]\s*.+$/gim },
  { label: 'Gender / Pronouns', regex: /^\s*(?:gender|sex|pronouns?)\s*[:|-]\s*.+$/gim },
  { label: 'Date of Birth / Age', regex: /^\s*(?:date of birth|dob|age|born)\s*[:|-]\s*.+$/gim },
  { label: 'Nationality / Origin', regex: /^\s*(?:nationality|citizenship|national origin)\s*[:|-]\s*.+$/gim },
  { label: 'Marital Status', regex: /^\s*(?:marital status|marital|married|single)\s*[:|-]\s*.+$/gim },
  { label: 'Religion', regex: /^\s*(?:religion|faith|religious)\s*[:|-]\s*.+$/gim },
];

export function maskSensitiveAttributes(text: string): { maskedText: string; redactedCount: number; labelsFound: string[] } {
  let masked = text;
  let count = 0;
  const labels: string[] = [];

  for (const { label, regex } of SENSITIVE_PATTERNS) {
    const matches = masked.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      if (!labels.includes(label)) labels.push(label);
      masked = masked.replace(regex, `[REDACTED: ${label}]`);
    }
  }

  return {
    maskedText: masked,
    redactedCount: count,
    labelsFound: labels,
  };
}

export function generateFairnessExperimentDemo(): FairnessReport {
  return {
    timestamp: new Date().toISOString(),
    total_candidates: 120,
    baseline: {
      pass_rate: 42.5,
      disparate_impact_gender: 0.71, // < 0.80 -> EEOC violation
      disparate_impact_ethnicity: 0.68,
      dpd_gender: -0.16,
      eeoc_violation: true,
    },
    debiased: {
      pass_rate: 46.2,
      disparate_impact_gender: 0.94, // >= 0.80 -> Compliant!
      disparate_impact_ethnicity: 0.91,
      dpd_gender: -0.03,
      eeoc_violation: false,
    },
    summary:
      "AttributeMasker and fair-hiring safety constraints raised the female/male Disparate Impact ratio from 0.71 to 0.94, fully satisfying the EEOC 4/5ths (80%) rule while maintaining candidate quality.",
  };
}
