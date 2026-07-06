# Deployment Readiness Guide

This guide covers the final steps to prepare your Skill Swapping Platform for production deployment.

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Set all required environment variables (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md))
- [ ] Configure GitHub Secrets (see [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md))
- [ ] Database backups configured on production server
- [ ] SSL/TLS certificates installed and renewed automatically
- [ ] CDN configured for static assets (optional)

### 2. Backend Verification

```bash
# Compile and run all tests
mvn clean verify

# Run dependency security check
mvn org.owasp:dependency-check-maven:check

# Check code coverage
mvn test jacoco:report
# Open target/site/jacoco/index.html to verify coverage >= 15%

# Build production image (if containerized)
docker build -f Dockerfile -t skill-swap-backend:latest .
```

### 3. Frontend Verification

```bash
# Install dependencies
cd frontend
npm install

# Run tests and build
npm run test
npm run build

# Verify output size in dist/
# Should be < 500KB for main bundle after gzip

# Optional: Run E2E tests in staging
npm run test:e2e
```

### 4. Database Migrations

Ensure all Flyway migrations are applied:

```bash
# Check migration status (migrations run automatically on app start)
# Expected migrations: V1-V15 completed
```

Current migrations:

- V1-V11: Core schema
- V12: Booking cancel reason
- V13: Auth sessions and payment idempotency
- V14: Booking idempotency keys
- V15: Audit logs

### 5. API Endpoint Validation

Once backend is running, verify key endpoints:

```bash
# Health check
curl http://localhost:8080/actuator/health

# Swagger UI (for manual testing)
# Open http://localhost:8080/swagger-ui.html

# Metrics endpoint (for monitoring)
curl http://localhost:8080/actuator/metrics
```

### 6. Security Review

- [ ] All security headers configured (see [SECURITY_HEADERS.md](SECURITY_HEADERS.md))
- [ ] CORS origins restricted to production domains
- [ ] JWT secret is strong (32+ characters, random)
- [ ] Database credentials are strong and not in source code
- [ ] OAuth2 client IDs/secrets configured for production apps
- [ ] No debug logs enabled in production
- [ ] Rate limiting thresholds tuned for expected load

### 7. Monitoring & Observability

- [ ] Prometheus metrics scrape configured
- [ ] Grafana dashboards created (optional but recommended)
- [ ] Error tracking (Sentry or similar) configured
- [ ] Log aggregation (ELK, DataDog, etc.) configured
- [ ] Alerts set up for critical thresholds
- [ ] On-call rotation scheduled for first 24h post-deploy

### 8. Performance Testing

```bash
# Run load test (see LOAD_TESTING_GUIDE.md for detailed setup)
# Expected performance:
# - API response time: < 500ms p95
# - Throughput: > 100 requests/sec
# - Error rate: < 0.1%
```

### 9. Rollback Plan

- [ ] Rollback procedure documented and tested
- [ ] Previous database backup available
- [ ] Docker images tagged for quick rollback
- [ ] Feature flags configured (if using)
- [ ] Runbook linked in incident channel

See [MIGRATION_ROLLBACK_PLAYBOOK.md](MIGRATION_ROLLBACK_PLAYBOOK.md) for detailed rollback steps.

### 10. Audit & Compliance

- [ ] Audit logging enabled (see [AUDIT_LOGGING.md](AUDIT_LOGGING.md))
- [ ] Privacy policy reviewed and linked
- [ ] GDPR compliance checked (if applicable)
- [ ] Data retention policy implemented
- [ ] PCI-DSS compliance verified (if handling payments)

## Deployment Steps

### Option 1: Docker Compose

Use the repo-level compose file to run the full stack locally or on a Docker host:

```bash
docker compose up --build
```

This starts:

- MySQL on `3306`
- Backend on `8080`
- Frontend on `5174`

Stop it with:

```bash
docker compose down
```

The release workflow in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) publishes versioned backend and frontend images to GHCR on release, so your deployment target can pull immutable tags instead of rebuilding locally.

### Option 2: Docker/Kubernetes

```bash
# Build and tag images
docker build -f backend/Dockerfile -t gcr.io/PROJECT/skill-swap-backend:1.0.0 .
docker build -f frontend/Dockerfile -t gcr.io/PROJECT/skill-swap-frontend:1.0.0 .

# Push to registry
docker push gcr.io/PROJECT/skill-swap-backend:1.0.0
docker push gcr.io/PROJECT/skill-swap-frontend:1.0.0

# Deploy to Kubernetes (example)
kubectl set image deployment/skill-swap-backend \
  skill-swap-backend=gcr.io/PROJECT/skill-swap-backend:1.0.0 \
  --record

# Monitor rollout
kubectl rollout status deployment/skill-swap-backend
```

### Option 2: Direct Server Deployment

```bash
# SSH to production server
ssh deploy@prod.example.com

# Stop current services
systemctl stop skill-swap-backend
systemctl stop skill-swap-frontend

# Deploy new versions (via artifact upload or git pull)
cd /opt/skill-swap/backend
git pull origin main
mvn clean package -DskipTests

# Start services
systemctl start skill-swap-backend
systemctl start skill-swap-frontend

# Verify health
curl http://localhost:8080/actuator/health
```

## Post-Deployment

### 1. Smoke Tests (first 30 minutes)

Run functional smoke tests from [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md):

```bash
# Auth flow
curl -X POST http://prod.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"xxx"}'

# Booking idempotency
curl -X POST http://prod.example.com/api/v1/bookings \
  -H "Idempotency-Key: test-key-123" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1}'
```

### 2. Monitor Critical Metrics (24h)

- Error rate < 0.5%
- API latency p95 < 1s
- CPU usage < 70%
- Memory usage < 80%
- Database connection pool healthy
- No spike in failed bookings/payments

### 3. Incident Response

If issues arise, follow the playbook: [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)

## Troubleshooting

| Issue              | Check                                         |
| ------------------ | --------------------------------------------- |
| 500 errors         | Backend logs, database connection, migrations |
| CORS errors        | CORS_ALLOWED_ORIGINS env var, SecurityConfig  |
| 401 Unauthorized   | JWT_SECRET, token expiration, SecurityConfig  |
| Slow API responses | Database query performance, rate limiting     |
| Missing metrics    | Prometheus scrape config, actuator endpoints  |

## Support & Escalation

- Incidents: Page on-call via incident channel
- Questions: Check docs in `/docs` directory
- Rollback: Follow [MIGRATION_ROLLBACK_PLAYBOOK.md](MIGRATION_ROLLBACK_PLAYBOOK.md)
