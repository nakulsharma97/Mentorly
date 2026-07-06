# Migration Rollback Playbook

This runbook defines how to safely roll back schema changes introduced through Flyway migrations.

## Preconditions

1. Confirm production backup timestamp and restore procedure.
2. Confirm release tag and migration version deployed.
3. Confirm incident commander and DBA owner for the rollback window.

## Rollback Strategy By Change Type

1. Additive table/index changes:

- Prefer forward-fix migration unless there is an urgent outage.
- If rollback is required, ship a new migration that drops the added objects.

2. Additive column changes:

- Ship a new migration that drops the column only after verifying no app code still reads/writes it.

3. Destructive changes (drop/rename/type changes):

- Always restore from backup if data integrity is at risk.
- Run validation queries before reopening traffic.

## Current High-Risk Objects

1. refresh_token_sessions

- Blast radius: auth refresh and logout-all behaviors.
- Backout: disable refresh endpoint or bypass revocation checks temporarily, then run compensating migration.

2. payment_idempotency_keys

- Blast radius: payment intent/status retries.
- Backout: keep table in place and disable strict key checks in app config if needed.

3. booking_idempotency_keys

- Blast radius: learner booking create retries and replay behavior.
- Backout: keep table in place and temporarily relax strict validation while preserving replay reads.

## Rollback Execution

1. Put API in maintenance mode (or restrict write endpoints).
2. Snapshot database.
3. Apply compensating migration or restore backup.
4. Re-run smoke tests:

- /actuator/health
- booking create/status update
- payment intent/status update
- auth login/refresh/logout-all

5. Resume traffic gradually.

## Verification Queries

```sql
SELECT COUNT(*) FROM flyway_schema_history;
SELECT COUNT(*) FROM refresh_token_sessions WHERE revoked = false;
SELECT COUNT(*) FROM payment_idempotency_keys;
SELECT COUNT(*) FROM booking_idempotency_keys;
```

## Post-Rollback Actions

1. Publish incident timeline and root cause.
2. Add missing pre-deploy checks into CI.
3. Open a follow-up task for permanent fix.
