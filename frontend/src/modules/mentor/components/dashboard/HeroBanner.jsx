import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { formatMoney } from "../../../common/dashboard/dashboardUtils";

/**
 * Emerald/teal glass hero banner. Left: greeting + primary actions.
 * Right: floating glass cards (Next Session, Pending Requests, quick stats).
 */
export default function HeroBanner({
  firstName,
  nextSession,
  pendingCount,
  monthGrowth,
  acceptanceRate,
  totalReviews,
  monthlyEarnings,
}) {
  return (
    <header className="md-hero md-animate">
      <div className="md-hero__body">
        <p className="md-hero__eyebrow">Mentor Control Room</p>
        <h1 className="md-hero__title">Welcome back, {firstName}</h1>
        <p className="md-hero__sub">
          Manage sessions, respond to requests, and grow your teaching
          reputation — all from one polished workspace.
        </p>

        <div className="md-hero__actions">
          <Link to="/mentor/teach?tab=sessions" className="md-btn md-btn--primary">
            <Icon name="add" /> Create Session
          </Link>
          <Link to="/mentor/teach?tab=packages" className="md-btn md-btn--ghost">
            <Icon name="inventory_2" /> Manage Packages
          </Link>
          <Link to="/mentor/messages" className="md-btn md-btn--ghost">
            <Icon name="chat_bubble" /> Messages
          </Link>
        </div>

        <div className="md-hero__badges">
          <span className="md-hero__badge">
            <Icon name="trending_up" /> Revenue growth {monthGrowth >= 0 ? "+" : ""}
            {monthGrowth}%
          </span>
          <span className="md-hero__badge">
            <Icon name="task_alt" /> Acceptance {acceptanceRate}%
          </span>
          <span className="md-hero__badge">
            <Icon name="star" /> {totalReviews} reviews
          </span>
        </div>
      </div>

      <div className="md-hero__aside">
        <div className="md-hero-glass">
          <p className="md-hero-glass__label">
            <Icon name="event_upcoming" /> Next Session
          </p>
          <p className="md-hero-glass__value md-hero-glass__value--sm">
            {nextSession ? nextSession.title || "Upcoming session" : "None scheduled"}
          </p>
          <p className="md-hero-glass__desc">
            {nextSession?.startTime
              ? new Date(nextSession.startTime).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Publish a slot to get booked"}
          </p>
        </div>

        <div className="md-hero-glass__row">
          <div className="md-hero-glass">
            <p className="md-hero-glass__label">
              <Icon name="pending_actions" /> Pending
            </p>
            <p className="md-hero-glass__value">{pendingCount}</p>
            <p className="md-hero-glass__desc">Awaiting response</p>
          </div>
          <div className="md-hero-glass">
            <p className="md-hero-glass__label">
              <Icon name="payments" /> This month
            </p>
            <p className="md-hero-glass__value">{formatMoney(monthlyEarnings)}</p>
            <p className="md-hero-glass__desc">Earnings</p>
          </div>
        </div>
      </div>
    </header>
  );
}
