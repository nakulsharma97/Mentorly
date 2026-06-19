# Booking Retry End-to-End Test

This test validates the booking retry UX against a real running backend and frontend.

## What it checks

- Learner can authenticate with seeded test credentials.
- Mentor with at least one future session is discovered from backend data.
- First booking attempt fails with a temporary conflict payload.
- Second click retries booking and proceeds to backend.
- Learner is redirected to sessions view after successful retry.

## Prerequisites

- Backend running on `http://localhost:8080`.
- Frontend running on `http://localhost:5173`.
- Seeded learner account exists (`learner@test.com`).

## Run

From `frontend`:

```bash
npm run test:e2e
```

Optional environment overrides:

- `PLAYWRIGHT_FRONTEND_URL`
- `PLAYWRIGHT_BACKEND_URL`

## Optional CI Gate

Use workflow `E2E Booking Retry (Optional)` from GitHub Actions (`workflow_dispatch`).

Inputs:

- `frontendUrl`: target frontend base URL
- `backendUrl`: target backend base URL

This workflow is non-blocking and intended for release-candidate validation against deployed environments.
