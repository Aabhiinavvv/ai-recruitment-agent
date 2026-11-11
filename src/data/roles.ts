import { Candidate } from '../types';

export const ROLE_REQUIREMENTS: Record<string, string[]> = {
  "AI/ML Engineer": [
    "Python", "Machine Learning", "Deep Learning", "Data Analysis", "Model Deployment",
    "Natural Language Processing", "Computer Vision", "Reinforcement Learning", "AI Ethics",
    "Cloud Computing", "MLOPS", "Scikit Learn", "AutoML", "Feature Engineering",
    "Data Engineering", "Hugging Face"
  ],
  "Frontend Engineer": [
    "HTML", "CSS", "JavaScript", "React", "Vue.js", "Angular", "Responsive Design",
    "Cross-Browser Compatibility", "Web Performance Optimization", "Version Control (Git)",
    "UI/UX Design Principles", "Testing and Debugging", "TypeScript", "SASS", "Bootstrap",
    "Tailwind CSS", "Redux", "GraphQL", "Performance Optimization"
  ],
  "Backend Engineer": [
    "Python", "Java", "Node.js", "Ruby", "Go", "Database Management (SQL/NoSQL)",
    "API Development (RESTful, GraphQL)", "Microservices Architecture",
    "Cloud Computing (AWS, Azure, GCP)", "Containerization (Docker, Kubernetes)",
    "Version Control (Git)", "Testing and Debugging", "Spring Boot", "Django", "Flask",
    "Express.js", "Serverless Architecture", "Message Queues (RabbitMQ, Kafka)",
    "Authentication and Authorization"
  ],
  "DevOps Engineer": [
    "Linux/Unix Systems", "Cloud Platforms (AWS, Azure, GCP)",
    "Containerization (Docker, Kubernetes)", "Infrastructure as Code (Terraform, Ansible)",
    "CI/CD Pipelines (Jenkins, GitLab CI)", "Monitoring and Logging (Prometheus, ELK Stack)",
    "Scripting Languages (Python, Bash)", "Version Control (Git)", "Security Best Practices",
    "Networking Concepts", "Configuration Management", "Serverless Architecture",
    "CloudFormation", "Nagios", "Puppet", "Grafana", "Istio", "Service Mesh"
  ],
  "Full Stack Engineer": [
    "Frontend Development (HTML, CSS, JavaScript, React, Vue.js)",
    "Backend Development (Python, Java, Node.js, Ruby, Go)",
    "Database Management (SQL/NoSQL)", "API Development (RESTful, GraphQL)",
    "Cloud Computing (AWS, Azure, GCP)", "Containerization (Docker, Kubernetes)",
    "Version Control (Git)", "Testing and Debugging", "UI/UX Design Principles",
    "Security Best Practices", "TypeScript", "SASS", "Bootstrap", "Tailwind CSS",
    "GraphQL", "Redux", "Performance Optimization", "Spring Boot", "Django", "Flask",
    "Express.js", "Serverless Architecture", "Message Queues (RabbitMQ, Kafka)",
    "Authentication and Authorization"
  ],
  "Product Manager": [
    "Product Strategy", "Market Research", "User Experience (UX) Design",
    "Agile Methodologies", "Project Management", "Data Analysis", "Stakeholder Management",
    "Communication Skills", "Leadership", "Problem-Solving Skills", "Roadmapping",
    "Prioritization", "Metrics and Analytics", "Customer Development",
    "Go-to-Market Strategy", "Cross-Functional Collaboration"
  ],
  "Data Scientist": [
    "Python", "R", "Machine Learning", "Deep Learning", "Data Visualization",
    "Statistical Analysis", "Data Wrangling", "Big Data Technologies (Hadoop, Spark)",
    "Cloud Computing (AWS, Azure, GCP)", "Version Control (Git)", "Testing and Debugging",
    "Scikit Learn", "AutoML", "Feature Engineering", "Data Engineering", "Hugging Face",
    "Natural Language Processing", "Computer Vision", "Reinforcement Learning", "AI Ethics"
  ]
};

