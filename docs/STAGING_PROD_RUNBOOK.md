# Staging and Production Runbook

## 1. Staging Dry Run

1. Deploy backend and frontend to staging using your chosen platform.
2. Trigger GitHub workflow `release-gate.yml` via `workflow_dispatch`.
3. Provide:

- `backend_url`: staging backend URL
- `frontend_url`: staging frontend URL
- `promote_to_production`: `false`

4. Confirm all jobs pass, including `staging-check`.

## 2. Production Promotion

1. Re-run `release-gate.yml` with:

- `backend_url`: production backend URL
- `frontend_url`: production frontend URL
- `promote_to_production`: `true`

2. Use GitHub environment protection rules so an approver is required at production gate.
3. Watch logs for health failures and do not proceed if any smoke endpoint fails.
4. Execute canary rollout plan: [docs/CANARY_RELEASE_PLAYBOOK.md](docs/CANARY_RELEASE_PLAYBOOK.md).

## 3. Minimum Manual Verification

1. Sign up and login.
2. Complete profile setup.
3. Search mentor and open profile.
4. Create booking and verify dashboard/session visibility.
5. Open messages page and send one message.
6. Hit backend `actuator/health` and `api/v1/skills`.

## 4. Rollback

1. Re-deploy previous known-good container image tags.
2. If database migration issue:

- stop traffic
- follow [docs/MIGRATION_ROLLBACK_PLAYBOOK.md](docs/MIGRATION_ROLLBACK_PLAYBOOK.md)
- run targeted smoke checks

3. Re-open traffic after smoke checks pass.

## 5. Data Safety Checks

1. Run backup: `./scripts/db-backup.ps1`
2. Run restore check: `./scripts/db-backup-restore-check.ps1`
3. Confirm scratch restore database had tables and check completed.
