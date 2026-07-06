# Booking API Contract

This document defines the booking-create API behavior expected by frontend, tests, and observability.

## Endpoint

- Method: `POST`
- Path: `/api/v1/bookings`
- Auth: required (learner/admin roles only)
- Header: `Idempotency-Key` (required)

## Idempotency-Key Rules

- Length must be between 8 and 120 characters.
- Allowed characters: letters, numbers, `.`, `_`, `:`, `-`.
- Key must be stable across retries for the same user action.

## Request Body

```json
{
  "sessionId": 123
}
```

## Responses

### Success: booking created

- HTTP: `200`
- Message: `Booking created`
- Payload: booking object

### Success: idempotent replay

- HTTP: `200`
- Message: `Booking replayed`
- Payload: existing booking object

### Client validation errors

- HTTP: `400`
- Examples:
  - `Idempotency-Key header is required`
  - `Idempotency-Key header must be 8-120 characters`
  - `Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)`
  - `Idempotency key reuse with different payload`

### Retryable conflict

- HTTP: `409`
- Code: `BOOKING_TEMPORARY_CONFLICT`
- Retryable: `true`
- Error message: `Temporary booking conflict. Please retry.`

## Error Envelope

All booking errors use standard envelope fields:

- `message`: request-level summary
- `data.code`: stable machine-readable code where available
- `data.error`: user-safe explanation
- `data.retryable`: `true` when retry is recommended
- `data.traceId`: request trace for diagnostics

## Metrics And Logs

Expected counters for booking create flow:

- `booking.create.request`
- `booking.create.success`
- `booking.create.replay`
- `booking.create.retry.success`
- `booking.create.failed` (with `reason` tag)

Structured logs should include:

- `outcome`
- `reason`
- `userId`
- `sessionId`
- `idempotencyKey` (summarized)
- `traceId`
