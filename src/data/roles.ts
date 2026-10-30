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
    memory_email: "alex.rivera@example.com"
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
    memory_consent: false
  }
];
