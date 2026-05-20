# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for CI/CD pipelines to securely handle sensitive information.

## Required Secrets

### Backend Secrets

| Secret Name             | Description                               | Example                                                  |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `DB_URL`                | MySQL database connection URL             | `jdbc:mysql://db.example.com:3306/skillswap?useSSL=true` |
| `DB_USERNAME`           | Database username                         | `skillswap_user`                                         |
| `DB_PASSWORD`           | Database password                         | `strong-random-password-32-chars-min`                    |
| `JWT_SECRET`            | JWT signing key                           | `your-256-bit-base64-encoded-secret-key-here`            |
| `GMAIL_USERNAME`        | Gmail account for emails                  | `noreply@example.com`                                    |
| `GMAIL_APP_PASSWORD`    | Gmail app password (not regular password) | `xxxx xxxx xxxx xxxx`                                    |
| `STRIPE_SECRET_KEY`     | Stripe secret API key                     | `sk_live_xxx...`                                         |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing key                | `whsec_xxx...`                                           |
| `GOOGLE_CLIENT_ID`      | Google OAuth2 client ID                   | `xxx.apps.googleusercontent.com`                         |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth2 client secret               | `GOCSPX-xxx...`                                          |
| `CORS_ALLOWED_ORIGINS`  | Allowed CORS origins (comma-separated)    | `https://app.example.com,https://www.example.com`        |
| `SENTRY_DSN`            | Sentry error tracking DSN                 | `https://xxx@sentry.io/123456`                           |

### Frontend Secrets

| Secret Name             | Description                               | Example                          |
| ----------------------- | ----------------------------------------- | -------------------------------- |
| `VITE_API_URL`          | Backend API URL                           | `https://api.example.com`        |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 client ID (same as backend) | `xxx.apps.googleusercontent.com` |
| `VITE_SENTRY_DSN`       | Frontend Sentry DSN                       | `https://xxx@sentry.io/654321`   |

### Deployment Secrets

| Secret Name                | Description                              | Example                             |
| -------------------------- | ---------------------------------------- | ----------------------------------- |
| `DOCKER_REGISTRY_URL`      | Docker registry URL                      | `gcr.io` or `docker.io`             |
| `DOCKER_REGISTRY_USERNAME` | Docker registry username                 | `_json_key` (for GCR)               |
| `DOCKER_REGISTRY_PASSWORD` | Docker registry password/token           | Base64-encoded service account JSON |
| `KUBE_CONFIG`              | Kubernetes cluster config (if using K8s) | Base64-encoded kubeconfig file      |
| `SSH_DEPLOY_KEY`           | SSH private key for server access        | SSH private key content             |
| `SSH_KNOWN_HOSTS`          | Known hosts for SSH (fingerprints)       | SSH host keys                       |

## How to Add Secrets to GitHub

### Via GitHub Web UI

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Enter the secret name (e.g., `DB_PASSWORD`)
4. Paste the secret value
5. Click "Add secret"

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
brew install gh  # macOS
# or https://github.com/cli/cli#installation for other OS

# Add a secret
gh secret set DB_PASSWORD -b "your-secret-value"

# List all secrets
gh secret list

# Delete a secret
gh secret remove DB_PASSWORD
```

### Via Terraform (Infrastructure as Code)

```hcl
resource "github_actions_secret" "db_password" {
  repository       = "skill-swapping-platform"
  secret_name      = "DB_PASSWORD"
  plaintext_value  = var.db_password
}
```

## Where to Get Secret Values

### Database Credentials

```bash
# If using managed database service:
# AWS RDS → Database → Configuration
# Azure Database → Connection strings
# Google Cloud SQL → Overview → Public IP
# DigitalOcean Managed Database → Connection Details
```

### JWT Secret

```bash
# Generate a strong JWT secret (32 bytes, base64-encoded)
openssl rand -base64 32

# Or using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Gmail App Password

1. Enable 2FA on your Gmail account
2. Go to myaccount.google.com → Security → App passwords
3. Select "Mail" and "Windows Computer" (or your OS)
4. Google generates a 16-character password
5. Use this password (not your Gmail password) in the secret

### Stripe API Keys

