import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import { SkeletonTable } from "../components/SkeletonLoaders";
import StatsCard from "../modules/common/dashboard/StatsCard";
import { EmptyState } from "../modules/common/dashboard/SectionCard";
import "../modules/mentor/mentor-pages.css";

const VIEW_TABS = ["day", "week", "month", "agenda"];
const STATUS_ORDER = {
  CONFIRMED: 0,
  ACCEPTED: 1,
  PENDING: 2,
  COMPLETED: 3,
  CANCELLED: 4,
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date, format = "short") {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: format === "short" ? "short" : "long",
    day: "numeric",
    year: format === "short" ? undefined : "numeric",
  }).format(date);
}

function formatTime(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status) {
  return status === "COMPLETED"
    ? "mp-ev--completed"
    : status === "CANCELLED"
      ? "mp-ev--cancelled"
      : status === "PENDING"
        ? "mp-ev--pending"
        : "mp-ev--confirmed";
}

function createCalendarDays(viewDate) {
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const firstDay = start.getDay();
  const days = [];
  const prevMonthLast = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    0,
  ).getDate();
  for (let i = firstDay - 1; i >= 0; i -= 1) {
    const day = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() - 1,
      prevMonthLast - i,
    );
    days.push({ date: day, out: true });
  }
  for (let i = 1; i <= end.getDate(); i += 1) {
    days.push({
      date: new Date(viewDate.getFullYear(), viewDate.getMonth(), i),
      out: false,
    });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i += 1) {
    days.push({
      date: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, i),
      out: true,
    });
  }
  return days;
}

