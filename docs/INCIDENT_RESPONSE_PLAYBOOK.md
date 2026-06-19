# Incident Response Playbook

## Severity Levels

1. SEV1: Full outage or data corruption.
2. SEV2: Major feature failure with workaround unavailable.
3. SEV3: Degraded behavior with workaround available.

## First 15 Minutes

1. Declare incident and assign commander.
2. Freeze deployments and notify stakeholders.
3. Confirm current blast radius and affected endpoints.
4. Start timeline log with UTC timestamps.

## Containment

1. Enable maintenance mode or rate limits as needed.
2. Roll back recent release if impact is growing.
3. Use rollback playbook for DB-related regressions.

## Diagnostics

1. Check API error codes and trace IDs.
2. Review auth failure counters and payment transition counters.
3. Validate health endpoints and DB connection status.

## Recovery

1. Deploy hotfix or rollback.
2. Run smoke checks and targeted business flow tests.
3. Re-enable traffic gradually.

## Post-Incident

1. Publish summary with customer impact and duration.
2. Document root cause and preventive actions.
3. Create follow-up tasks with owners and due dates.
