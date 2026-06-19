# Development Workflow

This guide defines a consistent day-to-day workflow for contributors.

## 1. Setup

1. Install Java 25 and Maven 3.9+.
2. Install Node.js 20+.
3. Start MySQL and create database `skill_swap`.
4. From repository root, run `./start-fullstack.ps1`.

## 2. Daily Commands

- Frontend dev: `Set-Location frontend; npm run dev`
- Frontend test: `Set-Location frontend; npm run test`
- Frontend coverage gate: `Set-Location frontend; npm run test:coverage`
- Frontend lint: `Set-Location frontend; npm run lint`
- Frontend build: `Set-Location frontend; npm run build`
- Backend run: `Set-Location backend; ./start-backend.ps1`
- Backend compile: `Set-Location backend; mvn clean test-compile`
- Backend verify (with JaCoCo gate): `Set-Location backend; mvn clean verify`
- Dependency CVE scan (transitive): `Set-Location backend; mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7`
- Smoke checks: `./smoke-check.ps1`
- Full local validation: `./validate-local.ps1`

Environment profiles:

- Backend profile: `Set-Location backend; $env:SPRING_PROFILES_ACTIVE="dev"; ./mvnw.cmd spring-boot:run`
- Frontend staging build: `Set-Location frontend; npm run build -- --mode staging`
- Frontend production build: `Set-Location frontend; npm run build -- --mode production`

## 3. Feature Workflow

1. Choose target domain package (backend) and route/page area (frontend).
2. Implement smallest viable change.
3. Run compile/tests for touched areas.
4. Run smoke checks if API/UI interaction changed.
5. Update docs in `docs/` when structure or behavior changes.

## 4. Backend Conventions

- Keep business logic in services.
- Keep repositories focused on data access only.
- Use DTOs for controller request/response boundaries.
- Add Flyway migration for every DB schema update.

## 5. Frontend Conventions

- Keep API calls in `src/api`.
- Keep reusable controls in `src/components`.
- Keep page-level composition in `src/pages`.
- Keep pure shared logic in `src/utils`.

## 6. Definition of Done

A change is done when:

1. Code compiles for affected modules.
2. Relevant tests and coverage gates pass.
3. Transitive dependency scan has no blocked CVEs.
4. Smoke checks pass for changed flows.
5. Documentation is updated if project structure or runbook changed.
6. Release and rollback checklists are updated for production-impacting changes.

## 7. Workflow Alignment

Use [WORKFLOW_OPERATIONS.md](WORKFLOW_OPERATIONS.md) as the source of truth for workflow intent and release sequencing.

Required checks by stage:

1. PR stage:

- `ci.yml`
- `backend-test-discovery.yml` (when backend changes)
- `secret-scan.yml`

2. Release stage:

- `release-gate.yml`
- `db-restore-check.yml` latest run status
- `security-nightly.yml` latest run status
- Follow SLO/blocker gates in `docs/LAUNCH_QUALITY_BAR.md`
- Verify alerts/runbook linkage in `docs/OBSERVABILITY_ALERTS.md`
- Confirm environment protections per `docs/GITHUB_ENVIRONMENT_PROTECTION.md`
