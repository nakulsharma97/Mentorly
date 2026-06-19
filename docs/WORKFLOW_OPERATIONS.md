# Workflow Operations Guide

This guide maps each GitHub workflow to when contributors should run it.

## Core Workflows

Dependency automation note:

- Dependabot is configured in `.github/dependabot.yml` for GitHub Actions, frontend npm, and backend Maven updates.

1. `ci.yml`

- Path: `.github/workflows/ci.yml`
- Trigger: push/pull_request
- Purpose: frontend lint/test/build + backend verify + backend CVE scan + backend non-zero test guard

2. `release-gate.yml`

- Path: `.github/workflows/release-gate.yml`
- Trigger: push + workflow_dispatch
- Purpose: pre-release quality gates, container smoke checks, optional staging/prod endpoint checks

3. `backend-test-discovery.yml`

- Path: `.github/workflows/backend-test-discovery.yml`
- Trigger: pull_request (backend changes) + workflow_dispatch
- Purpose: explicitly verifies backend tests are discovered and actually executed (>0)

4. `db-restore-check.yml`

- Path: `.github/workflows/db-restore-check.yml`
- Trigger: schedule + workflow_dispatch
- Purpose: validates backup and restore integrity against ephemeral MySQL in CI

5. `security-nightly.yml`

- Path: `.github/workflows/security-nightly.yml`
- Trigger: schedule + workflow_dispatch
- Purpose: backend OWASP scan and frontend npm audit high/critical

6. `secret-scan.yml`

- Path: `.github/workflows/secret-scan.yml`
- Trigger: pull_request, push, workflow_dispatch
- Purpose: detect leaked credentials/secrets early in branch lifecycle

## Contributor Usage Path

1. Before opening PR

- Run local validation script: `./validate-local.ps1`
- Ensure your branch is clean of generated artifacts.

2. During PR

- Ensure `ci.yml` and `backend-test-discovery.yml` are green.

3. Before release

- Ensure `release-gate.yml` passes with staging URLs.
- Ensure latest `db-restore-check.yml` and `security-nightly.yml` runs are green.
- Ensure `secret-scan.yml` is green for release branch.

4. Production promotion

- Use `release-gate.yml` with `promote_to_production=true` and follow runbook approvals.
- Ensure environment protection rules are enabled per `docs/GITHUB_ENVIRONMENT_PROTECTION.md`.
