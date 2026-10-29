# Environment Variables Reference

This document describes all environment variables used by the Skill Swapping Platform.

## Backend Environment Variables

### Database Configuration

| Variable                        | Purpose                  | Default         | Example                                             |
| ------------------------------- | ------------------------ | --------------- | --------------------------------------------------- |
| `SPRING_DATASOURCE_URL`         | MySQL connection URL     | None (required) | `jdbc:mysql://localhost:3306/skillswap?useSSL=true` |
| `SPRING_DATASOURCE_USERNAME`    | Database username        | None (required) | `skillswap_user`                                    |
| `SPRING_DATASOURCE_PASSWORD`    | Database password        | None (required) | `secure-password-here`                              |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Hibernate DDL behavior   | `validate`      | `validate` (use Flyway migrations)                  |
| `SPRING_FLYWAY_ENABLED`         | Enable Flyway migrations | `true`          | `true`                                              |

### Server Configuration

| Variable                      | Purpose          | Default             | Example             |
| ----------------------------- | ---------------- | ------------------- | ------------------- |
| `SERVER_PORT`                 | Application port | `8080`              | `8080`              |
| `SERVER_SERVLET_CONTEXT_PATH` | API base path    | `/`                 | `/api`              |
| `SPRING_APPLICATION_NAME`     | Application name | `skillswap-backend` | `skillswap-backend` |

### Security & Authentication

| Variable                                                          | Purpose                                | Default                                       | Example                                           |
| ----------------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `JWT_SECRET`                                                      | JWT signing key (base64)               | None (required)                               | `your-256-bit-base64-encoded-key`                 |
| `JWT_EXPIRATION`                                                  | JWT expiration time in ms              | `86400000` (24h)                              | `86400000`                                        |
| `JWT_REFRESH_EXPIRATION`                                          | Refresh token expiration in ms         | `604800000` (7d)                              | `604800000`                                       |
| `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID`     | Google OAuth2 client ID                | None                                          | `xxx.apps.googleusercontent.com`                  |
| `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET` | Google OAuth2 secret                   | None                                          | `GOCSPX-xxx...`                                   |
| `CORS_ALLOWED_ORIGINS`                                            | CORS allowed origins (comma-separated) | `http://localhost:5174,http://127.0.0.1:5174` | `https://app.example.com,https://www.example.com` |

### Email Configuration

Email sending is **optional and disabled by default** (`APP_EMAIL_ENABLED=false`). Two
transports exist and `APP_EMAIL_PROVIDER` picks one:

- `SMTP` (default) — the classic JavaMailSender path using `MAIL_*`.
- `BREVO_API` — Brevo's REST API over HTTPS/443 using `BREVO_API_KEY`.

**Render free web services block outbound SMTP ports 25/465/587**, so the SMTP transport
can never connect there; use `BREVO_API`. An unknown provider value fails fast at startup.

With email disabled in a production-like profile (anything other than dev/local/test),
`POST /api/v1/auth/send-verification-otp` and `POST /api/v1/auth/forgot-password` return
**HTTP 503 `Email service is not configured.`** rather than claiming a code was sent. In
dev/local they keep the log-only behaviour so no SMTP server is needed locally.

The `/actuator/health` mail probe is **off by default** (`MANAGEMENT_HEALTH_MAIL_ENABLED`),
so health stays independent of email — on hosts that block SMTP the probe would otherwise
report DOWN even while the Brevo transport delivers mail. Enable it only when SMTP is the
active transport and its failure should fail the health check.

