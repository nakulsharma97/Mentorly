# DevSync Performance Audit Report

**Generated:** 2026-08-23T10:04:24.052Z

## Summary

| Metric | Value |
|---|---|
| Total Pages | 47 |
| ✅ Pass | 32 |
| ❌ Fail | 15 |
| FCP Threshold | <1.80s |
| LCP Threshold | <2.50s |
| Load Threshold | <3.00s |

## Results (sorted by worst performance)

| Page | Route | Auth | TTFB | FCP | LCP | Load | Requests | Duplicates | Errors | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Landing / Auth Page | `/` | none | 10ms | 5.68s | N/A | 6.49s | 7 | — | 3 | ❌ FAIL |
| Login Page | `/login` | none | 10ms | 3.28s | N/A | 14.58s | 7 | — | 4 | ❌ FAIL |
| Signup Page | `/signup` | none | 21ms | 9.56s | N/A | 9.85s | 7 | — | 3 | ❌ FAIL |
| Resources (Public) | `/resources` | none | 31ms | 5.18s | N/A | 7.54s | 7 | — | 3 | ❌ FAIL |
| Learner Dashboard | `/learner/dashboard` | learner | 34ms | 2.55s | N/A | 2.31s | 7 | — | 3 | ❌ FAIL |
| Learner Mentors | `/learner/mentors` | learner | 14ms | 2.11s | N/A | 1.89s | 7 | — | 3 | ❌ FAIL |
| Learner Tasks | `/learner/tasks` | learner | 5ms | 832ms | N/A | 10.91s | 7 | — | 4 | ❌ FAIL |
| Learner Saved Mentors | `/learner/saved` | learner | 12ms | 2.73s | N/A | 2.56s | 6 | — | 3 | ❌ FAIL |
| Learner Learning Path | `/learner/path` | learner | 14ms | 2.76s | N/A | 3.99s | 7 | 1 | 4 | ❌ FAIL |
| Learner Achievements | `/learner/achievements` | learner | 29ms | 2.45s | N/A | 2.12s | 6 | — | 3 | ❌ FAIL |
| Learner Notifications | `/learner/notifications` | learner | 4ms | 2.24s | N/A | 1.89s | 7 | — | 3 | ❌ FAIL |
| Mentor Wallet | `/mentor/wallet` | mentor | 8ms | 1.87s | N/A | 1.62s | 7 | — | 3 | ❌ FAIL |
| Admin Broadcast | `/admin/notifications` | admin | 11ms | 2.02s | N/A | 1.73s | 7 | — | 3 | ❌ FAIL |
| Admin Verifications | `/admin/verifications` | admin | 6ms | 1.01s | N/A | 886ms | 7 | 1 | 4 | ❌ FAIL |
| Admin Payments | `/admin/payments` | admin | 11ms | 1.22s | N/A | 1.13s | 7 | 1 | 4 | ❌ FAIL |
| Learner Skills | `/learner/skills` | learner | 8ms | 1.42s | N/A | 1.07s | 7 | — | 3 | ✅ PASS |
| Learner Skill Detail | `/learner/skills/1` | learner | 4ms | 1.54s | N/A | 1.31s | 7 | — | 3 | ✅ PASS |
| Learner My Learning | `/learner/learning` | learner | 18ms | 976ms | N/A | 851ms | 7 | — | 3 | ✅ PASS |
| Learner Sessions | `/learner/sessions` | learner | 7ms | 900ms | N/A | 753ms | 7 | — | 3 | ✅ PASS |
| Learner Session Requests | `/learner/requests` | learner | 12ms | 1.03s | N/A | 905ms | 7 | — | 3 | ✅ PASS |
| Learner Certificates | `/learner/certificates` | learner | 6ms | 1.02s | N/A | 894ms | 7 | — | 3 | ✅ PASS |
| Learner Messages | `/learner/messages` | learner | 11ms | 1.00s | N/A | 879ms | 7 | — | 3 | ✅ PASS |
| Learner Profile | `/learner/profile` | learner | 7ms | 1.33s | N/A | 1.17s | 7 | — | 3 | ✅ PASS |
| Learner Settings | `/learner/settings` | learner | 6ms | 1.70s | N/A | 1.51s | 7 | — | 3 | ✅ PASS |
| Learner Wallet | `/learner/wallet` | learner | 4ms | 1.74s | N/A | 1.50s | 7 | — | 3 | ✅ PASS |
| Mentor Dashboard | `/mentor/dashboard` | mentor | 5ms | 1.20s | N/A | 1.04s | 7 | — | 3 | ✅ PASS |
| Mentor Teach | `/mentor/teach` | mentor | 9ms | 1.31s | N/A | 1.11s | 7 | — | 3 | ✅ PASS |
| Mentor Students | `/mentor/students` | mentor | 6ms | 1.24s | N/A | 1.10s | 7 | — | 3 | ✅ PASS |
| Mentor Calendar | `/mentor/calendar` | mentor | 7ms | 1.30s | N/A | 1.78s | 7 | — | 3 | ✅ PASS |
| Mentor Analytics | `/mentor/analytics` | mentor | 16ms | 1.07s | N/A | 956ms | 7 | — | 3 | ✅ PASS |
| Mentor Reviews | `/mentor/reviews` | mentor | 4ms | 1.00s | N/A | 887ms | 7 | — | 3 | ✅ PASS |
| Mentor Messages | `/mentor/messages` | mentor | 5ms | 1.26s | N/A | 1.08s | 7 | — | 3 | ✅ PASS |
| Mentor Professional Profile | `/mentor/professional-profile` | mentor | 7ms | 1.57s | N/A | 1.39s | 7 | — | 3 | ✅ PASS |
| Mentor Notifications | `/mentor/notifications` | mentor | 12ms | 1.47s | N/A | 1.33s | 7 | — | 3 | ✅ PASS |
| Mentor Settings | `/mentor/settings` | mentor | 6ms | 1.39s | N/A | 1.26s | 7 | — | 3 | ✅ PASS |
| Admin Dashboard | `/admin/dashboard` | admin | 7ms | 1.39s | N/A | 1.23s | 7 | — | 3 | ✅ PASS |
| Admin Users | `/admin/users` | admin | 5ms | 1.37s | N/A | 1.22s | 7 | — | 3 | ✅ PASS |
| Admin Sessions | `/admin/sessions` | admin | 5ms | 1.14s | N/A | 1.00s | 7 | — | 3 | ✅ PASS |
| Admin Analytics | `/admin/analytics` | admin | 6ms | 1.55s | N/A | 1.19s | 7 | — | 3 | ✅ PASS |
| Admin Notification Center | `/admin/notification-center` | admin | 5ms | 1.14s | N/A | 984ms | 7 | — | 3 | ✅ PASS |
| Admin Settings | `/admin/settings` | admin | 7ms | 1.68s | N/A | 1.41s | 7 | — | 3 | ✅ PASS |
| Admin Audit Log | `/admin/audit-log` | admin | 8ms | 1.45s | N/A | 1.33s | 7 | — | 3 | ✅ PASS |
| Admin Flagged Content | `/admin/flagged-content` | admin | 7ms | 1.52s | N/A | 1.32s | 7 | — | 3 | ✅ PASS |
| Admin Health | `/admin/health` | admin | 4ms | 1.18s | N/A | 1.05s | 7 | — | 3 | ✅ PASS |
| Admin Reports | `/admin/reports` | admin | 4ms | 1.02s | N/A | 895ms | 7 | — | 3 | ✅ PASS |
| Admin Skills | `/admin/skills` | admin | 4ms | 1.24s | N/A | 1.10s | 7 | — | 3 | ✅ PASS |
| Admin Conversations | `/admin/conversations` | admin | 12ms | 1.42s | N/A | 1.32s | 7 | — | 3 | ✅ PASS |

