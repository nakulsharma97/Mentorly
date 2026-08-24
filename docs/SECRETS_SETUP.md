# 🔐 Complete Secrets Setup Guide

This document lists **every secret and config variable** the project needs.
Follow each step in order. Secrets are never committed — they live only in GitHub.

---

## STEP 1 — Repository Secrets

**Path:** GitHub → Your repo → **Settings** → **Secrets and variables** → **Actions** → **Repository secrets** → **New repository secret**

---

### 🔒 A. Authentication & Security (Required)

| # | Secret Name | Value | How to generate |
|---|---|---|---|
| 1 | `JWT_SECRET` | Base64 string, ≥32 chars | Run: `openssl rand -base64 32` in terminal |
| 2 | `MYSQL_ROOT_PASSWORD` | Strong password | Make one up, e.g. `MyS3cure!Root2026` |
| 3 | `MYSQL_PASSWORD` | Strong password | Make one up, e.g. `MyS3cure!App2026` |

---

### 👤 B. Admin User (Required — backend refuses to start in prod without these)

| # | Secret Name | Value | Notes |
|---|---|---|---|
| 4 | `APP_ADMIN_EMAIL` | Your email, e.g. `admin@mentorly.app` | First admin account email |
| 5 | `APP_ADMIN_PASSWORD` | Strong password (NOT `Admin@12345`) | Backend REFUSES to start with default in prod |
| 6 | `APP_ADMIN_NAME` | Display name, e.g. `Platform Admin` | Optional, defaults to `Platform Admin` |

---

### 🌐 C. CORS & OAuth Redirect (Required)

| # | Secret Name | Value | Example |
|---|---|---|---|
| 7 | `CORS_ALLOWED_ORIGINS` | Your domain(s), comma-separated | `https://yourdomain.com,https://www.yourdomain.com` |
| 8 | `OAUTH2_REDIRECT_URL` | OAuth callback URL | `https://yourdomain.com/oauth/callback` |

---

### 🔑 D. Google OAuth — Login with Google (Required if using social login)

**Where to get these:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `https://yourdomain.com/login/oauth2/code/google`
7. Copy the **Client ID** and **Client Secret**

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 9 | `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Google Cloud Console → Credentials → OAuth 2.0 Client ID |
| 10 | `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Same page, click the copy icon next to Client Secret |

---

### 🐙 E. GitHub OAuth — Login with GitHub (Required if using social login)

**Where to get these:**
1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Application name: `Mentorly`
4. Homepage URL: `https://yourdomain.com`
5. Authorization callback URL: `https://yourdomain.com/login/oauth2/code/github`
6. Click **Register application**
7. Copy the **Client ID**
8. Click **Generate a new client secret** and copy it immediately

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 11 | `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | GitHub Settings → Developer settings → OAuth Apps |
| 12 | `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | Same page, generate new client secret |

---

### 📧 F. Email / SMTP — Sending OTP & Verification Emails (Required for signup OTP)

**Where to get these:** Use any SMTP provider (Resend, SendGrid, Mailgun, Gmail, etc.)

| # | Secret Name | Value | Example |
|---|---|---|---|
| 13 | `APP_EMAIL_ENABLED` | `true` to enable email sending | `true` |
| 14 | `MAIL_HOST` | SMTP server hostname | `smtp.resend.com` or `smtp.gmail.com` |
| 15 | `MAIL_PORT` | SMTP port | `465` (SSL) or `587` (TLS) |
| 16 | `MAIL_USERNAME` | SMTP username | e.g. `resend` or your email |
| 17 | `MAIL_PASSWORD` | SMTP password / API key | From your email provider dashboard |
| 18 | `APP_EMAIL_FROM` | Sender email address | e.g. `noreply@yourdomain.com` |

**Free SMTP options:**
- **Resend** (recommended): https://resend.com — free tier: 100 emails/day
- **Gmail**: Use app password (not regular password) — enable 2FA first
- **SendGrid**: https://sendgrid.com — free tier: 100 emails/day

---

### 💳 G. Razorpay — Payment Gateway (Required if accepting payments)

