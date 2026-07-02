import SectionCard from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { initials, formatDateParts, formatTime } from "../../../common/dashboard/dashboardUtils";

/** Pending booking requests with inline accept / decline. */
export default function PendingRequests({ requests = [], onRespond }) {
  if (requests.length === 0) return null;

  return (
    <SectionCard title="Pending Booking Requests" icon="pending_actions">
      <div className="md-pending">
        {requests.slice(0, 4).map((b) => {
          const learner = b?.learner?.fullName || "Learner";
          const { day, month } = formatDateParts(b?.session?.startTime);
          return (
            <div key={b.id} className="md-pending__item">
              <span className="md-avatar">{initials(learner)}</span>
              <div className="md-row__main">
                <p className="md-row__title">{learner}</p>
                <p className="md-row__meta">
                  <Icon name="menu_book" />
                  {b?.session?.skill?.name || b?.session?.title || "Session"}
                  <span>·</span>
                  <Icon name="schedule" /> {month} {day}, {formatTime(b?.session?.startTime)}
                </p>
              </div>
              <div className="md-pending__btns">
                <button
                  type="button"
                  className="md-icon-btn-accept"
                  onClick={() => onRespond(b.id, "ACCEPTED")}
                >
                  <Icon name="check" /> Accept
                </button>
                <button
                  type="button"
                  className="md-icon-btn-decline"
                  onClick={() => onRespond(b.id, "REJECTED")}
                >
                  <Icon name="close" /> Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
