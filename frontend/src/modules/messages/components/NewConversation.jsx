import { useEffect, useMemo, useRef, useState } from "react";
import client from "../../../api/client";
import { motion, AnimatePresence } from "framer-motion";
import LearnerCard from "./UserCard";
import { normalizeSkills, unwrap } from "../utils";

const CATEGORIES = [
  "All",
  "Programming",
  "Backend",
  "Frontend",
  "AI",
  "Cloud",
  "Data Science",
  "Cyber Security",
  "UI/UX",
  "DevOps",
];

const SEARCH_PLACEHOLDER =
  "Search by name, username, email, skill or technology…";

/**
 * "New conversation" screen — replaces ONLY the center panel (the sidebar and
 * details columns stay put). Searches real users on the backend with a 300ms
 * debounce, shows suggested learners when idle, and starts (or reuses) a
 * conversation without ever creating duplicates.
 */
export default function NewConversation({ profile, onClose, onStart, notify }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("All");
  const [workingUserId, setWorkingUserId] = useState(null);
  const searchRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await client.get("/api/v1/search/users", {
          params: { q, size: 16 },
        });
        if (seq !== seqRef.current) return;
        const data = unwrap(res.data) || [];
        const rows = data.map((u) => ({
          id: u.userId ?? u.id,
          name: u.fullName || u.name || "User",
          username: u.username || "",
          email: u.email || "",
          role: u.role || "LEARNER",
          skills: u.skills || "",
          headline: u.headline || "",
          company: u.company || "",
          rating: typeof u.rating === "number" ? u.rating : null,
          availability: u.availability || "",
          online: Boolean(u.online),
          experience: u.yearsOfExperience,
          experienceText: Number.isFinite(Number(u.yearsOfExperience))
            ? `${u.yearsOfExperience}+ yrs`
            : "",
          mentorVerified: Boolean(u.mentorVerified),
          canStartDirect: Boolean(u.canStartDirect),
          profileImageUrl: u.profileImageUrl || "",
        }));
        setResults(rows.filter((r) => String(r.id) !== String(profile?.id)));
      } catch (err) {
        if (seq !== seqRef.current) return;
        setError(
          err?.response?.data?.message || err?.message || "Search failed",
        );
        setResults([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, profile?.id]);

  const visible = useMemo(() => {
    if (category === "All") return results;
    const topic = category.toLowerCase().replace("/", " ");
    return results.filter((u) =>
      [u.name, u.username, u.email, normalizeSkills(u.skills).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(topic),
    );
  }, [category, results]);

  const start = async (user) => {
    if (!user?.id) return;
    setWorkingUserId(user.id);
    try {
      if (user.canStartDirect) {
        const res = await client.post(`/api/v1/chat/direct/${user.id}`);
        const data = unwrap(res.data);
        if (data?.conversationId) {
          notify?.({
            type: "success",
            title: "Conversation ready",
            message: `You can now message ${data.participantName || user.name}.`,
          });
          // Pass the FULL conversation payload so the chat opens instantly.
          onStart?.({ ...data, ...user });
          return;
        }
        setError("Unable to start conversation. No conversation ID returned.");
      } else {
        await client.post("/api/message-requests", {
          receiver: user.id,
          firstMessage:
            "Hi! I would like to connect and discuss our learning goals.",
        });
        notify?.({
          type: "success",
          title: "Message request sent",
          message: `Your request was sent to ${user.name}.`,
        });
      }
    } catch (err) {
      const body = err?.response?.data;
      setError(
        body?.message ||
          body?.data?.error ||
          err?.message ||
          "Unable to start conversation.",
      );
    } finally {
      setWorkingUserId(null);
    }
  };

  const suggestedLearners = useMemo(
    () => visible.filter((u) => u.role === "LEARNER").slice(0, 6),
    [visible],
  );

  const suggestedMentors = useMemo(
    () => visible.filter((u) => u.role === "MENTOR").slice(0, 6),
    [visible],
  );

  const topRated = useMemo(
    () =>
      [...visible]
        .filter((u) => typeof u.rating === "number")
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6),
    [visible],
  );

  const searching = Boolean(query.trim());
  const showSuggested = !searching;
  const showEmpty =
    searching &&
    !loading &&
    !error &&
    visible.length === 0;

  return (
    <motion.section
      className="ms-new"
      aria-label="New conversation"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <header className="ms-new__head">
        <button
          type="button"
          className="ms-icon-btn"
          onClick={onClose}
          aria-label="Back to conversations"
          title="Back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="ms-new__title-wrap">
          <h2>Start New Conversation</h2>
          <p>Connect with a learner to mentor, or a mentor to learn from.</p>
        </div>
        <button
          type="button"
          className="ms-icon-btn"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <div className="ms-new__search">
        <span className="material-symbols-outlined">search</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="Search learners"
        />
        {loading && searching ? (
          <span className="ms-new__search-spinner" aria-hidden="true" />
        ) : null}
        {query ? (
          <button
            type="button"
            className="ms-search__clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </div>

      <div className="ms-new__cats" aria-label="Categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`ms-new__cat${category === cat ? " is-active" : ""}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="ms-new__results">
        <AnimatePresence mode="wait">
          {showSuggested ? (
            <motion.div
              key="suggested"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <section className="ms-suggested">
                <h3>Suggested Learners</h3>
                <div className="ms-suggested__row">
                  {suggestedLearners.length ? (
                    suggestedLearners.map((m) => (
                      <LearnerCard
                        key={`learner-${m.id}`}
                        user={m}
                        onAction={start}
                        busy={workingUserId === m.id}
                        searchTerm=""
                      />
                    ))
                  ) : (
                    <p className="ms-new__hint">
                      Type above to search for learners across SkillSwap.
                    </p>
                  )}
                </div>
              </section>

              {suggestedMentors.length ? (
                <section className="ms-suggested">
                  <h3>Suggested Mentors</h3>
                  <div className="ms-suggested__row">
                    {suggestedMentors.map((m) => (
                      <LearnerCard
                        key={`mentor-${m.id}`}
                        user={m}
                        onAction={start}
                        busy={workingUserId === m.id}
                        searchTerm=""
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {topRated.length ? (
                <section className="ms-suggested">
                  <h3>Top Rated</h3>
                  <div className="ms-suggested__row">
                    {topRated.map((m) => (
                      <LearnerCard
                        key={`rated-${m.id}`}
                        user={m}
                        onAction={start}
                        busy={workingUserId === m.id}
                        searchTerm=""
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ms-new__loading"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="ms-skel-user" key={i}>
                  <span className="ms-skel-avatar" />
                  <div className="ms-skel-lines">
                    <span className="ms-skel-line ms-skel-line--lg" />
                    <span className="ms-skel-line" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : showEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="ms-new__empty"
            >
              <div className="ms-new__empty-icon" aria-hidden="true">
                <span className="material-symbols-outlined">person_search</span>
              </div>
              <h3>No learners found</h3>
              <p>
                {error
                  ? error
                  : `Nothing matches "${query.trim()}". Try a name, skill, or technology.`}
              </p>
              <button
                type="button"
                className="ms-btn ms-btn--outline ms-btn--sm"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="ms-new__results-head">
                <h3>
                  {visible.length} match{visible.length === 1 ? "" : "es"} for{" "}
                  “{query.trim()}”
                </h3>
              </div>
              <div className="ms-new__results-list">
                {visible.map((u) => (
                  <LearnerCard
                    key={u.id}
                    user={u}
                    onAction={start}
                    busy={workingUserId === u.id}
                    searchTerm={query.trim()}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
