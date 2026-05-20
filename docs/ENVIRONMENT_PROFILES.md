# Environment Profiles

This project supports development, staging, and production profiles for backend and frontend.

## Backend Profiles (Spring)

Profile files:

- [backend/src/main/resources/application.yml](../backend/src/main/resources/application.yml)
- [backend/src/main/resources/application-dev.yml](../backend/src/main/resources/application-dev.yml)
- [backend/src/main/resources/application-staging.yml](../backend/src/main/resources/application-staging.yml)
- [backend/src/main/resources/application-prod.yml](../backend/src/main/resources/application-prod.yml)

Activate a profile:

```powershell
Set-Location backend
$env:SPRING_PROFILES_ACTIVE="dev"
./mvnw.cmd spring-boot:run
```

Or with Maven argument:

```powershell
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=staging"
```

### Backend profile intent

- `dev`: local development defaults, debug visibility
- `staging`: production-like behavior with safer staging limits
- `prod`: stricter defaults and lower-verbosity logs

## Frontend Profiles (Vite)

Profile files:

- [frontend/.env.development](../frontend/.env.development)
- [frontend/.env.staging](../frontend/.env.staging)
- [frontend/.env.production](../frontend/.env.production)

Run by mode:

```powershell
Set-Location frontend
npm run dev
npm run build -- --mode staging
npm run build -- --mode production
```

Key variables:

- `VITE_APP_ENV`: environment label used in frontend behavior
- `VITE_API_BASE_URL`: backend API base URL

## Root Environment Example

Use [.env.example](../.env.example) as the baseline for secrets and runtime values.
Add `SPRING_PROFILES_ACTIVE` to local runtime environment when needed.

## CI Behavior

CI uses non-interactive defaults:

- frontend: lint, test, build
- backend: compile and test

Workflow file:

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
