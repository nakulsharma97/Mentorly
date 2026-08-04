import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { formatTime } from "./data";
import { EmptyState, Reveal, SectionHeader } from "./ui";

function dayLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** Next 7 days: sessions, deadlines, meetings and study blocks. */
export default function LearningCalendar({ events, milestones }) {
  // Merge real session events with derived milestone study blocks.
  const studyBlocks = milestones
    .filter((m) => m.status === "current" || m.status === "upcoming")
    .slice(0, 2)
    .map((m) => ({
      id: `study-${m.id}`,
      type: "study",
      title: `Study: ${m.title}`,
      sub: m.project,
      icon: "menu_book",
      startTime: null,
    }));

  const items = [...events, ...studyBlocks];

  return (
    <section className="lp-section" aria-label="Learning calendar">
      <Reveal>
        <SectionHeader
          icon="calendar_month"
          title="Upcoming Week"
          subtitle="Sessions, deadlines and study blocks for the next 7 days"
        />
      </Reveal>

      {items.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            icon="event_busy"
            title="A clear week ahead"
            description="Book a mentor session or set a study block — a full calendar is a growing calendar."
            actions={
              <Link to="/learner/mentors" className="lp-btn lp-btn--primary">
                <Icon name="person_search" /> Book a Session
              </Link>
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <div className="lp-calendar">
            {items.map((ev) => (
              <article key={ev.id} className={`lp-calendar__item is-${ev.type}`}>
                <span className="lp-calendar__day">
                  <strong>{dayLabel(ev.startTime) || "Flex"}</strong>
                  {ev.startTime && <small>{new Date(ev.startTime).getDate()}</small>}
                </span>
                <span className="lp-calendar__icon">
                  <Icon name={ev.icon} />
                </span>
                <div className="lp-calendar__body">
                  <h3>{ev.title}</h3>
                  <p>{ev.sub}</p>
                </div>
                <span className="lp-calendar__time">
                  {ev.startTime ? (
                    <>
                      <Icon name="schedule" /> {formatTime(ev.startTime)}
                    </>
                  ) : (
                    <em>Flexible</em>
                  )}
                </span>
                {ev.meetingLink && (
                  <a href={ev.meetingLink} target="_blank" rel="noreferrer" className="lp-btn lp-btn--primary lp-btn--sm">
                    <Icon name="videocam" /> Join
                  </a>
                )}
              </article>
            ))}
          </div>
        </Reveal>
      )}
    </section>
  );
}
