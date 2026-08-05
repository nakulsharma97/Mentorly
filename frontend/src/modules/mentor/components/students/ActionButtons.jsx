/**
 * Details-panel actions — Message + Schedule Session (equal width, 50px,
 * radius 16) and a subtle report link. Sticky at the bottom on mobile.
 */
export default function ActionButtons({ onMessage, onSchedule, onReport }) {
  return (
    <div className="ss-actions">
      <button type="button" className="ss-actions__btn ss-actions__btn--primary" onClick={onMessage}>
        <span className="material-symbols-outlined">chat_bubble</span>
        Message
      </button>
      <button type="button" className="ss-actions__btn ss-actions__btn--outline" onClick={onSchedule}>
        <span className="material-symbols-outlined">event</span>
        Schedule Session
      </button>
      {onReport && (
        <button type="button" className="ss-actions__link" onClick={onReport}>
          Report this learner
        </button>
      )}
    </div>
  );
}
