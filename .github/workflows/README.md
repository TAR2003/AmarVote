# GitHub Actions CI/CD for AmarVote

This document explains how the continuous integration and deployment workflows are set up for the AmarVote project, which uses Vite React for the frontend and Spring Boot for the backend.

## Workflows

### 1. Frontend CI (`.github/workflows/frontend-ci.yml`)

This workflow runs on changes to the frontend code and performs:
- Setting up Node.js environment
- Installing dependencies with npm
- Running ESLint for code quality (if configured)
- Building the Vite React application
- Running tests (if available)

The workflow is configured specifically for Vite, using appropriate commands for building and testing.

### 2. Backend CI (`.github/workflows/backend-ci.yml`)

This workflow runs on changes to the backend code and performs:
- Setting up Java 21 environment (matching your pom.xml configuration)
- Caching Maven dependencies for faster builds
- Building the Spring Boot application with Maven
- Running unit and integration tests

### 3. Secrets Check (`.github/workflows/secrets-check.yml`)

This workflow ensures that no hardcoded secrets are committed to the repository:
- Runs on changes to application.properties or application.yml
- Checks for hardcoded credentials, API keys, or tokens
- Ensures sensitive values are using environment variables
- Helps prevent security issues from exposing secrets

### 4. Docker Deployment (`.github/workflows/docker-deploy.yml`)

This workflow builds and pushes Docker images after successful CI runs:
- Builds Docker images for both Vite frontend and Spring Boot backend
- Tags and pushes images to Docker Hub
- Only runs after successful CI builds

## Setting Up GitHub Secrets

To use the Docker deployment workflow, you need to add the following secrets in your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:
   - `DOCKER_HUB_USERNAME` - Your Docker Hub username
   - `DOCKER_HUB_ACCESS_TOKEN` - Your Docker Hub access token (not your password)

## Adding More Workflows

As your project grows, consider adding:

- Code quality workflows using tools like SonarCloud
- Automatic dependency updates with Dependabot
- Release automation
- Environment-specific deployments (staging vs production)

## Notes for Local Development

These workflows don't affect local development. They only run when code is pushed to GitHub or when pull requests are created/updated.
