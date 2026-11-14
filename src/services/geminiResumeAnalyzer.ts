import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { ResumeAIInsights } from '../types/index.ts';

let sharedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets.'
    );
  }
  if (!sharedClient) {
    sharedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedClient;
}

export interface AnalyzeResumeInput {
  candidateName: string;
  resumeText: string;
  targetRole: string;
  jobDescription?: string;
  requiredSkills?: string[];
  experienceYears?: string;
  educationSummary?: string;
  overallScore?: number;
}

const VALID_CATEGORIES = new Set([
  'Trajectory',
  'Depth vs Breadth',
  'Ownership & Impact',
  'Specialization',
  'Consistency',
  'Leadership',
]);

const VALID_SIGNALS = new Set(['positive', 'neutral', 'watch']);

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return new Error(
      'Gemini API key is invalid or not set. Please check your API key in the Settings > Secrets panel.'
    );
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return new Error(
      'Gemini API quota exceeded. Please try again shortly or check your billing key in Settings > Secrets.'
    );
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return new Error('Selected AI model is currently unavailable. Please verify model configuration.');
  }
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message;
    if (typeof msg === 'string' && msg.trim()) {
      return new Error(msg.trim());
    }
  } catch {
    // raw was not JSON
  }
  return err instanceof Error ? err : new Error(raw || 'Failed to synthesize resume insights.');
}

