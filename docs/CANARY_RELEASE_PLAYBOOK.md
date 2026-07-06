# Canary Release Playbook

## Objective

Reduce production blast radius by rolling out to a small traffic slice first, validating, then completing rollout.

## Preconditions

1. Release gate workflow passed for staging.
2. Health checks green for backend and frontend.
3. On-call engineer assigned.
4. Previous stable image tags are available for instant rollback.

## Canary Rollout Steps

1. Deploy canary backend/frontend image tags to canary target.
2. Route 5-10% traffic to canary for 15 minutes.
3. Observe key metrics:

- backend error rate
- p95 latency
- auth failures
- booking creation failures
- payment status transition errors

4. If metrics stable, increase to 25% for 15 minutes.
5. If still stable, proceed to 100% deployment.

## Rollback Triggers

Rollback immediately if any of these occur:

1. Error rate increases by > 2x baseline for 5 minutes.
2. p95 latency increases by > 60% baseline for 5 minutes.
3. Booking or payment critical path has repeated 5xx responses.
4. Health endpoint failures persist for more than 2 minutes.

## Rollback Procedure

1. Route 100% traffic back to previous stable version.
2. Confirm `actuator/health` and `api/v1/skills` are healthy.
3. Run smoke checks.
4. Open incident timeline and capture regression details.

## Post-Canary Validation

1. Run smoke-check script.
2. Execute one real booking flow manually.
3. Verify recent error logs and telemetry events.
4. Publish release note with canary window and outcome.
