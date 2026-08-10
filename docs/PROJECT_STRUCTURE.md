# Project Structure Guide

This document provides a systematic map of the repository and explains where to add new features.

Related deep dives:

- Backend package docs: [docs/BACKEND_MODULES.md](BACKEND_MODULES.md)
- Frontend package docs: [docs/FRONTEND_MODULES.md](FRONTEND_MODULES.md)
- Architecture decisions: [docs/adr/README.md](adr/README.md)
- API contract index: [docs/API_CONTRACTS.md](API_CONTRACTS.md)

## Repository Map

- `backend/`: Spring Boot API (modular monolith)
- `frontend/`: React + Vite application
- `docs/`: Human-readable project documentation
- `start-fullstack.ps1`, `stop-fullstack.ps1`: Windows automation scripts
- `smoke-check.ps1`: Local health checks for backend/frontend

## Backend Structure (`backend/src/main/java/com/skillswap`)

The backend uses a domain-first package layout. Keep all related files inside the same domain folder.

Common pattern for each domain package:

- `<Domain>Controller`
- `<Domain>Service`
- `<Domain>Repository`
- `<Domain>` entity/model classes
- DTO classes

Current domain packages include:

- `auth`
- `availability`
- `booking`
- `certification`
- `chat`
- `notification`
- `payment`
- `review`
- `roadmap`
- `search`
- `session`
- `skill`
- `user`
- `verification`
- `waitlist`
- `watchlist`

Cross-cutting packages:

- `common`: shared exceptions and helpers
- `config`: security and app configuration

## Frontend Structure (`frontend/src`)

- `api/`: HTTP client and API adapters
- `components/`: shared reusable UI components
- `hooks/`: reusable React hooks for cross-page behavior
- `pages/`: route-level page components
- `utils/`: pure helpers and shared utility functions
- `styles.css`: global styling

Guideline:

- Put shared UI in `components/`
- Put route-level containers in `pages/`
- Keep API calls centralized in `api/client.js`

## Database and Migrations

- Flyway scripts: `backend/src/main/resources/db/migration`
- Naming pattern: `V<number>__<short_description>.sql`

Guideline:

- Add a new migration for every schema change
- Never edit old migration files already applied in shared environments

## Scripts and Local Operations

- Start all services: `./start-fullstack.ps1`
- Stop all services: `./stop-fullstack.ps1`
- Smoke checks: `./smoke-check.ps1`
- Backend only: `Set-Location backend; ./start-backend.ps1`
- Frontend only: `Set-Location frontend; npm run dev`

## Change Organization Rules

To keep the repository systematic:

1. Keep each feature scoped to one domain package in backend.
2. Add or update tests with each behavior change.
3. Keep API contracts explicit with DTOs.
4. Prefer small, focused files over catch-all utility files.
5. Update docs in `docs/` for any new module or workflow.
6. Keep durable architecture decisions in `docs/adr/` instead of in ad-hoc notes.
