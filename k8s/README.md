# Kubernetes Deployment — SkillSwap Platform

This directory contains Kubernetes manifests for deploying the SkillSwap platform.

## Prerequisites

- A Kubernetes cluster (v1.24+)
- `kubectl` configured with cluster access
- An Ingress controller (e.g., nginx-ingress)
- (Optional) cert-manager for automatic TLS

## Quick Start

```bash
# 1. Create the namespace
kubectl apply -f k8s/namespace.yaml

# 2. Configure secrets and config
#    Edit configmap.yaml and replace placeholder values before applying
kubectl apply -f k8s/configmap.yaml

# 3. Deploy the backend
kubectl apply -f k8s/backend-deployment.yaml

# 4. Deploy the frontend
kubectl apply -f k8s/frontend-deployment.yaml

# 5. Set up ingress (replace app.yourdomain.com with your domain)
kubectl apply -f k8s/ingress.yaml
```

## Configuration

### Secrets (configmap.yaml)

The `skillswap-secrets` Secret contains sensitive values. **Before deploying:**

1. Open `k8s/configmap.yaml`
2. Replace all `replace-me` and `replace-with-*` values with your actual secrets
3. Use `kubectl create secret generic skillswap-secrets ...` for production instead of storing secrets in YAML

### Docker Images

Update the container images in `backend-deployment.yaml` and `frontend-deployment.yaml`:

- Replace `ghcr.io/your-org` with your actual registry
- Update the image tag to match your CI/CD output

```bash
# Example: images built by GitHub Actions
kubectl set image deployment/skillswap-backend backend=ghcr.io/my-org/skillswap-backend:latest
kubectl set image deployment/skillswap-frontend frontend=ghcr.io/my-org/skillswap-frontend:latest
```

## Scaling

```bash
# Scale backend to 3 replicas
kubectl scale deployment skillswap-backend --replicas=3

# Scale frontend to 3 replicas
kubectl scale deployment skillswap-frontend --replicas=3
```

## Monitoring

```bash
# Check pod status
kubectl get pods -n skillswap

# View backend logs
kubectl logs -n skillswap -l app=skillswap,tier=backend

# Check deployment rollout status
kubectl rollout status deployment/skillswap-backend -n skillswap

# Rollback to previous version
kubectl rollout undo deployment/skillswap-backend -n skillswap
```

## TLS Certificates

The ingress assumes cert-manager is installed with a `letsencrypt-prod` ClusterIssuer.
Alternatively, update `ingress.yaml` to use a manually managed TLS secret.
