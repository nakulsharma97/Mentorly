# Observability and Alert Rules

## Minimum Alerts (Production)

1. API Error Rate Spike

- Trigger: 5xx error rate > 2% for 5 minutes.
- Action: Page on-call, attach top failing endpoints.

2. API Latency Regression

- Trigger: p95 latency > 800ms for 10 minutes.
- Action: Open incident, compare with previous release baseline.

3. Health Endpoint Degradation

- Trigger: `/actuator/health` failing for 2 consecutive checks.
- Action: Mark service degraded and start rollback evaluation.

4. Auth Failure Spike

- Trigger: login/signup failures > 3x baseline for 10 minutes.
- Action: Inspect auth logs, rate limiting, and upstream providers.

5. Booking/Payment Critical Flow Failure

- Trigger: booking create or payment status update errors > 1% for 10 minutes.
- Action: Protect transactions, pause risky deploys, investigate data integrity.

6. Database Connection Saturation

- Trigger: DB pool usage > 90% for 10 minutes.
- Action: Scale database/app, inspect slow queries.

## Dashboard Panels

1. Request volume by endpoint.
2. 4xx/5xx split by endpoint.
3. p50/p95/p99 latency.
4. Auth success/failure ratio.
5. Booking and payment success rate.
6. DB pool active/idle/waiting counts.

## Release Window Policy

1. During release and canary windows, watch alerts continuously.
2. If any critical alert breaches threshold, halt rollout immediately.
3. Follow rollback criteria from `docs/CANARY_RELEASE_PLAYBOOK.md`.
