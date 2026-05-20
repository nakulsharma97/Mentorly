# Payment API Contract

This document captures the payment behavior that the frontend and backend rely on.

## Endpoints

### Create payment intent

- Method: `POST`
- Path: `/api/v1/payments/intent`
- Header: `Idempotency-Key` (required)

Request body:

```json
{
  "bookingId": 123,
  "amount": 1200,
  "mode": "CARD"
}
```

Behavior:

- Learners and admins can create intents.
- Replays with the same key and payload return the original intent.
- Replays with a mismatched payload return `400`.

### Update payment status

- Method: `PATCH`
- Path: `/api/v1/payments/{id}/status`
- Header: `Idempotency-Key` (required)

Request body:

```json
{
  "status": "PAID"
}
```

Behavior:

- Admins or the session mentor can update the status.
- Replays use the same idempotency rules as payment intent creation.

## Rules

- Payment idempotency validation uses the same header rules as booking.
- Public responses use the standard API envelope.
- Retryable behavior should stay consistent with the shared error handling contract.
