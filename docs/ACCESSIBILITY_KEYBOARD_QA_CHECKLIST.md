# Keyboard QA Checklist

Run this checklist before each release candidate to verify keyboard-only usability.

## Global Navigation

1. Tab reaches all primary navigation items in visible order.
2. Focus ring is visible on every interactive element.
3. Enter/Space activates buttons and links.
4. Escape closes dialogs and returns focus to opener.

## Auth Flows

1. Login form supports full keyboard entry and submit.
2. Signup form validation errors are announced and focusable.
3. Role switcher can be opened, navigated, and selected via keyboard.

## Learning/Mentoring Flows

1. Session cards and booking actions are tab-accessible.
2. Payment flow controls can be completed without mouse interaction.
3. Message composer, send action, and thread navigation work via keyboard.

## Regression Notes

1. Capture browser + OS used.
2. Record any blocked path and offending element selector.
3. Link issue to release checklist before approval.
