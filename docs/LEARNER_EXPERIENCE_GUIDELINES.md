# Learner Experience Guidelines

This guide defines how post-login learner pages should be structured so the product stays understandable and consistent.

## Primary Learner Journey

1. Complete profile basics
2. Add watched skills
3. Browse mentors
4. Book session
5. Message mentor and prepare
6. Complete session
7. Leave review and continue

## Learner Home Information Architecture

Keep only these blocks in learner home:

1. Header hero (identity + primary actions)
2. Onboarding checklist (5-step progress)
3. Smart next-step panel (single recommended action)
4. Upcoming sessions (status + next action)
5. Roadmaps and progress metrics
6. Sidebar (certifications, watched skills, quick actions)

## Empty State Standard

Every empty state must include:

1. Clear title
2. Why it is empty
3. One primary action button

Example pattern:

- Title: No upcoming sessions yet
- Why: Book your next session to keep your momentum
- Action: Find mentors

## Session Status Language

Use consistent learner-facing labels:

- Requested
- Confirmed
- Reschedule Requested
- Completed
- Cancelled
- Declined

Each status card should include:

1. Label chip
2. Next action text

## CTA Hierarchy

Use exactly one visual primary action per section:

1. Primary CTA: solid background
2. Secondary CTA: subtle/outlined
3. Tertiary CTA: text link

## Role Safety Rule

Learner pages must not render mentor-only controls:

- No mentor verification workflows
- No mentor earnings management
- No mentor session publishing controls

## Suggested Test Cases

1. Learner login loads learner dashboard layout
2. Onboarding checklist shows progress count
3. Upcoming session cards display normalized status labels
4. Empty states render title + reason + action button
5. Primary learner CTA routes to /mentors when relevant

## Maintenance Rule

Before adding any new learner panel, verify:

1. It maps to a journey step
2. It has a clear CTA
3. It does not duplicate another section
4. It respects role boundaries
