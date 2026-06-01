# GitHub Environment Protection Setup

Use GitHub environment rules so production promotion requires human approval.

## Environments

1. `staging`

- Optional required reviewers
- Deployment history retention enabled

2. `production`

- Required reviewers (at least 1-2)
- Wait timer (recommended 5-10 minutes)
- Restrict deployments to protected branches only

## Required Secrets/Variables Scope

1. Put staging secrets in `staging` environment.
2. Put production secrets in `production` environment.
3. Avoid storing production credentials as repository-level secrets.

## Branch Protection

Require these status checks before merge to `main/master`:

1. CI / Frontend lint, test, build
2. CI / Backend verify and security scan
3. Backend Test Discovery / Verify backend tests are discovered
4. Secret Scan / Scan repository for leaked secrets

## Promotion Flow

1. Merge -> CI passes
2. Run `release-gate.yml` to staging with URLs
3. Review staging signals and canary policy
4. Run `release-gate.yml` with `promote_to_production=true`
5. Approver validates and approves production gate
