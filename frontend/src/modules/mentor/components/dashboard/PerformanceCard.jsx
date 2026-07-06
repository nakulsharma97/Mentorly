import SectionCard from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";

/** Radial completion gauge + supporting stats. */
export default function PerformanceCard({ percent = 0, sessions = 0, bookings = 0 }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <SectionCard title="Performance" icon="trending_up">
      <div className="md-perf">
        <svg className="md-ring" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="mdRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>
          <circle className="md-ring__track" cx="50" cy="50" r={r} />
          <circle
            className="md-ring__val"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
          <text className="md-ring__text" x="50" y="55" textAnchor="middle">
            {percent}%
          </text>
        </svg>
        <div>
          <p className="md-stat__label" style={{ marginBottom: 6 }}>
            Session Completion Rate
          </p>
          <p className="md-row__meta" style={{ margin: 0 }}>
            <Icon name="video_camera_front" /> {sessions} sessions
            <span>·</span>
            <Icon name="event" /> {bookings} bookings
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
