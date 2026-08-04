/**
 * Animated skeleton loaders — conversation list items and chat bubbles.
 */
export function ConversationListSkeleton({ count = 5 }) {
  return (
    <div className="ms-skel-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="ms-skel-item" key={i}>
          <span className="ms-skel-avatar" />
          <div className="ms-skel-lines">
            <span className="ms-skel-line ms-skel-line--lg" />
            <span className="ms-skel-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="ms-skel-thread" aria-hidden="true">
      <span className="ms-skel-bubble left" />
      <span className="ms-skel-bubble left" />
      <span className="ms-skel-bubble right" />
      <span className="ms-skel-bubble left" />
      <span className="ms-skel-bubble right" />
      <span className="ms-skel-bubble right" />
    </div>
  );
}

export function UserCardSkeleton({ count = 4 }) {
  return (
    <div className="ms-skel-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="ms-skel-user" key={i}>
          <span className="ms-skel-avatar" />
          <div className="ms-skel-lines">
            <span className="ms-skel-line ms-skel-line--lg" />
            <span className="ms-skel-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
