# CI/CD Pipeline Guide

## Overview

The Stock Market Agent platform uses GitHub Actions for a complete CI/CD pipeline that includes:

- **Linting & Code Quality**: ESLint on every push
- **Automated Testing**: Unit and integration tests
- **Security Scanning**: Vulnerability checks
- **Docker Building**: Multi-service containerization
- **Staging Deployment**: Automatic to staging on develop branch
- **Production Deployment**: Manual approval-based deployment

## Workflow Files

### 1. Test & Code Quality (`.github/workflows/test-and-quality.yml`)

**Triggers**: On every push to `main` or `develop` branches, and on pull requests

**Jobs**:
- **Lint**: ESLint checks
- **Test**: Unit tests with coverage reporting
- **Security**: npm audit for vulnerabilities
- **Integration**: Integration tests with real database
- **Build**: Docker image building (only on main)
- **Deploy Staging**: Deploy to staging environment (only on develop)

### 2. Build & Deploy (`.github/workflows/build-and-deploy.yml`)

**Triggers**: After test-and-quality pipeline completes

**Jobs**:
- **Build**: Build all service Docker images
- **Deploy Staging**: Deploy to staging (develop branch only)
- **Approval**: Manual approval gate for production
- **Deploy Production**: Blue-green deployment to production
- **Rollback**: Automatic rollback on failure

## Setting Up GitHub Actions

### 1. Create Required Secrets

Go to `Settings > Secrets and variables > Actions` and add:

```bash
# Docker Registry
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password

# Kubernetes Configs (base64 encoded)
KUBE_CONFIG_STAGING=$(cat ~/.kube/config-staging | base64 -w0)
KUBE_CONFIG_PRODUCTION=$(cat ~/.kube/config-prod | base64 -w0)

# Slack Webhook (for notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Configure Service Accounts

For Kubernetes access, create service accounts:

```bash
# Create namespace
kubectl create namespace ci-cd

# Create service account
kubectl create serviceaccount ci-cd-user -n ci-cd

# Bind cluster role
kubectl create clusterrolebinding ci-cd-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=ci-cd:ci-cd-user

# Get kubeconfig
kubectl config set-context --current --namespace=ci-cd
kubectl config view --raw > ~/.kube/config-prod
```

### 3. Enable Branch Protection Rules

In `Settings > Branches > Branch protection rules`, for `main` branch:

- ✅ Require a pull request before merging
- ✅ Require approvals (1 approval)
- ✅ Dismiss stale pull request approvals
- ✅ Require status checks to pass:
  - `lint`
  - `test`
  - `security`
  - `integration`
  - `build`

## Pipeline Flow

```
Push Code
    ↓
├─→ Lint (ESLint)
├─→ Test (Unit + Coverage)
├─→ Security (npm audit)
└─→ Integration Tests
    ↓
All pass?
    ├─→ YES: Build Docker images
    │    ├─ develop: Deploy to Staging
    │    └─ main: Approval gate
    └─→ NO: Fail and notify
         └─ Developer fixes and pushes again
```

## Workflow Details

### Lint Job

```yaml
- Runs ESLint on all TypeScript files
- Fails if any linting errors found
- Configurable via .eslintrc.json
```

Output:
```
ESLint reporting found 0 errors
```

### Test Job

```yaml
- Runs jest with coverage collection
- Uploads coverage to Codecov
- Requires >80% coverage
- Runs unit tests only
```

Output:
```
PASS  Test Suites: 4 passed, 4 total
✓ auth.test.ts
✓ portfolio.test.ts
✓ trading.test.ts
✓ gateway.test.ts

Coverage: 82% | Branches: 79% | Functions: 85%
```

### Integration Test Job

```yaml
- Starts PostgreSQL and Redis containers
- Runs database migrations
- Executes integration test suite
- Tests service-to-service communication
```

Requirements:
```yaml
services:
  postgres:15: Ready ✓
  redis:7: Ready ✓
```

### Build Job

```yaml
- Builds Docker images for all services
- Pushes to Docker Registry
- Tags with git SHA and `latest`
- Only runs on main branch after all tests pass
```

Images built:
```
docker-username/auth-service:abc1234
docker-username/api-gateway:abc1234
docker-username/portfolio-service:abc1234
docker-username/trading-engine-service:abc1234
... (all 16 services)
```

### Deploy Staging Job

```yaml
- Deploys from develop branch only
- Updates Kubernetes deployments
- Waits for rollout to complete
- Runs health checks
- Sends Slack notification
```

Process:
```
kubectl set image deployment/auth-service...
kubectl rollout status deployment/auth-service...
curl https://staging.stockmarketagent.com/health
```

### Production Approval Gate

```yaml
- Pauses pipeline for manual approval
- Requires explicit approval in GitHub Actions UI
- Can be approved by repo admins
```

### Deploy Production Job

```yaml
- Implements blue-green deployment
- Deploys new version (blue) alongside old (green)
- Tests blue environment
- Switches traffic to blue
- Cleans up old green environment
```

Blue-Green Strategy:
```
1. Deploy new version to "blue" environment
2. Health check blue environment
3. Test blue with smoke tests
4. Switch ingress to route to blue
5. Delete old "green" environment
```

## Monitoring Pipeline Status

### GitHub Actions Dashboard

1. Go to `Actions` tab in your repository
2. Click on workflow run to see details
3. View individual job logs
4. Artifact downloads available

### Slack Notifications

Pipeline automatically sends to Slack on:
- ✅ All tests passed
- ✅ Deployed to staging
- ✅ Deployed to production
- ❌ Test failures
- ❌ Deployment failures

Channel: `#deployments` (configurable)

