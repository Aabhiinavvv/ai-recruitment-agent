export interface SampleResumePreset {
  id: string;
  name: string;
  title: string;
  targetRole: string;
  matchTier: 'Exceptional (90%+)' | 'Strong Match (80-89%)' | 'Moderate / Mid (70-79%)' | 'Developing / Junior (<70%)';
  tierColor: string;
  candidateName: string;
  candidateEmail: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workHighlights: string;
  summary: string;
  resumeText: string;
}

export const SAMPLE_RESUME_PRESETS: SampleResumePreset[] = [
  {
    id: 'marcus-vance',
    name: 'Marcus Vance',
    title: 'Staff AI/ML Systems Architect',
    targetRole: 'AI/ML Engineer',
    matchTier: 'Exceptional (90%+)',
    tierColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    candidateName: 'Marcus Vance',
    candidateEmail: 'marcus.vance@aiml-innovations.io',
    githubUrl: 'https://github.com/marcusvance-ai',
    linkedinUrl: 'https://linkedin.com/in/marcus-vance-ai-architect',
    portfolioUrl: 'https://marcusvance.dev',
    workHighlights: 'Designed and productionized distributed LLM inference cluster with vLLM and TensorRT-LLM, cutting p99 latency by 58% at 30k req/min.',
    summary: '8+ years leading production deep learning, LLM serving infrastructure, Ray distributed training, and low-latency MLOps pipelines.',
    resumeText: `Marcus Vance - Staff AI & Machine Learning Systems Architect
Email: marcus.vance@aiml-innovations.io | Phone: +1 (415) 555-0182 | Location: San Francisco, CA
GitHub: https://github.com/marcusvance-ai | LinkedIn: https://linkedin.com/in/marcus-vance-ai-architect | Portfolio: https://marcusvance.dev

PROFESSIONAL SUMMARY
Senior Staff AI/ML Architect with 8+ years of production experience designing, training, and serving large-scale deep learning models, LLM reasoning pipelines, and real-time inference engines. Proven track record scaling ML systems to 50M+ daily active requests with sub-40ms latency while reducing cloud compute spend by 42%.

EDUCATION
- Ph.D. in Computer Science (Machine Learning & Distributed Systems), Stanford University (2018)
- B.S. in Computer Science with Honors, UC Berkeley (2014)

CORE TECHNICAL SKILLS
- Languages & Frameworks: Python, PyTorch, TensorFlow, C++, CUDA, Triton, Scikit Learn, NumPy, Pandas
- GenAI & LLMs: Hugging Face Transformers, vLLM, TensorRT-LLM, LangChain, LlamaIndex, RAG, RLHF, Fine-Tuning
- MLOps & Cloud: Docker, Kubernetes, Ray, Kubeflow, MLflow, AWS (SageMaker, EKS, EC2 GPU clusters), GCP Vertex AI
- Data & Vector Infra: Qdrant, Pinecone, Apache Spark, Kafka, SQL, Feature Stores (Feast), Redis

PROFESSIONAL EXPERIENCE

Staff Machine Learning Architect — Neuromancer AI (2021 – Present) | San Francisco, CA
- Architected the core foundation model serving platform using PyTorch, vLLM, and Triton, handling 30,000 queries per minute across 120 NVIDIA H100 GPUs.
- Spearheaded quantized model deployment (AWQ, FP8) reducing inference VRAM footprints by 65% with zero degradation on retrieval benchmarks.
- Built end-to-end MLOps automation pipeline with Ray Train, Kubeflow, and Weights & Biases for continuous evaluation and regression testing.
- Mentored a distributed team of 14 machine learning research and platform engineers.

Senior Machine Learning Engineer — Horizon Robotics & Vision (2018 – 2021) | Mountain View, CA
- Engineered multi-modal transformer architectures for real-time computer vision and sensor fusion at 60 FPS.
- Reduced model latency from 110ms to 28ms using TensorRT acceleration and mixed-precision inference.
- Published 3 peer-reviewed research papers at NeurIPS and CVPR on efficient attention mechanisms.

OPEN SOURCE & TECHNICAL HIGHLIGHTS
- Creator of vLLM-StreamKit (3.4k GitHub stars): Lightweight async streaming gateway for local and cloud LLM deployments.
- Core Contributor to Hugging Face TGI (Text Generation Inference) and Ray Train.`
  },
  {
    id: 'elena-rostova',
    name: 'Elena Rostova',
    title: 'Senior Full-Stack & GenAI Engineer',
    targetRole: 'Full Stack Engineer',
    matchTier: 'Strong Match (80-89%)',
    tierColor: 'bg-purple-100 text-purple-800 border-purple-300',
    candidateName: 'Elena Rostova',
    candidateEmail: 'elena.rostova@techfrontier.dev',
    githubUrl: 'https://github.com/erostova-dev',
    linkedinUrl: 'https://linkedin.com/in/elena-rostova-engineer',
    portfolioUrl: 'https://elenarostova.dev',
    workHighlights: 'Architected collaborative canvas interface in React 19 & WebSockets; built Python FastAPI backend with LangGraph for enterprise multi-agent workflows.',
    summary: '6 years of experience bridging cutting-edge frontend interfaces (React, TypeScript, Tailwind) with high-throughput backend services and AI agent workflows.',
    resumeText: `Elena Rostova - Senior Full-Stack & GenAI Engineer
Email: elena.rostova@techfrontier.dev | Phone: +1 (206) 555-0149 | Seattle, WA
GitHub: https://github.com/erostova-dev | LinkedIn: https://linkedin.com/in/elena-rostova-engineer | Portfolio: https://elenarostova.dev

EXECUTIVE SUMMARY
Full-Stack Software Engineer with 6+ years of expertise building resilient web applications, interactive visual canvases, and generative AI features. Highly skilled in React, TypeScript, Next.js, Node.js, Python FastAPI, PostgreSQL, and scalable microservice architectures.

EDUCATION
- M.S. in Software Engineering, University of Washington (2020)
- B.S. in Information Systems, Purdue University (2018)

TECHNICAL PROFICIENCIES
- Frontend: TypeScript, JavaScript, React, Next.js, Vue.js, Tailwind CSS, SASS, Redux Toolkit, WebSockets, Canvas/WebGL
- Backend: Python, Node.js, Express.js, FastAPI, Go, Django, GraphQL, REST APIs, Microservices
- Databases & Queues: PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka, Prisma ORM
- Cloud & DevOps: AWS (ECS, Lambda, RDS), Docker, CI/CD (GitHub Actions), Terraform

PROFESSIONAL WORK HISTORY

Senior Full-Stack Engineer — SynthFlow AI (2022 – Present) | Seattle, WA
- Built customer-facing AI agent orchestration dashboard using React 18, TypeScript, Tailwind CSS, and TanStack Query.
- Designed resilient backend microservices in Python (FastAPI) and Node.js that process 4.5M asynchronous webhooks daily.
- Integrated OpenAI and Anthropic SDKs with custom token streaming buffers, reducing initial UI time-to-first-token to 120ms.
- Enforced strict unit and E2E test coverage (Jest, Playwright) achieving 94% test pass rates across all core journeys.

Software Engineer — CloudScale Systems (2019 – 2022) | Portland, OR
- Developed responsive enterprise management portal serving 120k active corporate users with 99.98% uptime.
- Optimized frontend bundle sizes by 44% through code-splitting, tree-shaking, and lazy hydration techniques.
- Migrated legacy monolithic PHP services into decoupled Dockerized Express and Go microservices.`
  },
  {
    id: 'devon-brooks',
    name: 'Devon Brooks',
    title: 'Mid-Level Data Scientist & Analyst',
    targetRole: 'Data Scientist',
    matchTier: 'Moderate / Mid (70-79%)',
    tierColor: 'bg-amber-100 text-amber-800 border-amber-300',
    candidateName: 'Devon Brooks',
    candidateEmail: 'devon.brooks@datasense.co',
    githubUrl: 'https://github.com/devonbrooks-data',
    linkedinUrl: 'https://linkedin.com/in/devon-brooks-ds',
    portfolioUrl: 'https://devonbrooks.ai',
    workHighlights: 'Built customer churn risk prediction model in Scikit-Learn that prevented $420k in annual recurring revenue loss for B2B SaaS clients.',
    summary: '3.5 years of experience in exploratory data analysis, statistical modeling, feature engineering, and tabular machine learning using Python and SQL.',
    resumeText: `Devon Brooks - Data Scientist & Quantitative Analyst
Email: devon.brooks@datasense.co | Phone: +1 (312) 555-0193 | Chicago, IL
GitHub: https://github.com/devonbrooks-data | LinkedIn: https://linkedin.com/in/devon-brooks-ds | Portfolio: https://devonbrooks.ai

PROFESSIONAL SUMMARY
Data Scientist with 3.5 years of industry experience specializing in predictive modeling, statistical analysis, feature engineering, and automated business analytics pipelines. Strong background in Python, Scikit Learn, Pandas, SQL, and data visualization.

EDUCATION
- B.S. in Applied Statistics & Data Analytics, Northwestern University (2021)

KEY COMPETENCIES
- Machine Learning: Scikit Learn, XGBoost, LightGBM, Random Forests, Linear/Logistic Regression, K-Means Clustering
- Data Wrangling & Analysis: Python, Pandas, NumPy, SQL (PostgreSQL, Snowflake), R, Apache Spark
- Visualization: Tableau, PowerBI, Matplotlib, Seaborn, Streamlit
- Cloud & Workflow: AWS (S3, Athena), Airflow, Git, Docker

EXPERIENCE

Data Scientist — InsightLoop Analytics (2022 – Present) | Chicago, IL
- Trained customer churn and lifetime value models (XGBoost, Scikit Learn), achieving an AUC-ROC of 0.89 across 2.3M subscriber accounts.
- Automated daily ETL extraction workflows using SQL and Airflow DAGs, reducing reporting latency from 8 hours to 20 minutes.
- Built interactive Streamlit dashboards for sales executives to simulate pricing elasticity and conversion probabilities.

Junior Data Analyst — ClearMetric Solutions (2021 – 2022) | Evanston, IL
- Cleaned and prepared large tabular datasets for econometric regression modeling.
- Conducted A/B testing statistical significance calculations across 40+ product experiments.`
  },
  {
    id: 'chloe-zhao',
    name: 'Chloe Zhao',
    title: 'Senior DevOps & Platform Engineer',
    targetRole: 'DevOps Engineer',
    matchTier: 'Strong Match (80-89%)',
    tierColor: 'bg-blue-100 text-blue-800 border-blue-300',
    candidateName: 'Chloe Zhao',
    candidateEmail: 'chloe.zhao@cloudinfra.net',
    githubUrl: 'https://github.com/chloezhao-infra',
    linkedinUrl: 'https://linkedin.com/in/chloe-zhao-devops',
    portfolioUrl: 'https://chloezhao.dev',
    workHighlights: 'Engineered zero-downtime multi-region Kubernetes clusters with ArgoCD, Terraform, and Prometheus/Grafana across 80+ microservices.',
    summary: '6+ years specializing in cloud infrastructure automation, Kubernetes orchestration, GitOps pipelines, and production site reliability.',
    resumeText: `Chloe Zhao - Senior DevOps & Platform Reliability Engineer
Email: chloe.zhao@cloudinfra.net | Phone: +1 (512) 555-0164 | Austin, TX
GitHub: https://github.com/chloezhao-infra | LinkedIn: https://linkedin.com/in/chloe-zhao-devops | Portfolio: https://chloezhao.dev

SUMMARY
Seasoned DevOps & Infrastructure Engineer with 6+ years orchestrating immutable cloud environments, GitOps workflows, automated CI/CD pipelines, and high-availability container clusters on AWS, GCP, and Kubernetes.

EDUCATION
- B.S. in Computer Engineering, University of Texas at Austin (2018)

TECHNICAL SKILLS
- Orchestration: Kubernetes, Docker, Helm, Istio Service Mesh, ArgoCD, Nomad
- Infrastructure as Code: Terraform, Ansible, AWS CloudFormation, Pulumi
- Cloud Providers: AWS (EKS, VPC, IAM, S3, RDS), Google Cloud Platform (GKE, Cloud Build)
- CI/CD & Security: GitLab CI, GitHub Actions, Jenkins, HashiCorp Vault, Trivy
- Observability: Prometheus, Grafana, Datadog, ELK Stack (Elasticsearch, Logstash, Kibana)
- Scripting: Python, Bash, Go

EXPERIENCE

Senior DevOps Engineer — Stratos Cloud Solutions (2021 – Present) | Austin, TX
- Migrated 85 production microservices to AWS EKS using Terraform and Helm with zero downtime.
- Built GitOps delivery pipelines via ArgoCD, increasing deployment frequency from weekly to 35+ automated daily releases.
- Architected comprehensive Prometheus and Grafana alerting matrices reducing MTTR (Mean Time to Resolution) by 62%.

Cloud Infrastructure Engineer — Apex Global Media (2018 – 2021) | Dallas, TX
- Maintained hybrid multi-cloud infrastructure handling 12 TB of daily video streaming bandwidth.
- Automated security vulnerability scanning in GitHub Actions, preventing unauthorized container pushes.`
  },
  {
    id: 'samir-patel',
    name: 'Samir Patel',
    title: 'Junior Backend & Python Developer',
    targetRole: 'Backend Engineer',
    matchTier: 'Developing / Junior (<70%)',
    tierColor: 'bg-slate-100 text-slate-800 border-slate-300',
    candidateName: 'Samir Patel',
    candidateEmail: 'samir.patel@codestation.org',
    githubUrl: 'https://github.com/samirpatel-dev',
    linkedinUrl: 'https://linkedin.com/in/samir-patel-software',
    portfolioUrl: 'https://samirpatel.io',
    workHighlights: 'Developed RESTful task scheduling API in Python Flask with SQLite and JWT authentication; eager learner with strong computer science fundamentals.',
    summary: 'Recent Computer Science graduate with 1 year internship experience in Python, REST APIs, Git, and database queries.',
    resumeText: `Samir Patel - Junior Backend Software Developer
Email: samir.patel@codestation.org | Phone: +1 (404) 555-0125 | Atlanta, GA
GitHub: https://github.com/samirpatel-dev | LinkedIn: https://linkedin.com/in/samir-patel-software | Portfolio: https://samirpatel.io

OBJECTIVE
Motivated software developer looking to contribute to high-impact backend systems. Passionate about Python, RESTful API design, database schemas, and clean code practices.

EDUCATION
- B.S. in Computer Science, Georgia State University (2024) - GPA: 3.8/4.0

TECHNICAL SKILLS
- Languages: Python, JavaScript, SQL, C++
- Frameworks: Flask, Django Basics, Express.js
- Tools: Git, GitHub, Postman, Docker (Basics), VS Code, Linux

EXPERIENCE

Software Engineering Intern — DeltaTech Labs (Summer 2023) | Atlanta, GA
- Implemented 6 new REST API endpoints for user profile management in Python Flask.
- Wrote automated unit tests with pytest, increasing test coverage from 60% to 78%.
- Optimized slow SQL queries with indexing, improving response times on search queries by 30%.

ACADEMIC PROJECTS
- Distributed Task Queue: Built a lightweight asynchronous job worker in Python using Redis and Celery.
- Personal Expense Tracker: Full-stack application utilizing Python, SQLite, and HTML/CSS.`
  }
];