**Where to get these:**
1. Go to https://dashboard.razorpay.com
2. Sign up / Login
3. Go to **Settings** → **API Keys**
4. Click **Generate Key**
5. Copy **Key ID** and **Key Secret**

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 19 | `RAZORPAY_KEY_ID` | Razorpay Key ID | Razorpay Dashboard → Settings → API Keys → Key ID |
| 20 | `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Same page, copy the secret |
| 21 | `VITE_RAZORPAY_KEY_ID` | Same as `RAZORPAY_KEY_ID` | Frontend needs it too (VITE_ prefix exposes to browser) |

---

### 💳 H. Stripe — Payment Gateway (Optional — alternative to Razorpay)

**Where to get these:**
1. Go to https://dashboard.stripe.com
2. Toggle **Test mode** (top-right)
3. Go to **Developers** → **API keys** → Copy **Secret key**
4. Go to **Developers** → **Webhooks** → Add endpoint → Copy **Signing secret**

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 22 | `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard → Developers → API Keys → Secret key (sk_test_...) |
| 23 | `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard → Developers → Webhooks → Signing secret (whsec_...) |

---

### ☁️ I. AWS S3 — File Uploads (Optional)

**Where to get these:**
1. Go to https://console.aws.amazon.com
2. Go to **IAM** → **Users** → **Create user**
3. Attach policy: `AmazonS3FullAccess` (or custom policy)
4. Go to **Security credentials** → **Create access key**
5. Create S3 bucket at https://s3.console.aws.amazon.com

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 24 | `AWS_ACCESS_KEY_ID` | AWS Access Key | AWS Console → IAM → Users → Security credentials |
| 25 | `AWS_SECRET_ACCESS_KEY` | AWS Secret Key | Same page, create access key |
| 26 | `AWS_REGION` | AWS region | e.g. `ap-south-1` (Mumbai) or `us-east-1` (Virginia) |
| 27 | `S3_BUCKET` | S3 bucket name | e.g. `mentorly-uploads` |

---

### 📊 J. Sentry — Error Tracking (Optional)

**Where to get these:**
1. Go to https://sentry.io
2. Create project → **React** for frontend, **Spring Boot** for backend
3. Copy the DSN from project settings

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 28 | `SENTRY_DSN` | Backend Sentry DSN | Sentry → Backend project → Settings → Client Keys |
| 29 | `VITE_SENTRY_DSN` | Frontend Sentry DSN | Sentry → Frontend project → Settings → Client Keys |

---

### 🔔 K. Notifications (Optional)

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 30 | `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | Slack → Apps → Incoming Webhooks → Add to Slack |
| 31 | `MAIL_SERVER` | SMTP hostname (for CI notifications) | Same as `MAIL_HOST` above |
| 32 | `MAIL_PORT` | SMTP port | Same as above |
| 33 | `MAIL_USERNAME` | SMTP username | Same as above |
| 34 | `MAIL_PASSWORD` | SMTP password | Same as above |
| 35 | `MAIL_TO` | Notification recipient email | e.g. `team@yourdomain.com` |
| 36 | `MAIL_FROM` | Sender email | e.g. `CI Bot <ci@yourdomain.com>` |

---

## STEP 2 — Production Environment Secrets

**Path:** GitHub → Your repo → **Settings** → **Environments** → **New environment** → Name it `production` → **Create** → **Environment secrets** → **Add secret**

---

### 🚀 L. Deployment SSH Access (Required)

| # | Secret Name | Value | How to get |
|---|---|---|---|
| 1 | `DEPLOY_HOST` | Server IP or hostname | Your VPS/cloud server IP, e.g. `123.45.67.89` |
| 2 | `DEPLOY_USER` | SSH username | e.g. `ubuntu`, `root`, `deploy` |
| 3 | `DEPLOY_PATH` | Absolute path to project on server | e.g. `/opt/Mentorly` |
| 4 | `DEPLOY_SSH_KEY` | Full SSH private key | See instructions below |

### Optional

| # | Secret Name | Value | Default |
|---|---|---|---|
| 5 | `DEPLOY_SSH_PORT` | SSH port number | `22` |
| 6 | `DEPLOY_PROTOCOL` | Protocol for health checks | `https` |

### How to generate `DEPLOY_SSH_KEY`

```bash
# On your LOCAL machine, generate a new SSH key pair:
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key -N ""

# The PRIVATE key is what you paste as DEPLOY_SSH_KEY.
# Copy the entire contents of deploy_key (the file WITHOUT .pub extension).

# Then copy the PUBLIC key to your server:
ssh-copy-id -i deploy_key.pub ubuntu@YOUR_SERVER_IP

# Test the connection:
ssh -i deploy_key ubuntu@YOUR_SERVER_IP
```

### Enable Protection Rules (recommended)

On the same `production` environment page:
- ☑ **Required reviewers** — add yourself or a team member
- ☑ **Restrict to protected branches** — only `main` branch can deploy
- **Wait timer** — optional, set 5 minutes for rollback buffer

---

## STEP 3 — Staging Environment (Optional)

**Path:** GitHub → Your repo → **Settings** → **Environments** → **New environment** → Name it `staging` → **Environment secrets** → **Add secret**

