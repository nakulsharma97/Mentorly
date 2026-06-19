# Launch Quality Bar

This file defines hard release blockers for production promotion.

## SLO Targets

1. API availability: >= 99.9%
2. API latency p95: <= 500ms for core APIs
3. 5xx error rate: <= 0.5%
4. Booking flow success: >= 99%
5. Payment status update success: >= 99%

## Non-Negotiable Release Gates

1. `ci.yml` green
2. `release-gate.yml` green
3. `backend-test-discovery.yml` green
4. `db-restore-check.yml` latest run green
5. `security-nightly.yml` latest run green
6. `secret-scan.yml` green for release branch

## Blockers (Must Roll Back or Stop Promotion)

1. Any SLO breach lasting > 10 minutes during canary.
2. Critical workflow failure after code freeze.
3. Data integrity anomaly in booking/payment writes.
4. Health endpoint instability.

## Evidence Required Before Production

1. Staging validation report
2. Canary decision log
3. Alert dashboard screenshot or export
4. Rollback command and owner confirmation
