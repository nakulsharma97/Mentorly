# 🚀 Mentorly — Complete Deployment Roadmap

> From zero to production-ready. Every step, every link, every secret.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Setup](#2-server-setup)
3. [Domain & DNS](#3-domain--dns)
4. [GitHub Repository Setup](#4-github-repository-setup)
5. [Payment Gateway Setup](#5-payment-gateway-setup)
6. [OAuth2 Setup (Google & GitHub Login)](#6-oauth2-setup)
7. [Email Setup (Optional)](#7-email-setup)
8. [Docker Deployment](#8-docker-deployment)
9. [SSL / HTTPS](#9-ssl--https)
10. [Webhook Configuration](#10-webhook-configuration)
11. [Monitoring & Error Tracking](#11-monitoring--error-tracking)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Post-Deployment Checklist](#13-post-deployment-checklist)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

### What You Need

| Item | Free Option | Recommended |
|------|-------------|-------------|
| **Server** | Oracle Cloud Free Tier | DigitalOcean ($12/mo) or Hetzner ($5/mo) |
| **Domain** | Freenom (free .tk) | Namecheap or Cloudflare ($8-12/year) |
| **Stripe Account** | Free (pay per transaction) | dashboard.stripe.com |
| **Razorpay Account** | Free (pay per transaction) | dashboard.razorpay.com |
| **GitHub Account** | Free | github.com |
| **Sentry (optional)** | Free tier | sentry.io |
| **Resend (optional)** | Free tier (100 emails/day) | resend.com |

### Minimum Server Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| **RAM** | 2 GB | 4 GB |
| **CPU** | 1 vCPU | 2 vCPU |
| **Storage** | 25 GB SSD | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Bandwidth** | 1 TB | 2 TB |

---

## 2. Server Setup

### 2.1 Buy a VPS

**Recommended Providers (cheapest to best):**

| Provider | Starting Price | Link |
|----------|---------------|------|
| **Hetzner** | €4.50/mo | hetzner.com/cloud |
| **DigitalOcean** | $6/mo | digitalocean.com |
| **Vultr** | $5/mo | vultr.com |
| **Linode/Akamai** | $5/mo | linode.com |
| **AWS Lightsail** | $5/mo | lightsail.aws.amazon.com |
| **Oracle Cloud** | Free tier | cloud.oracle.com |

**Quick Start (DigitalOcean example):**

1. Go to [digitalocean.com](https://www.digitalocean.com)
2. Sign up / Log in
3. Click **Create → Droplets**
4. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic → $12/mo (2 GB RAM, 1 vCPU, 50 GB SSD)
   - **Region**: Choose closest to your users (e.g., Bangalore for India)
   - **Authentication**: SSH Keys (recommended) or Password
5. Click **Create Droplet**
6. Note your server IP: `xxx.xxx.xxx.xxx`

### 2.2 Connect to Server

```bash
# From your local machine
ssh root@YOUR_SERVER_IP

# If using SSH key
ssh -i ~/.ssh/your_key root@YOUR_SERVER_IP
```

### 2.3 Install Docker & Docker Compose

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Verify installations
docker --version
docker compose version

# Add your user to docker group (optional, for non-root usage)
usermod -aG docker $USER
```

### 2.4 Install Git

```bash
apt install git -y
git --version
```

### 2.5 Set Up Firewall

```bash
# Allow SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5174/tcp  # Frontend HTTP (optional, can remove after SSL)
ufw enable

# Check status
ufw status
```

---

## 3. Domain & DNS

### 3.1 Buy a Domain

| Provider | Price | Link |
|----------|-------|------|
| **Cloudflare Registrar** | At-cost (no markup) | cloudflare.com/products/registrar |
| **Namecheap** | ~$8-12/year | namecheap.com |
| **Google Domains** | ~$12/year | domains.google |
| **GoDaddy** | ~$10-15/year | godaddy.com |

### 3.2 Point Domain to Server

**At your domain registrar or DNS provider, create these records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | `YOUR_SERVER_IP` | 300 |
| **A** | `www` | `YOUR_SERVER_IP` | 300 |

**Example:**
```
Type: A
Name: @ (or leave blank)
Value: 165.232.45.123
TTL: 300
```

### 3.3 Verify DNS

```bash
# From your local machine (wait 5-10 minutes for propagation)
ping yourdomain.com
nslookup yourdomain.com
```

### 3.4 Recommended: Use Cloudflare (Free)

1. Go to [cloudflare.com](https://www.cloudflare.com) → Sign up
2. Add your domain
3. Change nameservers at your registrar to Cloudflare's
4. Enable:
   - **SSL/TLS** → Full (strict)
   - **Always Use HTTPS** → ON
   - **Auto Minify** → JS, CSS, HTML
   - **Brotli** → ON
   - **Security Level** → Medium
   - **Bot Fight Mode** → ON

**Benefits:** Free SSL, DDoS protection, CDN, caching, analytics

---

## 4. GitHub Repository Setup

### 4.1 Fork or Use Your Repository

Your repository: `https://github.com/nakulsharma97/Mentorly`

### 4.2 Set Up GitHub Environments (for CI/CD)

1. Go to your repo → **Settings → Environments**
2. Create environment: **`production`**
3. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `DEPLOY_HOST` | Your server IP (e.g., `165.232.45.123`) |
| `DEPLOY_USER` | `root` (or your SSH user) |
| `DEPLOY_PATH` | `/opt/mentorly` (where you'll clone the repo on server) |
| `DEPLOY_SSH_KEY` | Your SSH private key (full PEM content) |
| `DEPLOY_SSH_PORT` | `22` |
| `DEPLOY_PROTOCOL` | `https` |

### 4.3 Generate SSH Key for Deployment

```bash
# On your LOCAL machine (not the server)
ssh-keygen -t ed25519 -C "mentorly-deploy" -f ~/.ssh/mentorly_deploy

# Copy the PUBLIC key to your server
ssh-copy-id -i ~/.ssh/mentorly_deploy.pub root@YOUR_SERVER_IP

# The PRIVATE key goes into GitHub Secrets as DEPLOY_SSH_KEY
cat ~/.ssh/mentorly_deploy
# Copy the ENTIRE output (including BEGIN/END lines) into GitHub Secrets
```

### 4.4 Copy Server SSH Key to GitHub

1. Open `~/.ssh/mentorly_deploy` (the private key)
2. Copy the entire content
3. Go to GitHub → Settings → Environments → production → Secrets
4. Add `DEPLOY_SSH_KEY` with the full private key content

---

## 5. Payment Gateway Setup

### 5.1 Stripe Setup

**Step 1: Create Stripe Account**

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up / Log in
3. Complete business verification

**Step 2: Get API Keys**

1. Dashboard → **Developers → API Keys**
2. Toggle **"Test mode"** (top-right) for testing
3. Copy:
   - **Publishable key** → `pk_test_xxxxx` → goes to `VITE_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `sk_test_xxxxx` → goes to `STRIPE_SECRET_KEY`
4. For production: toggle to **Live mode** and copy `pk_live_` and `sk_live_`

**Step 3: Create Payment Webhook**

1. Dashboard → **Developers → Webhooks**
2. Click **"Add endpoint"**
3. URL: `https://yourdomain.com/api/v1/payments/webhook/stripe`
4. Events to send:
   - `charge.succeeded`
   - `charge.failed`
   - `charge.refunded`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** → `whsec_xxxxx` → goes to `STRIPE_WEBHOOK_SECRET`

**Step 4: Create Connect Webhook (for mentor payouts)**

1. Dashboard → **Developers → Webhooks**
2. Click **"Add endpoint"**
3. URL: `https://yourdomain.com/api/v1/payments/webhook/stripe-connect`
4. Events to send:
   - `account.updated`
   - `transfer.paid`
   - `transfer.failed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** → goes to `STRIPE_CONNECT_WEBHOOK_SECRET`

**Step 5: Enable Stripe Connect (for mentor payouts)**

1. Dashboard → **Settings → Connect Settings**
2. Enable Stripe Connect
3. Set up platform profile
4. Configure payout schedule

### 5.2 Razorpay Setup

**Step 1: Create Razorpay Account**

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Sign up / Log in
3. Complete KYC verification

**Step 2: Get API Keys**

1. Dashboard → **Settings → API Keys**
2. Click **"Generate Key"**
3. Copy:
   - **Key ID** → `rzp_test_xxxxx` → goes to BOTH:
     - `APP_PAYMENT_RAZORPAY_KEY_ID` (backend)
     - `VITE_RAZORPAY_KEY_ID` (frontend)
   - **Key Secret** → `xxxxx` → goes to `APP_PAYMENT_RAZORPAY_KEY_SECRET`
4. For production: generate **Live** keys

**Step 3: Create Payment Webhook**

1. Dashboard → **Settings → Webhooks**
2. Click **"Create Webhook"**
3. URL: `https://yourdomain.com/api/v1/payments/webhook/razorpay`
4. Secret: (auto-generated or set your own)
5. Events to enable:
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
6. Click **"Create"**
7. Copy the **Webhook Secret** → goes to `APP_PAYMENT_RAZORPAY_WEBHOOK_SECRET`

**Step 4: Create Payout Webhook (for mentor payouts)**

1. Dashboard → **Settings → Webhooks**
2. Click **"Create Webhook"**
3. URL: `https://yourdomain.com/api/v1/mentor/razorpay-payout/webhook`
4. Events:
   - `transfer.processed`
   - `transfer.failed`
5. Copy the **Webhook Secret** → goes to `APP_PAYOUT_RAZORPAY_WEBHOOK_SECRET`

**Step 5: Enable Razorpay Route (for mentor payouts)**

1. Dashboard → **Settings → Route**
2. Enable Route for marketplace payouts
3. Complete required documentation

---

## 6. OAuth2 Setup

### 6.1 Google OAuth2

**Step 1: Create Google Cloud Project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project → Name: "Mentorly"
3. Enable **Google+ API** and **People API**

**Step 2: Create OAuth Credentials**

1. Go to **APIs & Services → Credentials**
2. Click **"Create Credentials → OAuth client ID"**
3. Application type: **Web application**
4. Name: "Mentorly Web"
5. Authorized redirect URIs:
   - `https://yourdomain.com/login/oauth2/code/google`
   - `http://localhost:5174/login/oauth2/code/google` (for dev)
6. Click **"Create"**
7. Copy:
   - **Client ID** → goes to `GOOGLE_CLIENT_ID`
   - **Client Secret** → goes to `GOOGLE_CLIENT_SECRET`

**Step 3: Configure OAuth Consent Screen**

1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Fill in app name, email, logo
4. Add scopes: `email`, `profile`, `openid`
5. Add test users (if in testing mode)

### 6.2 GitHub OAuth2

**Step 1: Create GitHub OAuth App**

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - Application name: "Mentorly"
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://yourdomain.com/login/oauth2/code/github`
4. Click **"Register application"**
5. Copy:
   - **Client ID** → goes to `GITHUB_CLIENT_ID`
6. Click **"Generate a new client secret"**
7. Copy the **Client Secret** → goes to `GITHUB_CLIENT_SECRET`

---

## 7. Email Setup (Optional)

### 7.1 Using Resend (Recommended — Free tier: 100/day)

1. Go to [resend.com](https://resend.com) → Sign up
2. Add your domain
3. Verify DNS records (MX, TXT)
4. Go to **API Keys** → Create key
5. Set in `.env`:
   ```
   APP_EMAIL_ENABLED=true
   MAIL_HOST=smtp.resend.com
   MAIL_PORT=465
   MAIL_USERNAME=resend
   MAIL_PASSWORD=re_your_api_key_here
   APP_EMAIL_FROM=no-reply@yourdomain.com
   ```

### 7.2 Using Gmail SMTP (Simple but limited)

```
APP_EMAIL_ENABLED=true
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your_app_password  # Google Account → Security → App Passwords
APP_EMAIL_FROM=your@gmail.com
```

---

## 8. Docker Deployment

### 8.1 Clone Repository on Server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Create deployment directory
mkdir -p /opt/mentorly
cd /opt/mentorly

# Clone the repository
git clone https://github.com/nakulsharma97/Mentorly.git .

# OR if using a fork
git clone https://github.com/YOUR_USERNAME/Mentorly.git .
```

### 8.2 Create `.env` File

```bash
cp .env.example .env
nano .env
```

**Fill in ALL required values:**

```env
# === REQUIRED ===
JWT_SECRET=$(openssl rand -base64 32)
MYSQL_ROOT_PASSWORD=YourStrongRootPassword123!
MYSQL_PASSWORD=YourStrongDBPassword123!
SPRING_PROFILES_ACTIVE=prod

# === ADMIN ===
APP_ADMIN_EMAIL=admin@yourdomain.com
APP_ADMIN_PASSWORD=YourStrongAdminPassword123!
APP_ADMIN_NAME=Platform Admin

# === DOMAIN ===
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
OAUTH2_REDIRECT_URL=https://yourdomain.com/oauth/callback

# === STRIPE ===
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_your_stripe_connect_webhook_secret
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# === RAZORPAY ===
APP_PAYMENT_RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
APP_PAYMENT_RAZORPAY_KEY_SECRET=your_razorpay_key_secret
APP_PAYMENT_RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
APP_PAYOUT_RAZORPAY_WEBHOOK_SECRET=your_razorpay_payout_webhook_secret
VITE_RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id

# === OAUTH2 (optional) ===
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# === FRONTEND ===
VITE_API_BASE_URL=
VITE_APP_ENV=production
```

### 8.3 Start the Application

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

### 8.4 Verify Deployment

```bash
# Check health endpoint
curl http://localhost:8080/actuator/health

# Check frontend
curl -o /dev/null -s -w "%{http_code}" http://localhost:5174

# Check all containers
docker compose ps
```

**Expected output:**
```
NAME          STATUS          PORTS
mysql         Up (healthy)    3306:3306
backend       Up              8080:8080
frontend      Up              80:80, 443:443
```

---

## 9. SSL / HTTPS

### 9.1 Using Cloudflare (Easiest)

If you set up Cloudflare in Step 3.4:
1. SSL/TLS → Overview → Set to **Full (Strict)**
2. Always Use HTTPS → **ON**
3. Done! SSL is automatic.

### 9.2 Using Let's Encrypt (Manual)

```bash
# Install certbot
apt install certbot -y

# Get certificate
certbot certonly --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com

# Certificates are at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Copy to docker certs directory
mkdir -p /opt/mentorly/certs
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/mentorly/certs/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/mentorly/certs/key.pem

# Restart frontend
docker compose restart frontend

# Set up auto-renewal (cron)
crontab -e
# Add: 0 3 * * * certbot renew && cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/mentorly/certs/ && docker compose -f /opt/mentorly/docker-compose.yml restart frontend
```

### 9.3 Using Docker Compose Certbot Profile

```bash
# Initial certificate
docker compose --profile ssl run certbot certonly --webroot \
  -w /var/www/certbot -d yourdomain.com

# Reload nginx
docker compose exec frontend nginx -s reload
```

---

## 10. Webhook Configuration

### 10.1 Summary of All Webhook Endpoints

| Gateway | Endpoint | Events |
|---------|----------|--------|
| Stripe Payment | `https://yourdomain.com/api/v1/payments/webhook/stripe` | `charge.succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed` |
| Stripe Connect | `https://yourdomain.com/api/v1/payments/webhook/stripe-connect` | `account.updated`, `transfer.paid`, `transfer.failed` |
| Razorpay Payment | `https://yourdomain.com/api/v1/payments/webhook/razorpay` | `payment.captured`, `payment.failed`, `refund.created` |
| Razorpay Payout | `https://yourdomain.com/api/v1/mentor/razorpay-payout/webhook` | `transfer.processed`, `transfer.failed` |

### 10.2 Verify Webhooks Are Working

```bash
# Test webhook endpoint is reachable
curl -X POST https://yourdomain.com/api/v1/payments/webhook/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'

# Should return 400 (bad signature) — means endpoint is alive
```

---

## 11. Monitoring & Error Tracking

### 11.1 Sentry (Recommended — Free tier)

**Backend:**

1. Go to [sentry.io](https://sentry.io) → Create account
2. Create project → **Spring Boot**
3. Copy DSN
4. Set in `.env`:
   ```
   SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
   ```

**Frontend:**

1. Create another project → **React**
2. Copy DSN
3. Set in `.env`:
   ```
   VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
   ```

### 11.2 Health Checks

```bash
# Backend health
curl https://yourdomain.com/actuator/health

# Expected: {"status":"UP"}
```

### 11.3 Server Monitoring

```bash
# Install htop (process monitor)
apt install htop -y

# Install netdata (free server monitoring)
curl -Ss https://get.netdata.cloud | bash

# Access netdata at: http://YOUR_SERVER_IP:19999
```

---

## 12. CI/CD Pipeline

### How It Works

```
Git Push to main
    ↓
GitHub Actions (backend-ci.yml)
    ↓
  Tests (MySQL + Redis + Maven)
    ↓
  Docker Build → Push to ghcr.io
    ↓
GitHub Actions (deploy.yml)
    ↓
  SSH → Server → docker compose pull → restart
    ↓
  Health Check → Notification
```

### What Happens Automatically

1. **Push to `main`** → GitHub Actions runs:
   - Backend tests (630 tests with MySQL + Redis)
   - Frontend lint + tests (280 tests) + build
   - Docker image build → push to `ghcr.io/nakulsharma97/mentorly-backend:latest`

2. **After backend CI succeeds** → Deploy workflow:
   - SSH into your server
   - Pull new Docker image
   - Restart services
   - Health check
   - Send notification (Slack/email if configured)

### Manual Deploy

```bash
# On the server
cd /opt/mentorly
git pull origin main
docker compose pull
docker compose up -d
```

---

## 13. Post-Deployment Checklist

### ✅ Verify Everything Works

- [ ] **Frontend loads**: `https://yourdomain.com` shows landing page
- [ ] **Signup works**: Create a new account
- [ ] **Login works**: Log in with email/password
- [ ] **Google login works** (if configured)
- [ ] **GitHub login works** (if configured)
- [ ] **Profile setup**: Complete profile after signup
- [ ] **Admin login**: Log in with admin credentials
- [ ] **Admin dashboard**: All sections load
- [ ] **Theme toggle**: Dark/light switch works instantly

### ✅ Verify Payment Flow

- [ ] **Stripe test payment**: Use test card `4242 4242 4242 4242`
- [ ] **Razorpay test payment**: Use Razorpay test mode
- [ ] **Webhook delivery**: Check Stripe/Razorpay dashboard for delivered events
- [ ] **Wallet top-up**: Test both Stripe and Razorpay
- [ ] **Mentor withdrawal**: Test payout flow

### ✅ Verify Security

- [ ] **HTTPS**: Site loads with padlock icon
- [ ] **No secrets in frontend**: View source — no API keys visible
- [ ] **Admin protected**: Can't access admin without admin role
- [ ] **Rate limiting**: Test rapid login attempts
- [ ] **CORS**: Only your domain can make API calls

### ✅ Verify Performance

- [ ] **Page load**: < 3 seconds on 3G
- [ ] **Lighthouse score**: > 80 (Performance, Accessibility, Best Practices, SEO)
- [ ] **No console errors**: Check browser console

---

## 14. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `docker compose up` fails | Check `.env` file — all required variables must be set |
| MySQL won't start | Ensure `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` are set |
| Backend won't start | Check logs: `docker compose logs backend` |
| Frontend shows blank page | Check `CORS_ALLOWED_ORIGINS` matches your domain |
| Payments fail | Verify API keys are correct (test vs live) |
| Webhooks not received | Check webhook URL is accessible, check signature secrets |
| SSL not working | Verify certbot certificates or Cloudflare SSL setting |
| Domain not resolving | Wait 5-10 min for DNS propagation, check DNS records |

### Useful Commands

```bash
# View all logs
docker compose logs -f

# Restart specific service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build

# Check database
docker compose exec mysql mysql -u root -p

# Check disk usage
df -h

# Check memory usage
free -h

# Check running processes
docker compose ps
```

### Get Help

- **Docker logs**: `docker compose logs -f backend`
- **Spring Boot logs**: `docker compose logs backend | grep ERROR`
- **MySQL status**: `docker compose exec mysql mysqladmin status -u root -p`
- **Port check**: `netstat -tlnp | grep -E '80|443|8080|3306'`

---

## 🎉 You're Live!

Once all checks pass, your Mentorly platform is production-ready:

- **Landing page**: `https://yourdomain.com`
- **Admin panel**: `https://yourdomain.com/admin/login`
- **API**: `https://yourdomain.com/api/v1/`
- **Health check**: `https://yourdomain.com/actuator/health`

### Cost Summary

| Item | Monthly Cost |
|------|-------------|
| VPS Server | $5-12 |
| Domain | $0.50-1 |
| Stripe | Free (2.9% per transaction) |
| Razorpay | Free (2% per transaction) |
| Cloudflare | Free |
| Sentry | Free (5K events/month) |
| Resend | Free (100 emails/day) |
| **Total** | **~$6-14/month** |

---

*Last updated: September 2026*
*Repository: https://github.com/nakulsharma97/Mentorly*
