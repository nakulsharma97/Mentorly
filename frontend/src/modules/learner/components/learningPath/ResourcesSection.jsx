import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { RESOURCE_CATALOG } from "./data";
import { Reveal, SectionHeader } from "./ui";

/**
 * Curated resource library aligned to the learner's career path.
 * Every item is a real external resource (official docs, YouTube courses,
 * public cheat sheets) and opens in a new tab — never fake placeholder text.
 */
export default function ResourcesSection() {
  const catalog = RESOURCE_CATALOG.filter(
    (resource) => Array.isArray(resource.items) && resource.items.length > 0,
  );

  if (catalog.length === 0) {
    return null;
  }

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
          {catalog.map((r, i) => (
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
              {r.blurb ? <p className="lp-resource__blurb">{r.blurb}</p> : null}
              <ul>
                {r.items.map((item) => (
                  <li key={item.title}>
                    <Icon name="chevron_right" />
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.url}
                      aria-label={`${item.title} — opens in a new tab`}
                    >
                      <span className="lp-resource__link-text">{item.title}</span>
                      <Icon name="open_in_new" />
                    </a>
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
