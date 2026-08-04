import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { EmptyState, Reveal, SectionHeader } from "./ui";

const DIFF = {
  Beginner: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  Intermediate: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  Advanced: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
};

/** Project recommendation cards tied to the roadmap. */
export default function ProjectRecommendations({ projects }) {
  return (
    <section className="lp-section" aria-label="Recommended projects">
      <Reveal>
        <SectionHeader
          icon="construction"
          title="Projects to Build"
          subtitle="Ship real work — portfolios beat resumes"
        />
      </Reveal>

      {projects.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            icon="handyman"
            title="Projects unlock as you progress"
            description="Complete roadmap milestones to unlock starter templates, Figma files and mentor reviews."
            actions={
              <Link to="/learner/path" className="lp-btn lp-btn--primary">
                <Icon name="route" /> View Roadmap
              </Link>
            }
          />
        </Reveal>
      ) : (
        <div className="lp-projects">
          {projects.map((p, i) => {
            const diff = DIFF[p.difficulty] || DIFF.Beginner;
            return (
              <motion.article
                key={p.title}
                className={`lp-project${p.unlocked ? "" : " is-locked"}`}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={p.unlocked ? { y: -5 } : undefined}
              >
                <div className="lp-project__thumb" style={{ background: p.gradient }}>
                  <Icon name={p.icon} />
                  {p.recommended && p.unlocked && (
                    <span className="lp-project__rec"><Icon name="auto_awesome" /> Recommended</span>
                  )}
                  {!p.unlocked && <span className="lp-project__lock"><Icon name="lock" /></span>}
                </div>
                <div className="lp-project__body">
                  <div className="lp-project__meta-row">
                    <span className="lp-project__diff" style={{ color: diff.color, background: diff.bg }}>
                      {p.difficulty}
                    </span>
                    <span className="lp-project__hours"><Icon name="timelapse" /> ~{p.hours}h</span>
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                  <div className="lp-project__tech">
                    {p.technologies.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="lp-project__actions">
                    {p.unlocked ? (
                      <>
                        <Link to="/learner/skills" className="lp-btn lp-btn--primary lp-btn--sm">
                          <Icon name="play_arrow" /> Start Project
                        </Link>
                        <span className="lp-project__ghost-link"><Icon name="code" /> GitHub template</span>
                        <span className="lp-project__ghost-link"><Icon name="palette" /> Figma</span>
                      </>
                    ) : (
                      <span className="lp-project__unlock-hint">
                        <Icon name="lock" /> Unlocks at {Math.round((i / Math.max(1, projects.length)) * 100)}%+ roadmap
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
}
