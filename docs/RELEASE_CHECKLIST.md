# Release Candidate Checklist

## Versioning and Changelog

1. Confirm semantic version bump type (patch/minor/major).
2. Verify release notes draft is generated from merged PR titles.
3. Ensure breaking changes section is present when needed.

## Quality Gates

1. CI green on frontend and backend jobs.
2. Backend coverage gate passes (JaCoCo minimum).
3. Frontend coverage threshold passes (Vitest).
4. Dependency check has no CVSS >= 7 findings.
5. `backend-test-discovery.yml` latest run confirms backend tests executed (>0).
6. `db-restore-check.yml` latest run is green.
7. `release-gate.yml` passed for current release candidate.
8. `secret-scan.yml` passed for release branch.
9. Monthly manual DB restore rehearsal completed and recorded.

## Functional Verification

1. Run smoke checks in staging.
2. Validate auth login + refresh + logout-all.
3. Validate booking lifecycle including cancellation/refund paths.
4. Validate booking create idempotency behavior:

- Missing/malformed `Idempotency-Key` returns `400` with `retryable=false`.
- Replay with same key + payload returns same booking without duplicate writes.
- Replay with same key + different payload returns `400`.
- Temporary booking conflict returns `409` with `retryable=true`.

5. Validate payment intent and status transition with idempotency headers.
6. Confirm Flyway migration for `booking_idempotency_keys` is present in deployed schema history.

## API Documentation & Observability

1. Swagger UI accessible at `/swagger-ui.html` in staging/prod.
2. OpenAPI schema generated and validated at `/v3/api-docs`.
3. All controller methods tagged with `@Tag` annotation for grouping.
4. Actuator health endpoint accessible at `/actuator/health`.
5. Prometheus metrics exported at `/actuator/prometheus`.
6. Application info endpoint configured at `/actuator/info`.

## Security Verification

1. Security headers validated:
   - `Strict-Transport-Security` header present with appropriate max-age.
   - `X-Frame-Options: DENY` prevents clickjacking.
   - `X-Content-Type-Options: nosniff` prevents MIME sniffing.
   - `Content-Security-Policy` header configured and validated.
2. CORS origins restricted to production domain(s) only.
3. JWT secret is strong (32+ characters, random).
4. No debug logs enabled in production profile.
5. Rate limiting thresholds verified for auth (20/min) and payment (30/min) endpoints.

## Audit Logging

1. `@AuditableOperation` annotations added to sensitive endpoints:
   - Booking create/cancel/confirm/reject.
   - Payment create/refund.
   - User registration/password changes.
2. Audit logs table created via Flyway migration V15.
3. Audit logs accessible via `AuditLogService` for compliance review.
4. IP address extraction working (tests with and without X-Forwarded-For).
5. Sensitive data (passwords, card numbers) NOT logged.

## Performance Testing

1. Load test completed against staging or production-like environment.
2. API response time p95 < 500ms at 50+ concurrent users.
3. Throughput >= 100 requests/sec verified.
4. Error rate < 0.1% during 5-minute sustained load.
5. Memory usage stable (no memory leaks detected).
6. Database connection pool healthy (connections < 90% of max).
7. Performance benchmarks documented in LOAD_TESTING_GUIDE.md.

## Database Verification

1. All Flyway migrations present and applied successfully:
   - V1-V11: Core schema.
   - V12: Booking cancel reason.
   - V13: Auth sessions and payment idempotency.
   - V14: Booking idempotency keys.
   - V15: Audit logs.
2. Backup strategy configured and tested.
3. Backup + restore verification script executed successfully (`scripts/db-backup-restore-check.ps1`).
4. Indexes present on audit_logs (user_id, action, created_at).
5. Connection pooling configured with appropriate min/max connections.

## Environment Configuration

1. All required environment variables documented in ENVIRONMENT_VARIABLES.md.
2. GitHub Secrets configured per GITHUB_SECRETS_SETUP.md:
   - Database credentials.
   - JWT secret and OAuth2 credentials.
   - Email/payment/monitoring service keys.
   - CORS allowed origins.
3. `.env.example` file present and up-to-date.
4. Production environment variables validated (not using dev/test values).

## Documentation

1. DEPLOYMENT.md written with pre-deployment checklist, deployment steps, and post-deployment monitoring.
2. SECURITY_HEADERS.md documents all headers, configuration per environment, and testing.
3. AUDIT_LOGGING.md documents how to add audit logs and interpret events.
4. GITHUB_SECRETS_SETUP.md provides secret generation and rotation instructions.
5. ENVIRONMENT_VARIABLES.md is comprehensive and up-to-date.
6. LOAD_TESTING_GUIDE.md includes test scenarios and performance targets.
7. Runbook linked from incident response channel.
8. Workflow mapping doc reviewed: `docs/WORKFLOW_OPERATIONS.md`.
9. Environment protection guide reviewed: `docs/GITHUB_ENVIRONMENT_PROTECTION.md`.
10. SLO and launch blockers reviewed: `docs/LAUNCH_QUALITY_BAR.md`.

## Operational Readiness

1. Rollback playbook linked and reviewed (MIGRATION_ROLLBACK_PLAYBOOK.md).
2. Incident owner assigned for first 24h after deployment.
3. Alert rules and dashboards reviewed:
   - Error rate threshold.
   - API latency p95 threshold.
   - Database connection pool health.
   - Memory/CPU utilization limits.
4. On-call rotation verified.
5. Escalation path documented (team, PagerDuty, etc.).
6. Staging and production runbook reviewed: `docs/STAGING_PROD_RUNBOOK.md`.
7. Canary rollout playbook reviewed: `docs/CANARY_RELEASE_PLAYBOOK.md`.

## Approval

1. Product owner sign-off.
2. Engineering lead sign-off.
3. Security/InfoSec approval (if required).
4. On-call handoff completed.
5. Deployment checklist reviewed by at least 2 people.
