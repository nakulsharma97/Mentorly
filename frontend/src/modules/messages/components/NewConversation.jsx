import { useEffect, useMemo, useRef, useState } from "react";
import client from "../../../api/client";
import { motion, AnimatePresence } from "framer-motion";
import LearnerCard from "./UserCard";
import { unwrap } from "../utils";

const SEARCH_PLACEHOLDER =
  "Search learners by name, username or email...";

const FIRST_MESSAGE =
  "Hi! I would like to connect and discuss our learning goals.";

/**
 * "New conversation" screen — replaces ONLY the center panel. Searches real
 * users on the backend with a 300ms debounce, shows suggested learners when
 * idle, and starts (or reuses) a conversation without ever creating
 * duplicates. Each user card carries its own request state machine:
 *   idle → sending → sent | already-sent | open
 */
export default function NewConversation({ profile, onClose, onStart, notify }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workingUserId, setWorkingUserId] = useState(null);
  // Per-user request outcome: { [userId]: "sent" | "already-sent" }
  const [requestStates, setRequestStates] = useState({});
  // Users we discovered already have a direct conversation — show "Open Chat".
  const [directUserIds, setDirectUserIds] = useState(() => new Set());
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
          experienceText:
            u.yearsOfExperience != null &&
            Number.isFinite(Number(u.yearsOfExperience))
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

  // Search results are shown directly — no category filters.

  const markRequestState = (userId, state) =>
    setRequestStates((prev) => ({ ...prev, [userId]: state }));

  /** Opens an existing (or newly created) direct conversation and selects it. */
  const openDirect = async (user) => {
    const res = await client.post(`/api/v1/chat/direct/${user.id}`);
    const data = unwrap(res.data);
    if (!data?.conversationId) {
      throw new Error("Unable to start conversation. No conversation ID returned.");
    }
    notify?.({
      type: "success",
      title: "Conversation ready",
      message: `You can now message ${data.participantName || user.name}.`,
    });
    // Pass the FULL conversation payload so the chat opens instantly.
    onStart?.({ ...data, ...user });
  };

  /** Creates a pending conversation request (backend dedupes). */
  const sendRequest = async (user) => {
    await client.post("/api/message-requests", {
      receiver: user.id,
      firstMessage: FIRST_MESSAGE,
    });
    markRequestState(user.id, "sent");
    notify?.({
      type: "success",
      title: "Request sent",
      message: "Conversation request sent successfully.",
    });
  };

  const start = async (user) => {
    if (!user?.id) return;
    setWorkingUserId(user.id);
    setError(null);
    try {
      if (user.canStartDirect || directUserIds.has(user.id)) {
        await openDirect(user);
        return;
      }
      await sendRequest(user);
    } catch (err) {
      const body = err?.response?.data;
      const message = String(
        body?.message || body?.data?.error || err?.message || "",
      );
      const lower = message.toLowerCase();

      // A conversation already exists — flip the card and open it directly.
      if (lower.includes("conversation already exists")) {
        setDirectUserIds((prev) => new Set(prev).add(user.id));
        try {
          await openDirect(user);
        } catch {
          notify?.({
            type: "error",
            title: "Conversation unavailable",
            message: "Could not open the existing conversation. Please try again.",
          });
        }
        return;
      }

      // A pending request already exists — never duplicate.
      if (lower.includes("pending request") || lower.includes("already have")) {
        markRequestState(user.id, "already-sent");
        notify?.({
          type: "info",
          title: "Request already sent",
          message: `You already sent a request to ${user.name}.`,
        });
        return;
      }

      setError(
        body?.message || body?.data?.error || err?.message || "Unable to send request.",
      );
      notify?.({
        type: "error",
        title: "Request failed",
        message: body?.message || err?.message || "Please try again.",
      });
    } finally {
      setWorkingUserId(null);
    }
  };

  /** Resolve the button state for a user card. */
  const stateFor = (user) => {
    if (workingUserId === user.id) return "sending";
    if (requestStates[user.id] === "sent") return "sent";
    if (requestStates[user.id] === "already-sent") return "already-sent";
    if (user.canStartDirect || directUserIds.has(user.id)) return "open";
    return "idle";
  };

  const suggestedLearners = useMemo(
    () => results.filter((u) => u.role === "LEARNER").slice(0, 6),
    [results],
  );

  const suggestedMentors = useMemo(
    () => results.filter((u) => u.role === "MENTOR").slice(0, 6),
    [results],
  );

  const topRated = useMemo(
    () =>
      [...results]
        .filter((u) => typeof u.rating === "number")
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6),
    [results],
  );

  const searching = Boolean(query.trim());
  const showSuggested = !searching;
  const showEmpty = searching && !loading && results.length === 0;

  const renderCard = (user) => (
    <LearnerCard
      key={`user-${user.id}`}
      user={user}
      onAction={start}
      state={stateFor(user)}
      searchTerm={searching ? query.trim() : ""}
    />
  );

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

      <div className="ms-new__results">
        {error && !searching ? (
          <div className="ms-new__error" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

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
                    suggestedLearners.map(renderCard)
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
                    {suggestedMentors.map(renderCard)}
                  </div>
                </section>
              ) : null}

              {topRated.length ? (
                <section className="ms-suggested">
                  <h3>Top Rated</h3>
                  <div className="ms-suggested__row">
                    {topRated.map(renderCard)}
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
            >
              {error ? (
                <div className="ms-new__error" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              ) : null}
              <div className="ms-new__empty">
                <div className="ms-new__empty-icon" aria-hidden="true">
                  <span className="material-symbols-outlined">
                    person_search
                  </span>
                </div>
                <h3>No learners found</h3>
                <p>Try another search keyword.</p>
                <button
                  type="button"
                  className="ms-btn ms-btn--outline ms-btn--sm"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {error ? (
                <div className="ms-new__error" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              ) : null}
              <div className="ms-new__results-head">
                <h3>
                  {results.length} match{results.length === 1 ? "" : "es"} for{" "}
                  “{query.trim()}”
                </h3>
              </div>
              <div className="ms-new__results-list">
                {results.map(renderCard)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
