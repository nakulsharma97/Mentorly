import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { formatDate, formatTime } from "./data";
import { Avatar, Reveal } from "./ui";

/**
 * Large premium card focusing on the current milestone: progress, assigned
 * mentor, next session, today's tasks, practice + quick actions.
 */
export default function CurrentMilestone({
  milestone,
  progress,
  mentor,
  nextSession,
  weeksLeft,
}) {
  if (!milestone) return null;

  const tasks = milestone.tasks || [];
  const practice = milestone.resources?.practice || [];

  return (
    <section className="lp-section" aria-label="Current milestone">
      <Reveal>
        <div className="lp-focus">
          <div className="lp-focus__glow" />
          <div className="lp-focus__head">
            <div className="lp-focus__title-wrap">
              <span className="lp-focus__icon">
                <Icon name="track_changes" />
              </span>
              <div>
                <span className="lp-focus__eyebrow">Current milestone</span>
                <h2 className="lp-focus__title">{milestone.title}</h2>
              </div>
            </div>
            <div className="lp-focus__progress">
              <span className="lp-focus__pct">{progress}%</span>
              <div className="lp-bar lp-bar--lg">
                <motion.div
                  className="lp-bar__fill"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <span className="lp-focus__eta">
                <Icon name="hourglass_bottom" /> Est. finish ~{weeksLeft} weeks
              </span>
            </div>
          </div>

          <div className="lp-focus__grid">
            {/* Today's tasks */}
            <div className="lp-focus__card">
              <h3><Icon name="today" /> Today's Tasks</h3>
              <ul className="lp-focus__tasks">
                {tasks.slice(0, 4).map((t) => (
                  <li key={t}>
                    <span className="lp-focus__task-check"><Icon name="check" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Practice questions */}
            <div className="lp-focus__card">
              <h3><Icon name="quiz" /> Practice Questions</h3>
              <ul className="lp-focus__practice">
                {practice.slice(0, 3).map((p) => (
                  <li key={p}>
                    <Icon name="arrow_forward_ios" /> {p}
                  </li>
                ))}
              </ul>
              <span className="lp-focus__assignment">
                <Icon name="assignment" /> <strong>Assignment:</strong> {milestone.project}
              </span>
            </div>

            {/* Mentor + session */}
            <div className="lp-focus__card lp-focus__card--mentor">
              <h3><Icon name="support_agent" /> Your Mentor</h3>
              {mentor ? (
                <div className="lp-focus__mentor">
                  <Avatar url={mentor.profileImageUrl} name={mentor.fullName || "Mentor"} size={48} />
                  <div>
                    <strong>{mentor.fullName || "Mentor"}</strong>
                    <span>{mentor.headline || "Verified mentor"}</span>
                  </div>
                </div>
              ) : (
                <p className="lp-focus__no-mentor">No mentor assigned yet — book a session to get guided.</p>
              )}
              {nextSession ? (
                <div className="lp-focus__session">
                  <span className="lp-focus__session-date">
                    <Icon name="calendar_today" /> {formatDate(nextSession.startTime)}
                  </span>
                  <span className="lp-focus__session-date">
                    <Icon name="schedule" /> {formatTime(nextSession.startTime)}
                  </span>
                </div>
              ) : (
                <p className="lp-focus__no-mentor">No upcoming session.</p>
              )}
            </div>
          </div>

          <div className="lp-focus__actions">
            {nextSession?.meetingLink ? (
              <a href={nextSession.meetingLink} target="_blank" rel="noreferrer" className="lp-btn lp-btn--primary">
                <Icon name="videocam" /> Join Session
              </a>
            ) : (
              <Link to="/learner/mentors" className="lp-btn lp-btn--primary">
                <Icon name="calendar_add_on" /> Book a Session
              </Link>
            )}
            <Link to="/learner/messages" className="lp-btn lp-btn--outline">
              <Icon name="chat_bubble" /> Chat Mentor
            </Link>
            <Link to="/learner/resources" className="lp-btn lp-btn--ghost">
              <Icon name="sticky_note_2" /> View Notes
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
