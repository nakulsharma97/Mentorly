import { motion } from "framer-motion";
import Icon from "../../../common/dashboard/Icon";
import { Reveal, SectionHeader } from "./ui";

/**
 * Vertical skill dependency graph — completed (green), current (blue),
 * locked (gray) — with animated connectors.
 */
export default function SkillTree({ milestones }) {
  return (
    <section className="lp-section" aria-label="Skill tree">
      <Reveal>
        <SectionHeader
          icon="account_tree"
          title="Skill Tree"
          subtitle="Your skills build on each other — follow the dependency chain"
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-tree">
          <div className="lp-tree__line" aria-hidden="true" />
          <div className="lp-tree__nodes">
            {milestones.map((m, i) => (
              <motion.div
                key={m.id}
                className={`lp-tree__node is-${m.status}`}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <span className="lp-tree__connector" aria-hidden="true">
                  <motion.span
                    className="lp-tree__connector-fill"
                    initial={{ height: 0 }}
                    whileInView={{ height: "100%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 + 0.1 }}
                  />
                </span>
                <span className="lp-tree__node-icon">
                  {m.status === "completed" ? (
                    <Icon name="check" />
                  ) : m.status === "current" ? (
                    <Icon name="bolt" />
                  ) : (
                    <Icon name="lock" />
                  )}
                </span>
                <span className="lp-tree__node-label">{m.title}</span>
                <span className="lp-tree__node-status">
                  {m.status === "completed" ? "Mastered" : m.status === "current" ? "Learning" : "Locked"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