1. Sign in to Stripe Dashboard → Developers → API Keys
2. Copy the Secret Key (starts with `sk_test_` or `sk_live_`)
3. Copy the Webhook Signing Secret (starts with `whsec_`)

### Google OAuth2 Credentials

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth2 credentials (or use existing)
3. Copy Client ID and Client Secret

### Docker Registry Authentication

**For Docker Hub**:

```bash
# Use your Docker Hub credentials
echo -n "username:token" | base64
```

**For Google Container Registry (GCR)**:

```bash
# Use service account JSON
cat /path/to/service-account.json | base64
```

## Using Secrets in GitHub Actions

### Container Publish Workflow

The container publish workflow in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) uses the built-in `GITHUB_TOKEN` to authenticate to GHCR, so no separate registry secret is required for image publishing.

Set the frontend API URL as a repository variable named `VITE_API_BASE_URL` so the frontend image is built against the correct backend endpoint.

### In Backend Workflow (.github/workflows/ci.yml)

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up JDK
        uses: actions/setup-java@v3
        with:
          java-version: "25"

      - name: Run tests
        env:
          SPRING_DATASOURCE_URL: ${{ secrets.DB_URL }}
          SPRING_DATASOURCE_USERNAME: ${{ secrets.DB_USERNAME }}
          SPRING_DATASOURCE_PASSWORD: ${{ secrets.DB_PASSWORD }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: mvn clean verify
```

### In Frontend Workflow

```yaml
- name: Build frontend
  env:
    VITE_API_URL: ${{ secrets.VITE_API_URL }}
    VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
  run: |
    cd frontend
    npm install
    npm run build
```

### In Deployment Workflow

```yaml
- name: Deploy to Docker Registry
  env:
    DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY_URL }}
    DOCKER_USERNAME: ${{ secrets.DOCKER_REGISTRY_USERNAME }}
    DOCKER_PASSWORD: ${{ secrets.DOCKER_REGISTRY_PASSWORD }}
  run: |
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin "$DOCKER_REGISTRY"
    docker build -t $DOCKER_REGISTRY/skill-swap-backend:latest .
    docker push $DOCKER_REGISTRY/skill-swap-backend:latest
```

## Secret Security Best Practices

1. **Rotate regularly**: Update secrets every 90 days or after employee departures
2. **Use strong values**: 32+ characters, random, avoid dictionary words
3. **Principle of least privilege**: Only give services secrets they need
4. **Never commit secrets**: Use GitHub Secrets, not hardcoded values
5. **Audit access**: GitHub shows secret usage in workflow runs (not values)
6. **Different secrets per environment**: dev, staging, and production should have different secrets
7. **Secrets in logs**: GitHub Actions automatically masks secrets in logs, but be careful with print statements
8. **Remove after use**: If you accidentally expose a secret, rotate it immediately

## Rotating Secrets

When a secret is compromised:

```bash
# 1. Generate new secret value
openssl rand -base64 32

# 2. Update GitHub Secret via CLI
gh secret set SECRET_NAME -b "new-value"

# 3. Or via web UI: Delete old secret, add new one

# 4. Trigger new deployment
# GitHub Actions will use new secret

# 5. Verify in logs (secrets will be masked)

# 6. Monitor for any failures
```

## Troubleshooting

| Issue                                  | Solution                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Workflow fails with "secret not found" | Check secret name matches exactly (case-sensitive) in workflow             |
| Secret value visible in logs           | Avoid `echo $SECRET`; GitHub masks secrets automatically                   |
| Environment variable not set           | Verify `env:` section syntax in workflow YAML                              |
| Permission denied error                | Ensure runner has permission to access secret (check workflow permissions) |

## Verification Checklist

- [ ] All required secrets added to GitHub
- [ ] Secret names match exactly in workflow files
- [ ] Different secrets for dev/staging/prod
- [ ] Secrets rotated within last 90 days
- [ ] No secrets committed to repository (run `git log -p` to verify)
- [ ] GitHub Secret scanning enabled (Settings → Security & analysis)
- [ ] Team members have repository access to manage secrets
- [ ] Secret access logged/auditable

## References

- [GitHub Actions: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub CLI: Secret Management](https://cli.github.com/manual/gh_secret)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
