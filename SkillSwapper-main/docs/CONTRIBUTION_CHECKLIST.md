# Contribution Checklist

Use this checklist before opening a pull request or merging a change.

## Code

- [ ] Feature is scoped to the right domain or page.
- [ ] Shared logic was extracted instead of copied.
- [ ] Naming is consistent with surrounding files.
- [ ] No unrelated formatting churn was introduced.

## Behavior

- [ ] New behavior has tests.
- [ ] Existing tests still pass.
- [ ] Error handling stays aligned with the API envelope.
- [ ] Retry and idempotency flows are still correct where relevant.

## Documentation

- [ ] Public API contract updates are documented.
- [ ] New architecture decisions are added to an ADR.
- [ ] README links still point to the canonical docs.

## Validation

- [ ] Frontend build passes.
- [ ] Backend tests pass.
- [ ] Backend verify passes when backend behavior changes.
- [ ] CI workflow remains green locally where practical.
- [ ] `ci.yml` is green on the PR.
- [ ] `backend-test-discovery.yml` is green for backend-impacting PRs.
- [ ] `secret-scan.yml` is green on the PR.
- [ ] `db-restore-check.yml` latest scheduled/manual run is green before release-cut PRs.
- [ ] Monthly manual DB restore rehearsal is recorded before production release cut.
