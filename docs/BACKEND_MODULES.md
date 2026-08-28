# Backend Module Guide

Purpose: give new contributors a 1-2 minute understanding of each backend package under `backend/src/main/java/com/skillswap`.

## How To Read This

For each module:

- Responsibility: what business area it owns
- Main entry points: classes to read first
- Typical changes: where to edit for common tasks

## Module Map

### analytics

- Responsibility: role-based analytics summary, trends, and share payloads.
- Main entry points: `AnalyticsController`, `AnalyticsService`, `AnalyticsDtos`.
- Typical changes: add new KPI field in `AnalyticsService` and DTO mappings.

### auth

- Responsibility: authentication, JWT issuance/validation, OAuth2 login handling.
- Main entry points: `AuthController`, `AuthService`, `JwtService`, `AppUserDetailsService`.
- Typical changes: login/signup behavior, token claims, auth flow callbacks.

### availability

- Responsibility: mentor availability slots and retrieval.
- Main entry points: `AvailabilityController`, `UserAvailabilitySlot`, `UserAvailabilitySlotRepository`.
- Typical changes: slot rules, slot conflict checks, availability filtering.

### booking

- Responsibility: booking lifecycle and booking status transitions.
- Main entry points: `BookingController`, `Booking`, `BookingRepository`, `BookingStatus`.
- Typical changes: booking status transitions, query optimizations, booking rules.
- API contract notes:
  - `POST /api/v1/bookings` requires `Idempotency-Key` header.
  - Replays for same key + payload return existing booking with message `Booking replayed`.
  - Payload mismatch for same key returns `400`.
  - Temporary write conflicts return `409` with `code=BOOKING_TEMPORARY_CONFLICT` and `retryable=true`.
  - Emit counters under `booking.create.*` and include `traceId` in error payloads.

### certification

- Responsibility: user certification records and certificate operations.
- Main entry points: `CertificationController`, `CertificationService`, `UserCertification`.
- Typical changes: add fields to certification, validation rules, retrieval endpoints.

### chat

- Responsibility: booking-centric messaging and WebSocket chat handling.
- Main entry points: `ChatController`, `ChatService`, `BookingChatWebSocketHandler`, `ChatMessage`.
- Typical changes: message payload format, websocket routing, persistence rules.

### common

- Responsibility: cross-cutting API wrappers, exception handling, and health endpoints.
- Main entry points: `ApiResponse`, `GlobalExceptionHandler`, `HealthController`.
- Typical changes: standardized error/response shapes and platform-level handlers.

### config

- Responsibility: security filter chain, JWT request filtering, websocket config.
- Main entry points: `SecurityConfig`, `JwtAuthenticationFilter`, `WebSocketConfig`.
- Typical changes: authorization rules, CORS/CSRF behavior, security middleware order.

### notification

- Responsibility: in-app and email notifications and user notification preferences.
- Main entry points: `NotificationController`, `NotificationService`, `EmailNotificationService`, entities/repositories.
- Typical changes: event notification behavior, templates, preference checks.

### payment

- Responsibility: payment records, status updates, and payment queries.
- Main entry points: `PaymentController`, `Payment`, `PaymentRepository`, `PaymentStatus`.
- Typical changes: payment state transitions, audit fields, repository filters.
- **Note:** gateways are a `PaymentGateway` Strategy pattern; the **Stripe adapter makes real test-mode API calls** (PaymentIntent + `Webhook.constructEvent` signature verification), while the Razorpay adapter **simulates** gateway calls (see README → Current limitations). Idempotency handling is fully real.
- API contract notes:
  - `POST /api/v1/payments/intent` and `PATCH /api/v1/payments/{id}/status` require `Idempotency-Key`.
  - Payment idempotency validation uses the same shared rules as booking.
  - Replays should return the original payment object when the same key and payload are reused.

### review

- Responsibility: learner and mentor reviews and review retrieval.
- Main entry points: `ReviewController`, `MentorReview`, `LearnerReview`, repositories.
- Typical changes: rating rules, moderation flags, pagination/sorting.

### roadmap

- Responsibility: learner roadmap creation/tracking and progress updates.
- Main entry points: `LearningRoadmapController`, `LearningRoadmap`, `LearningRoadmapRepository`.
- Typical changes: progress calculations, roadmap milestones, completion logic.

### safety

- Responsibility: reports, user blocking, and safety moderation artifacts.
- Main entry points: `SafetyController`, `UserReport`, `UserBlock`, repositories.
- Typical changes: report workflow states, abuse handling rules, block checks.

### search

- Responsibility: mentor discovery and search filtering.
- Main entry points: `MentorSearchController`.
- Typical changes: search criteria, ranking, filter semantics.

### session

- Responsibility: mentor session creation, listing, and session status.
- Main entry points: `SessionController`, `SkillSession`, `SessionRepository`, `SessionStatus`.
- Typical changes: session scheduling, listing filters, session metadata.

### sessionpackage

- Responsibility: mentor package-based offerings tied to sessions.
- Main entry points: `SessionPackageController`, `SessionPackage`, `SessionPackageRepository`.
- Typical changes: package pricing structure, package lifecycle, package retrieval.

### skill

- Responsibility: skill catalog and skill metadata APIs.
- Main entry points: `SkillController`, `Skill`, `SkillRepository`.
- Typical changes: skill taxonomy, new skill attributes, search/list tuning.

### user

- Responsibility: user profile core data and user role model.
- Main entry points: `UserController`, `User`, `UserRepository`, `UserRole`.
- Typical changes: profile fields, role-bound validations, account queries.

### verification

- Responsibility: mentor and skill verification workflows and submission states.
- Main entry points: `MentorVerificationController`, `SkillVerificationController`, entities/repositories.
- Typical changes: verification status transitions, reviewer flows, evidence checks.

### waitlist

- Responsibility: session waitlist entries and waitlist status updates.
- Main entry points: `WaitlistController`, `SessionWaitlist`, `SessionWaitlistRepository`, `WaitlistStatus`.
- Typical changes: queue ordering, promotion rules, notifications.

### watchlist

- Responsibility: saved mentors and watched skills.
- Main entry points: `WatchlistController`, `SavedMentor`, `SkillWatchlist`, repositories.
- Typical changes: save/unsave actions, deduping rules, list projections.

### root application class

- Entry point: `SkillSwapApplication`.

## Contribution Shortcut

1. Find the module above that matches the feature.
2. Open controller and service first.
3. Update DTO/entity/repository as needed.
4. Add migration if schema changes.
