# ai-recruitment-agent
AI-powered Recruitment Agent built with Streamlit and LangChain. Analyze resumes, evaluate skills, generate interview questions, and improve resumes using LLMs. Includes semantic skill scoring, RAG-based Q&amp;A, and resume enhancement for smarter hiring decisions.

Recruitment actions are orchestrated by a LangGraph supervisor that routes work to
resume-analysis, candidate-Q&A, interview, and resume-coaching agents. The workflow
uses a local stdio MCP server for request and score validation. Resume screening is
advisory: the graph pauses for a recruiter to approve or reject each assessment
before recording a final selection. Checkpoints are held in memory for the lifetime
of the Streamlit session.

The assessment instructions restrict scoring to job-related evidence and treat
resume/job-description content as untrusted input. The local MCP process does not
receive Gemini API keys. Do not treat AI scores or camera/motion signals as a
substitute for a fair, human-led hiring process.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

Create a local `.env` file with one of these keys:

```bash
GEMINI_API_KEY=your_api_key
# or
GOOGLE_API_KEY=your_api_key
```

## Deploy on AWS App Runner

This app is already containerized and listens on port `8501`, so the simplest AWS deployment is:

1. Push the Docker image to Amazon ECR.
2. Create an AWS App Runner service from that ECR image.
3. Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` as an App Runner environment variable.

### 1. Build and push to ECR

Set these values for your AWS account:

```bash
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=123456789012
ECR_REPOSITORY=recruitment-system
IMAGE_TAG=latest
```

Create the ECR repository:

```bash
aws ecr create-repository \
  --repository-name $ECR_REPOSITORY \
  --region $AWS_REGION
```

Log Docker in to ECR:

```bash
aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

Build, tag, and push:

```bash
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .

docker tag $ECR_REPOSITORY:$IMAGE_TAG \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
```

### 2. Create the App Runner service

In AWS Console:

1. Open **App Runner**.
2. Choose **Create service**.
3. Source: **Container registry**.
4. Provider: **Amazon ECR**.
5. Select the image you pushed: `recruitment-system:latest`.
6. Deployment trigger: choose **Manual** for a first deployment.
7. Port: `8501`.
8. Environment variables: add `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
9. Health check path: `/_stcore/health`.
10. Create and wait for the service URL.

### 3. Updating the app

After changing code:

```bash
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
```

Then redeploy the App Runner service from the AWS Console.