export async function analyzeResumeWithGemini(
  input: AnalyzeResumeInput
): Promise<ResumeAIInsights> {
  const ai = getGeminiClient();
  const model = 'gemini-4-hydrogen';

  const trimmedResume = (input.resumeText || '').trim().slice(0, 18000);
  if (!trimmedResume) {
    throw new Error('Resume text is empty; cannot generate AI summary and patterns.');
  }

  const prompt = [
    `Analyze the following candidate resume against the target role using deep recruiter reasoning.`,
    `Do NOT merely paraphrase or copy bullet points. Synthesize a crisp brief summary, uncover hidden career and behavioral patterns across roles/dates/projects, and deliver actionable recruiter insights.`,
    ``,
    `Target Role: ${input.targetRole || 'Software / AI Engineer'}`,
    input.requiredSkills?.length
      ? `Target Required Skills: ${input.requiredSkills.join(', ')}`
      : '',
    input.jobDescription
      ? `Target Job Description Excerpt:\n${input.jobDescription.slice(0, 2200)}`
      : '',
    ``,
    `Candidate Name: ${input.candidateName || 'Candidate'}`,
    input.experienceYears ? `Detected Experience: ${input.experienceYears}` : '',
    input.educationSummary ? `Detected Education: ${input.educationSummary}` : '',
    typeof input.overallScore === 'number'
      ? `Rubric Baseline Score: ${input.overallScore}%`
      : '',
    ``,
    `--- CANDIDATE RESUME TEXT ---`,
    trimmedResume,
    `--- END RESUME TEXT ---`,
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    response = await withRetry(() =>
      ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert executive technical recruiter and talent intelligence analyst. ' +
          'Read the resume analytically to synthesize: ' +
          '(1) a crisp one-line tldrHeadline (max 15 words), ' +
          '(2) a concise 2-3 sentence briefSummary capturing the candidate career arc, measurable impact level, and fit for the target role (avoid generic filler and never invent facts not present in the resume), ' +
          '(3) 3 to 4 non-obvious careerPatterns (look for trajectory velocity, tenure stability vs frequent switches, generalist breadth vs specialist depth, quantified impact orientation, hands-on architecture vs coordination/leadership, domain pivots), each with grounded evidence from the resume and a signal ("positive", "neutral", or "watch"), ' +
          '(4) 3 to 4 sharp actionable keyInsights for the hiring team, ' +
          '(5) 2 to 3 riskOrProbeAreas pairing a specific observation or gap with a concrete interview question, and ' +
          '(6) concise workStyleSignals (seniorityCalibration, technicalDepthVsBreadth, impactOrientation). ' +
          'Every factual reference (skills, companies, years, metrics, degrees) must come strictly from the provided resume text.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tldrHeadline: {
              type: Type.STRING,
              description: 'Crisp single-line executive positioning headline (under 15 words).',
            },
            briefSummary: {
              type: Type.STRING,
              description:
                'Brief 2-3 sentence executive summary synthesizing career arc, core strength, and target role fit.',
            },
            careerPatterns: {
              type: Type.ARRAY,
              description: '3 to 4 analytical patterns detected across the resume.',
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description:
                      'One of: Trajectory, Depth vs Breadth, Ownership & Impact, Specialization, Consistency, Leadership',
                  },
                  pattern: {
                    type: Type.STRING,
                    description: 'Short pattern title (3-6 words).',
                  },
                  insight: {
                    type: Type.STRING,
                    description: 'What this pattern reveals about how the candidate operates.',
                  },
                  evidence: {
                    type: Type.STRING,
                    description: 'Short grounded citation from the resume.',
                  },
                  signal: {
                    type: Type.STRING,
                    description: 'One of: positive, neutral, watch',
                  },
                },
                required: ['category', 'pattern', 'insight', 'evidence', 'signal'],
              },
            },
            keyInsights: {
              type: Type.ARRAY,
              description: '3 to 4 high-signal recruiter insights derived from connecting resume dots.',
              items: { type: Type.STRING },
            },
            riskOrProbeAreas: {
              type: Type.ARRAY,
              description: '2 to 3 areas to validate or probe during interview.',
              items: {
                type: Type.OBJECT,
                properties: {
                  concern: {
                    type: Type.STRING,
                    description: 'Observation, ambiguity, or gap worth validating.',
                  },
                  suggestedQuestion: {
                    type: Type.STRING,
                    description: 'Targeted interview question to verify this area.',
                  },
                },
                required: ['concern', 'suggestedQuestion'],
              },
            },
            workStyleSignals: {
              type: Type.OBJECT,
              properties: {
                seniorityCalibration: {
                  type: Type.STRING,
                  description: 'Calibrated level signal (e.g., Mid-Level IC, Senior IC, Staff/Lead).',
                },
                technicalDepthVsBreadth: {
                  type: Type.STRING,
                  description: 'Assessment of deep specialist vs full-stack generalist balance.',
                },
                impactOrientation: {
                  type: Type.STRING,
                  description: 'How outcomes are framed (metric-driven, product-focused, research-led, etc.).',
                },
              },
              required: [
                'seniorityCalibration',
                'technicalDepthVsBreadth',
                'impactOrientation',
              ],
            },
          },
          required: [
            'tldrHeadline',
            'briefSummary',
            'careerPatterns',
            'keyInsights',
            'riskOrProbeAreas',
            'workStyleSignals',
          ],
        },
      },
    })
    );
  } catch (err: unknown) {
    throw formatGeminiError(err);
  }

  const rawJson = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawJson) as Partial<ResumeAIInsights>;

  const normalizedPatterns = Array.isArray(parsed.careerPatterns)
    ? parsed.careerPatterns.slice(0, 5).map((item) => ({
        category: (VALID_CATEGORIES.has(item?.category)
          ? item.category
          : 'Trajectory') as ResumeAIInsights['careerPatterns'][number]['category'],
        pattern: String(item?.pattern || 'Career Pattern').trim(),
        insight: String(item?.insight || '').trim(),
        evidence: String(item?.evidence || '').trim(),
        signal: (VALID_SIGNALS.has(item?.signal)
          ? item.signal
          : 'neutral') as 'positive' | 'neutral' | 'watch',
      }))
    : [];

  return {
    tldrHeadline: String(parsed.tldrHeadline || `${input.candidateName} — ${input.targetRole}`).trim(),
    briefSummary: String(parsed.briefSummary || '').trim(),
    careerPatterns: normalizedPatterns,
    keyInsights: Array.isArray(parsed.keyInsights)
      ? parsed.keyInsights.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [],
    riskOrProbeAreas: Array.isArray(parsed.riskOrProbeAreas)
      ? parsed.riskOrProbeAreas
          .map((p) => ({
            concern: String(p?.concern || '').trim(),
            suggestedQuestion: String(p?.suggestedQuestion || '').trim(),
          }))
          .filter((p) => p.concern && p.suggestedQuestion)
          .slice(0, 4)
      : [],
    workStyleSignals: {
      seniorityCalibration: String(
        parsed.workStyleSignals?.seniorityCalibration || 'Requires interview calibration'
      ).trim(),
      technicalDepthVsBreadth: String(
        parsed.workStyleSignals?.technicalDepthVsBreadth || 'Balanced technical profile'
      ).trim(),
      impactOrientation: String(
        parsed.workStyleSignals?.impactOrientation || 'Execution-oriented'
      ).trim(),
    },
    engine: model,
    generatedAt: new Date().toISOString(),
  };
}
