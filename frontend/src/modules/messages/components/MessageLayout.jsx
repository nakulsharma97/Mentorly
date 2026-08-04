import { motion } from "framer-motion";

/**
 * Messaging workspace shell — a fixed three-column grid
 * (conversation list · chat · learner details) that fills the hosting
 * workspace content area exactly. No internal topbar: the surrounding
 * workspace chrome already provides branding and navigation, so this page
 * never scrolls — only each column scrolls internally.
 */
export default function MessageLayout({ sidebar, chat, details, hideDetails }) {
  return (
    <section className="ms-shell" aria-label="Messaging workspace">
      <motion.div
        className="ms-app__container"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="ms-app__sidebar">{sidebar}</div>
        <div className="ms-app__chat">{chat}</div>
        {!hideDetails ? <div className="ms-app__details">{details}</div> : null}
      </motion.div>
    </section>
  );
}
