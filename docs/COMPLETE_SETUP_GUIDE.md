# 🚀 Complete Project Setup Guide — Mentorly Platform

This is the **definitive guide** to get Mentorly running from zero to production.
Follow every step in order. Do not skip anything.

---

## TABLE OF CONTENTS

1. [What You Need Before Starting](#1-what-you-need-before-starting)
2. [Create All Accounts & Get API Keys](#2-create-all-accounts--get-api-keys)
3. [Local Development Setup](#3-local-development-setup)
4. [GitHub Secrets (CI/CD)](#4-github-secrets-cicd)
5. [Production Server Setup](#5-production-server-setup)
6. [Domain & DNS Setup](#6-domain--dns-setup)
7. [SSL Certificate Setup](#7-ssl-certificate-setup)
8. [Deploy to Production](#8-deploy-to-production)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What You Need Before Starting

### Accounts to Create (Free)

| # | Account | URL | Why |
|---|---|---|---|
| 1 | GitHub | https://github.com | Code hosting + CI/CD |
| 2 | Razorpay | https://dashboard.razorpay.com | Payment gateway |
| 3 | Google Cloud | https://console.cloud.google.com | Google OAuth login |
| 4 | GitHub OAuth | https://github.com/settings/developers | GitHub OAuth login |
| 5 | Resend (or SendGrid) | https://resend.com | Email/OTP sending |
| 6 | Sentry (optional) | https://sentry.io | Error tracking |
| 7 | AWS (optional) | https://console.aws.amazon.com | File uploads (S3) |
| 8 | Stripe (optional) | https://dashboard.stripe.com | Alternative payment |
| 9 | Slack (optional) | https://slack.com | CI notifications |

### Software to Install

| Software | Version | Install |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| Java | 21 | https://adoptium.net |
| Maven | 3.9+ | https://maven.apache.org |
| Docker | 20.10+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+ | Comes with Docker Desktop |

---

## 2. Create All Accounts & Get API Keys

### 🔑 Step 2.0 — Generate Required Secrets & Passwords

Run these commands on your terminal to generate all the required secrets:

**1. Generate JWT Secret Key:**
```bash
openssl rand -base64 32
# Output: aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW=
# This is your JWT_SECRET
```

**2. Generate MySQL Root Password:**
```bash
openssl rand -base64 24
# Output: Xy7Za9Bc1De3Fg5Hi7Jk9Lm1No3Pq=
# This is your MYSQL_ROOT_PASSWORD
```

**3. Generate MySQL App Password:**
```bash
openssl rand -base64 24
# Output: Ab3Cd5Ef7Gh9Ij1Kl3Mn5Op7Qr=
# This is your MYSQL_PASSWORD
```

**4. Generate Admin Password:**
```bash
openssl rand -base64 16
# Output: St3Uv5Wx7Yz9Ab=
# This is your APP_ADMIN_PASSWORD
# WARNING: Do NOT use Admin@12345 in production!
```

**5. Create MySQL Database (if running MySQL directly):**
```bash
# Connect to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE skill_swap;
CREATE USER 'skill_swap'@'localhost' IDENTIFIED BY 'your-app-password';
GRANT ALL PRIVILEGES ON skill_swap.* TO 'skill_swap'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**6. Generate Razorpay API Keys:**
```bash
# Go to: https://dashboard.razorpay.com
# Settings → API Keys → Generate Key
# Copy: Key ID (rzp_test_xxxxx) and Key Secret
```

**7. Generate Google OAuth Credentials:**
```bash
# Go to: https://console.cloud.google.com/apis/credentials
# Create OAuth 2.0 Client ID (Web application)
# Redirect URIs: http://localhost:5174/login/oauth2/code/google
# Copy: Client ID and Client Secret
```

**8. Generate GitHub OAuth Credentials:**
```bash
# Go to: https://github.com/settings/developers
# New OAuth App
# Callback URL: http://localhost:5174/login/oauth2/code/github
# Copy: Client ID and Client Secret
```

**9. Generate SMTP/Email API Key:**
```bash
# Go to: https://resend.com (or SendGrid, Mailgun)
# Sign up → API Keys → Create API Key
# Copy: API Key
```

**10. Generate Stripe Keys (optional):**
```bash
# Go to: https://dashboard.stripe.com
# Developers → API Keys → Copy Secret Key (sk_test_xxxxx)
# Developers → Webhooks → Add endpoint → Copy Signing Secret (whsec_xxxxx)
```

**11. Generate AWS Keys (optional):**
```bash
# Go to: https://console.aws.amazon.com/iam
# Users → Create user → Security credentials → Create access key
# Copy: Access Key ID and Secret Access Key
```

**12. Generate Sentry DSN (optional):**
```bash
# Go to: https://sentry.io
# Create project → Copy DSN
```

**13. Generate Slack Webhook (optional):**
```bash
# Go to: https://api.slack.com/apps
# Create App → Incoming Webhooks → Add to Workspace
# Copy: Webhook URL
```

---

### 🔑 Step 2.1 — Razorpay (Payment Gateway)

```
1. Go to https://dashboard.razorpay.com
2. Sign up with your email
3. Complete KYC (required for live mode)
4. Go to Settings → API Keys
5. Click "Generate Key"
6. COPY these values (you won't see them again):
   - Key ID:      rzp_test_xxxxxxxxxxxxx
   - Key Secret:  xxxxxxxxxxxxxxxxxxxxxxxx
```

**Save as:**
- `RAZORPAY_KEY_ID` = Key ID
- `RAZORPAY_KEY_SECRET` = Key Secret

---

### 🔑 Step 2.2 — Google OAuth (Login with Google)

```
1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name it "Mentorly" → Click "Create"
4. Go to APIs & Services → Credentials
5. Click "Create Credentials" → "OAuth client ID"
6. Application type: "Web application"
7. Name: "Mentorly OAuth"
8. Authorized redirect URIs: Add these:
   - http://localhost:5174/login/oauth2/code/google    (for local dev)
   - https://yourdomain.com/login/oauth2/code/google    (for production)
9. Click "Create"
10. COPY these values:
    - Client ID:     xxxxxxx.apps.googleusercontent.com
    - Client Secret:  GOCSPX-xxxxxxxxxxxx
```

**Save as:**
- `GOOGLE_CLIENT_ID` = Client ID
- `GOOGLE_CLIENT_SECRET` = Client Secret

---

### 🔑 Step 2.3 — GitHub OAuth (Login with GitHub)

```
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name:    Mentorly
   - Homepage URL:        https://yourdomain.com
   - Authorization callback URL: https://yourdomain.com/login/oauth2/code/github
4. Click "Register application"
5. COPY the Client ID
6. Click "Generate a new client secret"
7. COPY the Client Secret immediately (shown only once)
```

**Save as:**
- `GITHUB_CLIENT_ID` = Client ID
- `GITHUB_CLIENT_SECRET` = Client Secret

---

### 🔑 Step 2.4 — Email/SMTP (Sending OTP & Verification Emails)

**Option A: Resend (Recommended — easiest)**

```
1. Go to https://resend.com
2. Sign up with your email
3. Go to API Keys → Create API Key
4. COPY the API key
5. Go to Domains → Add Domain
6. Add DNS records to verify your domain
7. Wait for verification (usually 5-10 minutes)
```

**Save as:**
- `MAIL_HOST` = `smtp.resend.com`
- `MAIL_PORT` = `465`
- `MAIL_USERNAME` = `resend`
- `MAIL_PASSWORD` = (the API key you copied)
- `APP_EMAIL_FROM` = `noreply@yourdomain.com`

**Option B: Gmail (for testing)**

```
1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. COPY the 16-character password
```

**Save as:**
- `MAIL_HOST` = `smtp.gmail.com`
- `MAIL_PORT` = `587`
- `MAIL_USERNAME` = `your.email@gmail.com`
- `MAIL_PASSWORD` = (the 16-character app password)

---

### 🔑 Step 2.5 — Stripe (Optional — Alternative Payment)

```
1. Go to https://dashboard.stripe.com
2. Sign up / Login
3. Toggle "Test mode" (top-right corner)
4. Go to Developers → API keys
5. Click "Reveal test key" next to Secret key
6. COPY: sk_test_xxxxxxxxxxxxx
7. Go to Developers → Webhooks
8. Click "Add endpoint"
9. URL: https://yourdomain.com/api/v1/payments/webhook/stripe
10. Events: payment_intent.succeeded, payment_intent.payment_failed
11. Click "Add endpoint"
12. Click "Reveal" next to Signing secret
13. COPY: whsec_xxxxxxxxxxxxx
```

**Save as:**
- `STRIPE_SECRET_KEY` = `sk_test_xxxxxxxxxxxxx`
- `STRIPE_WEBHOOK_SECRET` = `whsec_xxxxxxxxxxxxx`

---

### 🔑 Step 2.6 — AWS S3 (Optional — File Uploads)

```
1. Go to https://console.aws.amazon.com
2. Go to IAM → Users → Create user
3. Username: mentorly-uploads
4. Attach policies: AmazonS3FullAccess (or create custom policy)
5. Go to Security credentials → Create access key
6. COPY Access key and Secret access key
7. Go to S3 → Create bucket
8. Bucket name: mentorly-uploads (must be globally unique)
9. Region: ap-south-1 (Mumbai) or us-east-1 (Virginia)
10. Uncheck "Block all public access" (for file access)
11. Add bucket policy for public read access
```

**Save as:**
- `AWS_ACCESS_KEY_ID` = Access key
- `AWS_SECRET_ACCESS_KEY` = Secret access key
- `AWS_REGION` = `ap-south-1`
- `S3_BUCKET` = `mentorly-uploads`

---

### 🔑 Step 2.7 — Sentry (Optional — Error Tracking)

```
1. Go to https://sentry.io
2. Create account
3. Create project → Platform: Spring Boot (Java)
4. Copy the DSN from project settings
5. Create another project → Platform: React
6. Copy the DSN from project settings
```

**Save as:**
- `SENTRY_DSN` = Backend DSN
- `VITE_SENTRY_DSN` = Frontend DSN

---

### 🔑 Step 2.8 — Slack (Optional — CI Notifications)

```
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. App name: Mentorly CI
4. Go to Incoming Webhooks → Toggle ON
5. Click "Add New Webhook to Workspace"
6. Select channel → Click "Allow"
7. COPY the Webhook URL
```

**Save as:**
- `SLACK_WEBHOOK_URL` = Webhook URL

---

## 3. Local Development Setup

### Step 3.1 — Clone & Install

```bash
# Clone the repo
git clone https://github.com/nakulsharma97/Mentorly.git
cd Mentorly

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend (Maven will download dependencies)
cd backend
mvn install -DskipTests
cd ..
```

### Step 3.2 — Create .env File

```bash
# Copy the template
cp .env.example .env
```

**Edit `.env` with your values:**

```env
# ═════════════════════════════════════════════
#  REQUIRED
# ═════════════════════════════════════════════

# Generate JWT secret: openssl rand -base64 32
JWT_SECRET=your-generated-jwt-secret-here

# Database passwords (can use same password for dev)
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_PASSWORD=your-app-password

# ═════════════════════════════════════════════
#  ADMIN USER
# ═════════════════════════════════════════════

APP_ADMIN_EMAIL=admin@mentorly.app
APP_ADMIN_PASSWORD=Admin@12345
APP_ADMIN_NAME=Platform Admin

# ═════════════════════════════════════════════
#  CORS & OAUTH
# ═════════════════════════════════════════════

CORS_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
OAUTH2_REDIRECT_URL=http://localhost:5174/oauth/callback

# ═════════════════════════════════════════════
#  GOOGLE OAUTH
# ═════════════════════════════════════════════

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ═════════════════════════════════════════════
#  GITHUB OAUTH
# ═════════════════════════════════════════════

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ═════════════════════════════════════════════
#  EMAIL (OTP & VERIFICATION)
# ═════════════════════════════════════════════

APP_EMAIL_ENABLED=true
MAIL_HOST=smtp.resend.com
MAIL_PORT=465
MAIL_USERNAME=resend
MAIL_PASSWORD=your-resend-api-key
APP_EMAIL_FROM=noreply@yourdomain.com

# ═════════════════════════════════════════════
#  RAZORPAY (PAYMENTS)
# ═════════════════════════════════════════════

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx

# ═════════════════════════════════════════════
#  STRIPE (OPTIONAL)
# ═════════════════════════════════════════════

STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# ═════════════════════════════════════════════
#  AWS S3 (OPTIONAL)
# ═════════════════════════════════════════════

AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
S3_BUCKET=mentorly-uploads
```

### Step 3.3 — Start Development Servers

```bash
# Option A: Docker Compose (full stack)
docker compose up --build

# Option B: Separate services
# Terminal 1 - Backend
cd backend
./start-backend.ps1    # Windows
# or
mvn spring-boot:run    # Mac/Linux

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5174
- Backend API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html (dev profile only)

---

## 4. GitHub Secrets (CI/CD)

### Step 4.1 — Repository Secrets

**Path:** https://github.com/nakulsharma97/Mentorly/settings/secrets/actions

Click **"New repository secret"** for each:

| # | Name | Value | Required? |
|---|---|---|---|
| 1 | `JWT_SECRET` | Your JWT secret | ✅ Yes |
| 2 | `MYSQL_ROOT_PASSWORD` | MySQL root password | ✅ Yes |
| 3 | `MYSQL_PASSWORD` | MySQL app password | ✅ Yes |
| 4 | `APP_ADMIN_EMAIL` | Admin email | ✅ Yes |
| 5 | `APP_ADMIN_PASSWORD` | Admin password (NOT default) | ✅ Yes |
| 6 | `APP_ADMIN_NAME` | Admin display name | Optional |
| 7 | `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com` | ✅ Yes |
| 8 | `OAUTH2_REDIRECT_URL` | `https://yourdomain.com/oauth/callback` | ✅ Yes |
| 9 | `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ✅ Yes |
| 10 | `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ✅ Yes |
| 11 | `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | ✅ Yes |
| 12 | `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | ✅ Yes |
| 13 | `APP_EMAIL_ENABLED` | `true` | ✅ Yes |
| 14 | `MAIL_HOST` | SMTP host (e.g. `smtp.resend.com`) | ✅ Yes |
| 15 | `MAIL_PORT` | SMTP port (e.g. `465`) | ✅ Yes |
| 16 | `MAIL_USERNAME` | SMTP username | ✅ Yes |
| 17 | `MAIL_PASSWORD` | SMTP password/API key | ✅ Yes |
| 18 | `APP_EMAIL_FROM` | Sender email | ✅ Yes |
| 19 | `RAZORPAY_KEY_ID` | Razorpay Key ID | ✅ Yes |
| 20 | `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | ✅ Yes |
| 21 | `VITE_RAZORPAY_KEY_ID` | Same as RAZORPAY_KEY_ID | ✅ Yes |
| 22 | `STRIPE_SECRET_KEY` | Stripe secret key | Optional |
| 23 | `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Optional |
| 24 | `AWS_ACCESS_KEY_ID` | AWS access key | Optional |
| 25 | `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional |
| 26 | `AWS_REGION` | AWS region | Optional |
| 27 | `S3_BUCKET` | S3 bucket name | Optional |
| 28 | `SENTRY_DSN` | Backend Sentry DSN | Optional |
| 29 | `VITE_SENTRY_DSN` | Frontend Sentry DSN | Optional |
| 30 | `SLACK_WEBHOOK_URL` | Slack webhook URL | Optional |

### Step 4.2 — Production Environment Secrets

**Path:** https://github.com/nakulsharma97/Mentorly/settings/environments

1. Click **"New environment"**
2. Name it: `production`
3. Click **"Configure environment"**
4. Scroll to **"Environment secrets"**
5. Click **"Add secret"** for each:

| # | Name | Value | Required? |
|---|---|---|---|
| 1 | `DEPLOY_HOST` | Server IP (e.g. `123.45.67.89`) | ✅ Yes |
| 2 | `DEPLOY_USER` | SSH username (e.g. `ubuntu`) | ✅ Yes |
| 3 | `DEPLOY_PATH` | Project path (e.g. `/opt/Mentorly`) | ✅ Yes |
| 4 | `DEPLOY_SSH_KEY` | SSH private key | ✅ Yes |
| 5 | `DEPLOY_SSH_PORT` | SSH port (default `22`) | Optional |
| 6 | `DEPLOY_PROTOCOL` | `https` or `http` | Optional |

**Generate SSH key for deployment:**

```bash
# On your LOCAL machine
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key -N ""

# Copy PUBLIC key to your server
ssh-copy-id -i deploy_key.pub ubuntu@YOUR_SERVER_IP

# Test connection
ssh -i deploy_key ubuntu@YOUR_SERVER_IP

# The PRIVATE key (deploy_key without .pub) is what you paste as DEPLOY_SSH_KEY
```

### Step 4.3 — Enable Environment Protection Rules

On the `production` environment page:
- ☑ **Required reviewers** — Add yourself (prevents accidental deploys)
- ☑ **Restrict to protected branches** — Only `main` branch can deploy
- **Wait timer** — Optional, set 5 minutes

---

## 5. Production Server Setup

### Step 5.1 — Create a VPS Server

**Recommended providers:**
- **DigitalOcean** — https://digitalocean.com ($12/mo for 2GB RAM)
- **AWS EC2** — https://aws.amazon.com/ec2
- **Vultr** — https://vultr.com
- **Linode** — https://linode.com

**Minimum specs:**
- 2 vCPUs
- 2 GB RAM
- 50 GB SSD
- Ubuntu 22.04 LTS

### Step 5.2 — Initial Server Setup

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Create deploy user
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Switch to deploy user
su - deploy

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Log out and back in for group changes
exit
```

### Step 5.3 — Clone Project on Server

```bash
# SSH as deploy user
ssh deploy@YOUR_SERVER_IP

# Clone the repo
cd /opt
git clone https://github.com/nakulsharma97/Mentorly.git
cd Mentorly

# Make deploy script executable
chmod +x scripts/deploy.sh
```

### Step 5.4 — Create .env on Server

```bash
# Create .env file
nano .env
```

**Paste your values** (same as local .env but with production URLs):

```env
# Use production values here
JWT_SECRET=your-jwt-secret
MYSQL_ROOT_PASSWORD=your-strong-password
MYSQL_PASSWORD=your-strong-password
APP_ADMIN_EMAIL=admin@yourdomain.com
APP_ADMIN_PASSWORD=your-strong-admin-password
CORS_ALLOWED_ORIGINS=https://yourdomain.com
OAUTH2_REDIRECT_URL=https://yourdomain.com/oauth/callback
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
APP_EMAIL_ENABLED=true
MAIL_HOST=smtp.resend.com
MAIL_PORT=465
MAIL_USERNAME=resend
MAIL_PASSWORD=your-resend-api-key
APP_EMAIL_FROM=noreply@yourdomain.com
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
```

### Step 5.5 — Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Verify
sudo ufw status
```

---

## 6. Domain & DNS Setup

### Step 6.1 — Buy a Domain

Buy from any registrar:
- Namecheap: https://namecheap.com
- GoDaddy: https://godaddy.com
- Google Domains: https://domains.google

### Step 6.2 — Configure DNS Records

In your domain registrar's DNS settings, add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | YOUR_SERVER_IP | Auto |
| A | www | YOUR_SERVER_IP | Auto |
| CNAME | api | yourdomain.com | Auto |

### Step 6.3 — Point Domain to Server

After DNS propagation (5-30 minutes), verify:

```bash
# From your local machine
nslookup yourdomain.com
# Should return YOUR_SERVER_IP
```

---

## 7. SSL Certificate Setup

### Step 7.1 — Create certs Directory

```bash
# On your server
cd /opt/Mentorly
mkdir -p certs
```

### Step 7.2 — Get Let's Encrypt Certificate

```bash
# Stop frontend temporarily
docker compose stop frontend

# Get certificate
docker compose --profile ssl run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# Start frontend
docker compose up -d frontend
```

### Step 7.3 — Auto-Renewal Cron

```bash
# Add cron job for auto-renewal
crontab -e

# Add this line (renews daily at 3 AM)
0 3 * * * cd /opt/Mentorly && docker compose --profile ssl run --rm certbot renew && docker compose exec frontend nginx -s reload
```

---

## 8. Deploy to Production

### Option A: Automatic Deployment (CI/CD)

1. Push your code to `main` branch
2. GitHub Actions will:
   - Run tests
   - Build Docker image
   - Push to GitHub Container Registry
   - Deploy to your server

**Monitor deployment:**
- Go to https://github.com/nakulsharma97/Mentorly/actions
- Click on the latest workflow run
- Watch the progress

### Option B: Manual Deployment

```bash
# SSH into server
ssh deploy@YOUR_SERVER_IP

# Go to project directory
cd /opt/Mentorly

# Pull latest changes
git pull origin main

# Deploy
./scripts/deploy.sh --tag latest
```

### Option C: Rollback (if something goes wrong)

```bash
# SSH into server
ssh deploy@YOUR_SERVER_IP

# Go to project directory
cd /opt/Mentorly

# List backups
ls -la backups/

# Deploy previous version
./scripts/deploy.sh --tag previous-commit-sha
```

---

## 9. Verify Everything Works

### Step 9.1 — Check Backend Health

```bash
# From your local machine
curl https://yourdomain.com/actuator/health

# Should return: {"status":"UP"}
```

### Step 9.2 — Check Frontend

Open browser:
- Go to https://yourdomain.com
- You should see the Mentorly homepage

### Step 9.3 — Test Authentication

1. Click "Sign up"
2. Enter email and password
3. Check email for OTP
4. Enter OTP
5. Complete profile
6. You should be logged in

### Step 9.4 — Test Social Login

1. Click "Log in"
2. Click "Continue with Google"
3. Authorize the app
4. You should be logged in

### Step 9.5 — Test Payments

1. Create a session as a mentor
2. Book the session as a learner
3. Complete payment with Razorpay test mode
4. Verify payment status in Razorpay dashboard

### Step 9.6 — Check Sentry (if configured)

1. Go to https://sentry.io
2. Select your project
3. Verify events are being captured

---

## 10. Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose logs backend

# Common issues:
# - Missing JWT_SECRET → Add to .env
# - Missing MYSQL_PASSWORD → Add to .env
# - Database connection failed → Check MySQL is running
```

### Frontend won't load

```bash
# Check logs
docker compose logs frontend

# Common issues:
# - SSL certificate missing → Run certbot
# - Nginx config error → Check nginx.conf
```

### OTP emails not sending

```bash
# Check backend logs for email errors
docker compose logs backend | grep -i mail

# Common issues:
# - APP_EMAIL_ENABLED=false → Set to true
# - SMTP credentials wrong → Verify in .env
# - Domain not verified in Resend → Check Resend dashboard
```

### Payment fails

```bash
# Check Razorpay dashboard for errors
# Common issues:
# - Wrong API keys → Verify in .env
# - Test mode not enabled → Toggle in Razorpay dashboard
# - Domain not whitelisted → Add domain in Razorpay settings
```

### OAuth login fails

```bash
# Check backend logs
docker compose logs backend | grep -i oauth

# Common issues:
# - Redirect URI mismatch → Update in Google/GitHub console
# - Client ID/Secret wrong → Verify in .env
# - CORS error → Check CORS_ALLOWED_ORIGINS
```

---

## Quick Reference — All Secrets

```
REPOSITORY SECRETS (GitHub Settings → Secrets → Repository secrets):
  JWT_SECRET              ✅ Required
  MYSQL_ROOT_PASSWORD     ✅ Required
  MYSQL_PASSWORD          ✅ Required
  APP_ADMIN_EMAIL         ✅ Required
  APP_ADMIN_PASSWORD      ✅ Required
  CORS_ALLOWED_ORIGINS    ✅ Required
  OAUTH2_REDIRECT_URL     ✅ Required
  GOOGLE_CLIENT_ID        ✅ Required
  GOOGLE_CLIENT_SECRET    ✅ Required
  GITHUB_CLIENT_ID        ✅ Required
  GITHUB_CLIENT_SECRET    ✅ Required
  APP_EMAIL_ENABLED       ✅ Required (set to "true")
  MAIL_HOST               ✅ Required
  MAIL_PORT               ✅ Required
  MAIL_USERNAME           ✅ Required
  MAIL_PASSWORD           ✅ Required
  APP_EMAIL_FROM          ✅ Required
  RAZORPAY_KEY_ID         ✅ Required
  RAZORPAY_KEY_SECRET     ✅ Required
  VITE_RAZORPAY_KEY_ID    ✅ Required
  STRIPE_SECRET_KEY       Optional
  STRIPE_WEBHOOK_SECRET   Optional
  AWS_ACCESS_KEY_ID       Optional
  AWS_SECRET_ACCESS_KEY   Optional
  AWS_REGION              Optional
  S3_BUCKET               Optional
  SENTRY_DSN              Optional
  VITE_SENTRY_DSN         Optional
  SLACK_WEBHOOK_URL       Optional

PRODUCTION ENVIRONMENT (GitHub Settings → Environments → production):
  DEPLOY_HOST             ✅ Required
  DEPLOY_USER             ✅ Required
  DEPLOY_PATH             ✅ Required
  DEPLOY_SSH_KEY          ✅ Required
  DEPLOY_SSH_PORT         Optional (default: 22)
  DEPLOY_PROTOCOL         Optional (default: https)

STAGING ENVIRONMENT (GitHub Settings → Environments → staging):
  STAGING_HOST            Optional
  STAGING_USER            Optional
  STAGING_PATH            Optional
  STAGING_SSH_KEY         Optional
  STAGING_SSH_PORT        Optional (default: 22)
  STAGING_PROTOCOL        Optional (default: https)
```

---

**Need help?** Check the [Troubleshooting](#10-troubleshooting) section or open an issue at https://github.com/nakulsharma97/Mentorly/issues
