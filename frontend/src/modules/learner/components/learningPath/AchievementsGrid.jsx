import { motion } from "framer-motion";
import { Reveal, SectionHeader } from "./ui";

/** Badge grid — unlocked badges shine, locked ones show progress toward unlock. */
export default function AchievementsGrid({ achievements }) {
  const { all, earned } = achievements;

  return (
    <section className="lp-section" aria-label="Achievements">
      <Reveal>
        <SectionHeader
          icon="emoji_events"
          title="Achievements"
          subtitle={`${earned.length} of ${all.length} unlocked — keep the streak alive`}
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-achievements">
          {all.map((a, i) => (
            <motion.div
              key={a.label}
              className={`lp-achievement${a.unlocked ? " is-unlocked" : ""}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              whileHover={a.unlocked ? { scale: 1.05, rotate: i % 2 === 0 ? -1 : 1 } : undefined}
            >
              <div className="lp-achievement__icon">
                <span>{a.icon}</span>
                {a.unlocked && <span className="lp-achievement__sparkle">✦</span>}
              </div>
              <strong>{a.label}</strong>
              <p>{a.hint}</p>
              <div className="lp-achievement__bar">
                <motion.div
                  className="lp-achievement__fill"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${a.progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
              <span className="lp-achievement__status">
                {a.unlocked ? "Unlocked 🎉" : `${a.progress}%`}
              </span>
            </motion.div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
