#!/bin/bash
set -e

ECR_REGISTRY=${ECR_REGISTRY}
ECR_REPOSITORY=${ECR_REPOSITORY}
IMAGE_TAG=${IMAGE_TAG}
AWS_REGION=${AWS_REGION}

sudo apt-get update -y

# Install AWS CLI
if ! command -v aws &> /dev/null
then
    echo "Installing AWS CLI..."

    sudo apt-get install -y unzip curl

    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

    unzip awscliv2.zip

    sudo ./aws/install
fi

# Install Docker
if ! command -v docker &> /dev/null
then
    echo "Installing Docker..."

    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        software-properties-common

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

    sudo add-apt-repository \
       "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
       $(lsb_release -cs) stable"

    sudo apt-get update -y

    sudo apt-get install -y docker-ce

    sudo usermod -aG docker ubuntu

    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Install Nginx
if ! command -v nginx &> /dev/null
then
    echo "Installing Nginx..."

    sudo apt-get install -y nginx
fi

# Configure Nginx
if [ ! -f "/etc/nginx/sites-available/streamlit" ]
then
    echo "Creating Nginx config..."

    sudo tee /etc/nginx/sites-available/streamlit > /dev/null <<EOL
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8501;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

    sudo ln -sf /etc/nginx/sites-available/streamlit /etc/nginx/sites-enabled/

    sudo rm -f /etc/nginx/sites-enabled/default

    sudo nginx -t

    sudo systemctl restart nginx
fi

echo "Logging in to ECR..."

aws ecr get-login-password --region ${AWS_REGION} | \
docker login --username AWS --password-stdin ${ECR_REGISTRY}

echo "Stopping existing container..."

docker stop streamlit-container || true
docker rm streamlit-container || true

echo "Pulling latest image..."

docker pull ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

echo "Running container..."

docker run -d \
    --name streamlit-container \
    -p 8501:8501 \
    ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

echo "Deployment completed successfully!" 