### Email Notifications

GitHub sends notifications if:
- Your workflow fails
- A required check fails on your PR

Configure in `Settings > Notifications`

## Manual Interactions

### Approve Production Deployment

1. Go to `Actions` tab
2. Find "Build & Deploy" workflow run
3. Click `Review deployments`
4. Click `Approve and deploy`

### Cancel a Deployment

1. Go to running workflow
2. Click `Cancel workflow`
3. Cancels current job and subsequent jobs

### Re-run Failed Workflow

1. Go to failed workflow
2. Click `Re-run all jobs`
3. Pipeline restarts from beginning

## Debugging Pipeline Failures

### View Job Logs

```bash
# In GitHub UI, click on failed job
# Expand step to see full output
```

### Common Issues

#### Build Fails - "authentication required"

**Solution**: Check Docker Registry credentials
```bash
Settings > Secrets > DOCKER_USERNAME and DOCKER_PASSWORD
```

#### Tests Fail - "cannot find module"

**Solution**: Clear cache and reinstall dependencies
```bash
# In GitHub UI: Re-run jobs > Clear caches > Re-run
```

#### Deployment Fails - "connection refused"

**Solution**: Check Kubernetes configuration
```bash
# Verify KUBE_CONFIG secret is properly base64 encoded
cat ~/.kube/config | base64 -w0
```

#### Staging Deploy Works, Production Fails

**Solution**: Common reasons:
- Different cluster configuration
- Insufficient resources in production
- Different environment variables

**Debug**: SSH into production cluster
```bash
kubectl logs deployment/auth-service -n production
kubectl describe pod <pod-name> -n production
```

## Best Practices

### 1. Branch Strategy

```
main - Production ready, releases only
  ↓
develop - Staging environment, integration branch
  ↓
feature/* - Feature branches, each has own PR
```

### 2. Commit Messages

```
feat: Add new trading feature
fix: Resolve portfolio calculation bug
docs: Update API documentation
test: Add more coverage for auth
ci: Improve pipeline performance
```

### 3. Pull Request Checks

Before merging to main:
- ✅ All CI checks pass
- ✅ At least 1 approval
- ✅ Code review completed
- ✅ No conflicts with main

### 4. Deployment Cadence

- **Staging**: Automatic on every develop commit
- **Production**: Manual deployment, typically once per day
- **Rollback**: Automatic on health check failures

### 5. Monitoring Post-Deployment

After production deployment:

1. **Health Checks**: Monitor service status
2. **Metrics**: Check Prometheus for anomalies
3. **Logs**: Review ELK Stack for errors
4. **Uptime**: Verify SLAs are maintained

If issues detected:
```bash
# Automatic rollback triggers if health checks fail
# Manual rollback if needed:
kubectl rollout undo deployment/auth-service -n production
```

## Advanced Configuration

### Custom Notifications

Edit workflow files to send to different Slack channels:

```yaml
SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_PROD }}
```

### Custom Image Registry

Modify builds to use different registry:

```yaml
docker-username → your-registry.azurecr.io/your-org
```

### Extended Testing

Add additional test stages:

```yaml
test:load:
  name: Load Testing
  runs-on: ubuntu-latest
  steps:
    - run: npm run test:load
```

### Scheduled Deployments

Deploy at specific times:

```yaml
on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2 AM
```

## Metrics & Reporting

### Pipeline Metrics

- Average pipeline time: Target < 15 minutes
- Test success rate: Target > 99%
- Deployment success rate: Target > 95%
- Rollback frequency: Should be < 1/month

### Access Reports

```bash
# GitHub provides built-in reports:
Settings > Actions > Usage > All workflows
```

## Disaster Recovery

### If Pipeline is Down

1. Manually build and deploy:
```bash
docker build -t auth-service:manual .
docker push your-registry/auth-service:manual
kubectl set image deployment/auth-service auth-service=your-registry/auth-service:manual
```

2. Check GitHub Actions status:
https://www.githubstatus.com/

3. Contact GitHub Support if infrastructure issue

### If Secrets are Compromised

1. Rotate Docker Registry credentials
2. Generate new kubeconfig
3. Update all GitHub Secrets
4. Audit deployment history

```bash
kubectl get events --sort-by='.lastTimestamp' -A
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Container Registry](https://docs.docker.com/docker-hub/)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Blue-Green Deployments](https://martinfowler.com/bliki/BlueGreenDeployment.html)

---

**Last Updated**: March 25, 2026
**Maintained By**: DevOps Team