## 🚨 Failed Pages

### Landing / Auth Page (`/`)

- FCP 5.68s > 1.80s
- Load 6.49s > 3.00s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Login Page (`/login`)

- FCP 3.28s > 1.80s
- Load 14.58s > 3.00s
- **Console errors (4):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`

### Signup Page (`/signup`)

- FCP 9.56s > 1.80s
- Load 9.85s > 3.00s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Resources (Public) (`/resources`)

- FCP 5.18s > 1.80s
- Load 7.54s > 3.00s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Dashboard (`/learner/dashboard`)

- FCP 2.55s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Mentors (`/learner/mentors`)

- FCP 2.11s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Tasks (`/learner/tasks`)

- Load 10.91s > 3.00s
- **Console errors (4):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`

### Learner Saved Mentors (`/learner/saved`)

- FCP 2.73s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Learning Path (`/learner/path`)

- FCP 2.76s > 1.80s
- Load 3.99s > 3.00s
- 1 duplicate API call(s)
- **Duplicate API calls:**
  - http://localhost:5174/api/v1/auth/refresh (×2)
- **Console errors (4):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Achievements (`/learner/achievements`)

- FCP 2.45s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Learner Notifications (`/learner/notifications`)

- FCP 2.24s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Mentor Wallet (`/mentor/wallet`)

- FCP 1.87s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Admin Broadcast (`/admin/notifications`)

- FCP 2.02s > 1.80s
- **Console errors (3):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Admin Verifications (`/admin/verifications`)

- 1 duplicate API call(s)
- **Duplicate API calls:**
  - http://localhost:5174/api/v1/auth/refresh (×2)
- **Console errors (4):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

### Admin Payments (`/admin/payments`)

- 1 duplicate API call(s)
- **Duplicate API calls:**
  - http://localhost:5174/api/v1/auth/refresh (×2)
- **Console errors (4):**
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`

## Recommendations

### High FCP (12 pages)

These pages take too long to show first content. Consider:
- Reducing initial JS bundle size (code-splitting, tree-shaking)
- Inlining critical CSS
- Preloading key resources

### Duplicate API Calls (3 pages)

Multiple components fetch the same endpoint. Consider:
- Using a shared React context or cache for shared data
- Deduplicating with React Query/SWR
- Adding server-side caching (Cache-Control headers)

---
*Report generated by DevSync Performance Audit*