| Variable                      | Purpose                                             | Default                  | Example                        |
| ----------------------------- | --------------------------------------------------- | ------------------------ | ------------------------------ |
| `APP_EMAIL_ENABLED`           | Master switch for email sending                     | `false`                  | `true`                         |
| `APP_EMAIL_PROVIDER`          | `SMTP` or `BREVO_API` (case-insensitive)            | `SMTP`                   | `BREVO_API`                    |
| `APP_EMAIL_FROM`              | From address (must be a verified Brevo sender)      | `no-reply@mentorly.app`  | `no-reply@mentorly.app`        |
| `APP_EMAIL_FROM_NAME`         | Display name on Brevo sends                         | `Mentorly`               | `Mentorly`                     |
| `BREVO_API_KEY`               | Brevo API key (server-side only)                    | None (required for Brevo)| `xkeysib-xxx...`               |
| `BREVO_API_BASE_URL`          | Brevo API base URL (tests point this at a fake)     | `https://api.brevo.com`  | `https://api.brevo.com`        |
| `MAIL_HOST`                   | SMTP server                                         | `smtp.resend.com`        | `smtp.resend.com`              |
| `MAIL_PORT`                   | SMTP port                                           | `465`                    | `587`                          |
| `MAIL_USERNAME`               | SMTP username                                       | `resend`                 | `resend`                       |
| `MAIL_PASSWORD`               | SMTP password (required when SMTP is enabled)       | None (required)          | `re_xxx...`                    |
| `MAIL_SSL_ENABLE`             | Implicit TLS (true for 465)                         | `true`                   | `true`                         |
| `MAIL_STARTTLS_ENABLE`        | STARTTLS upgrade (true for 587)                     | `false`                  | `true`                         |
| `MAIL_CONNECTION_TIMEOUT_MS`  | SMTP connect timeout                                | `10000`                  | `10000`                        |
| `MAIL_READ_TIMEOUT_MS`        | SMTP read timeout                                   | `10000`                  | `10000`                        |
| `MAIL_WRITE_TIMEOUT_MS`       | SMTP write timeout                                  | `10000`                  | `10000`                        |
| `MANAGEMENT_HEALTH_MAIL_ENABLED` | Run the SMTP health probe                        | `false`                  | `true`                         |

### Payment Processing

| Variable                | Purpose                        | Default            | Example                                   |
| ----------------------- | ------------------------------ | ------------------ | ----------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe secret API key          | None               | `sk_live_xxx...`                          |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook key             | None               | `whsec_xxx...`                            |
| `PAYMENT_SUCCESS_URL`   | Success redirect after payment | `/payment-success` | `https://app.example.com/payment-success` |
| `PAYMENT_CANCEL_URL`    | Cancel redirect after payment  | `/payment-cancel`  | `https://app.example.com/payment-cancel`  |

> **Note — payment adapters:** the `PaymentGateway` Strategy pattern has two adapters. **Stripe is a real integration** — `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are used to call Stripe's test-mode API (`PaymentIntent.create`, refunds) and to verify webhook signatures via `Webhook.constructEvent`; if they are left unset the adapter only warns, and any real call fails with a clean Stripe API error. **Razorpay remains a simulated** reference implementation. `PAYMENT_SUCCESS_URL` / `PAYMENT_CANCEL_URL` drive the checkout redirect flow regardless.

### Rate Limiting

| Variable                                 | Purpose                     | Default | Example |
| ---------------------------------------- | --------------------------- | ------- | ------- |
| `RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE`    | Auth endpoint rate limit    | `20`    | `20`    |
| `RATE_LIMIT_PAYMENT_REQUESTS_PER_MINUTE` | Payment endpoint rate limit | `30`    | `30`    |
| `RATE_LIMIT_DEFAULT_REQUESTS_PER_MINUTE` | Default rate limit          | `100`   | `100`   |

### Logging & Observability

| Variable                                     | Purpose               | Default   | Example                        |
| -------------------------------------------- | --------------------- | --------- | ------------------------------ |
| `LOGGING_LEVEL_COM_SKILLSWAP`                | App log level         | `INFO`    | `DEBUG`                        |
| `LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_SECURITY` | Security log level    | `DEBUG`   | `DEBUG`                        |
| `SPRING_PROFILES_ACTIVE`                     | Active Spring profile | `default` | `prod`                         |
| `SENTRY_DSN`                                 | Sentry error tracking | None      | `https://xxx@sentry.io/123456` |

### Actuator & Metrics

| Variable                                    | Purpose                    | Default                          | Example                          |
| ------------------------------------------- | -------------------------- | -------------------------------- | -------------------------------- |
| `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE` | Exposed actuator endpoints | `health,info,metrics,prometheus` | `health,info,metrics,prometheus` |
| `MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS`   | Health details visibility  | `when-authorized`                | `when-authorized`                |

## Frontend Environment Variables

All frontend variables must be prefixed with `VITE_` to be accessible in the app.

| Variable                | Purpose                          | Default                 | Example                          |
| ----------------------- | -------------------------------- | ----------------------- | -------------------------------- |
| `VITE_API_URL`          | Backend API base URL             | `http://localhost:8080` | `https://api.example.com`        |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 client ID          | None                    | `xxx.apps.googleusercontent.com` |
| `VITE_SENTRY_DSN`       | Sentry error tracking (frontend) | None                    | `https://xxx@sentry.io/654321`   |
| `VITE_APP_ENV`          | Environment name                 | `development`           | `production`                     |

## Setting Environment Variables

### Method 1: System Environment Variables

