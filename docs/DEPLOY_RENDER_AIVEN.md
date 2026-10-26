# Mentorly — Render + Aiven par deploy karne ki step-by-step guide

Ye guide **exactly** wo raasta batati hai jo is repo ke code ke saath actually kaam karta hai:
**Render** par 2 Docker web services (backend + frontend) aur **Aiven for MySQL** par database.
Total monthly cost: **₹0** (dono ke free plans).

> Agar aap sirf keys chahte ho, seedha [Section 7 — Saari API keys](#7-saari-api-keys--kahan-se-kya-chahiye) par jao.

---

## 0. Pehle samjho kya banega (aur kyun 2 service, 1 static site nahi)

```
Browser  ──https──▶  mentorly-web.onrender.com   (nginx: SPA + reverse proxy)
                          │  /api  /oauth2  /login/oauth2  /ws
                          ▼
                     mentorly-api.onrender.com    (Spring Boot 3.5, Java 21)
                          │  JDBC + TLS (sslMode=REQUIRED)
                          ▼
                     Aiven for MySQL (free tier)
```

Kyun frontend ko static site nahi banaya:

- App ki auth **httpOnly cookies** (`access_token`, `refresh_token`) par chalti hai aur unki `SameSite=Lax` hai ([AuthCookieService.java](../backend/src/main/java/com/mentorly/auth/AuthCookieService.java)).
- `onrender.com` **Public Suffix List** par hai, matlab `mentorly-web.onrender.com` aur `mentorly-api.onrender.com` browser ke liye **cross-site** hain → `SameSite=Lax` cookie kabhi nahi jayegi → login/refresh/WebSocket sab tootega.
- Isliye frontend container hi `/api`, `/oauth2`, `/login/oauth2`, `/ws` ko backend par proxy karta hai. Browser sirf **ek origin** dekhta hai. Isi wajah se repo me [`frontend/nginx.render.conf.template`](../frontend/nginx.render.conf.template), [`frontend/Dockerfile.render`](../frontend/Dockerfile.render) aur [`render.yaml`](../render.yaml) add kiye gaye hain.

Ek aur zaroori baat: Render ke **free** web service ko private network se reach nahi kiya ja sakta, isliye nginx backend ko uske **public https URL** par proxy karta hai (thoda extra hop, free plan par yehi sahi tarika hai).

### Accounts jo chahiye (sab free)

1. **GitHub** — code yahin se Render deploy karega.
2. **Render** — https://render.com (GitHub se sign in).
3. **Aiven** — https://aiven.io (Google/GitHub/email se sign in).
4. Optional (features ke hisaab se): Google Cloud, GitHub OAuth, Stripe, Razorpay, Resend, Sentry.

---

## 0.1 Dockerfile kahan hai? (aur root wala kya hai)

Dockerfile **hai** — aur ab repo root par bhi ek hai, taaki Render ke default settings bina error ke chalein:

| File | Kiske liye | Build context |
|---|---|---|
| [`Dockerfile`](../Dockerfile) | **Single-service image**: frontend build (node) + backend build (Maven) + runtime me nginx aur Spring Boot dono (`start.sh`) — sirf Render ke default `./Dockerfile` ke liye fallback | repo root |
| [`backend/Dockerfile`](../backend/Dockerfile) | `mentorly-api` (Spring Boot, Maven multi-stage) — canonical image | `backend/` |
| [`frontend/Dockerfile.render`](../frontend/Dockerfile.render) | `mentorly-web` (Vite build + nginx) | `frontend/` |
| [`frontend/nginx.render.conf.template`](../frontend/nginx.render.conf.template) | nginx config (proxy + SPA fallback) | — |
| [`.dockerignore`](../.dockerignore) | root context chhota rakhta hai; `.env` image me nahi jaata | repo root |

Root `Dockerfile` ab **backend-only nahi** hai: wo frontend (Vite) aur backend (Maven)
dono build karta hai aur ek container me chalata hai — nginx `$PORT` par SPA serve karta
hai aur `/api`, `/oauth2`, `/login/oauth2`, `/ws`, `/actuator/health` ko internal
Spring Boot (`127.0.0.1:8081`) par proxy karta hai (`start.sh`). Ye **sirf** fallback
hai taaki jab `Root Directory` aur `Dockerfile Path` dono khaali hon (Render ka default
→ `./Dockerfile`) to build `open Dockerfile: no such file or directory` par fail na ho.

**Canonical path: [`render.yaml`](../render.yaml) (rasta B — do services).** Root
`Dockerfile` ek alternate all-in-one image hai; dono same-origin proxy rakhte hain, par
blueprint wala do-services setup isi doc ka documented route hai.

- frontend service ke liye `Root Directory: frontend` + `Dockerfile Path: Dockerfile.render` set karna **zaroori** hai, warna wo bhi backend build kar dega.
- Root `Dockerfile` `$PORT` par bind karta hai (Render default `10000`) aur Spring ko
  internal `8081` par `--server.port=8081` se chalata hai; single-service setup me
  `SERVER_PORT` set karne ki zaroorat nahi padti.

Do valid raste:

| Rasta | Root Directory | Dockerfile Path | Build Context |
|---|---|---|---|
| A. Render default (root Dockerfile) | *(khaali)* | *(khaali → `Dockerfile`)* | *(khaali)* |
| B. Preferred — chhota context | `backend` | `Dockerfile` | *(khaali)* |

> Trap: Root Directory khaali + Dockerfile Path `backend/Dockerfile` **nahi** chalega — build context repo root ban jaata hai aur `COPY pom.xml` fail hota hai.
> Root Directory `backend` + Dockerfile Path `backend/Dockerfile` bhi galat hai (wo `backend/backend/Dockerfile` dhundhega).

[`render.yaml`](../render.yaml) rasta B use karta hai:

```yaml
- name: mentorly-api
  dockerContext: ./backend        # <-- is folder ka Dockerfile use hoga
  dockerfilePath: ./backend/Dockerfile
- name: mentorly-web
  dockerContext: ./frontend       # <-- is folder ka
  dockerfilePath: ./frontend/Dockerfile.render
```

Aur ek zaroori baat: **Render aapke laptop ka folder nahi padhta** — wo GitHub repo clone karke usme se build karta hai. Matlab `render.yaml`,
`Dockerfile`, `backend/Dockerfile` aur `frontend/Dockerfile.render` **GitHub par push hone chahiye** (Section 3), tabhi deploy chalega.
Local folder me Docker install hona bhi zaroori nahi hai.

---

## 1. Aiven for MySQL set up karo (10 minute)

1. https://console.aiven.io par sign in karo.
2. **Create service** → **Aiven for MySQL** chuno.
3. **Plan: Free** chuno (1 CPU / 1 GB RAM / 1 GB disk; ek organization me **ek hi free MySQL** milta hai).
4. **Cloud + region**: India ke sabse paas — Google Cloud `asia-south1` (Mumbai) ya AWS `ap-south-1`; agar wo Free me na dikhe to Singapore/Frankfurt. (Render region baad me `singapore` rakhenge — latency ke liye same-ish region best hai.)
5. Service name: `mentorly-db` → **Create service**. Status `RUNNING` hone tak 2–5 min wait karo.
6. Service ke **Overview → Connection information** me ye 5 cheezein copy karo:
   - **Host** (e.g. `mysql-1a2b3c4d-mentorly-db.aivencloud.com`)
   - **Port** (e.g. `25000` — 3306 nahi hota, jo dikhe wahi)
   - **User** → `avnadmin`
   - **Password** → copy / `Reset password` se naya banao
   - **Database** → `defaultdb`
   - (Optional) **CA certificate** → `ca.pem` download. Is guide me `sslMode=REQUIRED` use kar rahe hain, isliye CA file ki zaroorat **nahi** (sirf `VERIFY_CA`/`VERIFY_IDENTITY` ke liye padti hai).
7. **Database name**: `defaultdb` hi use kar lena sabse aasan hai. Apna naam chahiye to **Connect → Databases → Create database** (e.g. `mentorly`) — phir JDBC URL me `defaultdb` ki jagah `mentorly` likhna.
8. **IP allowlist**: **Service settings → Cloud and network → Actions → Set IP address allowlist**. Default `0.0.0.0/0` hi **rehne do** — Render free services ke outbound IP fixed nahi hote, isliye IP pin karna kaam nahi karega. Security TLS + strong password se aati hai.
9. *(Optional)* Local se test:
   ```bash
   mysql --host=<HOST> --port=<PORT> --user=avnadmin --password --ssl-mode=REQUIRED defaultdb
   ```
10. **Note**: Aiven free service ko lambi inactivity par power-off kar sakta hai (pehle mail aata hai). Console se dobara power on ho jata hai. App chalte rehne se ye problem nahi aati.

### JDBC URL jo Render me daalna hai

Aiven jo `mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb` deta hai, usko JDBC me aise badlo:

```
jdbc:mysql://HOST:PORT/defaultdb?sslMode=REQUIRED&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8
```

- Password me special characters (`@ : / #`) ho to URL-encode karo (`@` → `%40`, `#` → `%23`). Better: password alphanumeric rakho.
- `sslMode=REQUIRED` **zaroori** hai — Aiven plain connection accept nahi karta.
- `useSSL=true` mat likho, Connector/J 8 me `sslMode` hi sahi property hai.

---

## 2. Local par secrets generate karo (2 minute)

Git Bash / WSL / PowerShell (PowerShell me `openssl` Git ke saath aata hai):

```bash
# JWT signing key (base64, 32+ bytes) — ise Render generate bhi kar sakta hai
openssl rand -base64 48

# Admin password — khud choose karo, strong rakho
# (ye values app reject karti hai: Admin@12345, admin, password, changeme, admin123)

# Razorpay webhook secrets — ye aap khud choose karte ho (koi bhi random string)
openssl rand -hex 24
openssl rand -hex 24
```

---

## 3. Code GitHub par push karo

Render GitHub repo se build karta hai (local folder se nahi):

```bash
git add render.yaml frontend/Dockerfile.render frontend/nginx.render.conf.template docs/DEPLOY_RENDER_AIVEN.md
git commit -m "Add Render + Aiven deployment blueprint and guide"
git push origin main
```

> Repo me pehle se `.github/workflows/*` hain — Render unhe ignore karta hai. Koi conflict nahi.

---

## 4. Render par Blueprint se deploy (recommended)

1. https://dashboard.render.com → **New → Blueprint**.
2. GitHub connect karo aur `Mentorly` repo select karo (branch `main`).
3. Render `render.yaml` padhkar 2 services dikhayega:
   - `mentorly-api` (Docker, `./backend`)
   - `mentorly-web` (Docker, `./frontend/Dockerfile.render`)
4. **Apply** dabao. Jo env vars `sync: false` hain unke liye Render ek form dikhayega — **jo values abhi pata hain wahi bharo**, baaki **blank chhod do** (baad me Environment tab se add kar lena):

   | Field | Value |
   |---|---|
   | `SPRING_DATASOURCE_URL` | `jdbc:mysql://HOST:PORT/defaultdb?sslMode=REQUIRED&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8` |
   | `SPRING_DATASOURCE_USERNAME` | `avnadmin` |
   | `SPRING_DATASOURCE_PASSWORD` | Aiven password |
   | `JWT_SECRET` | `openssl rand -base64 48` ka output (valid base64 hona zaroori hai) |
   | `APP_ADMIN_EMAIL` | aapka admin email (e.g. `admin@yourdomain.com`) |
   | `APP_ADMIN_PASSWORD` | strong password (Section 2 wala) |
   | Stripe / Razorpay / Google / GitHub / Sentry / Mail | blank chhod do, baad me |

5. **Create** → pehla build shuru. Backend ka Maven build ~5–10 min leta hai (pehli baar), frontend ~3–5 min.
6. Backend boot par **Flyway 79 migrations** chalayega (1–2 min). Uske baad `AdminDataInitializer` aapka admin user bana dega.
7. Dono services `Live` hone par URL copy karo:

   ```
   https://mentorly-api.onrender.com     ← backend
   https://mentorly-web.onrender.com     ← frontend (yahi users ko dena hai)
   ```

   ⚠️ Render naam already taken hone par suffix lagata hai (e.g. `mentorly-web-a1b2`). Aisa hua to **Section 5** ke 5 variables update karo, warna CORS/OAuth/WebSocket tootenge.

---

## 5. Pehle deploy ke baad URLs verify/fix karo (bahut zaroori)

Dashboard → `mentorly-api` → **Environment** → ye 4 values **apne asli** frontend URL par set karo:

| Variable | Value (example) |
|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://mentorly-web.onrender.com` |
| `APP_WEBSOCKET_ALLOWED_ORIGINS` | `https://mentorly-web.onrender.com` |
| `OAUTH2_REDIRECT_URL` | `https://mentorly-web.onrender.com/oauth/callback` |
| `APP_FRONTEND_BASE_URL` | `https://mentorly-web.onrender.com` |

Dashboard → `mentorly-web` → **Environment** → 1 value:

| Variable | Value |
|---|---|
| `BACKEND_URL` | `https://mentorly-api.onrender.com` (bina trailing slash) |

Save karke dono services **Manual Deploy → Deploy latest commit** (ya `Restart`) karo. `BACKEND_URL` badla ho to frontend ko **rebuild** karna padega (nginx template container start par render hota hai, isliye restart bhi kaafi hai, par rebuild safe hai).

---

## 6. Env variables — poora reference

### 6.1 Backend (`mentorly-api`) — required to boot

`SPRING_PROFILES_ACTIVE=prod` hone ki wajah se in ke bina app **start hi nahi hoga** (`EnvironmentConfigValidator` fail-fast karta hai):

| Variable | Kahan se | Example |
|---|---|---|
| `SPRING_DATASOURCE_URL` | Aiven → Connection information | `jdbc:mysql://…/defaultdb?sslMode=REQUIRED…` |
| `SPRING_DATASOURCE_PASSWORD` | Aiven | `Avn…` |
| `SPRING_DATASOURCE_USERNAME` | Aiven | `avnadmin` |
| `JWT_SECRET` | `openssl rand -base64 48` (valid base64, ≥32 bytes decode) | base64 string |
| `CORS_ALLOWED_ORIGINS` | aapka frontend URL | `https://mentorly-web.onrender.com` |
| `OAUTH2_REDIRECT_URL` | frontend URL + `/oauth/callback` | `https://mentorly-web.onrender.com/oauth/callback` |
| `PORT` / `SERVER_PORT` | `8080` (Render isi port par traffic bhejta hai) | `8080` |
| `APP_ADMIN_EMAIL` | aapka email | `admin@example.com` |
| `APP_ADMIN_PASSWORD` | aapka strong password | `Str0ng-…` |

> Note: `APP_ADMIN_EMAIL` blank chhodo to admin seed hi nahi hoga; set kiya to `APP_ADMIN_PASSWORD` bhi dena **padega** (warna prod me startup fail).

### 6.2 Backend — feature-wise

| Variable | Feature | Mandatory? |
|---|---|---|
| `APP_WEBSOCKET_ALLOWED_ORIGINS` | chat/notification WebSockets | Haan (chat ke liye) |
| `APP_FRONTEND_BASE_URL` | email/analytics links | Recommended |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Sign in with Google" | Optional |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | "Sign in with GitHub" | Optional |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe payments + mentor payouts | Optional (payments chahiye to haan) |
| `APP_PAYMENT_RAZORPAY_KEY_ID`, `APP_PAYMENT_RAZORPAY_KEY_SECRET`, `APP_PAYMENT_RAZORPAY_WEBHOOK_SECRET`, `APP_PAYOUT_RAZORPAY_WEBHOOK_SECRET`, `APP_PAYMENT_RAZORPAY_FAIL_ON_PLACEHOLDER` | Razorpay payments + payouts | Optional |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` | Google Meet links | Optional (dekho Section 11) |
| `APP_EMAIL_ENABLED`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `APP_EMAIL_FROM` | email notifications | Optional (Render free par SMTP blocked) |
| `SENTRY_DSN` | error tracking | Optional |
| `APP_TRUSTED_PROXY=true` | rate-limit/audit me asli client IP | Haan (nginx ke peeche) |
| `SERVER_FORWARD_HEADERS_STRATEGY=framework` | Google/GitHub OAuth redirect `https://<frontend>` par bane (nginx `X-Forwarded-Host` bhejta hai) | Haan (social login ke liye) |
| `APP_AUTH_COOKIE_SECURE=true` | cookies sirf HTTPS par | Haan (prod) |
| `JWT_EXPIRATION_MS`, `JWT_REFRESH_EXPIRATION_MS` | token lifetime (default 15 min / 7 din) | Optional |
| `APP_RATE_LIMIT_AUTH_PER_MINUTE` (12), `…_PAYMENT_…` (20), `…_API_WRITE_…`, `…_SEARCH_…` | rate limits | Optional |
| `APP_FILES_EXPIRATION_DAYS` (30), `APP_FILES_CLEANUP_CRON` | upload retention / purge | Optional |
| `REFRESH_TOKEN_CLEANUP_CRON` | refresh-token cleanup (default `0 20 3 * * *`) | Optional |
| `BOOKING_COMPLETION_CONFIRM_TIMEOUT_HOURS` (24), `BOOKING_COMPLETION_CHECK_POLL_MS` (120000) | auto-complete booking scheduler | Optional |
| `APP_CORS_ALLOW_CREDENTIALS` (true) | keep `true` — cookies ke liye zaroori | Optional |
| `SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE` (10) | free instance par `5` rakha gaya hai | Optional |
| `SERVER_TOMCAT_THREADS_MAX` (200) | free instance par `25` rakha gaya hai | Optional |
| `APP_REDIS_ENABLED` + `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD` | shared cache | Optional — **abhi off rakho** (code TLS support nahi karta, isliye Upstash/Redis Cloud TLS URLs kaam nahi karenge) |

### 6.3 Frontend (`mentorly-web`)

| Variable | Kya karta hai | Value |
|---|---|---|
| `BACKEND_URL` | nginx proxy target (runtime) | `https://mentorly-api.onrender.com` |
| `PORT` | nginx listen port | `8080` |
| `VITE_API_BASE_URL` | API base; **khaali** = same-origin (proxy) | *(empty)* |
| `VITE_APP_ENV` | Sentry/monitoring env label | `production` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay checkout modal | `rzp_test_…` (public key) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Elements (wallet top-up) | `pk_test_…` |
| `VITE_SENTRY_DSN` | frontend error tracking | `https://…ingest.sentry.io/…` |
| `VITE_ENABLE_MONITORING` | custom telemetry on/off | `false` (default on) |
| `VITE_MONITORING_ENDPOINT` | custom telemetry endpoint | empty |

> ⚠️ `VITE_*` values **build time** par bundle me bake hoti hain. Badalne ke baad **rebuild** zaroori hai, sirf restart se nahi.

### 6.4 Jo variables **is deploy me nahi chahiye**

| Variable | Kyun nahi |
|---|---|
| `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD` | sirf `docker-compose.yml` ke local MySQL ke liye |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` | `.env.example` me hain par **code me kahin use nahi hote** |
| `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` | purane docs me hain, code `VITE_API_BASE_URL` padhta hai |
| `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL` | docs me mention hain, code inhe read nahi karta |
| `SSL_CERT_DIR`, `FRONTEND_HTTPS_PORT` | TLS Render karta hai |

---

## 7. Saari API keys — kahan se, kya chahiye

Ek nazar me checklist (tick karte jao):

- [ ] 1. Aiven MySQL password
- [ ] 2. `JWT_SECRET` (khud generate)
- [ ] 3. `APP_ADMIN_PASSWORD` (khud choose)
- [ ] 4. Google OAuth — Client ID + Client Secret
- [ ] 5. GitHub OAuth — Client ID + Client Secret
- [ ] 6. Razorpay — Key ID + Key Secret + Webhook Secret + Payout Webhook Secret
- [ ] 7. Stripe — Secret Key + Publishable Key + Webhook Secret + Connect Webhook Secret
- [ ] 8. Google Calendar (Meet) — Client ID + Client Secret + Redirect URI
- [ ] 9. Email — `MAIL_PASSWORD` (Resend API key) + `APP_EMAIL_FROM`
- [ ] 10. Sentry — backend DSN + frontend DSN
- [ ] 11. Monitoring endpoint (optional)

### 7.0 Kaunsi key **kab** aur **kahan** paste karni hai (order-wise)

| # | Kab | Kahan (Render screen) | Variable | Value kahan se |
|---|---|---|---|---|
| 1 | Blueprint create karte waqt (form) | `mentorly-api` → Environment | `SPRING_DATASOURCE_URL` | Aiven → Overview → Connection information (Section 1 ka JDBC format) |
| 2 | wahi form | `mentorly-api` | `SPRING_DATASOURCE_USERNAME` | Aiven (`avnadmin`) |
| 3 | wahi form | `mentorly-api` | `SPRING_DATASOURCE_PASSWORD` | Aiven |
| 4 | wahi form | `mentorly-api` | `JWT_SECRET` | apne terminal me `openssl rand -base64 48` |
| 5 | wahi form | `mentorly-api` | `APP_ADMIN_EMAIL` | aapka email |
| 6 | wahi form | `mentorly-api` | `APP_ADMIN_PASSWORD` | aapka strong password |
| 7 | Baaki sab **blank** chhod do | — | — | pehla deploy chalne do |
| 8 | Deploy ke **baad** (URL pata chalne par) | `mentorly-api` | `CORS_ALLOWED_ORIGINS`, `APP_WEBSOCKET_ALLOWED_ORIGINS`, `OAUTH2_REDIRECT_URL`, `APP_FRONTEND_BASE_URL` | aapka asli frontend URL (Section 5) |
| 9 | Deploy ke baad | `mentorly-web` | `BACKEND_URL` | aapka asli backend URL |
| 10 | Google login chahiye tab | `mentorly-api` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console (Section 7.4) |
| 11 | GitHub login chahiye tab | `mentorly-api` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | github.com/settings/developers (Section 7.5) |
| 12 | Razorpay payments chahiye tab | `mentorly-api` | `APP_PAYMENT_RAZORPAY_KEY_ID`, `..._KEY_SECRET`, `..._WEBHOOK_SECRET`, `APP_PAYOUT_RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard (Section 7.6) |
| 13 | wahi | `mentorly-web` | `VITE_RAZORPAY_KEY_ID` | same Razorpay **Key ID** (public) |
| 14 | Stripe payments chahiye tab | `mentorly-api` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Dashboard (Section 7.7) |
| 15 | wahi | `mentorly-web` | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (public) |
| 16 | Google Meet chahiye tab | `mentorly-api` | `GOOGLE_CALENDAR_CLIENT_ID`, `..._CLIENT_SECRET`, `..._REDIRECT_URI` | Google Cloud Console (Section 7.8) |
| 17 | Email chahiye tab (paid instance) | `mentorly-api` | `MAIL_PASSWORD`, `APP_EMAIL_FROM`, `APP_EMAIL_ENABLED=true` | Resend (Section 7.9) |
| 18 | Error tracking chahiye tab | `mentorly-api` + `mentorly-web` | `SENTRY_DSN`, `VITE_SENTRY_DSN` | Sentry (Section 7.10) |

> `VITE_*` values **build time** par bundle me jati hain — change karne ke baad `mentorly-web` ko **rebuild** karna padega, sirf restart se kaam nahi chalega. Backend ke env vars ke liye restart kaafi hai.

### 7.1 Aiven MySQL password — *free*
Console → service → **Overview → Connection information → Password**. (Reset bhi wahin se.)

### 7.2 `JWT_SECRET` — *khud generate*
`openssl rand -base64 48` — output ko Render me `JWT_SECRET` ke roop me paste karo. Ye value **valid base64 honi chahiye** aur decode hone par kam se kam 32 bytes deni chahiye, warna `JwtService` startup par hi fail kar dega (isliye Render ke auto-generate par bharosa mat karo). **Kabhi badalna mat**, warna sab logged-out ho jayenge.

### 7.3 `APP_ADMIN_PASSWORD` — *khud choose*
Kam se kam 12 characters, letters+digits+symbol. Ye in values me se nahi hona chahiye: `Admin@12345`, `admin`, `password`, `changeme`, `admin123` (app refuse karti hai).

### 7.4 Google sign-in (OAuth2) — *free*
1. https://console.cloud.google.com → project banao (e.g. `mentorly`).
2. **APIs & Services → OAuth consent screen** → User type **External** → App name, support email, developer email bharo → Save. Testing me rehna ho to **Test users** me apna email add karo; public ke liye **Publish app**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type **Web application**.
4. **Authorized redirect URIs** (exactly ye, ek-ek line):
   ```
   https://mentorly-web.onrender.com/login/oauth2/code/google
   http://localhost:5174/login/oauth2/code/google
   ```
5. **Create** → **Client ID** (`….apps.googleusercontent.com`) aur **Client secret** (`GOCSPX-…`) copy karo → Render me `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
6. Note: client secret sirf ek baar dikhta hai; kho gaya to "Reset secret".

### 7.5 GitHub sign-in (OAuth2) — *free*
1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
2. Application name: `Mentorly`; Homepage URL: `https://mentorly-web.onrender.com`.
3. **Authorization callback URL**:
   ```
   https://mentorly-web.onrender.com/login/oauth2/code/github
   ```
4. **Register application** → **Client ID** copy karo → **Generate a new client secret** → secret copy karo (`ghp_…` jaisa nahi, 40-char hex hota hai).
5. Render me `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
6. Local dev ke liye doosra OAuth App banao callback `http://localhost:5174/login/oauth2/code/github`.

### 7.6 Razorpay — *free account, test keys*
1. https://dashboard.razorpay.com → **Test mode** toggle (top-right) ON.
2. **Settings → API Keys → Generate Test Key** → **Key ID** (`rzp_test_…`) aur **Key Secret** (sirf ek baar dikhta hai) copy karo.
3. Ye 2 values:
   - Backend: `APP_PAYMENT_RAZORPAY_KEY_ID`, `APP_PAYMENT_RAZORPAY_KEY_SECRET`
   - Frontend: `VITE_RAZORPAY_KEY_ID` — **same Key ID** (public hota hai)
4. **Webhook secret** (payment events): **Settings → Webhooks → Add New Webhook**
   - URL: `https://mentorly-web.onrender.com/api/v1/payments/webhook/razorpay`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Secret: apna random string (Section 2) → wahi Render me `APP_PAYMENT_RAZORPAY_WEBHOOK_SECRET`
5. **Payout webhook secret** (mentor payouts): doosra webhook
   - URL: `https://mentorly-web.onrender.com/api/v1/mentor/razorpay-payout/webhook`
   - Events: `transfer.processed`, `transfer.failed`, `account.updated`
   - Secret: doosra random string → `APP_PAYOUT_RAZORPAY_WEBHOOK_SECRET`
6. `APP_PAYMENT_RAZORPAY_FAIL_ON_PLACEHOLDER`: `prod` profile me default `true` hai, matlab placeholder keys par app **start hi nahi hoga** — isliye `render.yaml` me ise `false` kiya gaya hai. Jab asli (test/live) keys daal do, ise `true` kar dena.

### 7.7 Stripe — *free test mode*
1. https://dashboard.stripe.com → **Test mode** ON.
2. **Developers → API keys**:
   - **Secret key** `sk_test_…` → Render `STRIPE_SECRET_KEY`
   - **Publishable key** `pk_test_…` → frontend `VITE_STRIPE_PUBLISHABLE_KEY`
3. **Payment webhook**: **Developers → Webhooks → Add endpoint**
   - URL: `https://mentorly-web.onrender.com/api/v1/payments/webhook/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - **Signing secret** `whsec_…` → `STRIPE_WEBHOOK_SECRET`
4. **Connect webhook** (mentor payouts — alag endpoint, alag secret): dobara **Add endpoint**
   - URL: `https://mentorly-web.onrender.com/api/v1/payments/webhook/stripe-connect`
   - Events: `account.updated`, `transfer.paid`, `transfer.failed`
   - Naya `whsec_…` → `STRIPE_CONNECT_WEBHOOK_SECRET`
5. Test card: `4242 4242 4242 4242`, koi bhi future expiry, koi bhi CVC/ZIP.
6. Note: live keys (`sk_live_…`) is project me **na** daalo — README kehta hai Stripe integration test-mode ke liye hai.

### 7.8 Google Calendar / Google Meet — *free, optional (see 11.3)*
1. Usi Google Cloud project me **APIs & Services → Library → Google Calendar API → Enable**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Redirect URI: `https://mentorly-web.onrender.com/oauth2/callback`.
4. Client ID/Secret → `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`, redirect → `GOOGLE_CALENDAR_REDIRECT_URI`.
   (Yahan login wala Google client reuse bhi kar sakte ho, bas redirect URI add kar do.)

### 7.9 Email / SMTP — *free tier available*
Render **free** instances outbound ports **25, 465, 587 block** karte hain → **isse abhi `APP_EMAIL_ENABLED=false` hi rakho** (default). Paid instance lo tab ye setup karo:

1. https://resend.com → **API Keys → Create** → `re_…` copy karo (ye hi SMTP password hai).
2. Domain verify karo (Resend → Domains) aur `APP_EMAIL_FROM` me usi domain ka address do (e.g. `no-reply@yourdomain.com`).
3. Render env:
   ```
   APP_EMAIL_ENABLED=true
   MAIL_HOST=smtp.resend.com
   MAIL_PORT=465
   MAIL_USERNAME=resend
   MAIL_PASSWORD=re_xxxxxxxx
   APP_EMAIL_FROM=no-reply@yourdomain.com
   ```
4. Alternatives (same 3 line change): Brevo `smtp-relay.brevo.com:587`, SendGrid `smtp.sendgrid.net:587` (username `apikey`), Mailgun `smtp.mailgun.org:587`, Gmail app password `smtp.gmail.com:465`.
5. Yaad rakho: email enable karte hi `/actuator/health` SMTP probe bhi karta hai — SMTP toota to health DOWN (aur Render deploy fail) ho sakta hai.

### 7.10 Sentry — *free plan*
1. https://sentry.io → **Projects → Create project**.
2. Backend ke liye platform **Java / Spring Boot** → DSN copy → Render `SENTRY_DSN`.
3. Frontend ke liye platform **React** → DSN copy → `VITE_SENTRY_DSN`.
4. Chaho to ek hi project ke 2 DSN use kar sakte ho, par alag projects me errors clean rehte hain.

### 7.11 Monitoring endpoint — *optional*
`VITE_ENABLE_MONITORING=false` karke custom telemetry band kar sakte ho. Apna collector ho to URL `VITE_MONITORING_ENDPOINT` me do.

---

## 8. Webhooks — final URLs ki list

| Gateway | Endpoint |
|---|---|
| Razorpay payments | `https://mentorly-web.onrender.com/api/v1/payments/webhook/razorpay` |
| Razorpay payouts | `https://mentorly-web.onrender.com/api/v1/mentor/razorpay-payout/webhook` |
| Stripe payments | `https://mentorly-web.onrender.com/api/v1/payments/webhook/stripe` |
| Stripe Connect (payouts) | `https://mentorly-web.onrender.com/api/v1/payments/webhook/stripe-connect` |

Kyun `mentorly-web` (API host nahi): webhook signature verification origin-independent hai, par same-origin rakhne se cookie/CORS jaise edge cases nahi aate. Dono URL kaam karenge — `mentorly-api…` bhi theek hai.

---

## 9. Deploy ke baad verification (10 minute)

### 9.0 Maine locally kya-kya verify kiya (deploy se pehle hi)

Ye sab **actually chala kar** check kiya gaya, sirf padh kar nahi:

| Check | Kaise | Result |
|---|---|---|
| Backend build | `mvn -Dmaven.test.skip=true clean package` | ✅ jar bana (`backend-0.0.1-SNAPSHOT.jar`) |
| **DB load / migrations** | prod profile + Aiven-jaisa URL (`sslMode=REQUIRED`) par app start kiya | ✅ **79/79 Flyway migrations applied, 0 failed**, **62 tables** bane, Hibernate `validate` pass |
| Admin seed | same run | ✅ `Created default admin user` |
| Health endpoint | `GET /actuator/health` | ✅ `200 {"status":"UP"}` |
| Public API | `GET /api/v1/users/mentors` | ✅ `200` |
| Login + cookies | `POST /api/v1/auth/login` | ✅ `200`, cookies `Secure; HttpOnly; SameSite=Lax` |
| CORS | `OPTIONS` preflight with frontend origin | ✅ `200` + `Access-Control-Allow-Origin` / `-Credentials` |
| **OAuth redirect via proxy headers** | `Host: mentorly-api…` + `X-Forwarded-Host/Proto` | ✅ `302` → `...redirect_uri=https://mentorly-web.onrender.com/login/oauth2/code/google` |
| Frontend build | `npm run build` (VITE_API_BASE_URL empty) | ✅ exit 0 |
| Lockfile (`npm ci`) | `npm ci --dry-run` | ✅ exit 0 (Dockerfile ka `npm ci` chalega) |
| **nginx config** | rendered template ko NGINX ke apne parser (`crossplane`) se `--strict` | ✅ `status: ok`, **0 errors**, 8 locations |
| `render.yaml` | YAML parse + env key duplicate check | ✅ 2 services, 0 duplicates |

Boot time measured (is laptop par, 8-core): pehla boot (79 migrations) **124s**, schema ready hone ke baad **75s**. Render ke 512 MB / 0.1 CPU free instance par ye ~1.5–3 min ho sakta hai — Render ka health-check window 15 min hai, isliye deploy fail nahi hoga; bas pehli request slow lagegi.

### 9.1 Backend health
```bash
curl -i https://mentorly-api.onrender.com/actuator/health
# 200 + {"status":"UP"}  (pehli call par free instance ko ~1 min lag sakta hai)
```

### 9.2 Frontend + proxy
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mentorly-web.onrender.com/       # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mentorly-web.onrender.com/api/v1/users/mentors  # 200
```
Doosri call 404/502 deti hai to `BACKEND_URL` galat hai ya backend down hai.

### 9.3 Signup + login
1. `https://mentorly-web.onrender.com/signup` → learner signup.
2. Email verification OTP screen aaye to `APP_EMAIL_ENABLED=false` me OTP log me aata hai:
   Render → `mentorly-api` → **Logs** → `verification` search karo.
3. Login karke `/complete-profile` flow poora karo, learner dashboard khule.

### 9.4 Admin
`https://mentorly-web.onrender.com/admin/login` → `APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD`. Admin dashboard khulna chahiye (pehli boot par seed hota hai).

### 9.5 Chat (WebSocket) — proxy ka asli test
Do browser windows me learner + mentor login karo → `/messages` → message bhejo. DevTools → Network → **WS** tab me `wss://mentorly-web.onrender.com/ws/chat/...` `101 Switching Protocols` dikhna chahiye.

### 9.6 Admin verification page
Admin → **Health** page → DB connection green. Admin → **Verifications / Users** list load ho rahi hai to Flyway + JPA sab sahi hai.

### 9.7 Payment (Stripe test)
Mentor → wallet top-up → card `4242 4242 4242 4242` → success. Backend logs me `Stripe PaymentIntent created` aur `Stripe webhook signature verification: PASSED` dikhe.

---

## 10. Troubleshooting — jo errors actually aayenge

| Error | Matlab / Fix |
|---|---|
| Deploy fail: `Application startup blocked: required environment variable(s) are missing` | `CORS_ALLOWED_ORIGINS` / `OAUTH2_REDIRECT_URL` / `SPRING_DATASOURCE_PASSWORD` / `JWT_SECRET` me se koi missing. Log me naam likha hoga. |
| `Refusing to start: Razorpay keys are using default/test placeholder values` | `APP_PAYMENT_RAZORPAY_FAIL_ON_PLACEHOLDER=false` karo ya asli Razorpay keys daalo. |
| `Refusing to start: APP_ADMIN_PASSWORD is not configured…` | `APP_ADMIN_EMAIL` set hai par password nahi — dono do, ya dono khaali chhodo. |
| `Communications link failure` / `SSL/TLS` error | JDBC URL me `sslMode=REQUIRED` missing, ya Aiven port galat (3306 nahi, jo Aiven dikhata hai). |
| `Access denied for user 'avnadmin'` | Password galat / URL-encode nahi kiya (special chars), ya Aiven service paused hai. |
| `Health check failed` + 503 on `/actuator/health` | DB connect nahi ho raha, ya `APP_EMAIL_ENABLED=true` + SMTP toota. |
| Login ke baad turant logout | Cookies nahi ja rahe: frontend different host par hai, ya `APP_AUTH_COOKIE_SECURE=true` par HTTP access. Sirf `https://mentorly-web…` use karo. |
| CORS error browser me | `CORS_ALLOWED_ORIGINS` me exact origin (scheme + host, **no trailing slash**). |
| WS `1006`/failed | `APP_WEBSOCKET_ALLOWED_ORIGINS` me frontend origin, aur `/ws/` proxy (nginx template) check karo. |
| Google login `redirect_uri_mismatch` | Google console me **exactly** `https://mentorly-web.onrender.com/login/oauth2/code/google` hona chahiye (trailing slash nahi). |
| `502 Bad Gateway` on `/api/...` | `BACKEND_URL` galat/down. Backend health pehle check karo; free instance cold start 1 min. |
| Build fail: `npm ci` lock mismatch | `frontend/package-lock.json` commit hona chahiye (hai). Local `npm install` ke baad lock push karo. |
| Build fail (backend): out of memory | Free build me 8 GB milta hai; dobara deploy karo. `-Dmaven.test.skip=true` already set hai. |
| `Template `nginx.render.conf.template` not found` | `dockerContext` galat hai — `./frontend` hona chahiye aur file `frontend/` me honi chahiye. |

---

## 11. Free plan ki limits + is project ki known limitations

### 11.1 Render free web service
- 512 MB RAM / 0.1 CPU → JVM `MaxRAMPercentage=65` + Tomcat 25 threads par set hai. Bahut load par slow hoga.
- **15 min inactivity** par sleep, phir pehli request par cold start — locally measured **75s (warm DB)** / **124s (fresh migrations)**; free instance par ~1.5–3 min. Deploy ke baad turant na kholo, ek baar `curl` chala kar jaga lo.
- Workspace me **750 instance-hours/month** (dono services share karte hain). Din bhar chalane par ~1440 hours lagte hain → month ke aakhir me suspend ho sakta hai. Demo/hobby ke liye theek.
- **Persistent disk nahi** → neeche point 11.3.
- Outbound SMTP ports 25/465/587 blocked → email band rakho.

### 11.2 OAuth redirects aur proxy headers
Frontend nginx backend ko `Host: mentorly-api.onrender.com` (Render routing ke liye) aur `X-Forwarded-Host: mentorly-web.onrender.com` + `X-Forwarded-Proto: https` bhejta hai. Isi wajah se `SERVER_FORWARD_HEADERS_STRATEGY=framework` set hai — iske bina Google/GitHub ka `redirect_uri` galat host (backend ya `http://`) par banta hai aur `redirect_uri_mismatch` aata hai.

### 11.3 Chat attachments restart par gayab
`StoredFileService` files `uploads/chat/` me **disk par** likhta hai. Render free ka filesystem ephemeral hai → har restart/redeploy par attachments delete. Production chahiye to S3/R2 add karna padega (code change zaroori hai; `.env.example` ke AWS vars abhi kisi code me use nahi hote).

### 11.4 Google Meet links abhi code me adhoore hain
`GoogleCalendarMeetingProvider` credentials maangta hai, par token lene ka OAuth step (`GoogleOAuthTokenManager.authenticate`) kahin call **nahi** hota — token store karne ka koi endpoint nahi hai. Result: **mentor "live session create" karega to `MeetingProviderException` aayegi** (booking/payment/chat par asar nahi). Keys daalna safe hai, par is feature ke liye code me token flow add karna padega.

### 11.5 Aiven free MySQL
- 1 GB disk, `max_connections` 76 (Hikari 10 use karta hai — theek hai).
- Ek organization = ek free MySQL.
- Backups milte hain, par SLA nahi. Inactivity par power-off ho sakta hai (mail aata hai).

### 11.6 Redis
Off rakho. Code sirf plain Redis (no TLS) support karta hai, isliye Upstash/Redis Cloud ke `rediss://` URLs kaam nahi karenge.

---

## 12. Blueprint ke bina manual deploy (agar `render.yaml` use nahi karna)

**Backend**
- New → **Web Service** → repo → Branch `main` → Runtime **Docker**
- Root Directory: `backend` · Dockerfile Path: `Dockerfile` · Build Context: *(khaali)*
- *(alternative: Root Directory khaali chhodo — repo root ka `Dockerfile` khud build ho jaayega, path bhi khaali)*
- Region: `singapore` · Plan: **Free**
- Health check path: `/actuator/health`
- Port: kuch set karne ki zaroorat nahi — image `$PORT` par bind karta hai (`--server.port=${PORT:-8080}`)
- Env vars: Section 6.1 + 6.2

**Frontend**
- New → **Web Service** → same repo → Runtime **Docker**
- Root Directory: `frontend` · Dockerfile Path: `Dockerfile.render` · Build Context: *(khaali)*
- ⚠ `frontend/Dockerfile` (bina `.render`) mat chuno — wo compose/VPS wala TLS image hai, Render par 443 bind karke fail hoga.
- Health check path: `/`
- Env vars: Section 6.3

---

## 13. Ek line me summary

Aiven par free MySQL banao → Render par `render.yaml` Blueprint apply karo → DB + admin values bharo → dono service ke asli URLs 5 env vars me update karo → `/actuator/health` aur `/api/v1/users/mentors` check karo → signup/admin/chat test karo. Bas.
