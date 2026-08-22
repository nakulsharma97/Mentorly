/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- overlay backdrop */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import ProfileGateModal from "../components/ProfileGateModal";
import { SkeletonTable } from "../components/SkeletonLoaders";
import StatsCard from "../modules/common/dashboard/StatsCard";
import { EmptyState } from "../modules/common/dashboard/SectionCard";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import useMentorGate from "../modules/common/useMentorGate";
import { formatPrice } from "../utils/price";
import "../modules/mentor/mentor-pages.css";

const VIEW_TABS = ["day", "week", "month", "agenda"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ISO day names starting from Monday
const ISO_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function formatTime(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
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
  // Marketplace gate — blocks availability/session actions until the
  // mentor's profile is complete AND admin-verified.
  const gate = useMentorGate(profile, null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState("month");
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotDeleting, setSlotDeleting] = useState(null);
  const [slotForm, setSlotForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const loadData = useCallback(async () => {
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
      // Paginated responses — unwrap .content from the Page objects.
      const bookings = bookingsRes?.data?.data?.content || [];
      const sessions = sessionsRes?.data?.data?.content || [];
      const slotItems = slotsRes?.data?.data?.content || [];
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
            sessionType: session?.sessionType || item?.sessionType || null,
            skill:
              session?.skill?.name ||
              (String(session?.sessionType || "").toUpperCase() === "PRIVATE"
                ? "Private 1:1"
                : String(session?.sessionType || "").toUpperCase() === "PUBLIC"
                  ? "Public 1:1"
                  : item?.sessionType || "General"),
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
  }, [notify]);

  useEffect(() => {
    document.title = "Calendar | Mentorly Mentor";
    loadData();
  }, [loadData]);

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

  const createOneOffSession = () => {
    gate.requestAction(() => navigate("/mentor/teach?tab=sessions"));
  };

  const updateStatus = async (bookingId, status) => {
    try {
      await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      notify?.({
        type: "success",
        title: "Status updated",
        message: `Booking status changed to ${status}.`,
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

  // ─── Availability: Create / Save Slot ───
  const createAvailabilitySlot = async (event) => {
    event.preventDefault();
    // Marketplace gate — setting availability requires a verified mentor.
    if (gate.mode) {
      gate.requestAction(() => {});
      return;
    }

    // Validate form
    if (!slotForm.startTime || !slotForm.endTime) {
      notify?.({
        type: "error",
        title: "Missing times",
        message: "Please provide both start and end times.",
      });
      return;
    }

    if (slotForm.startTime >= slotForm.endTime) {
      notify?.({
        type: "error",
        title: "Invalid time range",
        message: "Start time must be before end time.",
      });
      return;
    }

    setSavingSlot(true);
    try {
      const payload = {
        dayOfWeek: Number(slotForm.dayOfWeek),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        timezone: slotForm.timezone,
        active: true,
      };
      await client.post("/api/v1/availability/my-slots", payload);
      notify?.({
        type: "success",
        title: "Availability added",
        message: "Your availability slot was saved successfully.",
      });
      // Reset form to defaults
      setSlotForm((prev) => ({
        ...prev,
        startTime: "09:00",
        endTime: "17:00",
      }));
      loadData();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Could not save slot",
        message: err?.response?.data?.message || "Please try again later.",
      });
    } finally {
      setSavingSlot(false);
    }
  };

  // ─── Availability: Remove Slot ───
  const removeSlot = async (slotId) => {
    setSlotDeleting(slotId);
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
        message: err?.response?.data?.message || "Please try again later.",
      });
    } finally {
      setSlotDeleting(null);
    }
  };

  return (
    <div className="md md-page">
      <MentorPageHero
        eyebrow="Your Schedule"
        icon="calendar_month"
        title="Calendar"
        sub="Manage bookings, availability, and your mentor schedule from one place."
      >
        <button
          type="button"
          className="md-btn md-btn--outline md-btn--sm"
          onClick={loadData}
          disabled={loading}
        >
          <Icon name="refresh" /> Refresh
        </button>
        <button
          type="button"
          className="md-btn md-btn--ghost md-btn--sm"
          onClick={() => navigate("/mentor/students")}
        >
          <Icon name="groups" /> View Students
        </button>
      </MentorPageHero>

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
              aria-label="Previous month"
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
            <span className="mp-tz-badge">
              {USER_TIMEZONE}
            </span>
            <button
              type="button"
              className="md-btn md-btn--outline md-btn--sm"
              aria-label="Next month"
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
                  <div className="md-empty">
                    <div className="md-empty__icon">
                      <Icon name="calendar_month" />
                    </div>
                    <p className="md-empty__title">No schedule items yet</p>
                    <p className="md-empty__desc">
                      Your sessions and bookings will appear here once created.
                    </p>
                  </div>
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


      {/* ═══════════════════ AUTO-CREATED SESSIONS NOTICE ═══════════════════ */}
      <div className="md-card md-animate" style={{ gap: 14 }}>
        <div className="mp-head">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="auto_awesome" />
            <div>
              <h2 className="mp-head__title" style={{ fontSize: "1.1rem", margin: 0 }}>
                Auto Sessions
              </h2>
              <p className="mp-head__sub" style={{ margin: "2px 0 0" }}>
                Sessions are created automatically from your availability slots.
                Just set your weekly availability below and we will generate sessions
                for the upcoming two weeks.
              </p>
            </div>
          </div>
        </div>
        <div
          style={{
            background: "var(--md-soft, #f0fdf4)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "0.88rem",
            color: "var(--md-text-2, #166534)",
          }}
        >
          <Icon name="info" />
          <span>
            Sessions use your profile headline or skills as the title and your
            hourly rate as the price. You can edit or cancel sessions anytime from{" "}
            <button
              type="button"
              className="md-btn md-btn--ghost md-btn--sm"
              style={{ display: "inline", padding: 0, fontSize: "inherit", textDecoration: "underline", verticalAlign: "baseline" }}
              onClick={() => navigate("/mentor/teach?tab=sessions")}
            >
              Manage Sessions
            </button>
            .
          </span>
        </div>
        <div className="mp-modal__foot">
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={createOneOffSession}
          >
            <Icon name="add" /> Create Custom Session
          </button>
        </div>
      </div>

      {/* ═══════════════════ AVAILABILITY SECTION ═══════════════════ */}
      <div className="md-card md-animate" style={{ gap: 18 }}>
        <div className="mp-head">
          <div>
            <h2 className="mp-head__title" style={{ fontSize: "1.1rem" }}>
              Availability
            </h2>
            <p className="mp-head__sub">
              Define recurring weekly slots. Sessions will be auto-created for each
              slot for the next two weeks.
            </p>
          </div>
        </div>

        <form className="mp-modal__body" onSubmit={createAvailabilitySlot}>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-day">
                Day of week
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
                {ISO_DAY_NAMES.map((name, index) => (
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
              <div className="mp-timezone-display">
                <Icon name="schedule" />
                <span>{USER_TIMEZONE}</span>
              </div>
            </div>
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="slot-start">
                Start time
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
                End time
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
            <button
              type="submit"
              className="md-btn md-btn--brand"
              disabled={savingSlot}
            >
              {savingSlot ? (
                <>
                  <span className="mp-spinner" /> Saving…
                </>
              ) : (
                "Save Availability"
              )}
            </button>
          </div>
        </form>

        {/* Existing Slots */}
        {slots.length > 0 && (
          <div className="mp-mini-list">
            <p className="mp-section__title" style={{ margin: "0 0 4px" }}>
              <Icon name="schedule" /> Saved Slots ({slots.length})
            </p>
            {slots.map((slot) => (
              <div key={slot.id} className="mp-avail-row">
                <div className="mp-avail-row__indicator" />
                <div style={{ flex: 1 }}>
                  <div className="mp-avail-row__day">
                    {ISO_DAY_NAMES[(slot.dayOfWeek || 1) - 1] || "Day"}
                  </div>
                  <div className="mp-avail-row__time">
                    {slot.startTime} – {slot.endTime}
                    {slot.timezone && ` · ${slot.timezone}`}
                  </div>
                </div>
                <button
                  type="button"
                  className="mp-icon-btn mp-icon-btn--danger"
                  onClick={() => removeSlot(slot.id)}
                  disabled={slotDeleting === slot.id}
                  aria-label={`Delete ${ISO_DAY_NAMES[(slot.dayOfWeek || 1) - 1]} slot`}
                >
                  {slotDeleting === slot.id ? (
                    <span className="mp-spinner mp-spinner--sm" />
                  ) : (
                    <Icon name="delete" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {slots.length === 0 && (
          <div className="md-empty" style={{ marginTop: 8 }}>
            <div className="md-empty__icon">
              <Icon name="schedule" />
            </div>
            <p className="md-empty__title">No availability set</p>
            <p className="md-empty__desc">
              Set your weekly availability above so learners can see when you
              are free for mentoring sessions.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════ EVENT DETAIL DRAWER ═══════════════════ */}
      {selectedEvent && (
        <div
          className="mp-overlay"
          onMouseDown={() => setSelectedEvent(null)}
          role="presentation"
        >
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
                    <span className="mp-tz-label">{USER_TIMEZONE}</span>
                  </p>
                </div>
              </div>
              <div>
                <p className="mp-block__label">Notes</p>
                <p className="mp-mini-row__m">
                  {selectedEvent.description ||
                    "No additional notes provided."}
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
                  Price: {formatPrice(selectedEvent.priceAmount)}
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

      {/* Marketplace gate modal — blocks availability/session creation until
          the mentor's profile is complete AND admin-verified. */}
      <ProfileGateModal {...gate.gate} />
    </div>
  );
}
