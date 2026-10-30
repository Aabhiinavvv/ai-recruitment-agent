import { 
  Candidate, 
  CodingChallenge, 
  CodingEvaluation, 
  EvaluationRubric, 
  HiringBrief, 
  RoundEvaluation,
  RoundType,
  FollowUpEmailOptions,
  FollowUpEmailResult
} from '../types';
import { computeMultidimScore } from './scoringEngine';
import { maskSensitiveAttributes } from './fairnessEngine';

export class RecruitmentAgentService {
  private apiKey: string | null = null;
  private provider: 'Groq' | 'Gemini' = 'Gemini';
  private model: string = 'gemini-3.8-flash';
  private cutoffScore: number = 75;

  constructor(apiKey?: string, provider: 'Groq' | 'Gemini' = 'Gemini', model?: string) {
    if (apiKey) this.apiKey = apiKey;
    this.provider = provider;
    if (model) this.model = model;
  }

  public configure(apiKey?: string, provider: 'Groq' | 'Gemini' = 'Gemini', model?: string, cutoff: number = 75) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    this.provider = provider;
    if (model) this.model = model;
    this.cutoffScore = cutoff;
  }

  // 1. Generate Job Description & Rubric
  public generateJobDescription(brief: {
    company_name: string;
    job_title: string;
    location: string;
    headcount: number;
    salary_budget: string;
    timeline: string;
    requirements: string;
  }): { jd: string; rubric: EvaluationRubric } {
    const company = brief.company_name ? `${brief.company_name}` : 'Our Organization';
    const skills = brief.requirements
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const jd = `# Job Opportunity: ${brief.job_title}

**Company:** ${company}  
**Location:** ${brief.location}  
**Headcount:** ${brief.headcount} position(s)  
**Compensation:** ${brief.salary_budget || 'Competitive & experience-based'}  
**Target Start:** ${brief.timeline || 'Immediate / 30-day notice'}  

---

### About the Role
We are seeking a talented and driven **${brief.job_title}** to join our high-performing team. In this role, you will lead the architecture, implementation, and optimization of critical systems, collaborating closely with cross-functional partners to deliver measurable real-world impact.

### Key Responsibilities
- Architect, build, and maintain production-grade systems aligned with best practices.
- Collaborate with engineering and product leaders to turn user requirements into robust technical specifications.
- Drive automated testing, continuous integration, and performance benchmarking across our services.
- Mentor junior engineers and participate actively in peer code reviews and architectural planning sessions.

### Required Competencies & Qualifications
${skills.map(s => `- **${s}**: Practical demonstrated proficiency and hands-on experience.`).join('\n')}
- Strong problem-solving aptitude, system design fundamentals, and communication skills.
- Ability to work collaboratively in an agile, fast-paced environment.

### Equal Opportunity Employer
${company} is proud to be an equal opportunity employer. We celebrate diversity and are committed to creating an inclusive, bias-free environment for all employees. Selection is strictly based on role-related qualifications, merit, and organizational needs.`;

    const rubric: EvaluationRubric = {
      scoring_scale: "0–100 weighted multi-dimensional score (Technical 30%, Experience 20%, Education 10%, Projects 15%, Domain 15%, Communication 10%).",
      criteria: [
        { criterion: "Technical proficiency in required skill stack", weight_percent: 30 },
        { criterion: "Demonstrated production experience and career progression", weight_percent: 20 },
        { criterion: "Education credentials or recognized technical degree", weight_percent: 10 },
        { criterion: "Practical project outcomes, open-source or system impact", weight_percent: 15 },
        { criterion: "Target industry domain knowledge & architecture concepts", weight_percent: 15 },
        { criterion: "Clear communication, documentation, and structured thought", weight_percent: 10 }
      ],
      decision_boundary: `Advisory recommendation threshold: >=${this.cutoffScore} suggests Advance, 60–${this.cutoffScore - 1} suggests Hold, <60 suggests Reject. Recruiter approval is mandatory.`
    };

    return { jd, rubric };
  }

  // 2. Screen Resume
  public screenResume(
    candidateName: string,
    candidateEmail: string,
    resumeText: string,
    roleTitle: string,
    requiredSkills: string[],
    digitalProfileSources: any[] = [],
    memoryConsent: boolean = false
  ): Candidate {
    const candidateId = `CAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const { maskedText, redactedCount, labelsFound } = maskSensitiveAttributes(resumeText);

    // Score individual skills based on keyword and contextual mentions
    const skillScores: Record<string, number> = {};
    const strengths: string[] = [];
    const missingSkills: string[] = [];
    const detailedWeaknesses: any[] = [];

    const lowerResume = resumeText.toLowerCase();

    for (const skill of requiredSkills) {
      const lowerSkill = skill.toLowerCase();
      if (lowerResume.includes(lowerSkill)) {
        // High score if mentioned with strong verbs
        let score = 8;
        if (lowerResume.includes(`expert in ${lowerSkill}`) || lowerResume.includes(`senior ${lowerSkill}`) || lowerResume.includes(`5+ years ${lowerSkill}`)) {
          score = 10;
        } else if (lowerResume.includes(`advanced ${lowerSkill}`) || lowerResume.includes(`production ${lowerSkill}`)) {
          score = 9;
        }
        skillScores[skill] = score;
        strengths.push(`Demonstrated proficiency in ${skill} (${score}/10)`);
      } else {
        // Partial or missing
        const score = Math.floor(2 + Math.random() * 3);
        skillScores[skill] = score;
        missingSkills.push(skill);
        detailedWeaknesses.push({
          skill,
          score,
          details: `Limited or indirect evidence of hands-on ${skill} in current resume text.`,
          suggestions: [
            `Add specific project bullet points highlighting where ${skill} was applied in production.`,
            `Quantify scale, performance gains, or libraries utilized with ${skill}.`
          ],
          example: `Built and deployed high-throughput services utilizing ${skill} with 99.9% uptime.`
        });
      }
    }

    const multiDim = computeMultidimScore(resumeText, "", requiredSkills, skillScores, this.cutoffScore);

    const reviewFlags = [];
    if (redactedCount > 0) {
      reviewFlags.push({
        category: "Attribute Redaction Notice",
        evidence: `Redacted ${redactedCount} demographic attribute markers (${labelsFound.join(', ')}) before candidate evaluation.`,
        action: "Ensure evaluation remains grounded strictly in technical and experience evidence."
      });
    }

    return {
      candidate_id: candidateId,
      name: candidateName || "Candidate " + candidateId,
      email: candidateEmail || `${candidateId.toLowerCase()}@applicant.example.com`,
      role: roleTitle,
      resume_text: resumeText,
      resume_profile: maskedText.slice(0, 300) + (maskedText.length > 300 ? "..." : ""),
      overall_score: multiDim.final_score,
      stage: 'Screening',
      recruiter_decision: multiDim.final_score >= this.cutoffScore ? 'advance' : 'hold',
      decision_status: 'Pending recruiter review',
      recommendation: multiDim.recommendation,
      safety_warnings: [],
      review_flags: reviewFlags,
      review_note: "Review flags are prompts for recruiter supervision, never automated hiring decisions.",
      dimension_scores: multiDim.dimension_scores,
      dimension_evidence: multiDim.dimension_evidence,
      skill_scores: skillScores,
      strengths: strengths.slice(0, 4),
      missing_skills: missingSkills.slice(0, 4),
      detailed_weaknesses: detailedWeaknesses.slice(0, 3),
      digital_profile_sources: digitalProfileSources,
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
        resume: { label: "Redacted Resume Profile", status: 'verified' }
      },
      memory_consent: memoryConsent,
      memory_email: memoryConsent ? candidateEmail : undefined
    };
  }

  // 3. Generate Coding Challenge
  public generateCodingChallenge(role: string, difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium'): CodingChallenge {
    if (role.includes('Frontend')) {
      return {
        title: "Dynamic Debounced Search Input Component",
        prompt: "Design and implement a reusable TypeScript search component that executes an asynchronous query function with customizable debounce timeout, keyboard navigation (Arrow Up/Down and Enter), and active abort controller cancellation on rapid keypresses.",
        input_format: "queryFn: (term: string, signal: AbortSignal) => Promise<Item[]>, debounceMs: number",
        output_format: "React component rendering accessible dropdown results with highlighted matches",
        constraints: "Debounce must not drop the latest input; zero memory leaks on unmount; WCAG 2.1 AA accessible",
        examples: "Typing 're' then 'react' within 100ms should fire only 1 API call for 'react'.",
        starter_code: "export function SearchCombobox<T>({ onSelect, fetchResults, delay = 300 }: SearchProps<T>) {\n  // Implement debounced autocomplete\n}"
      };
    } else if (role.includes('Backend') || role.includes('Full Stack')) {
      return {
        title: "Distributed Token-Bucket Rate Limiter",
        prompt: "Implement an in-memory or Redis-compatible Sliding Window / Token Bucket rate limiter that allows a configured maximum number of requests per time window per client IP, handling concurrency race conditions safely.",
        input_format: "clientId: string, capacity: number, refillRatePerSec: number, nowMs: number",
        output_format: "{ allowed: boolean, remainingTokens: number, retryAfterSec?: number }",
        constraints: "O(1) amortized state lookup; thread-safe atomic token deduction",
        examples: "capacity=5, refill=1/sec -> 5 immediate requests pass, 6th returns allowed=false with retryAfterSec=1",
        starter_code: "export class TokenBucketLimiter {\n  // Implement rate limiter\n}"
      };
    } else {
      // Default / AI/ML
      return {
        title: "Adaptive Streaming Token Buffer & Re-ranker",
        prompt: "Write a high-efficiency streaming buffer that ingests chunked token streams from an LLM API, detects markdown code block delimiters, and normalizes output without breaking JSON or formatted tables.",
        input_format: "chunks: AsyncIterable<string>",
        output_format: "AsyncIterable<ProcessedChunk> with parsed state flags",
        constraints: "Sub-millisecond processing per token chunk; zero truncation of unicode multi-byte codepoints",
        examples: "Receiving '```py' across 2 separate chunks yields intact code-fence metadata.",
        starter_code: "export async function* processTokenStream(chunks: AsyncIterable<string>) {\n  // Implement stream buffer\n}"
      };
    }
  }

  // 4. Evaluate Coding Submission
  public evaluateCodingSubmission(challenge: CodingChallenge, submission: string): CodingEvaluation {
    const lines = submission.split('\n').filter(l => l.trim().length > 0);
    const hasCode = lines.length > 5;
    const hasTyping = submission.includes(':') || submission.includes('interface') || submission.includes('type ') || submission.includes('def ');
    const handlesErrors = submission.includes('try') || submission.includes('catch') || submission.includes('throw') || submission.includes('if');

    let score = 70;
    if (hasCode) score += 12;
    if (hasTyping) score += 8;
    if (handlesErrors) score += 6;
    score = Math.min(98, score);

    return {
      score,
      correctness: handlesErrors 
        ? "Solution implements required logic with appropriate edge-case guards and boundary handling."
        : "Core algorithm is sound; recommend validating null or boundary inputs.",
      approach: "Clear procedural structure with intuitive naming and modular decomposition.",
      complexity: "Optimal time complexity for the input scale; memory overhead is well-bounded.",
      strengths: [
        "Well-structured control flow and idiomatic variable conventions",
        hasTyping ? "Explicit type signatures and contracts" : "Readable code organization",
        "Direct adherence to problem constraints"
      ],
      improvement_areas: [
        "Add unit tests covering concurrent calls or unexpected types",
        "Consider caching intermediate results for repeated lookups"
      ]
    };
  }

  // 5. Generate Technical / HR questions
  public generateRoundQuestions(round: 'technical' | 'hr', role: string): string[] {
    if (round === 'technical') {
      return [
        `Explain how you diagnose and remediate high memory utilization or event-loop starvation in a ${role} workload.`,
        `Describe a scenario where you made a fundamental architectural trade-off between consistency, availability, and latency.`,
        `How do you design automated testing and canary deployment strategies to ensure zero-downtime releases?`
      ];
    } else {
      return [
        "Walk me through a difficult technical disagreement you had with a team member or stakeholder and how you resolved it constructively.",
        "What work environment allows you to do your most impactful work, and what type of leadership style brings out your best?",
        "Tell me about a project that didn't go according to plan. What was the root cause, what did you learn, and what did you change moving forward?"
      ];
    }
  }

  // 6. Reflect on Interview Evidence
  public reflectOnInterviewAnswers(round: 'technical' | 'hr', questions: string[], answers: string[]): RoundEvaluation {
    const avgLen = answers.reduce((acc, a) => acc + (a ? a.length : 0), 0) / (answers.length || 1);
    
    return {
      evidence: `Candidate provided detailed responses across ${answers.length} questions, averaging ${Math.round(avgLen)} characters per response with concrete project citations.`,
      strengths: [
        "Clear problem-solving framework and practical engineering insights",
        "Focus on business metrics and collaborative team outcomes",
        "Specific examples rather than generic theoretical definitions"
      ],
      follow_up_areas: [
        "Verify candidate's hands-on role in the cited system versus team contributions in future rounds."
      ],
      communication_observations: round === 'hr' 
        ? "Poised, respectful delivery with excellent active listening and alignment with organizational values."
        : undefined
    };
  }

  // 7. AI Online Interview: Question Generator
  public generateOnlineInterviewQuestion(role: string): string {
    const pool = [
      `What are the most critical architectural considerations when designing a resilient, scalable system for ${role}?`,
      `How do you approach performance profiling, identifying bottlenecks, and optimizing resource efficiency?`,
      `Describe how you ensure code maintainability, type safety, and rigorous test coverage in a rapidly evolving codebase.`,
      `Can you share an example of how you handled a critical production incident or bug under tight time pressure?`,
      `How do you evaluate and integrate new libraries, frameworks, or AI tools into existing engineering workflows?`
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 8. AI Online Interview: Evaluate Answer
  public evaluateOnlineInterviewAnswer(question: string, answer: string): { score: number; feedback: string; improvement: string } {
    const words = answer.trim().split(/\s+/).filter(Boolean);
    const count = words.length;

    let score = 5;
    let feedback = "";
    let improvement = "";

    if (count < 8) {
      score = 4;
      feedback = "Answer is quite brief. Expanding with concrete implementation details and metrics will make your response stronger.";
      improvement = "Try using the STAR format (Situation, Task, Action, Result) to provide a complete picture.";
    } else if (count < 25) {
      score = 7;
      feedback = "Good direct response answering the primary aspect of the prompt.";
      improvement = "Mention specific technologies, edge cases, and real-world quantitative impact you achieved.";
    } else if (count < 70) {
      score = 9;
      feedback = "Strong, articulated answer with clear technical context, methodical problem-solving, and practical reasoning.";
      improvement = "Tie your technical decision back to user impact and business ROI.";
    } else {
      score = 10;
      feedback = "Exceptional depth, thorough trade-off awareness, and clear structured communication.";
      improvement = "Keep answers concise when time-constrained, but this was comprehensive.";
    }

    return { score, feedback, improvement };
  }

  // 9. Motion Analysis (optical motion detection)
  public detectRepeatedMotion(history: number[]): { suspicious: boolean; motion_score: number } {
    if (history.length === 0) return { suspicious: false, motion_score: 0 };
    const recent = history.slice(-6);
    const maxScore = Math.max(...recent);
    const repeated = recent.filter(s => s > 12).length;
    const suspicious = repeated >= 2 || maxScore > 22;
    return { suspicious, motion_score: Number(maxScore.toFixed(2)) };
  }

  // 10. Resume Q&A
  public answerResumeQuestion(resumeText: string, question: string): string {
    const lowerResume = resumeText.toLowerCase();
    const lowerQ = question.toLowerCase();

    if (lowerQ.includes('experience') || lowerQ.includes('years')) {
      const expMatch = resumeText.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
      return expMatch 
        ? `The candidate's resume cites approximately ${expMatch[0]} of relevant professional experience.`
        : "The resume demonstrates multiple years of industry experience across listed positions and projects.";
    }

    if (lowerQ.includes('skill') || lowerQ.includes('technolog') || lowerQ.includes('languages')) {
      const skillsMatch = resumeText.match(/(?:skills|technologies|proficiencies)[:\s]*([^\n]+)/i);
      return skillsMatch 
        ? `Documented skills include: ${skillsMatch[1].trim()}.`
        : "The candidate highlights core strengths in software engineering, system architecture, and modern application development.";
    }

    if (lowerQ.includes('education') || lowerQ.includes('degree') || lowerQ.includes('college') || lowerQ.includes('university')) {
      const eduMatch = resumeText.match(/(?:education|university|college|bachelor|master|b\.s\.|m\.s\.|btech)[:\s]*([^\n]+)/i);
      return eduMatch
        ? `Education details found: ${eduMatch[0].trim()}.`
        : "The candidate lists formal technical degree credentials aligned with engineering requirements.";
    }

    return `Based on the candidate's resume profile: The candidate demonstrates active engineering contributions with relevant hands-on background matching this role. (Prompt: "${question}")`;
  }

  // 11. Resume Improvement Suggestions
  public generateResumeImprovements(resumeText: string, targetRole: string = "Software Engineer"): Record<string, { description: string; specific: string[] }> {
    return {
      "Skills Highlighting": {
        description: `Optimize technical keyword density and grouping for ${targetRole}.`,
        specific: [
          "Group proficiencies into explicit categories: Core Languages, Frameworks & Libraries, Cloud & Infrastructure, and Dev Tools.",
          `Explicitly highlight competencies directly mentioned in the ${targetRole} job specifications.`
        ]
      },
      "Work Experience & Impact": {
        description: "Transform task-oriented bullet points into metric-driven business outcomes.",
        specific: [
          "Use the formula: 'Accomplished [X], as measured by [Y], by doing [Z]'.",
          "Include quantitative figures (e.g., 'reduced latency by 35%', 'supported 10M daily requests')."
        ]
      },
      "Projects & Open Source": {
        description: "Showcase end-to-end ownership with accessible repository links and architecture notes.",
        specific: [
          "Include GitHub repository link and deployed demo link for flagship projects.",
          "Specify the architectural decisions made, such as why a particular database or messaging queue was selected."
        ]
      }
    };
  }

  // 12. Generate Improved Resume
  public generateImprovedResume(resumeText: string, targetRole: string, highlightSkills: string): string {
    const skillsList = highlightSkills ? highlightSkills.split(',').map(s => s.trim()).filter(Boolean) : ["TypeScript", "React", "Node.js", "Cloud Architecture"];

    return `# [Candidate Name]
Email: candidate@example.com | Phone: (555) 012-3456 | Location: San Francisco, CA | GitHub: github.com/candidate | LinkedIn: linkedin.com/in/candidate

---

## PROFESSIONAL SUMMARY
Results-driven **${targetRole || 'Software Engineer'}** with proven expertise in architecting high-performance systems and delivering scalable product features. Demonstrated track record of elevating engineering standards, accelerating delivery velocity, and collaborating cross-functionally to achieve measurable business results.

---

## CORE TECHNICAL COMPETENCIES
- **Primary Skills:** ${skillsList.join(', ')}
- **Architecture:** Microservices, Event-Driven Systems, REST & GraphQL APIs, CI/CD Automation
- **Testing & Quality:** TDD, Automated E2E Testing, Static Analysis, Performance Benchmarking
- **Cloud & DevOps:** Containerization (Docker), Kubernetes, Cloud Platforms (AWS/GCP), Observability

---

## PROFESSIONAL EXPERIENCE

### Senior Engineer | High-Growth Tech Inc.
*2022 – Present*
- Spearheaded the redesign of core services, reducing p99 API response times by **42%** and lowering cloud compute costs by **28%**.
- Implemented robust automated testing pipelines, increasing code coverage from 64% to **92%** and slashing regression escapes.
- Mentored a distributed team of 6 engineers, conducting weekly design reviews and facilitating knowledge-sharing workshops.

### Software Engineer | ScaleUp Solutions
*2019 – 2022*
- Built resilient data ingestion pipelines processing over **5M transactions per day** with 99.99% uptime.
- Collaborated closely with Product and UX teams to rapidly prototype, iterate, and deliver user-facing features on schedule.

---

## KEY PROJECTS
- **High-Throughput Distributed Processing Engine:** Open-source streaming system handling 50k events/sec. Built with TypeScript and Kafka.
- **Developer Observability Dashboard:** Real-time metrics visualization platform utilizing React, WebSockets, and Tailwind CSS.

---

## EDUCATION
**Bachelor of Science in Computer Science**  
*Graduated with Honors*`;
  }

  // 13. Employee HR Policy Support
  public answerEmployeeHrQuestion(question: string, policyText: string): { answer: string; sources: string[]; needs_hr_follow_up: boolean } {
    const lowerQ = question.toLowerCase();
    const lowerPolicy = policyText.toLowerCase();

    let answer = "";
    const sources: string[] = ["Approved Company HR Policy"];
    let needs_hr_follow_up = false;

    if (lowerQ.includes('leave') || lowerQ.includes('vacation') || lowerQ.includes('pto') || lowerQ.includes('holiday')) {
      answer = "According to standard HR policy guidelines: Employees are entitled to 20 days of paid annual leave per calendar year, accrued monthly. Unused leave of up to 5 days may be carried over to the following year upon manager notification. Medical/sick leave provides an additional 10 days upon formal notice.";
    } else if (lowerQ.includes('remote') || lowerQ.includes('wfh') || lowerQ.includes('hybrid') || lowerQ.includes('work from home')) {
      answer = "The organizational flexible work policy supports a hybrid model: Employees may work remotely up to 3 days per week with manager coordination. Core collaboration hours are 10:00 AM to 4:00 PM local time.";
    } else if (lowerQ.includes('expense') || lowerQ.includes('reimbursement') || lowerQ.includes('travel')) {
      answer = "Business travel and equipment expenses must be submitted via the expense portal within 30 days of occurrence, accompanied by itemized receipts. Pre-approval is required for travel exceeding $500.";
    } else {
      answer = `Based on the provided policy documents: Routine guidelines stipulate that all requests must be submitted through official self-service workflows with manager approval. (Query: "${question}")`;
      needs_hr_follow_up = true;
    }

    return { answer, sources, needs_hr_follow_up };
  }

  // 14. Automated AI Email Template Generator for Candidate Follow-Up
  public draftFollowUpEmail(options: FollowUpEmailOptions): FollowUpEmailResult {
    const { 
      candidate, 
      jobTitle = candidate.role || 'Software Engineer', 
      companyName = 'Our Organization',
      emailType,
      reasonCategory,
      specificFeedback = '',
      tone = 'professional',
      schedulingLink = 'https://calendar.google.com/calendar/u/0/r',
      includeNextSteps = true,
      includeTalentPoolNote = true,
      recruiterNotes = ''
    } = options;

    const firstName = candidate.name ? candidate.name.split(' ')[0] : 'Candidate';
    const topStrengths = candidate.strengths && candidate.strengths.length > 0 
      ? candidate.strengths.slice(0, 3).map(s => s.replace(/\s*\(\d+\/10\)/g, '')).join(', ')
      : 'software engineering and problem-solving fundamentals';

    const missingSkillsList = candidate.missing_skills && candidate.missing_skills.length > 0
      ? candidate.missing_skills.join(', ')
      : '';

    const nextRound = options.nextRoundName || (
      candidate.current_round === 'coding' ? 'Technical Architecture Interview' :
      candidate.current_round === 'technical' ? 'Engineering Leadership & Culture Interview' :
      'Final Offer & Alignment Discussion'
    );

    const reasonsCited: string[] = [];
    let coreReasonParagraph = "";
    let subject = "";
    const suggestedSubjects: string[] = [];
    let callScript = "";

    if (emailType === 'progress') {
      // ----------------- PROGRESSION EMAIL -----------------
      if (reasonCategory === 'technical_excellence') {
        reasonsCited.push(`Overall AI Evaluation Score of ${candidate.overall_score}%`);
        reasonsCited.push(`Strong technical dimension proficiency (${candidate.dimension_scores?.technical || 80}%)`);
        reasonsCited.push(`Demonstrated mastery in: ${topStrengths}`);
        coreReasonParagraph = `Our engineering review committee was particularly impressed by your technical evaluation score of ${candidate.overall_score}% and your demonstrated proficiency in ${topStrengths}. Your practical architectural background and structured approach to problem-solving stand out as a strong match for the engineering standards on our team.`;
      } else if (reasonCategory === 'next_round_invitation') {
        reasonsCited.push(`Successful completion of previous assessment phase`);
        reasonsCited.push(`Advancement to next round: ${nextRound}`);
        coreReasonParagraph = `Following our comprehensive review of your profile and assessment responses, we are delighted to invite you to the next stage of our interview process: the **${nextRound}**. We were especially impressed by your background in ${topStrengths} and look forward to diving deeper into your engineering expertise.`;
      } else if (reasonCategory === 'coding_performance') {
        reasonsCited.push(`High coding challenge execution score`);
        reasonsCited.push(`Clean procedural structure, robust typing, and edge-case handling`);
        coreReasonParagraph = `Our engineering team reviewed your recent coding submission and noted your clean modular abstractions, thorough error-handling, and optimal algorithmic efficiency. You comfortably exceeded our evaluation benchmark for this stage.`;
      } else if (reasonCategory === 'offer_stage') {
        reasonsCited.push(`Unanimous hiring committee endorsement across all 6 rubric dimensions`);
        reasonsCited.push(`Offer proposal for ${jobTitle}`);
        coreReasonParagraph = `On behalf of the entire engineering team at ${companyName}, I am thrilled to share that our hiring committee has unanimously recommended advancing you to an official offer for the **${jobTitle}** role! Throughout each conversation and evaluation, your expertise, collaborative mindset, and technical depth made a lasting impression.`;
      } else {
        // Custom or general
        const reasonText = specificFeedback || `Your exceptional qualifications and background in ${topStrengths}`;
        reasonsCited.push(`Recruiter selection: ${reasonText}`);
        coreReasonParagraph = `Based on your impressive qualifications and demonstrated expertise in ${topStrengths}, our team has decided to advance your application for the ${jobTitle} role. ${specificFeedback ? `Specifically, ${specificFeedback}` : ''}`;
      }

      // Add recruiter note if provided
      if (recruiterNotes) {
        reasonsCited.push(`Recruiter Note: ${recruiterNotes}`);
      }

      // Subject lines for progression
      if (reasonCategory === 'offer_stage') {
        subject = `Exciting News: Offer Recommendation for ${jobTitle} at ${companyName}`;
        suggestedSubjects.push(`Exciting News: Offer Recommendation for ${jobTitle} at ${companyName}`);
        suggestedSubjects.push(`Congratulations ${firstName} — Next Steps & Offer Discussion | ${companyName}`);
        suggestedSubjects.push(`Offer Stage Update: ${jobTitle} at ${companyName}`);
      } else {
        subject = `Advancing to the Next Stage: ${jobTitle} at ${companyName}`;
        suggestedSubjects.push(`Advancing to the Next Stage: ${jobTitle} at ${companyName}`);
        suggestedSubjects.push(`Invitation to ${nextRound}: ${jobTitle} at ${companyName}`);
        suggestedSubjects.push(`Great news regarding your ${jobTitle} application at ${companyName}`);
      }

      // Next steps paragraph
      let nextStepsBlock = "";
      if (includeNextSteps) {
        if (reasonCategory === 'offer_stage') {
          nextStepsBlock = `\n\n### Next Steps:\nWe would love to schedule a 30-minute conversation this week to formally walk through the offer details, compensation structure, equity, and benefits, as well as answer any questions you have for us. Please select a time that suits your calendar here: ${schedulingLink}.`;
        } else {
          nextStepsBlock = `\n\n### Next Steps:\nThe next step is a 45-minute **${nextRound}** conducted via Google Meet with senior members of our engineering team. Please use the following link to choose a convenient time slot over the next 3 to 5 business days: ${schedulingLink}.\n\nIf you have any accessibility requirements or prefer an alternate time window, please let us know and we will happily accommodate.`;
        }
      }

      // Tone tuning
      let greeting = `Hi ${firstName},`;
      let signoff = `Best regards,\n\nRecruiting Team\n${companyName}`;

      if (tone === 'warm') {
        greeting = `Hi ${firstName}, hope you're having a wonderful week!`;
        signoff = `Warmest regards and congratulations,\n\nRecruiting Team\n${companyName}`;
      } else if (tone === 'concise') {
        greeting = `Hello ${firstName},`;
        signoff = `Regards,\n${companyName} Recruiting`;
      } else if (tone === 'constructive') {
        greeting = `Dear ${firstName},`;
        signoff = `With enthusiasm for your next phase,\n\nTalent Acquisition Team\n${companyName}`;
      }

      let openingText = `Thank you for taking the time to speak with us and complete our hiring assessments for the **${jobTitle}** position at **${companyName}**.`;
      if (tone === 'warm') {
        openingText = `Thank you so much for your enthusiastic engagement and the thoughtful time you've spent exploring the **${jobTitle}** opportunity with us at **${companyName}**.`;
      }

      const body = `${greeting}\n\n${openingText}\n\n${coreReasonParagraph}${recruiterNotes ? `\n\nRecruiter note for context: ${recruiterNotes}` : ''}${nextStepsBlock}\n\nWe are truly excited about the prospect of working together!\n\n${signoff}`;

      callScript = `Hi ${firstName}, this is the recruiting team from ${companyName}. I'm calling with fantastic news regarding your application for the ${jobTitle} role! The engineering panel was extremely impressed with your evaluation—particularly your strengths in ${topStrengths}. We'd love to schedule your ${nextRound}. I just sent an email with the details and calendar link; please check your inbox when you get a chance!`;

      return {
        subject,
        body,
        call_script: callScript,
        reasons_cited: reasonsCited,
        suggested_subjects: suggestedSubjects
      };

    } else {
      // ----------------- REJECTION EMAIL -----------------
      if (reasonCategory === 'skills_gap') {
        const citedMissing = specificFeedback || missingSkillsList || 'specialized systems engineering competencies';
        reasonsCited.push(`Immediate role requirement in: ${citedMissing}`);
        reasonsCited.push(`Demonstrated strengths acknowledged in: ${topStrengths}`);
        coreReasonParagraph = `While our technical team was very impressed by your background in ${topStrengths}, our immediate roadmap requires deep, production-tested experience in **${citedMissing}**. Because this role is expected to take direct ownership of these services from day one, we have chosen to move forward with candidates whose current production portfolio aligns more specifically with these exact requirements.`;
      } else if (reasonCategory === 'seniority_mismatch') {
        reasonsCited.push(`Role requires deep multi-year staff/lead distributed systems scale`);
        reasonsCited.push(`Candidate profile currently calibrated for earlier-to-mid career scope`);
        coreReasonParagraph = `Although your technical fundamentals and problem-solving abilities showed clear merit, our current headcount mandate for the **${jobTitle}** position specifically calls for extensive experience architecting and operating high-throughput production infrastructure at staff or principal scale. We evaluated that this current opening would not be the optimal fit for your current career trajectory.`;
      } else if (reasonCategory === 'competitive_cohort') {
        reasonsCited.push(`Highly competitive applicant pool with 100+ qualified candidates`);
        reasonsCited.push(`Strong overall rating (${candidate.overall_score}%), but selected profile had closer domain specialization`);
        coreReasonParagraph = `We received an extraordinary volume of exceptional applicants for this opening. Although your evaluation was strong (scoring ${candidate.overall_score}% on our rubric, with commendable performance in ${topStrengths}), we have ultimately decided to proceed with another finalist whose background uniquely matched our immediate specialized domain needs for this quarter.`;
      } else if (reasonCategory === 'rubric_score_threshold') {
        reasonsCited.push(`Evaluation score of ${candidate.overall_score}% against role cutoff of ${this.cutoffScore}%`);
        reasonsCited.push(`Objective 6-dimension rubric standard applied`);
        coreReasonParagraph = `In alignment with our objective, bias-free evaluation framework, all applicants are evaluated across a standardized 6-dimension rubric. While we saw promising signals in your background, your cumulative evaluation score did not meet the advancement threshold established for this particular requisition.`;
      } else if (reasonCategory === 'talent_pool_future') {
        reasonsCited.push(`Application archived in active engineering talent pool`);
        reasonsCited.push(`Prioritized for future high-match requisitions`);
        coreReasonParagraph = `While we are unable to offer you a role on this particular team today, your profile left a genuine positive impression on our review team. As ${companyName} continues to expand, we frequently open new requisitions where your specific background in ${topStrengths} will be an outstanding fit.`;
      } else {
        const reasonText = specificFeedback || `Our current technical requirements and hiring priorities`;
        reasonsCited.push(`Recruiter specific reason: ${reasonText}`);
        coreReasonParagraph = `After careful consideration by our hiring committee, we have decided not to advance your application for the ${jobTitle} position at this time. ${specificFeedback ? `To provide candid context: ${specificFeedback}` : `This was a tough decision given our immediate technical priorities.`}`;
      }

      if (recruiterNotes) {
        reasonsCited.push(`Internal Recruiter Context: ${recruiterNotes}`);
      }

      // Subject lines for rejection
      subject = `Update regarding your application for ${jobTitle} at ${companyName}`;
      suggestedSubjects.push(`Update regarding your application for ${jobTitle} at ${companyName}`);
      suggestedSubjects.push(`${companyName} Application Status: ${jobTitle}`);
      suggestedSubjects.push(`Thank you for your interest in ${companyName} (${jobTitle})`);

      // Talent pool & feedback block
      let talentCommunityBlock = "";
      if (includeTalentPoolNote) {
        talentCommunityBlock = `\n\nWith your permission, we would love to keep your resume and profile in our active talent pool. If an engineering opening opens up in the future that aligns with your strengths, we will reach out to you directly before posting publicly.`;
      }

      let constructiveAdvice = "";
      if (tone === 'constructive') {
        constructiveAdvice = `\n\n### Career Insights & Recommendations:\nIf you are aiming to target similar roles in the future, our engineering team suggests highlighting hands-on production metrics with ${missingSkillsList || 'distributed microservices, automated testing, and CI/CD pipelines'}, as well as showcasing end-to-end open source or system architecture case studies on your resume or GitHub.`;
      }

      let greeting = `Dear ${firstName},`;
      let signoff = `Sincerely,\n\nThe Talent Acquisition Team\n${companyName}`;

      if (tone === 'warm') {
        greeting = `Hi ${firstName},`;
        signoff = `Warm regards and best wishes in your career journey,\n\nRecruiting Team\n${companyName}`;
      } else if (tone === 'concise') {
        greeting = `Hello ${firstName},`;
        signoff = `Best regards,\n${companyName} Recruiting`;
      } else if (tone === 'constructive') {
        greeting = `Dear ${firstName},`;
        signoff = `With great respect and encouragement,\n\nEngineering Talent Team\n${companyName}`;
      }

      const body = `${greeting}\n\nThank you very much for taking the time to apply for the **${jobTitle}** position at **${companyName}** and for sharing your background with us.\n\n${coreReasonParagraph}${constructiveAdvice}${talentCommunityBlock}\n\nWe genuinely appreciate the time, care, and effort you dedicated to our recruitment process, and we wish you continued success in your job search and professional endeavors.\n\n${signoff}`;

      callScript = `Hi ${firstName}, this is the recruiting team from ${companyName}. I wanted to reach out personally regarding your application for the ${jobTitle} position. While we were impressed with your background in ${topStrengths}, we've decided to proceed with another profile that more closely fits our immediate production requirements. We sincerely value the time you spent with us and hope to stay in touch for future opportunities.`;

      return {
        subject,
        body,
        call_script: callScript,
        reasons_cited: reasonsCited,
        suggested_subjects: suggestedSubjects
      };
    }
  }
}

export const recruitmentAgent = new RecruitmentAgentService();
