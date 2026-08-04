import { motion } from "framer-motion";
import Icon from "../../../common/dashboard/Icon";
import { ProgressRing, Reveal, SectionHeader } from "./ui";

const METRICS = [
  { key: "interview", label: "Interview Readiness", icon: "record_voice_over" },
  { key: "resume", label: "Resume Completion", icon: "description" },
  { key: "portfolio", label: "Portfolio Completion", icon: "web" },
  { key: "github", label: "GitHub Activity", icon: "code" },
  { key: "mockInterviews", label: "Mock Interviews", icon: "groups" },
  { key: "coding", label: "Coding Score", icon: "terminal" },
  { key: "communication", label: "Communication", icon: "forum" },
];

function readinessTone(score) {
  if (score >= 75) return { label: "Job Ready", color: "#10b981" };
  if (score >= 50) return { label: "Interview Soon", color: "#f59e0b" };
  if (score >= 25) return { label: "Building", color: "#3b82f6" };
  return { label: "Just Starting", color: "#94a3b8" };
}

/** Job readiness scoreboard with a big gauge + per-skill bars. */
export default function CareerReadiness({ readiness }) {
  const tone = readinessTone(readiness.jobReadiness);

  return (
    <section className="lp-section" aria-label="Career readiness">
      <Reveal>
        <SectionHeader
          icon="rocket_launch"
          title="Career Readiness"
          subtitle="A live estimate of how close you are to your career goal"
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-readiness">
          <div className="lp-readiness__gauge">
            <ProgressRing value={readiness.jobReadiness} size={150} stroke={12} label={`${readiness.jobReadiness}%`} sublabel={tone.label} id="lpReadyRing" />
            <span className="lp-readiness__tone" style={{ color: tone.color, background: `${tone.color}1f` }}>
              <Icon name="flag" /> {tone.label}
            </span>
            <p className="lp-readiness__hint">
              {readiness.jobReadiness >= 75
                ? "You're ready to start applying — polish your resume and go!"
                : readiness.jobReadiness >= 50
                  ? "Solid progress — book mock interviews to sharpen up."
                  : "Keep building — every session and project moves the needle."}
            </p>
          </div>

          <div className="lp-readiness__bars">
            {METRICS.map((m, i) => {
              const val = readiness[m.key] || 0;
              return (
                <div key={m.key} className="lp-readiness__row">
                  <span className="lp-readiness__row-icon">
                    <Icon name={m.icon} />
                  </span>
                  <div className="lp-readiness__row-body">
                    <div className="lp-readiness__row-head">
                      <span>{m.label}</span>
                      <strong>{val}%</strong>
                    </div>
                    <div className="lp-bar">
                      <motion.div
                        className="lp-bar__fill"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${val}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