export const SAMPLE_CANDIDATES: Candidate[] = [
  {
    candidate_id: "CAN-9821",
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    phone: "+1-555-019-2831",
    role: "AI/ML Engineer",
    resume_text: `Alex Rivera - Senior AI Engineer
Summary: 5+ years of experience engineering production machine learning systems, deep neural networks, and NLP pipelines. Built LLM evaluation harnesses and deployed computer vision models to edge Kubernetes clusters.
Education: M.S. in Computer Science, Georgia Tech (2020)
Technical Skills: Python, PyTorch, TensorFlow, Scikit Learn, MLOps, Docker, Kubernetes, Hugging Face, NLP, Model Deployment, AWS (SageMaker), SQL.
Experience:
- Senior ML Engineer at Cortex Labs (2021-Present): Deployed transformer models serving 10M queries/day with <45ms p95 latency. Built feature engineering pipelines in Ray.
- Data Scientist at DataPulse (2019-2021): Trained computer vision inspection models with 98.4% precision. Reduced inference costs by 35% with quantization.
Projects: Open-source RAG benchmark toolkit (2.1k stars on GitHub).`,
    resume_profile: "Senior AI Engineer with 5+ years in production ML systems, PyTorch, MLOps, LLMs, and distributed inference.",
    overall_score: 88,
    stage: 'Technical',
    stage_dwell_times: {
      Screening: 1.4,
      Technical: 6.8,
      Interview: 0,
      Offered: 0,
    },
    interview_feedback_reports: [
      {
        id: "fb-alex-tech-1",
        candidateId: "CAN-9821",
        candidateName: "Alex Rivera",
        interviewerName: "David Chen",
        interviewerRole: "Principal AI Systems Engineer",
        roundName: "Technical Live Coding & RAG Architecture",
        roundType: "system_design",
        interviewDate: "2026-11-01",
        durationMinutes: 60,
        rawNotes: "Superb discussion on production LLM inference optimization and multi-agent coordination. Addressed prompt injection attacks by proposing input sandboxing, schema-constrained decoding, and dual-model validation guards. Implemented an asynchronous token-streaming generator in Python/FastAPI with proper cancellation hooks.",
        ratings: {
          technicalDepth: 9,
          problemSolvingSpeed: 9,
          systemArchitecture: 9,
          communicationClarity: 9,
          cultureAndLeadership: 8
        },
        overallRecommendation: "Strong Hire",
        createdAt: "2026-11-01T15:30:00Z",
        updatedAt: "2026-11-01T15:30:00Z",
        evaluationReport: {
          executiveSummary: "Alex delivered an exemplary interview during the Technical Live Coding & RAG Architecture round with David Chen. Demonstrating a composite evaluation score of 91/100, the candidate calibrated at L6 / Staff / Principal Engineer Track. The technical assessment highlighted mastery over high-scale architectural design, robust error recovery, and exceptional clarity of thought.",
          calibratedLevel: "L6 / Staff / Principal Engineer Track",
          hiringVerdict: "Strong Hire",
          compositeScore: 91,
          confidenceScorePercent: 94,
          coreStrengths: [
            {
              title: "Deep Technical & Foundational Competence",
              evidence: "Demonstrated high-rigor mastery in AI/ML Engineer domain with score of 9/10.",
              signalStrength: "Exceptional"
            },
            {
              title: "Architectural Trade-Off & Scalability Intuition",
              evidence: "Proactively factored high-throughput constraints, failure modes, and operational telemetry into system blueprints.",
              signalStrength: "Exceptional"
            },
            {
              title: "Methodical Problem-Solving & Edge Case Coverage",
              evidence: "Deconstructed complex requirements systematically, validating assumptions before committing to code or topology.",
              signalStrength: "Strong"
            }
          ],
          riskFactorsOrGaps: [
            {
              concern: "High Domain Caliber — Flight Risk / Comp Expectations",
              context: "Candidate performance is at top quartile of interview pool. Likely considering multiple competitive offers.",
              severity: "Low",
              mitigation: "Expedite scheduling of final executive sync and calibrate offer package near 75th percentile."
            }
          ],
          competencyEvaluations: [
            {
              competency: "Technical Depth & Domain Core",
              score: 9,
              benchmark: "Senior Bar: 7.5+",
              verdict: "Exceeds Bar",
              observations: "Exhibited authoritative mastery of AI/ML Engineer fundamentals, internals, and execution standards."
            },
            {
              competency: "System Architecture & Scale",
              score: 9,
              benchmark: "Senior Bar: 7.0+",
              verdict: "Exceeds Bar",
              observations: "Deep understanding of partitioning, backpressure, state stores, and latency SLAs under load."
            },
            {
              competency: "Problem-Solving & Agility",
              score: 9,
              benchmark: "Target Bar: 7.0+",
              verdict: "Exceeds Bar",
              observations: "Rapidly mapped ambiguities to structured engineering steps and edge-case boundaries."
            },
            {
              competency: "Communication & Team Synergy",
              score: 9,
              benchmark: "Target Bar: 7.0+",
              verdict: "Exceeds Bar",
              observations: "Articulate, empathetic, and highly collaborative. Takes feedback seamlessly."
            },
            {
              competency: "Culture, Ownership & Leadership",
              score: 8,
              benchmark: "Target Bar: 7.0+",
              verdict: "Exceeds Bar",
              observations: "Demonstrated strong bias for action, incident empathy, and mentorship orientation."
            }
          ],
          questionDeepDives: [
            {
              topic: "Live Coding: Vector Cosine Similarity & Heap Sort",
              candidateResponseSummary: "Candidate implemented clean, idiomatic Python with zero-norm guarding and optimal complexity.",
              technicalTradeoffsNoted: "Discussed min-heap optimization vs full sorting for top-K extraction.",
              verdict: "Flawless execution"
            },
            {
              topic: "RAG Pipeline Hallucination Mitigation",
              candidateResponseSummary: "Applied hybrid sparse-dense retrieval (BM25 + Contriever) along with cross-encoder rerankers and citation grounding.",
              technicalTradeoffsNoted: "Analyzed latency overhead of rerankers vs retrieval precision.",
              verdict: "Exceeds Senior Bar"
            }
          ],
          onboardingFocusAreas: [
            "Complete deep-dive into internal AI/ML Engineer architectural blueprints and RFC repo within Week 1.",
            "Shadow senior team members during production deployments and weekly on-call rotation syncs.",
            "Establish initial milestone deliverable targeting end of Month 1 to validate end-to-end service delivery velocity."
          ],
          recommendedNextSteps: "Fast-track candidate to Final Executive Alignment with Engineering Leadership. Recommend extending offer at L6 / Staff / Principal Engineer Track with compensation benchmarked at top quartile.",
          generatedAt: "Nov 1, 2026, 03:30 PM",
          engineVersion: "AI Recruitment Intelligence v3.8"
        }
      }
    ],
    recruiter_decision: 'advance',
    decision_status: 'Advanced by recruiter',
    recommendation: 'Advance',
    private_notes: "Strong candidate for ML infra. Communicates clearly and demonstrated deep knowledge of PyTorch/vLLM. Follow up on distributed training experience and compensation range during technical screen.",
    notes_updated_at: "Today, 10:18 AM",
    safety_warnings: [],
    review_flags: [],
    dimension_scores: {
      technical: 92,
      experience: 86,
      education: 85,
      projects: 90,
      domain: 88,
      communication: 80
    },
    dimension_evidence: {
      technical: "High mastery in Python, PyTorch, Hugging Face, and MLOps deployment pipelines.",
      experience: "5+ years exceeding the 3-year baseline. Lead roles in production architectures.",
      education: "Master's degree in Computer Science directly aligned with the technical requirements.",
      projects: "High-impact open source contribution with substantial community adoption.",
      domain: "Strong conceptual overlap with deep learning, quantization, and edge serving.",
      communication: "Structured technical prose, clear articulation of latency and trade-offs."
    },
    skill_scores: {
      "Python": 10,
      "Machine Learning": 9,
      "Deep Learning": 9,
      "Model Deployment": 9,
      "MLOPS": 8,
      "NLP": 9,
      "Hugging Face": 9,
      "Scikit Learn": 8,
      "Cloud Computing": 8
    },
    strengths: [
      "Demonstrated experience running LLMs at scale with sub-50ms latency",
      "Comprehensive knowledge of PyTorch, MLOps, and Kubernetes containerization",
      "Master's degree in Computer Science from a recognized institution"
    ],
    missing_skills: ["Reinforcement Learning"],
    detailed_weaknesses: [
      {
        skill: "Reinforcement Learning",
        score: 4,
        details: "Minimal mention of RLHF or PPO in production fine-tuning pipelines.",
        suggestions: ["Highlight any policy gradient experimentation or reward modeling projects."],
        example: "Implemented RLHF reward model alignment with trl / trlx on open models."
      }
    ],
    digital_profile_sources: [
      {
        source_type: "GitHub",
        source_ref: "github",
        source_location: "https://github.com/alexrivera-ml",
        content: "Candidate-provided link only; page content was not accessed or verified."
      },
      {
        source_type: "Candidate-submitted work highlights",
        source_ref: "candidate_submitted_work",
        source_location: "",
        content: "Engineered distributed vector search pipeline using Qdrant with hybrid BM25 re-ranking."
      }
    ],
    current_round: 'coding',
    rounds: {
      coding: {
        challenge_version: 1,
        challenge: {
          title: "Optimized Vector Cosine Similarity Search",
          prompt: "Write a function that calculates the cosine similarity between a query vector and a matrix of document embeddings, returning the indices and scores of top-K results sorted in descending order without using third-party search libraries.",
          input_format: "query: List[float], matrix: List[List[float]], k: int",
          output_format: "List[Tuple[int, float]] (index, similarity score)",
          constraints: "query length == vector dimension <= 1024, matrix length <= 50,000",
          examples: "query=[1.0, 0.0], matrix=[[1.0, 0.0], [0.0, 1.0]], k=1 -> [(0, 1.0)]",
          starter_code: "def top_k_cosine(query: list[float], matrix: list[list[float]], k: int) -> list[tuple[int, float]]:\n    # Implement solution here\n    pass"
        },
        candidate_submission: `import math

def top_k_cosine(query: list[float], matrix: list[list[float]], k: int) -> list[tuple[int, float]]:
    q_norm = math.sqrt(sum(x * x for x in query))
    if q_norm == 0:
        return []
        
    scored = []
    for idx, doc in enumerate(matrix):
        d_norm = math.sqrt(sum(y * y for y in doc))
        if d_norm == 0:
            sim = 0.0
        else:
            dot = sum(x * y for x, y in zip(query, doc))
            sim = dot / (q_norm * d_norm)
        scored.append((idx, sim))
        
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:k]`,
        evaluation: {
          score: 92,
          correctness: "Fully correct with zero-norm vector guarding.",
          approach: "Clear vector math with explicit norm caching.",
          complexity: "O(N * D) time, O(N) space. Could use a min-heap of size K for large N.",
          strengths: ["Clean handling of division by zero", "Idiomatic Python typing", "Expected output matches spec"],
          improvement_areas: ["Consider using heapq.nlargest for O(N log K) instead of O(N log N) sort"]
        },
        decision: 'pass',
        notes: "Excellent performance, moved to technical interview."
      },
      technical: {
        questions: [
          "How do you address vocabulary mismatch and hallucinations in RAG pipelines?",
          "Explain the trade-offs between Quantized Low-Rank Adaptation (QLoRA) and full fine-tuning."
        ],
        answers: [
          "We mitigated hallucinations by applying hybrid sparse-dense retrieval (BM25 + Contriever) along with a cross-encoder reranker. We also enforce strict grounding prompts with attribution citations.",
          "QLoRA freezes the base model in 4-bit precision and adds trainable rank-decomposition matrices. It saves ~75% VRAM at the cost of slight compute overhead during dequantization."
        ],
        evaluation: {
          evidence: "Candidate provides concrete architectures and realistic trade-off awareness.",
          strengths: ["Accurate understanding of quantization math", "Hands-on experience with cross-encoders"],
          follow_up_areas: ["Ask about distributed multi-node fine-tuning experience"]
        },
        decision: null,
        notes: ""
      }
    },
    verification_checks: {
      identity: 'verified',
      employment: 'verified',
      education: 'in_progress',
      criminal: 'pending',
      reference: 'verified'
    },
    document_validation: {
      resume: { label: "Redacted Resume Profile", status: 'verified' },
      degree: { label: "Degree Certificate (M.S.)", status: 'verified' },
      experience: { label: "Service / Relieving Letter", status: 'submitted' }
    },
    memory_consent: true,
    memory_email: "alex.rivera@example.com",
    custom_tags: ["High Priority", "Referred"],
    persona: {
      candidateId: "CAN-9821",
      archetype: "The Production AI & LLM Systems Architect",
      tagline: "Bridges cutting-edge transformer models with resilient, low-latency production serving.",
      superpower: "Distills theoretical ML architectures into hyper-efficient inference pipelines operating at sub-50ms latencies under heavy query load.",
      highlightReel: [
        {
          title: "10M queries/day with <45ms p95 latency",
          description: "Deployed transformer models at Cortex Labs serving 10M queries daily with strict SLA compliance.",
          category: "Impact",
          metric: "10M queries/day"
        },
        {
          title: "35% inference cost reduction with quantization",
          description: "Optimized deep learning vision models through FP16/INT8 weight quantization and engine pruning.",
          category: "Architecture",
          metric: "-35% Cost"
        },
        {
          title: "Open-Source RAG Benchmark Toolkit",
          description: "Authored open-source benchmark harness adopted by 2,100+ GitHub developers.",
          category: "Leadership",
          metric: "2.1k Stars"
        },
        {
          title: "Ray Feature Engineering Pipelines",
          description: "Built distributed feature store ingestion handling high-dimensional vector embeddings.",
          category: "Execution",
          metric: "Distributed"
        }
      ],
      strengths: [
        {
          trait: "Production Scale & Latency Mastery",
          evidence: "Demonstrated experience running LLMs at scale with sub-50ms latency",
          businessImpact: "Ensures mission-critical API responsiveness without degraded user experience under traffic bursts."
        },
        {
          trait: "MLOps & Cloud Orchestration",
          evidence: "Comprehensive knowledge of PyTorch, MLOps, and Kubernetes containerization",
          businessImpact: "Accelerates model deployment cadence while eliminating production drift."
        },
        {
          trait: "Computer Science Foundation",
          evidence: "Master's degree in Computer Science from Georgia Tech",
          businessImpact: "Applies sound mathematical foundations to vector similarity and loss curve optimization."
        }
      ],
      growthAreas: [
        {
          area: "Reinforcement Learning & Policy Optimization (RLHF / PPO)",
          context: "Resume demonstrates heavy production inference and supervised fine-tuning; minimal explicit RLHF alignment work cited.",
          interviewProbe: "Ask Alex: 'Walk us through your familiarity with RLHF and DPO reward modeling. How would you design a feedback loop to align LLM generation against policy guidelines?'"
        },
        {
          area: "Multi-Node Distributed Training Cluster Management",
          context: "Heavy expertise in serving and quantization; less emphasis on training 70B+ parameter models from raw pretraining checkpoints.",
          interviewProbe: "Ask Alex: 'How have you handled gradient synchronization bottlenecks and network fabric topologies during large-scale distributed training?'"
        }
      ],
      workingStyle: {
        paceAndExecution: "Deliberate architectural planning followed by rapid, high-leverage execution sprints.",
        collaborationStyle: "Proactive communicator; writes crisp RFCs and advocates for blameless postmortems.",
        decisionMaking: "First-principles data-driven; benchmarks alternatives with empirical latency and cost metrics."
      },
      idealEnvironment: "High-autonomy culture with direct ownership of ML infrastructure roadmaps, modern GPU clusters, and minimal bureaucratic gatekeeping.",
      fitSignal: "Immediate High-Impact Lead",
      generatedAt: "Verified Baseline"
    },
    processed_at: "2026-11-08T09:30:00.000Z"
  },
  {
    candidate_id: "CAN-4150",
    name: "Priya Chen",
    email: "priya.chen@example.com",
    phone: "+1-555-014-9820",
    role: "AI/ML Engineer",
    resume_text: `Priya Chen - Machine Learning Practitioner
Summary: 3 years building automated data pipelines, predictive models, and classical ML systems. Experienced in Python, Scikit-learn, SQL, and AWS.
Education: B.S. in Statistics, UC Berkeley (2022)
Skills: Python, Scikit Learn, Pandas, NumPy, Feature Engineering, SQL, AWS, Flask, Data Analysis.
Experience:
- ML Analyst at RetailMetrics (2022-Present): Developed customer churn models using XGBoost, improving retention by 8%.
Projects: End-to-end sales forecasting app hosted on Streamlit.`,
    resume_profile: "ML practitioner with 3 years focusing on predictive modeling, tabular data, and feature engineering.",
    overall_score: 74,
    stage: 'Screening',
    stage_dwell_times: {
      Screening: 4.6,
      Technical: 0,
      Interview: 0,
      Offered: 0,
    },
    recruiter_decision: 'hold',
    decision_status: 'Pending recruiter review',
    recommendation: 'Hold',
    safety_warnings: [],
    review_flags: [],
    dimension_scores: {
      technical: 72,
      experience: 68,
      education: 78,
      projects: 70,
      domain: 74,
      communication: 78
    },
    dimension_evidence: {
      technical: "Strong classical ML and data analysis skills; limited deep learning and LLM exposure.",
      experience: "Meets entry/mid threshold (3 years), mainly with tabular predictive models.",
      education: "Bachelor's degree in Statistics.",
      projects: "Standard forecasting projects; limited production deployment scale.",
      domain: "Strong statistical foundations and feature engineering.",
      communication: "Clear summary and well-structured project descriptions."
    },
    skill_scores: {
      "Python": 8,
      "Machine Learning": 8,
      "Data Analysis": 9,
      "Scikit Learn": 9,
      "Feature Engineering": 8,
      "Deep Learning": 5,
      "MLOPS": 4
    },
    strengths: [
      "Solid statistical and tabular modeling foundation (XGBoost, Scikit-learn)",
      "Strong feature engineering and data wrangling proficiency"
    ],
    missing_skills: ["Deep Learning", "MLOPS", "Hugging Face"],
    detailed_weaknesses: [
      {
        skill: "Deep Learning",
        score: 5,
        details: "Lack of PyTorch or neural network architectures in recent experience.",
        suggestions: ["Highlight any computer vision, NLP, or embedding experience."],
        example: "Built neural collaborative filtering model with PyTorch Lightning."
      }
    ],
    digital_profile_sources: [],
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
    memory_consent: false,
    custom_tags: ["Domain Specialist"],
    processed_at: "2026-11-09T11:15:00.000Z"
  },
  {
    candidate_id: "CAN-8291",
    name: "Marcus Vance",
    email: "marcus.vance@example.com",
    phone: "+1-555-018-9921",
    role: "AI/ML Engineer",
    resume_text: `Marcus Vance - Lead Research & Systems Engineer
Summary: 6+ years specializing in distributed model architectures, reinforcement learning from human feedback (RLHF), and GPU scaling.
Experience:
- Lead AI Engineer at HyperScale ML (2020-Present): Scaled 70B parameter LLM fine-tuning across 128x H100 GPUs using Megatron-DeepSpeed.
- Senior Software Engineer at DataWave (2018-2020): Architected multi-node distributed streaming clusters in C++ and Python.
Education: M.S. in Computer Engineering, Stanford University (2018)`,
    resume_profile: "Lead AI Engineer specializing in distributed training, Megatron-DeepSpeed, RLHF, and GPU cluster infrastructure.",
    overall_score: 93,
    stage: 'Interview',
    stage_dwell_times: {
      Screening: 1.2,
      Technical: 3.5,
      Interview: 8.4, // Bottleneck in panel scheduling!
      Offered: 0,
    },
    recruiter_decision: 'advance',
    decision_status: 'Advanced by recruiter',
    recommendation: 'Advance',
    safety_warnings: [],
    review_flags: [],
    dimension_scores: {
      technical: 96,
      experience: 94,
      education: 90,
      projects: 95,
      domain: 92,
      communication: 88
    },
    dimension_evidence: {
      technical: "Exceptional mastery of distributed Megatron-DeepSpeed, PyTorch, and multi-node clusters.",
      experience: "6+ years with direct ownership of 128x GPU cluster deployments.",
      education: "Master's degree from Stanford University.",
      projects: "70B parameter distributed training pipeline.",
      domain: "Deep systems and RLHF architectural alignment.",
      communication: "Structured communication with crisp trade-off reasoning."
    },
    skill_scores: {
      "Python": 10,
      "Deep Learning": 10,
      "Machine Learning": 9,
      "Model Deployment": 10,
      "MLOPS": 9,
      "Cloud Computing": 9,
      "Reinforcement Learning": 9,
      "Hugging Face": 9
    },
    strengths: [
      "Deep multi-node distributed training and Megatron-DeepSpeed expertise",
      "Hands-on RLHF alignment at 70B model scale"
    ],
    missing_skills: [],
    detailed_weaknesses: [],
    digital_profile_sources: [],
    current_round: 'technical',
    rounds: {},
    verification_checks: {
      identity: 'verified',
      employment: 'verified',
      education: 'verified',
      criminal: 'pending',
      reference: 'verified'
    },
    document_validation: {
      resume: { label: "Redacted Resume Profile", status: 'verified' }
    },
    memory_consent: true,
    custom_tags: ["High Priority"],
    processed_at: "2026-11-10T14:40:00.000Z"
  },
  {
    candidate_id: "CAN-5502",
    name: "Jordan Blake",
    email: "jordan.blake@example.com",
    phone: "+1-555-017-3342",
    role: "AI/ML Engineer",
    resume_text: `Jordan Blake - Senior MLOps Engineer
Summary: 4 years focused on ML deployment pipelines, Triton inference server, Docker, Kubernetes, and model monitoring.
Experience:
- Senior MLOps at CloudAI (2021-Present): Reduced deployment turnaround from 3 days to 15 minutes with automated CI/CD.
Education: B.S. in Computer Science, UIUC (2020)`,
    resume_profile: "Senior MLOps engineer with 4 years specializing in Triton Inference Server, CI/CD, and Kubernetes serving.",
    overall_score: 86,
    stage: 'Offered',
    stage_dwell_times: {
      Screening: 1.5,
      Technical: 2.8,
      Interview: 4.2,
      Offered: 1.8, // Optimal flow!
    },
    recruiter_decision: 'advance',
    decision_status: 'Hired by recruiter',
    recommendation: 'Advance',
    safety_warnings: [],
    review_flags: [],
    dimension_scores: {
      technical: 88,
      experience: 84,
      education: 82,
      projects: 86,
      domain: 85,
      communication: 90
    },
    dimension_evidence: {
      technical: "Excellent production MLOps, Triton inference, and automated containerization.",
      experience: "4 years production deployment in cloud Kubernetes environments.",
      education: "Bachelor's in Computer Science from UIUC.",
      projects: "Automated ML CI/CD pipeline reducing turnaround time.",
      domain: "Serving pipelines, drift monitoring, and latency tuning.",
      communication: "Articulate and collaborative."
    },
    skill_scores: {
      "Python": 9,
      "MLOPS": 10,
      "Model Deployment": 9,
      "Cloud Computing": 9,
      "Machine Learning": 8,
      "Docker": 9,
      "Kubernetes": 9
    },
    strengths: [
      "Production CI/CD automation for model deployment",
      "High proficiency with Triton Inference Server and latency SLAs"
    ],
    missing_skills: ["Reinforcement Learning"],
    detailed_weaknesses: [],
    digital_profile_sources: [],
    current_round: 'hr',
    rounds: {},
    verification_checks: {
      identity: 'verified',
      employment: 'verified',
      education: 'verified',
      criminal: 'verified',
      reference: 'verified'
    },
    document_validation: {
      resume: { label: "Redacted Resume Profile", status: 'verified' }
    },
    memory_consent: true,
    custom_tags: ["Internal"],
    processed_at: "2026-11-11T08:20:00.000Z"
  }
];
