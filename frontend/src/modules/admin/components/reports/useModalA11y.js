import { useEffect, useRef } from "react";

/**
 * useModalA11y — accessibility plumbing for modal dialogs / drawers:
 *  - Escape-to-close (skipped while an action is in flight)
 *  - Initial focus moved into the dialog
 *  - Tab focus trapped inside the dialog
 *  - Focus restored to the previously focused element on close
 *
 * `deps` should mirror the dialog's open state so the effect re-runs per open.
 */
export default function useModalA11y({ open, onClose, busy = false, dialogRef }) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef?.current;
    if (!dialog) return undefined;

    previouslyFocusedRef.current = document.activeElement;

    // Initial focus: the first focusable element inside the dialog.
    const focusables = dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length) {
      focusables[0].focus();
    } else {
      dialog.setAttribute("tabindex", "-1");
      dialog.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const list = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (list.length === 0) return;

      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, busy, onClose, dialogRef]);
}
