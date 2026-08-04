import { motion } from "framer-motion";
import Icon from "../../../common/dashboard/Icon";
import { Reveal, SectionHeader } from "./ui";

/** Lightweight animated bar chart (no chart dependency). */
function BarChart({ series }) {
  const maxHours = Math.max(...series.map((d) => d.hours), 1);
  const total = series.reduce((s, d) => s + d.sessions, 0);
  return (
    <div className="lp-chart">
      <div className="lp-chart__y-axis" aria-hidden="true">
        <span>{Math.ceil(maxHours)}h</span>
        <span>{Math.ceil(maxHours / 2)}h</span>
        <span>0h</span>
      </div>
      <div className="lp-chart__plot">
        {series.map((d, i) => (
          <div key={d.date} className="lp-chart__col">
            <span className="lp-chart__val">{d.hours > 0 ? `${d.hours}h` : ""}</span>
            <div className="lp-chart__bar-wrap">
              <motion.div
                className={`lp-chart__bar${d.isToday ? " is-today" : ""}`}
                initial={{ height: 0 }}
                whileInView={{ height: `${Math.max((d.hours / maxHours) * 100, d.hours > 0 ? 8 : 2)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className={`lp-chart__label${d.isToday ? " is-today" : ""}`}>
              {d.isToday ? "Today" : d.label}
            </span>
          </div>
        ))}
      </div>
      <p className="lp-chart__total">
        <Icon name="insights" /> {total} session{total === 1 ? "" : "s"} this week
      </p>
    </div>
  );
}

/** Weekly analytics: hours, sessions, assignments, projects + goals. */
export default function AnalyticsChart({ weeklySeries, stats, goals }) {
  const goalCards = [
    { icon: "schedule", label: "Weekly Goal", value: `${Math.round(stats.hours)}h / ${goals.weeklyHours}h`, pct: Math.min(100, Math.round((stats.hours / Math.max(1, goals.weeklyHours)) * 100)) },
    { icon: "calendar_month", label: "Monthly Goal", value: `${stats.sessions} / ${goals.monthlySessions} sessions`, pct: Math.min(100, Math.round((stats.sessions / Math.max(1, goals.monthlySessions)) * 100)) },
    { icon: "construction", label: "Projects", value: `${goals.projectsDone} / ${goals.projectsTotal} built`, pct: Math.min(100, Math.round((goals.projectsDone / Math.max(1, goals.projectsTotal)) * 100)) },
  ];

  return (
    <section className="lp-section" aria-label="Weekly analytics">
      <div className="lp-cols lp-cols--analytics">
        <Reveal className="lp-analytics-main">
          <SectionHeader
            icon="insights"
            title="Weekly Analytics"
            subtitle="Your learning activity over the last 7 days"
          />
          <div className="lp-card lp-card--chart">
            <BarChart series={weeklySeries} />
          </div>
        </Reveal>

        <Reveal delay={0.08} className="lp-analytics-side">
          <SectionHeader icon="flag" title="Goals" subtitle="This week's targets" />
          <div className="lp-goals">
            {goalCards.map((g) => (
              <div key={g.label} className="lp-goal">
                <span className="lp-goal__icon">
                  <Icon name={g.icon} />
                </span>
                <div className="lp-goal__body">
                  <span className="lp-goal__label">{g.label}</span>
                  <strong className="lp-goal__value">{g.value}</strong>
                  <div className="lp-bar">
                    <motion.div
                      className="lp-bar__fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${g.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <span className="lp-goal__pct">{g.pct}%</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
