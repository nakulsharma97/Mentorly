# SkillSwapper

SkillSwapper is a full-stack skill-sharing platform with separate learner and mentor experiences. The repository contains a React/Vite frontend, a Spring Boot backend, and supporting Docker-based local development.

## Repository structure

- `frontend/` - React 18 frontend app built with Vite.
- `backend/` - Spring Boot backend service using Java 21 and Maven.
- `contracts/` - Solidity smart contract and related Hardhat config.
- `docs/` - project guides, API/contracts, workflows, and architecture documentation.
- `docker-compose.yml` - local development stack for frontend, backend, and MySQL.

## Technology stack

- Frontend: React 18, Vite, React Router v6, Axios, Vitest, Playwright
- Backend: Spring Boot 3.5.0, Java 21, Spring Security, Spring Data JPA, Flyway, MySQL, JWT, WebSocket, Sentry
- Dev containers: Docker Compose with MySQL, backend, frontend
- Smart contracts: Hardhat + Solidity

## Key concepts

- Role-based routing separates learner and mentor applications.
- Auth flows are handled in the frontend and routed to `/learner/*` or `/mentor/*` after login.
- Public unauthenticated pages include `/`, `/login`, `/signup`, `/test-checklist`, and public mentor profiles under `/mentors/:mentorId`.
- The app uses lazy-loaded page components with route error boundaries.

## Local development prerequisites

- Node.js 20+
- Java 21
- Maven 3.9+
- Docker and Docker Compose (optional, for containerized local stack)
- MySQL if running backend directly

## Running locally

### Option 1: Run with Docker Compose

From the repository root:

```powershell
docker compose up --build
```

This starts:

- `mysql` on port `3306`
- `backend` on port `8080`
- `frontend` on port `5174`

### Option 2: Run backend and frontend separately

#### Backend

```powershell
Set-Location backend
./start-backend.ps1
```

The backend defaults to `SPRING_PROFILES_ACTIVE=dev` and listens on port `8080`.

#### Frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

The frontend uses Vite and expects the backend API at `VITE_API_BASE_URL`.

## Environment variables

The Docker Compose stack supports these defaults:

- `MYSQL_DATABASE` - default: `skill_swap`
- `MYSQL_ROOT_PASSWORD` - default: `rootpassword`
- `MYSQL_USER` - default: `skill_swap`
- `MYSQL_PASSWORD` - default: `skill_swap`
- `SPRING_PROFILES_ACTIVE` - default: `prod` in Docker Compose, `dev` for local backend startup
- `SPRING_DATASOURCE_URL` - default: `jdbc:mysql://mysql:3306/skill_swap?...`
- `SPRING_DATASOURCE_USERNAME` - default: `skill_swap`
- `SPRING_DATASOURCE_PASSWORD` - default: `skill_swap`
- `JWT_SECRET` - default: `change-me-change-me-change-me-change-me`
- `CORS_ALLOWED_ORIGINS` - default: `http://localhost:5174,http://127.0.0.1:5174`
- `VITE_API_BASE_URL` - default: `http://backend:8080` when built with Docker Compose
- `VITE_APP_ENV` - production by default in Docker build

## Frontend commands

From `frontend/`:

```powershell
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run test
npm run test:coverage
npm run test:watch
npm run test:e2e
```

## Backend commands

From `backend/`:

```powershell
mvn clean test-compile
mvn clean verify
mvn spring-boot:run
```

Or use the helper script:

```powershell
./start-backend.ps1
```

## Testing

- Frontend unit tests use Vitest.
- End-to-end tests use Playwright.
- Backend tests are managed by Spring Boot and Maven.
- The backend POM includes JaCoCo coverage and OWASP dependency checks.

## Documentation and conventions

- `docs/` contains project standards, deployment checklists, security guidance, and API contract documentation.
- `docs/DEVELOPMENT_WORKFLOW.md` includes the standard contributor workflow and daily commands.
- `docs/PROJECT_STRUCTURE.md` and related docs describe module boundaries and frontend/backend structure.

## Notes

- The frontend now routes authenticated users into explicit `/learner/*` and `/mentor/*` paths.
- Legacy `/home` behavior is intentionally deprecated and replaced by role-specific dashboard redirects.
- Public mentor profiles remain accessible at `/mentors/:mentorId`.

## Contribution

1. Review existing docs in `docs/` before changing architecture or workflow.
2. Run frontend and backend tests for touched areas.
3. Update documentation when adding or changing public routes, auth behavior, or deployment configuration.
