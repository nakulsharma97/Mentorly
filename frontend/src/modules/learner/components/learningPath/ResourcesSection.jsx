import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { RESOURCE_CATALOG } from "./data";
import { Reveal, SectionHeader } from "./ui";

/** Curated resource library aligned to the learner's career path. */
export default function ResourcesSection() {
  return (
    <section className="lp-section" aria-label="Resources">
      <Reveal>
        <SectionHeader
          icon="library_books"
          title="Resource Library"
          subtitle="Hand-picked books, videos, docs and practice problems"
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-resources">
          {RESOURCE_CATALOG.map((r, i) => (
            <motion.div
              key={r.title}
              className="lp-resource"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
            >
              <span className="lp-resource__icon" style={{ background: `${r.color}1f`, color: r.color }}>
                <Icon name={r.icon} />
              </span>
              <h3>{r.title}</h3>
              <ul>
                {r.items.map((item) => (
                  <li key={item}>
                    <Icon name="chevron_right" /> {item}
                  </li>
                ))}
              </ul>
              <Link to="/learner/resources" className="lp-resource__action">
                {r.action} <Icon name="arrow_forward" />
              </Link>
            </motion.div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
