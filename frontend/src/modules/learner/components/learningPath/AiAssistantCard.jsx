import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { Reveal } from "./ui";

/** AI-powered study coach — smart recommendations built from live data. */
export default function AiAssistantCard({ insights }) {
  if (!insights) return null;

  return (
    <section className="lp-section" aria-label="AI learning assistant">
      <Reveal>
        <div className="lp-ai">
          <div className="lp-ai__glow" />
          <div className="lp-ai__head">
            <span className="lp-ai__avatar">
              <Icon name="auto_awesome" />
              <span className="lp-ai__pulse" />
            </span>
            <div>
              <span className="lp-ai__eyebrow">AI Learning Assistant</span>
              <h2 className="lp-ai__title">Your personal study coach</h2>
            </div>
            <span className="lp-ai__badge"><Icon name="bolt" /> Insights refreshed</span>
          </div>

          <div className="lp-ai__insight">
            <Icon name="psychology" />
            <p>{insights.focus}</p>
          </div>

          <div className="lp-ai__grid">
            <div className="lp-ai__card">
              <h3><Icon name="priority_high" /> Weak Areas</h3>
              <ul>
                {insights.weakAreas.map((w) => (
                  <li key={w}><Icon name="error" /> {w}</li>
                ))}
              </ul>
              <Link to="/learner/skills" className="lp-ai__link">
                Practice weak skills <Icon name="arrow_forward" />
              </Link>
            </div>

            <div className="lp-ai__card">
              <h3><Icon name="fact_check" /> Suggested Practice</h3>
              <ul>
                {insights.suggestedPractice.map((s) => (
                  <li key={s}><Icon name="task_alt" /> {s}</li>
                ))}
              </ul>
              <Link to="/learner/path" className="lp-ai__link">
                Open roadmap <Icon name="arrow_forward" />
              </Link>
            </div>

            <div className="lp-ai__card">
              <h3><Icon name="hourglass_top" /> Study Time</h3>
              <ul>
                <li><Icon name="schedule" /> ~{insights.estDailyHours}h/day recommended</li>
                <li><Icon name="group_add" /> {insights.skillCount} skills in your plan</li>
                <li><Icon name="workspace_premium" /> {insights.certifications} certificate{insights.certifications === 1 ? "" : "s"} earned</li>
              </ul>
            </div>
          </div>

          <motion.div
            className="lp-ai__motivation"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <span>✨</span>
            <p>{insights.motivation}</p>
            {insights.sessionHint && <small>{insights.sessionHint}</small>}
          </motion.div>
        </div>
      </Reveal>
    </section>
  );
}
