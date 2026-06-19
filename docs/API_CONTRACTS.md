# API Contracts Index

This index points to the source of truth for public behavior that other code depends on.

## Current Contracts

- Booking create contract: [docs/BOOKING_API_CONTRACT.md](BOOKING_API_CONTRACT.md)
- Payment contract: [docs/PAYMENT_API_CONTRACT.md](PAYMENT_API_CONTRACT.md)
- Role-aware booking UX notes: [LEARNER_MENTOR_SEPARATION.md](../LEARNER_MENTOR_SEPARATION.md)

## Cross-Cutting Rules

- Shared API response envelope and retryable error fields are handled in backend common error handling.
- Idempotency rules for booking and payment endpoints should stay aligned across controllers.

## Maintenance Rule

Add a new entry here whenever a public endpoint gets a contract doc, a replay rule, or a behavior that the frontend depends on directly.
