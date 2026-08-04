# SkillSwap — Local Preview Run Doc

Frontend: Vite + React 19 (dev server, port **5174**)
Backend: Spring Boot (port **8080**) — optional for frontend preview

## Reproduce uncommitted artifacts

1. **Dependencies** — `frontend/node_modules` is checked in locally but not in git:
   install with `npm install` (run from `frontend/`). Root `node_modules` also exists
   for the `contracts/` Hardhat package; it is not needed for the web preview.
2. **Env files** — there is NO `frontend/.env` file in this repo; all `VITE_*`
   variables are optional (monitoring, payments, Sentry) and the API client
   falls back to the Vite proxy. No copy step needed.
   Backend `.env` (from `.env.example`) is only required to run the Spring Boot
   API, not the frontend dev server.

## Run the server

```bash
cd frontend
npm run dev        # serves on 0.0.0.0:5174 (see vite.config.js)
```

- Default port is **5174**; if occupied, Vite auto-bumps to 5175+.
- `/api`, `/oauth2`, and `/ws` are proxied to `http://localhost:8080`. Without the
  backend running, the UI renders but API calls (notifications, auth, etc.)
  fail with ECONNREFUSED proxy errors — expected.

### Detached start (used for the live Preview)

```bash
cd frontend && nohup npm run dev > ../.freebuff/preview-<id>.log 2>&1 &
```

Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/` → `200`.

To also serve the backend: start Spring Boot from `backend/`
(`./mvnw spring-boot:run` or `scripts/start-backend.ps1`), which needs a MySQL
database configured via backend `.env`.
