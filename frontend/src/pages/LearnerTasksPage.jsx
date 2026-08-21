import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./my-learning.css";
import "./tasks.css";

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

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(value) {
  const date = parseDate(value);
  return date ? dayKey(date) === dayKey(new Date()) : false;
}

function isOverdue(value) {
  const date = parseDate(value);
  return date ? date < startOfToday() : false;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  if (isToday(value)) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(date) === dayKey(tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatLongDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Title-case a task title for display ("Prepare questions for…" →
 * "Prepare Questions for…"). All-caps tokens (REST, API, AWS) are preserved
 * so acronyms never get mangled. Display only — the stored value is untouched.
 */
function toTitleCase(value) {
  const text = String(value || "").trim();
  if (!text) return text;
  return text
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z0-9][A-Z0-9._-]*$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const TYPE_META = {
  SESSION_FOLLOWUP: { label: "Session Follow-up", icon: "event_repeat", tone: "info" },
  NOTE_REVIEW: { label: "Notes", icon: "sticky_note_2", tone: "warning" },
  PRACTICE: { label: "Practice", icon: "fitness_center", tone: "primary" },
  ASSIGNMENT: { label: "Assignment", icon: "assignment", tone: "warning" },
  PROJECT: { label: "Project", icon: "code_blocks", tone: "primary" },
  READING: { label: "Reading", icon: "menu_book", tone: "info" },
  PERSONAL: { label: "Personal", icon: "person", tone: "muted" },
  OTHER: { label: "Other", icon: "more_horiz", tone: "muted" },
};

const PRIORITY_META = {
  URGENT: { label: "Urgent", tone: "urgent" },
  HIGH: { label: "High", tone: "high" },
  MEDIUM: { label: "Medium", tone: "medium" },
  LOW: { label: "Low", tone: "low" },
};

const STATUS_META = {
  TODO: { label: "To Do", tone: "muted" },
  IN_PROGRESS: { label: "In Progress", tone: "in_progress" },
  COMPLETED: { label: "Completed", tone: "completed" },
  OVERDUE: { label: "Overdue", tone: "overdue" },
  CANCELLED: { label: "Cancelled", tone: "cancelled" },
};

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "TODAY", label: "Today" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SESSION_TASKS", label: "Session Tasks" },
];

function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.OTHER;
}

function priorityMeta(priority) {
  return PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
}

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.TODO;
}

/* ════════════════════════════════════════════════════════════════════════
   Task card
   ════════════════════════════════════════════════════════════════════════ */

