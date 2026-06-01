# ADR 0001: Role-Based Learner and Mentor Experiences

Status: Accepted

## Context

The platform serves two distinct user groups with different jobs to be done:

- Learners need to discover mentors, manage bookings, track progress, and continue learning.
- Mentors need to publish sessions, manage requests, review outcomes, and track earnings.

Keeping both roles in a single undifferentiated dashboard makes the product harder to navigate and harder to evolve.

## Decision

Provide separate learner and mentor experiences across navigation, dashboard layout, and primary actions.

The canonical implementation is the role-aware routing and dashboard split in the frontend, backed by shared APIs.

## Consequences

- Learner pages can emphasize browsing, booking, roadmaps, and messages.
- Mentor pages can emphasize session publishing, request handling, reviews, and earnings.
- Shared backend APIs remain reusable, but UI behavior stays role-specific.
- Future features must be checked against role boundaries before being added to a page.
