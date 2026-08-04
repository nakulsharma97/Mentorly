/**
 * Animated three-dot typing indicator.
 * Renders an accessible label so screen readers announce "X is typing".
 */
export default function TypingIndicator({ name = "Someone" }) {
  return (
    <div className="ms-typing" role="status" aria-live="polite" aria-label={`${name} is typing`}>
      <span />
      <span />
      <span />
    </div>
  );
}
