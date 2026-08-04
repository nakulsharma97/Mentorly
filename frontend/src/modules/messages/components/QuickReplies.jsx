const QUICK_REPLIES = [
  "Thanks! 🙏",
  "Let's schedule.",
  "Please review my assignment.",
  "I'll check your code.",
  "Can you explain this topic?",
  "See you in the session.",
  "I'll upload the resources.",
  "Please complete the practice questions.",
];

/**
 * One-tap mentoring replies shown above the composer — send instantly.
 */
export default function QuickReplies({ onSend, disabled }) {
  if (disabled) return null;
  return (
    <div className="ms-quick" aria-label="Quick replies">
      {QUICK_REPLIES.map((text) => (
        <button
          key={text}
          type="button"
          className="ms-quick__chip"
          onClick={() => onSend?.(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