| # | Secret Name | Value | Notes |
|---|---|---|---|
| 1 | `STAGING_HOST` | Staging server IP | Same format as production |
| 2 | `STAGING_USER` | SSH username | Same format as production |
| 3 | `STAGING_PATH` | Project path on staging server | e.g. `/opt/Mentorly-staging` |
| 4 | `STAGING_SSH_KEY` | SSH private key for staging | Generate separately or reuse |
| 5 | `STAGING_SSH_PORT` | SSH port | Defaults to `22` |
| 6 | `STAGING_PROTOCOL` | Protocol for health checks | Defaults to `https` |

---

## STEP 4 — Server Prerequisites

Before deploying, ensure your production server has:

```bash
# 1. Docker + Docker Compose installed
docker --version        # Docker 20.10+
docker compose version  # v2+

# 2. Project cloned at DEPLOY_PATH
cd /opt/Mentorly
git pull origin main

# 3. deploy.sh is executable
chmod +x scripts/deploy.sh

# 4. Firewall allows SSH (22) and HTTP/HTTPS (80/443)
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# 5. The deploy user has permission to run docker
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

---

## STEP 5 — Verify Setup

After adding all secrets:

1. Go to **Actions** tab → **backend-ci** → **Run workflow** → **Run workflow**
2. Wait for CI to pass (tests + Docker image build)
3. The **deploy** workflow will trigger automatically on success
4. If it fails, check **Actions** → **deploy** → expand the failed step for details

---

## Quick Reference — All Secrets at a Glance

```
REPOSITORY SECRETS (Settings → Secrets → Repository secrets):

  🔒 Authentication & Security
  JWT_SECRET              ✅ Required
  MYSQL_ROOT_PASSWORD     ✅ Required
  MYSQL_PASSWORD          ✅ Required

  👤 Admin User
  APP_ADMIN_EMAIL         ✅ Required
  APP_ADMIN_PASSWORD      ✅ Required
  APP_ADMIN_NAME          Optional

  🌐 CORS & OAuth Redirect
  CORS_ALLOWED_ORIGINS    ✅ Required
  OAUTH2_REDIRECT_URL     ✅ Required

  🔑 Google OAuth
  GOOGLE_CLIENT_ID        ✅ Required (if using social login)
  GOOGLE_CLIENT_SECRET    ✅ Required (if using social login)

  🐙 GitHub OAuth
  GITHUB_CLIENT_ID        ✅ Required (if using social login)
  GITHUB_CLIENT_SECRET    ✅ Required (if using social login)

  📧 Email / SMTP (for OTP & verification)
  APP_EMAIL_ENABLED       ✅ Required (set to "true")
  MAIL_HOST               ✅ Required (if email enabled)
  MAIL_PORT               ✅ Required (if email enabled)
  MAIL_USERNAME           ✅ Required (if email enabled)
  MAIL_PASSWORD           ✅ Required (if email enabled)
  APP_EMAIL_FROM          ✅ Required (if email enabled)

  💳 Razorpay (Payments)
  RAZORPAY_KEY_ID         ✅ Required (if using payments)
  RAZORPAY_KEY_SECRET     ✅ Required (if using payments)
  VITE_RAZORPAY_KEY_ID    ✅ Required (if using payments)

  💳 Stripe (Payments - Optional)
  STRIPE_SECRET_KEY       Optional
  STRIPE_WEBHOOK_SECRET   Optional

  ☁️ AWS S3 (File Uploads - Optional)
  AWS_ACCESS_KEY_ID       Optional
  AWS_SECRET_ACCESS_KEY   Optional
  AWS_REGION              Optional
  S3_BUCKET               Optional

  📊 Sentry (Error Tracking - Optional)
  SENTRY_DSN              Optional
  VITE_SENTRY_DSN         Optional

  🔔 Notifications
  SLACK_WEBHOOK_URL       Optional
  MAIL_SERVER             Optional
  MAIL_PORT               Optional
  MAIL_USERNAME           Optional
  MAIL_PASSWORD           Optional
  MAIL_TO                 Optional
  MAIL_FROM               Optional

PRODUCTION ENVIRONMENT (Settings → Environments → production):
  DEPLOY_HOST             ✅ Required
  DEPLOY_USER             ✅ Required
  DEPLOY_PATH             ✅ Required
  DEPLOY_SSH_KEY          ✅ Required
  DEPLOY_SSH_PORT         Optional (default: 22)
  DEPLOY_PROTOCOL         Optional (default: https)

STAGING ENVIRONMENT (Settings → Environments → staging):
  STAGING_HOST            Optional
  STAGING_USER            Optional
  STAGING_PATH            Optional
  STAGING_SSH_KEY         Optional
  STAGING_SSH_PORT        Optional (default: 22)
  STAGING_PROTOCOL        Optional (default: https)
```