**Linux/macOS**:

```bash
# Add to ~/.bashrc or ~/.zshrc
export JWT_SECRET="your-secret-here"
export DB_PASSWORD="your-password-here"

# Load changes
source ~/.bashrc
```

**Windows (PowerShell)**:

```powershell
$env:JWT_SECRET = "your-secret-here"
$env:DB_PASSWORD = "your-password-here"
```

**Windows (CMD)**:

```cmd
set JWT_SECRET=your-secret-here
set DB_PASSWORD=your-password-here
```

### Method 2: .env File

Create `.env` in the **project root or `backend/`** (don't commit to Git):

```bash
# Backend
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/skillswap
SPRING_DATASOURCE_USERNAME=skillswap_user
SPRING_DATASOURCE_PASSWORD=password
JWT_SECRET=base64-encoded-secret-here
```

**Spring Boot loads `.env` automatically** via `spring.config.import` in
`backend/src/main/resources/application.yml` — no manual `export` needed for
`mvn spring-boot:run`, IDE launches, or `java -jar`. OS environment variables
always take precedence over `.env` values, so values you export explicitly
still win. The `.env` is parsed as Java properties (`KEY=VALUE`, `#` comments);
`optional:` makes a missing file harmless (e.g. containers).

Only if you prefer to load it by hand in your terminal:

```bash
export $(cat .env | xargs)
mvn spring-boot:run
```

### Method 3: Docker Environment

```dockerfile
# In Dockerfile
ENV JWT_SECRET=${JWT_SECRET}
ENV DB_URL=${DB_URL}

# Or in docker-compose.yml
services:
  backend:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DB_URL=${DB_URL}
```

### Method 4: Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: skillswap-secrets
type: Opaque
stringData:
  JWT_SECRET: base64-encoded-secret-here
  DB_PASSWORD: password-here

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skillswap-backend
spec:
  template:
    spec:
      containers:
        - name: backend
          envFrom:
            - secretRef:
                name: skillswap-secrets
```

## Validation

### Check if variables are set

**Bash**:

```bash
# Check single variable
echo $JWT_SECRET

# Check multiple
env | grep -E "JWT|DB|STRIPE"
```

**PowerShell**:

```powershell
# Check single variable
$env:JWT_SECRET

# Check multiple
Get-ChildItem Env: | Where-Object {$_.Name -match "JWT|DB|STRIPE"}
```

### Application startup logs

The backend logs which environment is loaded:

```
Starting SkillSwapApplication...
The following profiles are active: prod
```

Check for any `WARN` about missing required variables.

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`:

   ```
   .env
   .env.local
   .env.*.local
   ```

2. **Never log sensitive values** - Spring Boot masks common secrets in logs:

   ```
   password=***
   secret=***
   token=***
   ```

3. **Use separate values per environment**:
   - Development: localhost URLs, test keys
   - Staging: staging domains, test keys
   - Production: production domains, live keys

4. **Rotate keys periodically** (every 90 days minimum)

5. **Least privilege**: Only set variables an app needs

## Environment-Specific Examples

### Development (.env.local)

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/skillswap
JWT_SECRET=dev-secret-not-secure
APP_EMAIL_ENABLED=false
STRIPE_SECRET_KEY=sk_test_xxx
```

### Staging (.env.staging)

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://db.staging.example.com:3306/skillswap
JWT_SECRET=staging-secret-xxx
CORS_ALLOWED_ORIGINS=https://staging.example.com
STRIPE_SECRET_KEY=sk_test_xxx
```

### Production (.env.prod - NEVER COMMIT)

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://db.prod.example.com:3306/skillswap
JWT_SECRET=prod-secret-xxx-keep-secure
CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
STRIPE_SECRET_KEY=sk_test_xxx # Stripe is a live test-mode integration — use TEST keys, never live keys
SENTRY_DSN=https://xxx@sentry.io/123456
```

## Troubleshooting

| Issue                      | Solution                                                    |
| -------------------------- | ----------------------------------------------------------- |
| "Property not found" error | Check variable name matches exactly (case-sensitive)        |
| Empty value in logs        | Verify variable is actually set in environment              |
| Wrong URL used             | Ensure you set the right variable for the right environment |
| Secrets visible in logs    | Check Spring Cloud Config for masking patterns              |

## References

- [Spring Boot: Application Properties](https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html)
- [Vite: Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Stripe: API Keys](https://stripe.com/docs/keys)
- [OWASP: Configuration Management](https://cheatsheetseries.owasp.org/cheatsheets/Configuration_Cheat_Sheet.html)