export default function MentorCalendarPage({ profile, notify }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState("month");
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    sessionType: "1:1 Mentoring",
    startTime: "",
    endTime: "",
    meetingLink: "",
    priceAmount: "",
    maxParticipants: 1,
  });
  const [creating, setCreating] = useState(false);
  const [slotForm, setSlotForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  useEffect(() => {
    document.title = "Calendar | SkillSwap Mentor";
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [bookingsRes, sessionsRes, slotsRes] = await Promise.all([
        client.get("/api/v1/bookings"),
        client.get("/api/v1/sessions"),
        client
          .get("/api/v1/availability/my-slots")
          .catch(() => ({ data: { data: [] } })),
      ]);
      const bookings = bookingsRes?.data?.data || [];
      const sessions = sessionsRes?.data?.data || [];
      const slotItems = slotsRes?.data?.data || [];
      const mapped = [...bookings, ...sessions]
        .map((item) => {
          const session = item?.session || item;
          const start = toDate(session?.startTime || item?.startTime || null);
          const end = toDate(session?.endTime || item?.endTime || null);
          const status = item?.bookingStatus || item?.status || "PENDING";
          return {
            id: item?.id || session?.id,
            title: session?.title || item?.title || "Session",
            student:
              item?.learner?.fullName ||
              item?.learner?.name ||
              session?.learner?.fullName ||
              "Learner",
            skill:
              session?.sessionType ||
              session?.skill?.name ||
              item?.sessionType ||
              "General",
            start,
            end,
            status,
            meetingLink: session?.meetingLink || item?.meetingLink || "",
            priceAmount:
              session?.priceAmount || item?.priceAmount || item?.price || 0,
            description: session?.description || item?.description || "",
            paymentStatus:
              item?.paymentStatus ||
              (item?.bookingStatus === "COMPLETED" ? "COMPLETED" : "PENDING"),
            sessionId: session?.id,
            bookingId: item?.id,
            type: item?.session ? "booking" : "session",
          };
        })
        .filter((item) => item.start);
      mapped.sort(
        (a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0),
      );
      setEvents(mapped);
      setSlots(slotItems);
    } catch (err) {
      console.error("Failed to load calendar data", err);
      setError(true);
      notify?.({
        type: "error",
        title: "Calendar unavailable",
        message: "Please retry in a moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const upcoming = events.filter(
      (event) =>
        event.start &&
        event.start > new Date() &&
        !["CANCELLED", "REJECTED"].includes(event.status),
    ).length;
    const completed = events.filter(
      (event) => event.status === "COMPLETED",
    ).length;
    const pending = events.filter(
      (event) =>
        event.status === "PENDING" ||
        event.status === "ACCEPTED" ||
        event.status === "CONFIRMED",
    ).length;
    return { upcoming, completed, pending };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const dayStart = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      viewDate.getDate(),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return events.filter(
      (event) => event.start && event.start >= dayStart && event.start < dayEnd,
    );
  }, [events, viewDate]);

  const calendarDays = useMemo(() => createCalendarDays(viewDate), [viewDate]);

  const changeView = (nextView) => setView(nextView);

  const updateStatus = async (bookingId, status) => {
    try {
      await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      notify?.({
        type: "success",
        title: "Session updated",
        message: "The booking status was updated.",
      });
      loadData();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Update failed",
        message: err?.response?.data?.message || "Try again.",
      });
    }
  };

  const createSession = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      await client.post("/api/v1/sessions", {
        title: form.title,
        description: form.description,
        sessionType: form.sessionType,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        priceAmount: Number(form.priceAmount || 0),
        meetingLink: form.meetingLink,
        maxParticipants: Number(form.maxParticipants || 1),
      });
      notify?.({
        type: "success",
        title: "Session created",
        message: "Your new session is live.",
      });
      setForm({
        title: "",
        description: "",
        sessionType: "1:1 Mentoring",
        startTime: "",
        endTime: "",
        meetingLink: "",
        priceAmount: "",
        maxParticipants: 1,
      });
      loadData();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Session not created",
        message: err?.response?.data?.message || "Please review the form.",
      });
    } finally {
      setCreating(false);
    }
  };

  const createAvailabilitySlot = async (event) => {
    event.preventDefault();
    try {
      await client.post("/api/v1/availability/my-slots", slotForm);
      notify?.({
        type: "success",
        title: "Availability updated",
        message: "Your availability slot was saved.",
      });
      loadData();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Could not save slot",
        message: err?.response?.data?.message || "Try again.",
      });
    }
  };

  const removeSlot = async (slotId) => {
    try {
      await client.delete(`/api/v1/availability/my-slots/${slotId}`);
      notify?.({
        type: "success",
        title: "Slot removed",
        message: "The availability slot was deleted.",
      });
      loadData();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Could not delete slot",
        message: err?.response?.data?.message || "Try again.",
      });
    }
  };

  return (
    <div className="md md-page">
      <div className="mp-head md-animate">
        <div>
          <h1 className="mp-head__title">Calendar</h1>
          <p className="mp-head__sub">
            Manage bookings, availability, and your mentor schedule from one
            place.
          </p>
        </div>
        <div className="mp-head__actions">
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={loadData}
          >
            <Icon name="refresh" /> Refresh
          </button>
          <button
            type="button"
            className="md-btn md-btn--brand md-btn--sm"
            onClick={() => navigate("/mentor/students")}
          >
            <Icon name="groups" /> View Students
          </button>
        </div>
      </div>

      <div
        className="md-stats md-animate"
        style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}
      >
        <StatsCard
          icon="calendar_month"
          label="Upcoming Sessions"
          value={stats.upcoming}
          description="Scheduled ahead"
        />
        <StatsCard
          icon="task_alt"
          label="Completed Sessions"
          value={stats.completed}
          description="Finished sessions"
        />
        <StatsCard
          icon="schedule"
          label="Pending Requests"
          value={stats.pending}
          description="Needs attention"
        />
      </div>

      <div className="md-card md-animate" style={{ gap: 16 }}>
        <div className="mp-cal-toolbar">
          <div className="mp-cal-nav">
            <button
              type="button"
              className="md-btn md-btn--outline md-btn--sm"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1),
                )
              }
            >
              <Icon name="chevron_left" />
            </button>
            <div className="mp-cal-nav__label">
              {formatDate(viewDate, "long")}
            </div>
            <button
              type="button"
              className="md-btn md-btn--outline md-btn--sm"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
                )
              }
            >
              <Icon name="chevron_right" />
            </button>
          </div>
          <div
            className="mp-view-tabs"
            role="tablist"
            aria-label="Calendar views"
          >
            {VIEW_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`mp-view-tab ${view === tab ? "mp-view-tab--active" : ""}`}
                onClick={() => changeView(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mp-legend">
          <span className="mp-legend__item">
            <span className="mp-legend__dot mp-dot--confirmed" /> Confirmed
          </span>
          <span className="mp-legend__item">
            <span className="mp-legend__dot mp-dot--pending" /> Pending
          </span>
          <span className="mp-legend__item">
            <span className="mp-legend__dot mp-dot--completed" /> Completed
          </span>
          <span className="mp-legend__item">
            <span className="mp-legend__dot mp-dot--cancelled" /> Cancelled
          </span>
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={4} />
        ) : error ? (
          <EmptyState
            icon="event_busy"
            title="Calendar unavailable"
            description="We could not load your schedule right now."
          />
        ) : (
          <>
            {view === "month" && (
              <div className="mp-month">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="mp-month__dow">
                    {day}
                  </div>
                ))}
                {calendarDays.map((item, index) => {
                  const isToday =
                    item.date.toDateString() === new Date().toDateString();
                  const dayEvents = events.filter(
                    (event) =>
                      event.start &&
                      event.start.toDateString() === item.date.toDateString(),
                  );
                  return (
                    <div
                      key={`${item.date.toISOString()}-${index}`}
                      className={`mp-day ${item.out ? "mp-day--out" : ""} ${isToday ? "mp-day--today" : ""}`}
                    >
                      <div className="mp-day__num">{item.date.getDate()}</div>
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={`mp-chip ${statusClass(event.status)}`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <span
                            className={`mp-chip__dot ${event.status === "COMPLETED" ? "mp-dot--completed" : event.status === "CANCELLED" ? "mp-dot--cancelled" : event.status === "PENDING" ? "mp-dot--pending" : "mp-dot--confirmed"}`}
                          />
                          {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="mp-day__more">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <div className="mp-cols">
                <div className="mp-col">
                  <div className="mp-col__head mp-col__head--today">
                    <div className="mp-col__dow">Today</div>
                    <div className="mp-col__date">
                      {formatDate(viewDate, "long")}
                    </div>
                  </div>
                  <div className="mp-col__body">
                    {filteredEvents.length === 0 ? (
                      <div className="mp-avail-row">
                        No sessions planned for this day.
                      </div>
                    ) : (
                      filteredEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={`mp-ev-card ${statusClass(event.status)}`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="mp-ev-card__time">
                            {formatTime(event.start)} – {formatTime(event.end)}
                          </div>
                          <div className="mp-ev-card__title">{event.title}</div>
                          <div className="mp-ev-card__sub">
                            {event.student} · {event.skill}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === "week" && (
              <div
                className="mp-cols"
                style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}
              >
                {Array.from({ length: 7 }, (_, index) => {
                  const date = new Date(
                    viewDate.getFullYear(),
                    viewDate.getMonth(),
                    viewDate.getDate() - viewDate.getDay() + index,
                  );
                  const dayEvents = events.filter(
                    (event) =>
                      event.start &&
                      event.start.toDateString() === date.toDateString(),
                  );
                  return (
                    <div key={date.toISOString()} className="mp-col">
                      <div className="mp-col__head">
                        <div className="mp-col__dow">
                          {DAY_NAMES[date.getDay()]}
                        </div>
                        <div className="mp-col__date">{date.getDate()}</div>
                      </div>
                      <div className="mp-col__body">
                        {dayEvents.length === 0 ? (
                          <div className="mp-avail-row">Open</div>
                        ) : (
                          dayEvents.map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              className={`mp-ev-card ${statusClass(event.status)}`}
                              onClick={() => setSelectedEvent(event)}
                            >
                              <div className="mp-ev-card__time">
                                {formatTime(event.start)}
                              </div>
                              <div className="mp-ev-card__title">
                                {event.title}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "agenda" && (
              <div className="mp-agenda">
                {events.length === 0 ? (
                  <div className="mp-avail-row">No schedule items yet.</div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="mp-agenda__group">
                      <div className="mp-agenda__date">
                        {formatDate(event.start)}{" "}
                        <span>{formatTime(event.start)}</span>
                      </div>
                      <button
                        type="button"
                        className={`mp-ev-card ${statusClass(event.status)}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="mp-ev-card__title">{event.title}</div>
                        <div className="mp-ev-card__sub">
                          {event.student} · {event.skill}
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="md-card md-animate" style={{ gap: 18 }}>
        <div className="mp-head">
          <div>
            <h2 className="mp-head__title" style={{ fontSize: "1.1rem" }}>
              Create session
            </h2>
            <p className="mp-head__sub">
              Publish a live mentee session directly from the dashboard.
            </p>
          </div>
        </div>
        <form className="mp-modal__body" onSubmit={createSession}>
          <div className="mp-field">
            <label className="mp-label" htmlFor="session-title">
              Title
            </label>
            <input
              id="session-title"
              className="mp-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="mp-field">
            <label className="mp-label" htmlFor="session-description">
              Description
            </label>
            <textarea
              id="session-description"
              className="mp-textarea"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
            />
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-start">
                Start
              </label>
              <input
                id="session-start"
                type="datetime-local"
                className="mp-input"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                required
              />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-end">
                End
              </label>
              <input
                id="session-end"
                type="datetime-local"
                className="mp-input"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-skill">
                Skill
              </label>
              <input
                id="session-skill"
                className="mp-input"
                value={form.sessionType}
                onChange={(e) =>
                  setForm({ ...form, sessionType: e.target.value })
                }
                required
              />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-price">
                Price
              </label>
              <input
                id="session-price"
                type="number"
                min="0"
                className="mp-input"
                value={form.priceAmount}
                onChange={(e) =>
                  setForm({ ...form, priceAmount: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-link">
                Meeting link
              </label>
              <input
                id="session-link"
                className="mp-input"
                value={form.meetingLink}
                onChange={(e) =>
                  setForm({ ...form, meetingLink: e.target.value })
                }
              />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="session-max">
                Max learners
              </label>
              <input
                id="session-max"
                type="number"
                min="1"
                className="mp-input"
                value={form.maxParticipants}
                onChange={(e) =>
                  setForm({ ...form, maxParticipants: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mp-modal__foot">
            <button
              type="submit"
              className="md-btn md-btn--brand"
              disabled={creating}
            >
              {creating ? "Creating…" : "Create Session"}
            </button>
          </div>
        </form>
      </div>

      <div className="md-card md-animate" style={{ gap: 18 }}>
        <div className="mp-head">
          <div>
            <h2 className="mp-head__title" style={{ fontSize: "1.1rem" }}>
              Availability
            </h2>
            <p className="mp-head__sub">
              Define recurring mentor slots and manage blocked dates.
            </p>
          </div>
        </div>
        <form className="mp-modal__body" onSubmit={createAvailabilitySlot}>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-day">
                Day
              </label>
              <select
                id="slot-day"
                className="mp-input"
                value={slotForm.dayOfWeek}
                onChange={(e) =>
                  setSlotForm({
                    ...slotForm,
                    dayOfWeek: Number(e.target.value),
                  })
                }
              >
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-timezone">
                Timezone
              </label>
              <input
                id="slot-timezone"
                className="mp-input"
                value={slotForm.timezone}
                onChange={(e) =>
                  setSlotForm({ ...slotForm, timezone: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-start">
                Start
              </label>
              <input
                id="slot-start"
                type="time"
                className="mp-input"
                value={slotForm.startTime}
                onChange={(e) =>
                  setSlotForm({ ...slotForm, startTime: e.target.value })
                }
                required
              />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-end">
                End
              </label>
              <input
                id="slot-end"
                type="time"
                className="mp-input"
                value={slotForm.endTime}
                onChange={(e) =>
                  setSlotForm({ ...slotForm, endTime: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="mp-modal__foot">
            <button type="submit" className="md-btn md-btn--brand">
              Save Availability
            </button>
          </div>
        </form>
        {slots.length > 0 && (
          <div className="mp-mini-list">
            {slots.map((slot) => (
              <div key={slot.id} className="mp-avail-row">
                <div style={{ flex: 1 }}>
                  <div className="mp-avail-row__day">
                    {DAY_NAMES[(slot.dayOfWeek || 1) - 1] || "Day"}
                  </div>
                  <div className="mp-avail-row__time">
                    {slot.startTime} – {slot.endTime} · {slot.timezone}
                  </div>
                </div>
                <button
                  type="button"
                  className="mp-icon-btn"
                  onClick={() => removeSlot(slot.id)}
                >
                  <Icon name="delete" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEvent && (
        <div className="mp-overlay" onMouseDown={() => setSelectedEvent(null)}>
          <aside
            className="mp-drawer"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Session details"
          >
            <div className="mp-drawer__head">
              <div className="mp-drawer__head-main">
                <h3 className="mp-drawer__title">{selectedEvent.title}</h3>
                <p className="mp-drawer__sub">{selectedEvent.student}</p>
              </div>
              <span className={`mp-pill ${statusClass(selectedEvent.status)}`}>
                {selectedEvent.status}
              </span>
            </div>
            <div className="mp-drawer__body">
              <div className="mp-kv">
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Student</p>
                  <p className="mp-kv__v">{selectedEvent.student}</p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Skill</p>
                  <p className="mp-kv__v">{selectedEvent.skill}</p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Date</p>
                  <p className="mp-kv__v">{formatDate(selectedEvent.start)}</p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Time</p>
                  <p className="mp-kv__v">
                    {formatTime(selectedEvent.start)} –{" "}
                    {formatTime(selectedEvent.end)}
                  </p>
                </div>
              </div>
              <div>
                <p className="mp-block__label">Notes</p>
                <p className="mp-mini-row__m">
                  {selectedEvent.description || "No additional notes provided."}
                </p>
              </div>
              <div>
                <p className="mp-block__label">Meeting Link</p>
                <a
                  href={selectedEvent.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="md-link"
                >
                  {selectedEvent.meetingLink || "No meeting link yet"}
                </a>
              </div>
              <div>
                <p className="mp-block__label">Package & Payment</p>
                <p className="mp-mini-row__m">
                  Price:{" "}
                  {Number(selectedEvent.priceAmount || 0).toLocaleString(
                    "en-US",
                    { style: "currency", currency: "USD" },
                  )}
                </p>
                <p className="mp-mini-row__m">
                  Payment status: {selectedEvent.paymentStatus || "Pending"}
                </p>
              </div>
            </div>
            <div className="mp-drawer__foot">
              <button
                type="button"
                className="md-btn md-btn--outline md-btn--sm"
                onClick={() =>
                  updateStatus(selectedEvent.bookingId, "CONFIRMED")
                }
              >
                Confirm
              </button>
              <button
                type="button"
                className="md-btn md-btn--outline md-btn--sm"
                onClick={() =>
                  updateStatus(selectedEvent.bookingId, "COMPLETED")
                }
              >
                Complete
              </button>
              <button
                type="button"
                className="md-btn md-btn--outline md-btn--sm"
                onClick={() =>
                  updateStatus(selectedEvent.bookingId, "CANCELLED")
                }
              >
                Cancel
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
