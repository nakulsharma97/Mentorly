# Design Tokens

This lightweight token reference is the baseline for frontend UI consistency.

## Source of Truth

- Core tokens live in [frontend/src/ui-polish.css](../frontend/src/ui-polish.css)
- Base app styling is in [frontend/src/styles.css](../frontend/src/styles.css)
- Reusable primitives are in [frontend/src/components/ui/Primitives.jsx](../frontend/src/components/ui/Primitives.jsx)

## Color Tokens

- Surface: `--surface`, `--surface-container-lowest`, `--surface-container-low`, `--surface-container-high`, `--surface-container-highest`
- Text: `--on-surface`, `--on-surface-variant`
- Action: `--primary`, `--primary-container`, `--secondary`, `--secondary-container`
- Semantic: `--success`, `--warning`, `--error-container`
- Focus: `--focus-ring`

## Spacing and Radius

- Fluid spacing: `--space-fluid`
- Radius scale:
  - small: `.rounded-lg`
  - medium: `.rounded-xl`
  - large: `.rounded-2xl`

## Primitive Component Mapping

- Button: `.ui-btn` with variants
  - `.ui-btn-primary`
  - `.ui-btn-secondary`
  - `.ui-btn-ghost`
- Card: `.ui-card`
- Form field wrapper: `.ui-field`, `.ui-field-label`, `.ui-field-hint`
- Badge: `.ui-badge-*`
- Alert: `.ui-alert-*`

## Accessibility Baselines

- Focus ring: global `:focus-visible` with `--focus-ring`
- Keyboard shortcut: skip-link class `.skip-link`
- Route focus target: `#route-content`
- Alert surfaces use semantic variants for contrast clarity

## Usage Rules

1. Prefer primitives from [frontend/src/components/ui/Primitives.jsx](../frontend/src/components/ui/Primitives.jsx) for new UI.
2. Use token variables in CSS instead of hard-coded colors where possible.
3. Keep responsive spacing fluid by using `--space-fluid` and existing utility classes.