function TaskCard({ task, busy, onToggle, onOpen }) {
  const done = task.status === "COMPLETED";
  // Only render a type badge when the backend actually returned a type — a
  // missing type is simply omitted, never shown as "Other" or a raw value.
  const type = task.type ? TYPE_META[task.type] || TYPE_META.OTHER : null;
  const priority = priorityMeta(task.priority);
  const status = statusMeta(task.status);
  const overdue = task.status === "OVERDUE";
  const title = toTitleCase(task.title);

  return (
    <div className={`dt-task ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}>
      <button
        type="button"
        className={`dt-task-check ${done ? "is-checked" : ""}`}
        aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
        disabled={busy}
        onClick={() => onToggle(task, !done)}
      >
        {done && <Icon name="check" />}
      </button>
      <div className="dt-task-main" role="button" tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(e) => e.key === "Enter" && onOpen(task)}>
        <div className="dt-task-title">
          <span className={`dt-task-title-text ${done ? "is-struck" : ""}`}>{title}</span>
        </div>
        <div className="dt-task-meta">
          {type && (
            <span className={`dt-type-badge dt-type-badge--${type.tone}`}>
              <Icon name={type.icon} /> {type.label}
            </span>
          )}
          <span className={`dt-priority dt-priority--${priority.tone}`}>{priority.label}</span>
        </div>
        <div className="dt-task-context">
          {task.mentorName && (
            <span className="dt-meta-item">
              <Icon name="person" /> Mentor: {task.mentorName}
            </span>
          )}
          {task.sessionTitle && (
            <span className="dt-meta-item">
              <Icon name="co_present" /> Session: {task.sessionTitle}
            </span>
          )}
          {task.dueDate && (
            <span className={`dt-meta-item ${overdue ? "dt-meta-item--overdue" : ""}`}>
              <Icon name="event" /> Due: {formatShortDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
      <div className="dt-task-side">
        <span className={`dt-status dt-status--${status.tone}`}>{status.label}</span>
        <button
          type="button"
          className="ml-btn ml-btn--primary ml-btn--sm"
          disabled={busy || done}
          onClick={() => onToggle(task, true)}
        >
          <Icon name="check" /> {done ? "Done" : "Mark Complete"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sections
   ════════════════════════════════════════════════════════════════════════ */

function TaskSection({ title, icon, tasks, emptyText, busy, onToggle, onOpen, tone }) {
  return (
    <section className="ml-section" aria-label={title}>
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name={icon} /> {title}
          <span className={`ml-chip ml-chip--${tone || "muted"}`}>{tasks.length}</span>
        </h2>
      </div>
      {tasks.length === 0 ? (
        <div className="dt-empty-row">
          <Icon name="task_alt" />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="dt-task-list">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} busy={busy} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Calendar view
   ════════════════════════════════════════════════════════════════════════ */

function TasksCalendar({ tasks, onSelectDay }) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const date = parseDate(task.dueDate);
      if (!date) return;
      const key = dayKey(date);
      (map[key] = map[key] || []).push(task);
    });
    return map;
  }, [tasks]);

  const monthLabel = viewDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const changeMonth = (delta) =>
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${viewDate.getFullYear()}-${viewDate.getMonth()}-${day}`;
    cells.push({ day, date: new Date(viewDate.getFullYear(), viewDate.getMonth(), day), tasks: tasksByDay[key] || [] });
  }

  return (
    <section className="ml-section" aria-label="Task calendar">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="calendar_month" /> Task Calendar
        </h2>
        <div className="ml-cal-nav">
          <button type="button" className="ml-icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}>
            <Icon name="chevron_left" />
          </button>
          <span className="ml-cal-month-label">{monthLabel}</span>
          <button type="button" className="ml-icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>
      <div className="ml-cal-grid" role="grid" aria-label="Monthly task calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div className="ml-cal-weekday" key={weekday}>
            {weekday}
          </div>
        ))}
        {cells.map((cell, index) =>
          cell === null ? (
            <div className="ml-cal-cell ml-cal-cell--empty" key={`blank-${index}`} />
          ) : (
            <div
              className={`ml-cal-cell dt-cal-cell ${dayKey(cell.date) === dayKey(new Date()) ? "is-today" : ""}`}
              key={cell.day}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(cell.date)}
              onKeyDown={(e) => e.key === "Enter" && onSelectDay(cell.date)}
            >
              <span className="ml-cal-daynum">{cell.day}</span>
              {cell.tasks.slice(0, 3).map((task) => (
                <span className={`dt-cal-chip ${task.status === "COMPLETED" ? "is-done" : task.status === "OVERDUE" ? "is-overdue" : ""}`} key={task.id}>
                  {toTitleCase(task.title)}
                </span>
              ))}
              {cell.tasks.length > 3 && <span className="dt-cal-more">+{cell.tasks.length - 3} more</span>}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Add / Edit task modal
   ════════════════════════════════════════════════════════════════════════ */

const INITIAL_FORM = {
  title: "",
  description: "",
  type: "PERSONAL",
  priority: "MEDIUM",
  dueDate: "",
  relatedSessionId: "",
  relatedMentorId: "",
  reminderAt: "",
};

function TaskFormModal({ editing, busy, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!editing) return INITIAL_FORM;
    return {
      title: editing.title || "",
      description: editing.description || "",
      type: editing.type || "PERSONAL",
      priority: editing.priority || "MEDIUM",
      dueDate: editing.dueDate ? editing.dueDate.slice(0, 16) : "",
      relatedSessionId: editing.relatedSessionId || "",
      relatedMentorId: editing.relatedMentorId || "",
      reminderAt: editing.reminderAt ? editing.reminderAt.slice(0, 16) : "",
    };
  });

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || busy) return;
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      relatedSessionId: form.relatedSessionId ? Number(form.relatedSessionId) : null,
      relatedMentorId: form.relatedMentorId ? Number(form.relatedMentorId) : null,
      reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
    });
  };

  const canSubmit = Boolean(form.title.trim()) && !busy;

  return (
    <div className="ml-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="ml-modal dt-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit task" : "Add task"}>
        <div className="ml-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2>{editing ? "Edit Task" : "Add Task"}</h2>
            <p>{editing ? "Update your task details." : "Create a new learning task."}</p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="ml-modal-body">
            <label className="dt-field">
              <span>Task title *</span>
              <input
                className="ml-input"
                type="text"
                placeholder="e.g. Practice 5 ArrayList problems"
                value={form.title}
                maxLength={200}
                onChange={set("title")}
              />
            </label>
            <label className="dt-field">
              <span>Description</span>
              <textarea
                className="ml-note-textarea"
                rows={3}
                placeholder="Add more detail about this task..."
                value={form.description}
                maxLength={1000}
                onChange={set("description")}
              />
            </label>
            <div className="dt-field-grid">
              <label className="dt-field">
                <span>Task type</span>
                <select className="ml-select" value={form.type} onChange={set("type")}>
                  {Object.entries(TYPE_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dt-field">
                <span>Priority</span>
                <select className="ml-select" value={form.priority} onChange={set("priority")}>
                  {Object.entries(PRIORITY_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dt-field">
                <span>Due date</span>
                <input
                  className="ml-input"
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={set("dueDate")}
                />
              </label>
              <label className="dt-field">
                <span>Reminder</span>
                <input
                  className="ml-input"
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={set("reminderAt")}
                />
              </label>
              <label className="dt-field">
                <span>Related session ID</span>
                <input
                  className="ml-input"
                  type="number"
                  min="1"
                  placeholder="Optional"
                  value={form.relatedSessionId}
                  onChange={set("relatedSessionId")}
                />
              </label>
              <label className="dt-field">
                <span>Related mentor ID</span>
                <input
                  className="ml-input"
                  type="number"
                  min="1"
                  placeholder="Optional"
                  value={form.relatedMentorId}
                  onChange={set("relatedMentorId")}
                />
              </label>
            </div>
          </div>
          <div className="ml-modal-foot">
            <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ml-btn ml-btn--primary" disabled={!canSubmit}>
              <Icon name="check" /> {editing ? "Save Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Task detail modal
   ════════════════════════════════════════════════════════════════════════ */

function TaskDetailModal({ task, busy, onToggle, onEdit, onDelete, onClose }) {
  const type = typeMeta(task.type);
  const priority = priorityMeta(task.priority);
  const status = statusMeta(task.status);

  return (
    <div className="ml-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="ml-modal dt-modal" role="dialog" aria-modal="true" aria-label={task.title}>
        <div className="ml-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2>{toTitleCase(task.title)}</h2>
            <p>Learning task</p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ml-modal-body">
          <div className="dt-detail-chips">
            <span className={`dt-type-badge dt-type-badge--${type.tone}`}>
              <Icon name={type.icon} /> {type.label}
            </span>
            <span className={`dt-priority dt-priority--${priority.tone}`}>{priority.label}</span>
            <span className={`dt-status dt-status--${status.tone}`}>{status.label}</span>
          </div>
          {task.description && <p className="dt-detail-desc">{task.description}</p>}
          <div className="dt-detail-list">
            {task.dueDate && (
              <div>
                <span>Due date</span>
                <strong>{formatDate(task.dueDate)}</strong>
              </div>
            )}
            {task.completedAt && (
              <div>
                <span>Completed</span>
                <strong>{formatDate(task.completedAt)}</strong>
              </div>
            )}
            {task.mentorName && (
              <div>
                <span>Mentor</span>
                <strong>{task.mentorName}</strong>
              </div>
            )}
            {task.sessionTitle && (
              <div>
                <span>Related session</span>
                <strong>{task.sessionTitle}</strong>
              </div>
            )}
            {task.reminderAt && (
              <div>
                <span>Reminder</span>
                <strong>{formatDate(task.reminderAt)}</strong>
              </div>
            )}
            <div>
              <span>Created</span>
              <strong>{formatDate(task.createdAt)}</strong>
            </div>
          </div>
        </div>
        <div className="ml-modal-foot dt-detail-actions">
          <button type="button" className="ml-btn ml-btn--danger ml-btn--ghost" disabled={busy} onClick={() => onDelete(task)}>
            <Icon name="delete" /> Delete
          </button>
          <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="ml-btn ml-btn--outline" disabled={busy} onClick={() => onEdit(task)}>
            <Icon name="edit" /> Edit
          </button>
          {task.status !== "COMPLETED" && (
            <button type="button" className="ml-btn ml-btn--primary" disabled={busy} onClick={() => onToggle(task, true)}>
              <Icon name="check" /> Mark Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════ */

export default function LearnerTasksPage() {
  const [state, setState] = useState({ loading: true, error: null, data: EMPTY });
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
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

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [tasksRes, statsRes] = await Promise.all([
        client.get("/api/v1/learning/tasks"),
        client.get("/api/v1/learning/tasks/stats"),
      ]);
      setState({ loading: false, error: null, data: unwrap(tasksRes) || EMPTY });
      setStats(unwrap(statsRes) || null);
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error), data: EMPTY });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Deterministic follow-ups from real session activity — idempotent on the
  // backend, safe to run on every visit.
  useEffect(() => {
    client
      .post("/api/v1/learning/tasks/generate")
      .then(() => refresh())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived lists ── */

  const tasks = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    return state.data.filter((task) => {
      if (!term) return true;
      return (
        task.title.toLowerCase().includes(term) ||
        (task.description || "").toLowerCase().includes(term) ||
        (task.mentorName || "").toLowerCase().includes(term) ||
        (task.sessionTitle || "").toLowerCase().includes(term)
      );
    });
  }, [state.data, searchInput]);

  const sections = useMemo(() => {
    const overdue = [];
    const today = [];
    const upcoming = [];
    const completed = [];
    tasks.forEach((task) => {
      if (task.status === "COMPLETED") {
        completed.push(task);
        return;
      }
      if (task.status === "OVERDUE" || (task.dueDate && isOverdue(task.dueDate))) {
        overdue.push(task);
        return;
      }
      if (task.dueDate && isToday(task.dueDate)) {
        today.push(task);
        return;
      }
      upcoming.push(task);
    });
    const sortByDue = (list) =>
      [...list].sort((a, b) => {
        const ad = parseDate(a.dueDate)?.getTime() || 0;
        const bd = parseDate(b.dueDate)?.getTime() || 0;
        return ad - bd;
      });
    return {
      overdue: sortByDue(overdue),
      today: sortByDue(today),
      upcoming: sortByDue(upcoming),
      completed: [...completed].sort((a, b) =>
        (parseDate(b.completedAt)?.getTime() || 0) - (parseDate(a.completedAt)?.getTime() || 0),
      ),
    };
  }, [tasks]);

  const filteredSections = useMemo(() => {
    const apply = (list) => {
      if (filter === "PERSONAL") return list.filter((task) => !task.systemGenerated);
      if (filter === "SESSION_TASKS") return list.filter((task) => task.systemGenerated);
      if (filter === "COMPLETED") return list.filter((task) => task.status === "COMPLETED");
      if (filter === "OVERDUE") return list.filter((task) => task.status === "OVERDUE" || (task.dueDate && isOverdue(task.dueDate)));
      if (filter === "TODAY") return list.filter((task) => task.dueDate && isToday(task.dueDate));
      if (filter === "UPCOMING") {
        return list.filter(
          (task) =>
            task.status !== "COMPLETED" &&
            task.status !== "OVERDUE" &&
            !(task.dueDate && isToday(task.dueDate)) &&
            !(task.dueDate && isOverdue(task.dueDate)),
        );
      }
      return list;
    };
    return {
      overdue: apply(sections.overdue),
      today: apply(sections.today),
      upcoming: apply(sections.upcoming),
      completed: apply(sections.completed),
    };
  }, [sections, filter]);

  const showOverdue = filter === "ALL" || filter === "OVERDUE";
  const showToday = filter === "ALL" || filter === "TODAY" || filter === "PERSONAL" || filter === "SESSION_TASKS" || filter === "UPCOMING";
  const showUpcoming = filter === "ALL" || filter === "UPCOMING" || filter === "PERSONAL" || filter === "SESSION_TASKS";
  const showCompleted = filter === "ALL" || filter === "COMPLETED";

  const hasAny =
    sections.overdue.length > 0 || sections.today.length > 0 || sections.upcoming.length > 0 || sections.completed.length > 0;

  /* ── Actions ── */

  const toggleTask = useCallback(
    async (task, completed) => {
      setBusy(true);
      try {
        await client.patch(`/api/v1/learning/tasks/${task.id}/complete`, { completed });
        showToast("success", completed ? "Task completed 🎉" : "Task marked not done");
        if (detailTask && detailTask.id === task.id) {
          setDetailTask((current) => (current ? { ...current, status: completed ? "COMPLETED" : "TODO", completedAt: completed ? new Date().toISOString() : null } : current));
        }
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [detailTask, refresh, showToast],
  );

  const saveTask = useCallback(
    async (payload) => {
      setBusy(true);
      try {
        if (editingTask) {
          await client.put(`/api/v1/learning/tasks/${editingTask.id}`, payload);
          showToast("success", "Task updated");
        } else {
          await client.post("/api/v1/learning/tasks", payload);
          showToast("success", "Task created");
        }
        setFormOpen(false);
        setEditingTask(null);
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [editingTask, refresh, showToast],
  );

  const deleteTask = useCallback(
    async () => {
      setBusy(true);
      try {
        await client.delete(`/api/v1/learning/tasks/${confirmDelete.id}`);
        showToast("success", "Task deleted");
        setConfirmDelete(null);
        setDetailTask(null);
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [confirmDelete, refresh, showToast],
  );

  const openAdd = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setDetailTask(null);
    setEditingTask(task);
    setFormOpen(true);
  };

  const todayTotal = stats?.todayTotal || 0;
  const todayCompleted = stats?.todayCompleted || 0;
  const progress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <header className="dt-hero">
        <div className="dt-hero-decor" aria-hidden="true">
          <span className="dt-hero-orb dt-hero-orb--1" />
          <span className="dt-hero-orb dt-hero-orb--2" />
        </div>
        <div className="dt-hero-main">
          <span className="dt-hero-eyebrow">
            <Icon name="task_alt" /> Daily Tasks
          </span>
          <h1>Stay consistent, complete your learning tasks, and make progress every day.</h1>
          <p className="dt-hero-date">{formatLongDate(new Date())}</p>
          <div className="dt-hero-progress">
            <div className="dt-hero-progress-head">
              <span>
                {todayCompleted} of {todayTotal} tasks completed
              </span>
              <b>{progress}%</b>
            </div>
            <div className="ml-progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="dt-hero-actions">
            <button type="button" className="dt-hero-btn dt-hero-btn--outline" onClick={openAdd}>
              <Icon name="add" /> Add Task
            </button>
            <button
              type="button"
              className={`dt-hero-btn dt-hero-btn--outline ${view === "calendar" ? "is-active" : ""}`}
              onClick={() => setView(view === "calendar" ? "list" : "calendar")}
            >
              <Icon name={view === "calendar" ? "view_list" : "calendar_month"} />
              {view === "calendar" ? "List View" : "Calendar View"}
            </button>
          </div>
        </div>
        <div className="dt-hero-visual" aria-hidden="true">
          <div className="dt-hero-visual-icon">
            <span className="material-symbols-outlined">assignment_turned_in</span>
          </div>
        </div>
      </header>

      {state.loading ? (
        <div className="ml-skeleton" aria-label="Loading tasks...">
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
        </div>
      ) : state.error ? (
        <div className="ml-empty">
          <span className="ml-empty-icon">
            <Icon name="error" />
          </span>
          <h3>Tasks could not be loaded</h3>
          <p>{state.error}</p>
          <button type="button" className="ml-btn ml-btn--primary" onClick={refresh}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      ) : (
        <div className="dt-layout">
          <div className="dt-main">
            <div className="dt-toolbar">
              <div className="ml-search dt-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="Search tasks..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  aria-label="Search tasks"
                />
                {searchInput && (
                  <button type="button" className="ml-icon-btn" aria-label="Clear search" onClick={() => setSearchInput("")}>
                    <Icon name="close" />
                  </button>
                )}
              </div>
              <div className="dt-filters">
                {FILTERS.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={`dt-filter ${filter === item.value ? "is-active" : ""}`}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {view === "calendar" ? (
              <TasksCalendar tasks={tasks} onSelectDay={() => setView("list")} />
            ) : hasAny ? (
              <>
                {showOverdue && sections.overdue.length > 0 && (
                  <TaskSection
                    title="Overdue"
                    icon="event_busy"
                    tone="overdue"
                    tasks={filteredSections.overdue}
                    emptyText="No overdue tasks."
                    busy={busy}
                    onToggle={toggleTask}
                    onOpen={setDetailTask}
                  />
                )}
                {showToday && (
                  <TaskSection
                    title="Today"
                    icon="today"
                    tone="primary"
                    tasks={filteredSections.today}
                    emptyText="No tasks for today."
                    busy={busy}
                    onToggle={toggleTask}
                    onOpen={setDetailTask}
                  />
                )}
                {showUpcoming && (
                  <TaskSection
                    title="Upcoming"
                    icon="event"
                    tone="info"
                    tasks={filteredSections.upcoming}
                    emptyText="No upcoming tasks."
                    busy={busy}
                    onToggle={toggleTask}
                    onOpen={setDetailTask}
                  />
                )}
                {showCompleted && sections.completed.length > 0 && (
                  <TaskSection
                    title="Recently Completed"
                    icon="task_alt"
                    tone="completed"
                    tasks={filteredSections.completed.slice(0, 10)}
                    emptyText="No completed tasks yet."
                    busy={busy}
                    onToggle={toggleTask}
                    onOpen={setDetailTask}
                  />
                )}
                {!hasAny ||
                  (filteredSections.overdue.length +
                    filteredSections.today.length +
                    filteredSections.upcoming.length +
                    filteredSections.completed.length ===
                    0 && (
                    <div className="ml-empty">
                      <span className="ml-empty-icon">
                        <Icon name="search_off" />
                      </span>
                      <h3>No tasks match</h3>
                      <p>Try a different filter or search term.</p>
                    </div>
                  ))}
              </>
            ) : (
              <div className="ml-empty ml-empty--illustrated">
                <span className="ml-empty-icon">
                  <Icon name="checklist" />
                </span>
                <h3>You're all caught up!</h3>
                <p>
                  Create your first task or book a mentor session to start building your learning
                  routine.
                </p>
                <div className="dt-empty-actions">
                  <button type="button" className="ml-btn ml-btn--primary" onClick={openAdd}>
                    <Icon name="add" /> Add Task
                  </button>
                  <Link to="/learner/mentors" className="ml-btn ml-btn--outline">
                    <Icon name="person_search" /> Find a Mentor
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="dt-side" aria-label="Task summary">
            <div className="dt-side-card">
              <h3 className="dt-side-title">
                <Icon name="insights" /> Today's Progress
              </h3>
              <div className="dt-side-stats">
                <div className="dt-side-stat">
                  <b>{stats?.completed || 0}</b>
                  <span>Completed</span>
                </div>
                <div className="dt-side-stat">
                  <b>{stats?.remaining || 0}</b>
                  <span>Remaining</span>
                </div>
                <div className="dt-side-stat dt-side-stat--danger">
                  <b>{stats?.overdue || 0}</b>
                  <span>Overdue</span>
                </div>
              </div>
              <div className="dt-side-streak">
                <Icon name="local_fire_department" />
                <span>
                  <b>{stats?.streak || 0} day</b> learning streak
                </span>
              </div>
            </div>

            <div className="dt-side-card">
              <h3 className="dt-side-title">
                <Icon name="event" /> Upcoming
              </h3>
              {sections.upcoming.length === 0 ? (
                <p className="dt-side-empty">No upcoming tasks.</p>
              ) : (
                <div className="dt-side-list">
                  {sections.upcoming.slice(0, 5).map((task) => (
                    <button type="button" className="dt-side-item" key={task.id} onClick={() => setDetailTask(task)}>
                      <span className="dt-side-dot" />
                      <span className="dt-side-item-text">{toTitleCase(task.title)}</span>
                      <span className="dt-side-item-date">{formatShortDate(task.dueDate)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {formOpen && (
        <TaskFormModal
          editing={editingTask}
          busy={busy}
          onSave={saveTask}
          onClose={() => {
            setFormOpen(false);
            setEditingTask(null);
          }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          busy={busy}
          onToggle={toggleTask}
          onEdit={openEdit}
          onDelete={(task) => setConfirmDelete(task)}
          onClose={() => setDetailTask(null)}
        />
      )}

      {confirmDelete && (
        <div className="ml-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setConfirmDelete(null)}>
          <div className="ml-modal" role="dialog" aria-modal="true" aria-label="Delete task">
            <div className="ml-modal-head">
              <div>
                <h2>Delete Task</h2>
                <p>Delete "{confirmDelete.title}"? This cannot be undone.</p>
              </div>
              <button type="button" className="ml-modal-close" aria-label="Close" onClick={() => setConfirmDelete(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="ml-modal-foot">
              <button type="button" className="ml-btn ml-btn--ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className="ml-btn ml-btn--danger" disabled={busy} onClick={deleteTask}>
                <Icon name="delete" /> Delete
              </button>
            </div>
          </div>
        </div>
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
