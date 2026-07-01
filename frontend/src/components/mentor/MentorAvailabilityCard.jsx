const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MentorAvailabilityCard({ slots, timezone }) {
  const visibleSlots = slots.slice(0, 5);

  return (
    <section className="dashboard-card mentor-section-card mentor-availability-card">
      <div className="mentor-section-header">
        <div>
          <h3>Availability insights</h3>
          <p className="mentor-section-copy">
            Time windows set by the mentor in your current timezone.
          </p>
        </div>
        <span className="mentor-badge mentor-badge-alt">
          {timezone || "Local timezone"}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="mentor-empty-state">
          <p className="mentor-empty-title">No live availability yet</p>
          <p className="mentor-empty-text">
            This mentor is building their schedule. Check back later for new
            time slots.
          </p>
        </div>
      ) : (
        <ul className="mentor-availability-list">
          {visibleSlots.map((slot, index) => (
            <li
              key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
              className="mentor-availability-item"
            >
              <strong>{DAY_LABELS[slot.dayOfWeek - 1] || "Day"}</strong>
              <span>
                {slot.startTime} – {slot.endTime}
              </span>
              <small>{slot.note || "Available"}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
