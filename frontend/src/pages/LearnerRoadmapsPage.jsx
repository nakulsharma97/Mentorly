import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./my-learning.css";

const EMPTY = [];

function unwrap(response) {
  return response?.data?.data;
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load data"
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

const STATUS_META = {
  ACTIVE: { label: "Active", className: "ml-status--active" },
  ARCHIVED: { label: "Archived", className: "ml-status--archived" },
  NOT_STARTED: { label: "Not started", className: "ml-status--not-started" },
};

function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, busy }) {
  return (
    <div
      className="ml-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ml-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ml-modal-head">
          <div>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ml-modal-foot">
          <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ml-btn ml-btn--primary" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact career-path picker used by the "New Roadmap" modal. */
function PathPickerModal({ careerPaths, selectedId, onSelect, onCreate, onClose, busy }) {
  return (
    <div
      className="ml-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ml-modal" role="dialog" aria-modal="true" aria-label="Start a new learning path">
        <div className="ml-modal-head">
          <div>
            <h2>Start a New Learning Path</h2>
            <p>Choose the career path you want to follow. You can change it anytime.</p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ml-modal-body">
          {careerPaths.length === 0 ? (
            <div className="ml-empty" style={{ padding: 28 }}>
              <span className="ml-empty-icon">
                <Icon name="search_off" />
              </span>
              <h3>No learning paths available yet</h3>
              <p>Career paths will appear here as soon as they are published.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {careerPaths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  className={`ml-option ${selectedId === path.id ? "is-selected" : ""}`}
                  onClick={() => onSelect(path.id)}
                >
                  <span className="ml-goal-icon" style={{ width: 38, height: 38 }}>
                    <Icon name={path.icon || "school"} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: "0.9rem" }}>
                      {path.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        color: "var(--ml-muted)",
                        fontSize: "0.76rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {path.durationWeeks} weeks · {path.difficulty}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-modal-foot">
          <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ml-btn ml-btn--primary"
            disabled={!selectedId || busy || careerPaths.length === 0}
            onClick={() => onCreate(selectedId)}
          >
            <Icon name="map" /> Create Roadmap
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LearnerRoadmapsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, data: EMPTY });
  const [careerPaths, setCareerPaths] = useState(EMPTY);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { kind, roadmap }
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [roadmapsRes, pathsRes] = await Promise.all([
        client.get("/api/v1/learning/roadmaps"),
        client.get("/api/v1/career-paths"),
      ]);
      setState({ loading: false, error: null, data: unwrap(roadmapsRes) || EMPTY });
      setCareerPaths(unwrap(pathsRes) || EMPTY);
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error), data: EMPTY });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const handleCreateRoadmap = useCallback(
    async (careerPathId) => {
      if (!careerPathId || busy) return;
      setBusy(true);
      try {
        const res = await client.post("/api/v1/learning/roadmaps", { careerPathId });
        const created = unwrap(res);
        setPickerOpen(false);
        setSelectedPathId(null);
        showToast("success", `Learning path started — welcome to ${created.careerPath?.name}.`);
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh, showToast],
  );

  const runStatusAction = useCallback(
    async (roadmap, action, successMessage) => {
      setBusy(true);
      try {
        await client.patch(`/api/v1/learning/roadmaps/${roadmap.id}/status`, { action });
        showToast("success", successMessage);
        setPendingAction(null);
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await client.delete(`/api/v1/learning/roadmaps/${pendingAction.roadmap.id}`);
      showToast("success", "Roadmap deleted");
      setPendingAction(null);
      refresh();
    } catch (error) {
      showToast("error", getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [pendingAction, refresh, showToast]);

  const confirmModal =
    pendingAction?.kind === "archive"
      ? {
          title: "Archive Roadmap",
          body: `Archiving "${pendingAction.roadmap.careerPath?.name}" keeps all of your progress saved. You can switch back anytime.`,
          confirmLabel: "Archive",
        }
      : pendingAction?.kind === "delete"
        ? {
            title: "Delete Roadmap",
            body: `Delete "${pendingAction.roadmap.careerPath?.name}"? This roadmap has never been started, so it can be removed permanently.`,
            confirmLabel: "Delete",
          }
        : null;

  const hasRoadmaps = state.data.length > 0;

  return (
    <div className="ml-shell">
      <header className="ml-page-head">
        <div>
          <h1>My Roadmaps</h1>
          <p>Every learning path you have started or explored — switch or archive anytime.</p>
        </div>
        <button
          type="button"
          className="ml-btn ml-btn--primary"
          disabled={careerPaths.length === 0}
          onClick={() => {
            setSelectedPathId(null);
            setPickerOpen(true);
          }}
        >
          <Icon name="add" /> New Roadmap
        </button>
      </header>

      {state.loading ? (
        <div className="ml-skeleton" aria-label="Loading roadmaps...">
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
        </div>
      ) : state.error ? (
        <div className="ml-empty">
          <span className="ml-empty-icon">
            <Icon name="error" />
          </span>
          <h3>Roadmaps could not be loaded</h3>
          <p>{state.error}</p>
          <button type="button" className="ml-btn ml-btn--primary" onClick={refresh}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      ) : !hasRoadmaps ? (
        /* First-time experience — the learner chooses their own goal. */
        <section className="ml-section" aria-label="Choose your learning goal">
          <div className="ml-section-head">
            <h2 className="ml-section-title">
              <Icon name="flag" /> Choose Your Learning Goal
            </h2>
            <p className="ml-section-hint">
              Select the career path you want to follow. You can change or add more learning paths
              anytime.
            </p>
          </div>
          <div className="ml-goal-grid">
            {careerPaths.map((path) => (
              <article className="ml-goal-card" key={path.id}>
                <span className="ml-goal-icon" aria-hidden="true">
                  <Icon name={path.icon || "school"} />
                </span>
                <h2 className="ml-goal-name">{path.name}</h2>
                <p className="ml-goal-desc">{path.description}</p>
                <div className="ml-goal-meta">
                  <span className="ml-chip">
                    <Icon name="schedule" /> {path.durationWeeks} Weeks
                  </span>
                  <span className="ml-chip">
                    <Icon name="signal_cellular_alt" /> {path.difficulty}
                  </span>
                </div>
                {path.skills?.length > 0 && (
                  <div className="ml-goal-skills">
                    {path.skills.slice(0, 6).map((skill) => (
                      <span className="ml-skill-chip" key={skill}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="ml-btn ml-btn--primary"
                  disabled={busy}
                  onClick={() => handleCreateRoadmap(path.id)}
                >
                  <Icon name="map" /> Create Roadmap
                </button>
              </article>
            ))}
          </div>
          {careerPaths.length === 0 && (
            <div className="ml-empty">
              <span className="ml-empty-icon">
                <Icon name="search_off" />
              </span>
              <h3>No learning paths available yet</h3>
              <p>Career paths will appear here as soon as they are published.</p>
            </div>
          )}
        </section>
      ) : (
        <div className="ml-roadmap-grid">
          {state.data.map((roadmap) => {
            const status = STATUS_META[roadmap.status] || STATUS_META.NOT_STARTED;
            const isActive = roadmap.status === "ACTIVE";
            return (
              <article
                className={`ml-roadmap-card ${isActive ? "is-active" : ""}`}
                key={roadmap.id}
              >
                <div className="ml-roadmap-top">
                  <div className="ml-roadmap-heading">
                    <span className="ml-goal-icon">
                      <Icon name={roadmap.careerPath?.icon || "school"} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h2 className="ml-roadmap-name">{roadmap.careerPath?.name}</h2>
                      <p className="ml-roadmap-desc">{roadmap.careerPath?.description}</p>
                    </div>
                  </div>
                  <span className={`ml-status ${status.className}`}>{status.label}</span>
                </div>

                <div className="ml-roadmap-meta">
                  <span>
                    <Icon name="calendar_today" /> Created {formatDate(roadmap.createdAt)}
                  </span>
                  <span>
                    <Icon name="task_alt" /> {roadmap.completedLessons}/{roadmap.totalLessons} lessons
                  </span>
                </div>

                <div className="ml-progress-bar" aria-hidden="true">
                  <span style={{ width: `${roadmap.progressPercent || 0}%` }} />
                </div>
                <small style={{ color: "var(--ml-muted)", fontWeight: 700 }}>
                  {roadmap.progressPercent || 0}% complete
                </small>

                <div className="ml-roadmap-actions">
                  <button
                    type="button"
                    className="ml-btn ml-btn--primary ml-btn--sm"
                    onClick={() => navigate("/learner/learning")}
                  >
                    <Icon name="play_arrow" /> Continue
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className="ml-btn ml-btn--outline ml-btn--sm"
                      disabled={busy}
                      onClick={() => runStatusAction(roadmap, "switch", `Now learning ${roadmap.careerPath?.name}`)}
                    >
                      <Icon name="swap_horiz" /> Switch
                    </button>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      className="ml-btn ml-btn--ghost ml-btn--sm"
                      disabled={busy}
                      onClick={() => setPendingAction({ kind: "archive", roadmap })}
                    >
                      <Icon name="archive" /> Archive
                    </button>
                  )}
                  {roadmap.canDelete && (
                    <button
                      type="button"
                      className="ml-btn ml-btn--danger ml-btn--sm"
                      disabled={busy}
                      onClick={() => setPendingAction({ kind: "delete", roadmap })}
                    >
                      <Icon name="delete" /> Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <PathPickerModal
          careerPaths={careerPaths}
          selectedId={selectedPathId}
          onSelect={setSelectedPathId}
          onCreate={handleCreateRoadmap}
          onClose={() => setPickerOpen(false)}
          busy={busy}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          body={confirmModal.body}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={pendingAction.kind === "archive"
            ? () => runStatusAction(pendingAction.roadmap, "archive", "Roadmap archived — progress saved")
            : handleDelete}
          onClose={() => setPendingAction(null)}
          busy={busy}
        />
      )}

      {toast && (
        <div className={`ml-toast ml-toast--${toast.type}`} role="status">
          <Icon name={toast.type === "success" ? "check_circle" : "error"} />
          {toast.text}
        </div>
      )}
    </div>
  );
}
