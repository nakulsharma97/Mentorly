# Frontend Module Guide

Purpose: give new contributors a 1-2 minute orientation for each frontend package under `frontend/src`.

## How To Read This

For each area:

- Responsibility: what it owns
- Start here: first file to open
- Typical changes: where to modify features safely

## Module Map

### api

- Responsibility: shared HTTP client and backend base URL configuration.
- Start here: `api/client.js`.
- Typical changes: auth headers, interceptors, endpoint helper methods.

### components

- Responsibility: reusable UI primitives shared by pages.
- Start here: `components/Navbar.jsx`, `components/AuthModal.jsx`.
- UI primitives: `components/ui/Primitives.jsx` (buttons, cards, fields, badges, alerts).
- Typical changes: navigation items, role switch UX, modal behavior.
- Test files: `Navbar.test.jsx`.

### pages

- Responsibility: route-level screens and page composition.
- Start here: `pages/Dashboard.jsx`, `pages/LearnerDashboard.jsx`, `pages/MentorDashboard.jsx`.
- Typical changes: add/modify route-level UI, wire API data into page layouts.
- Additional notable pages:
  - `AuthPage.jsx`
  - `AnalyticsPage.jsx`
  - `LearningPage.jsx`
  - `TeachingPage.jsx`
  - `MessagesPage.jsx`
  - `ResourcesPage.jsx`
  - `RoleGuide.jsx`
  - `ProfileSetup.jsx`
  - `ExecutiveDashboard.jsx`
  - `MentorProfilePage.jsx`
  - `NotFoundPage.jsx`
- Test files: `AnalyticsPage.test.jsx`.

### utils

- Responsibility: pure helper logic and shared data transforms.
- Start here: `utils/profileSkills.js`, `utils/i18n.js`.
- Typical changes: formatting, i18n helper updates, data mapping helpers.

### app composition files

- `App.jsx`: route tree and top-level app composition.
- `main.jsx`: React bootstrap entrypoint.
- `styles.css`: global tokens/base style layer.

### frontend test setup

- `test/setupTests.js`: testing environment setup.
- `App.role-routing.test.jsx`: role-routing behavior coverage.

## Contribution Shortcut

1. If changing data fetching: start in `api/client.js`.
2. If changing page behavior: edit corresponding file in `pages/`.
3. If UI is shared across routes: move logic into `components/`.
4. Keep pure transformations in `utils/`.
5. Update/add tests near touched route/component.
