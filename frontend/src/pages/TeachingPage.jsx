import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import MobileBottomNav from "../components/MobileBottomNav";
import { getApiErrorMessage } from "../utils/apiErrors";

const SORT_OPTIONS = [
  { value: "dateAsc", label: "Date ↑" },
  { value: "dateDesc", label: "Date ↓" },
  { value: "priceAsc", label: "Price ↑" },
  { value: "priceDesc", label: "Price ↓" },
  { value: "seatsAsc", label: "Seats ↑" },
  { value: "seatsDesc", label: "Seats ↓" },
];

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "Published", label: "Published" },
  { key: "Draft", label: "Draft" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDateOnly = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const getStatusLabel = (session) => {
  const raw = String(
    session?.status || session?.sessionStatus || "",
  ).toUpperCase();
  if (raw === "DRAFT") return "Draft";
  if (raw === "CANCELLED") return "Cancelled";
  if (raw === "COMPLETED") return "Completed";
  if (raw === "ARCHIVED") return "Completed";
  if (raw === "PENDING") return "Draft";
  if (!session?.startTime) return "Draft";
  if (new Date(session.startTime).getTime() < Date.now()) return "Completed";
  return "Published";
};

const badgeStyle = (status) => {
  switch (status) {
    case "Published":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "Draft":
      return "bg-slate-100 text-slate-800 border border-slate-200";
    case "Completed":
      return "bg-slate-100 text-slate-700 border border-slate-200";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border border-rose-100";
    default:
      return "bg-slate-100 text-slate-800 border border-slate-200";
  }
};

export default function TeachingPage({ notify }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("dateAsc");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    title: "",
    sessionType: "1:1 Mentoring",
    description: "",
    startTime: "",
    endTime: "",
    priceAmount: "",
    meetingLink: "",
    maxParticipants: 1,
    cancellationWindowHours: 24,
    rescheduleWindowHours: 12,
  });
  const [sessionErrors, setSessionErrors] = useState({});
  const [sessionMessage, setSessionMessage] = useState("");
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  const loadWorkspaceData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [profileRes, sessionsRes, bookingsRes, availabilityRes] =
        await Promise.all([
          client.get("/api/v1/users/me"),
          client.get("/api/v1/sessions"),
          client.get("/api/v1/bookings"),
          client.get("/api/v1/availability/my-slots"),
        ]);

      setProfile(profileRes?.data?.data || null);
      setSessions(sessionsRes?.data?.data || []);
      setBookings(bookingsRes?.data?.data || []);
      setAvailabilitySlots(availabilityRes?.data?.data || []);
    } catch (error) {
      setLoadError("Could not load your sessions. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const mentorSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session) return false;
        if (!profile?.id || !session?.mentor?.id) return true;
        return session.mentor.id === profile.id;
      }),
    [sessions, profile],
  );

  const pendingRequests = useMemo(
    () =>
      bookings.filter((booking) =>
        ["PENDING", "RESCHEDULE_REQUESTED"].includes(
          String(booking?.bookingStatus || booking?.status || "").toUpperCase(),
        ),
      ),
    [bookings],
  );

  const stats = useMemo(() => {
    const active = mentorSessions.filter(
      (session) => getStatusLabel(session) === "Published",
    ).length;
    const thisWeek = mentorSessions.filter((session) => {
      const start = session?.startTime
        ? new Date(session.startTime).getTime()
        : 0;
      const now = Date.now();
      return start >= now && start <= now + 7 * 24 * 60 * 60 * 1000;
    }).length;

    const lastWeek = mentorSessions.filter((session) => {
      const start = session?.startTime
        ? new Date(session.startTime).getTime()
        : 0;
      const now = Date.now();
      return (
        start >= now - 14 * 24 * 60 * 60 * 1000 &&
        start < now - 7 * 24 * 60 * 60 * 1000
      );
    }).length;

    const trend =
      lastWeek === 0
        ? thisWeek > 0
          ? "New this week"
          : "No change"
        : `${Math.round(((thisWeek - lastWeek) / Math.max(1, lastWeek)) * 100)}% this week`;
    return {
      total: mentorSessions.length,
      active,
      pending: pendingRequests.length,
      thisWeek,
      trend,
    };
  }, [mentorSessions, pendingRequests]);

  const filteredSessions = useMemo(() => {
    return mentorSessions
      .filter((session) => {
        const status = getStatusLabel(session);
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (upcomingOnly) {
          const startTime = session?.startTime
            ? new Date(session.startTime).getTime()
            : 0;
          if (startTime < Date.now()) return false;
        }
        if (!searchTerm) return true;
        const query = searchTerm.toLowerCase();
        return [
          session?.title,
          session?.sessionType,
          session?.description,
          session?.skill?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aDate = new Date(a?.startTime || 0).getTime();
        const bDate = new Date(b?.startTime || 0).getTime();
        const aPrice = Number(a?.priceAmount || a?.pricePerHour || 0);
        const bPrice = Number(b?.priceAmount || b?.pricePerHour || 0);
        const aSeats = Number(a?.maxParticipants || a?.capacity || 1);
        const bSeats = Number(b?.maxParticipants || b?.capacity || 1);

        switch (sortKey) {
          case "dateDesc":
            return bDate - aDate;
          case "priceAsc":
            return aPrice - bPrice;
          case "priceDesc":
            return bPrice - aPrice;
          case "seatsAsc":
            return aSeats - bSeats;
          case "seatsDesc":
            return bSeats - aSeats;
          default:
            return aDate - bDate;
        }
      });
  }, [mentorSessions, searchTerm, statusFilter, sortKey, upcomingOnly]);

  const openSessionModal = (session = null) => {
    setEditingSession(session);
    setSessionForm({
      title: session?.title || "",
      sessionType: session?.sessionType || "1:1 Mentoring",
      description: session?.description || "",
      startTime: session?.startTime || "",
      endTime: session?.endTime || "",
      priceAmount: String(session?.priceAmount || session?.pricePerHour || 0),
      meetingLink: session?.meetingLink || "",
      maxParticipants: session?.maxParticipants || session?.capacity || 1,
      cancellationWindowHours: session?.cancellationWindowHours || 24,
      rescheduleWindowHours: session?.rescheduleWindowHours || 12,
    });
    setSessionErrors({});
    setSessionMessage("");
    setIsSessionModalOpen(true);
  };

  const validateSession = (form) => {
    const errors = {};
    if (!String(form.title || "").trim())
      errors.title = "Please enter a session title.";
    if (!String(form.sessionType || "").trim())
      errors.sessionType = "Please enter a session type.";
    if (!String(form.description || "").trim())
      errors.description = "Please add a short session description.";
    if (!form.startTime) errors.startTime = "Please choose a start time.";
    if (!form.endTime) errors.endTime = "Please choose an end time.";
    if (
      form.startTime &&
      form.endTime &&
      new Date(form.endTime) <= new Date(form.startTime)
    ) {
      errors.endTime = "End time must be after start time.";
    }
    if (
      !Number.isFinite(Number(form.priceAmount)) ||
      Number(form.priceAmount) < 0
    ) {
      errors.priceAmount = "Price must be 0 or greater.";
    }
    if (
      !Number.isFinite(Number(form.maxParticipants)) ||
      Number(form.maxParticipants) < 1
    ) {
      errors.maxParticipants = "At least one seat is required.";
    }
    return errors;
  };

  const handleSessionChange = (field, value) => {
    setSessionForm((prev) => ({ ...prev, [field]: value }));
    if (Object.keys(sessionErrors).length > 0) {
      setSessionErrors((prev) => ({
        ...prev,
        ...validateSession({ ...sessionForm, [field]: value }),
      }));
    }
  };

  const saveSession = async (event) => {
    event.preventDefault();
    const errors = validateSession(sessionForm);
    if (Object.keys(errors).length > 0) {
      setSessionErrors(errors);
      setSessionMessage("Please fix the highlighted fields.");
      return;
    }

    const payload = {
      title: sessionForm.title.trim(),
      description: sessionForm.description.trim(),
      sessionType: sessionForm.sessionType.trim(),
      startTime: new Date(sessionForm.startTime).toISOString(),
      endTime: new Date(sessionForm.endTime).toISOString(),
      priceAmount: Number(sessionForm.priceAmount || 0),
      meetingLink: sessionForm.meetingLink.trim(),
      maxParticipants: Number(sessionForm.maxParticipants || 1),
      cancellationWindowHours: Number(
        sessionForm.cancellationWindowHours || 24,
      ),
      rescheduleWindowHours: Number(sessionForm.rescheduleWindowHours || 12),
    };

    try {
      let response;
      if (editingSession?.id) {
        response = await client.patch(
          `/api/v1/sessions/${editingSession.id}`,
          payload,
        );
        const updated = response?.data?.data;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === updated.id ? updated : session,
          ),
        );
        notify?.({
          type: "success",
          title: "Session updated",
          message: "Changes were saved.",
        });
      } else {
        response = await client.post("/api/v1/sessions", payload);
        const created = response?.data?.data;
        if (created) setSessions((prev) => [created, ...prev]);
        notify?.({
          type: "success",
          title: "Session created",
          message: "Your session is now available.",
        });
      }
      setIsSessionModalOpen(false);
    } catch (error) {
      setSessionMessage(getApiErrorMessage(error, "Could not save session."));
      notify?.({
        type: "error",
        title: "Save failed",
        message: getApiErrorMessage(error, "Could not save session."),
      });
    }
  };

  const duplicateSession = async (session) => {
    const payload = {
      title: `${session.title || "Session"} (Copy)`,
      description: session.description || "",
      sessionType: session.sessionType || "1:1 Mentoring",
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      priceAmount: Number(session.priceAmount || session.pricePerHour || 0),
      meetingLink: session.meetingLink || "",
      maxParticipants: Number(session.maxParticipants || session.capacity || 1),
      cancellationWindowHours: Number(session.cancellationWindowHours || 24),
      rescheduleWindowHours: Number(session.rescheduleWindowHours || 12),
    };
    try {
      const response = await client.post("/api/v1/sessions", payload);
      const created = response?.data?.data;
      if (created) setSessions((prev) => [created, ...prev]);
      notify?.({
        type: "success",
        title: "Session duplicated",
        message: "A copy was added.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Duplicate failed",
        message: getApiErrorMessage(error, "Could not duplicate session."),
      });
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await client.delete(`/api/v1/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      notify?.({
        type: "success",
        title: "Session deleted",
        message: "The session was removed.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Delete failed",
        message: getApiErrorMessage(error, "Could not delete session."),
      });
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      const response = await client.patch(
        `/api/v1/bookings/${bookingId}/status`,
        { status },
      );
      const updated = response?.data?.data;
      setBookings((prev) =>
        prev.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      notify?.({
        type: "success",
        title: "Request updated",
        message: `Request ${status.toLowerCase()} successfully.`,
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Update failed",
        message: getApiErrorMessage(error, "Could not update request."),
      });
    }
  };

  const openAvailabilityModal = (slot = null, dayOfWeek = null) => {
    setEditingAvailability(slot);
    setAvailabilityForm({
      dayOfWeek: dayOfWeek ?? slot?.dayOfWeek ?? 1,
      startTime: slot?.startTime || "09:00",
      endTime: slot?.endTime || "17:00",
      timezone:
        slot?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "UTC",
    });
    setAvailabilityMessage("");
    setIsAvailabilityModalOpen(true);
  };

  const saveAvailability = async (event) => {
    event.preventDefault();
    setAvailabilityMessage("");
    if (!availabilityForm.startTime || !availabilityForm.endTime) {
      setAvailabilityMessage("Please provide both start and end times.");
      return;
    }
    if (availabilityForm.startTime >= availabilityForm.endTime) {
      setAvailabilityMessage("Start time must be before end time.");
      return;
    }

    const payload = {
      dayOfWeek: Number(availabilityForm.dayOfWeek),
      startTime: availabilityForm.startTime,
      endTime: availabilityForm.endTime,
      timezone: availabilityForm.timezone,
      active: true,
    };

    try {
      let response;
      if (editingAvailability?.id) {
        response = await client.patch(
          `/api/v1/availability/my-slots/${editingAvailability.id}`,
          payload,
        );
        const updated = response?.data?.data;
        setAvailabilitySlots((prev) =>
          prev.map((slot) => (slot.id === updated.id ? updated : slot)),
        );
        notify?.({
          type: "success",
          title: "Availability updated",
          message: "Your availability was saved.",
        });
      } else {
        response = await client.post("/api/v1/availability/my-slots", payload);
        const created = response?.data?.data;
        if (created) setAvailabilitySlots((prev) => [...prev, created]);
        notify?.({
          type: "success",
          title: "Availability added",
          message: "Your availability was saved.",
        });
      }
      setIsAvailabilityModalOpen(false);
      setEditingAvailability(null);
    } catch (error) {
      setAvailabilityMessage(
        getApiErrorMessage(error, "Could not save availability."),
      );
      notify?.({
        type: "error",
        title: "Save failed",
        message: getApiErrorMessage(error, "Could not save availability."),
      });
    }
  };
  const removeAvailability = async (slotId) => {
    try {
      await client.delete(`/api/v1/availability/my-slots/${slotId}`);
      setAvailabilitySlots((prev) => prev.filter((slot) => slot.id !== slotId));
      notify?.({
        type: "success",
        title: "Availability removed",
        message: "This window was deleted.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Delete failed",
        message: getApiErrorMessage(error, "Could not delete availability."),
      });
    }
  };

  const availabilityByDay = useMemo(() => {
    const slotMap = new Map();
    availabilitySlots.forEach((slot) => {
      const day = Number(slot?.dayOfWeek || 1);
      if (!slotMap.has(day)) slotMap.set(day, slot);
    });

    return DAYS.map((dayName, index) => {
      const dayNumber = index + 1;
      return {
        dayName,
        dayNumber,
        slot: slotMap.get(dayNumber),
      };
    });
  }, [availabilitySlots]);

  return (
    <div className="md-page space-y-6">
      <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-8 shadow-xl shadow-slate-200/40 transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface-variant">
              Mentor &gt; Manage Sessions
            </p>
            <h1 className="mt-3 text-[2.4rem] font-bold tracking-tight text-on-surface">
              Manage Sessions
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] font-normal leading-[1.6] text-on-surface-variant">
              Publish sessions, manage bookings, and keep your availability updated.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="inline-flex min-h-[50px] items-center justify-center rounded-[18px] bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => openSessionModal()}
            >
              + Create Session
            </button>
            <button
              type="button"
              className="inline-flex min-h-[50px] items-center justify-center rounded-[18px] border border-outline-variant/20 bg-surface-container-low px-6 py-3 text-sm font-semibold text-on-surface transition duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high"
              onClick={() => navigate("/mentor/calendar")}
            >
              Import Calendar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Sessions",
            value: stats.total,
            hint: "All published and historical sessions",
            icon: "calendar_month",
          },
          {
            label: "Active Sessions",
            value: stats.active,
            hint: "Upcoming sessions learners can book",
            icon: "bolt",
          },
          {
            label: "Pending Requests",
            value: stats.pending,
            hint: "Bookings awaiting your response",
            icon: "mail",
          },
          {
            label: "This Week",
            value: stats.thisWeek,
            hint: stats.trend,
            icon: "schedule",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="group min-h-[168px] rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 text-primary">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-xl">
                <span className="material-symbols-outlined">{card.icon}</span>
              </span>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                {card.label}
              </p>
            </div>
            <p className="mt-5 text-[40px] md:text-[44px] font-semibold leading-none text-on-surface">
              {card.value}
            </p>
            <p className="mt-3 text-[14px] leading-7 text-on-surface-variant">
              {card.hint}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface-variant">
                  Session Management
                </p>
                <h2 className="mt-2 text-[1.85rem] font-semibold text-on-surface">
                  Your Sessions
                </h2>
                <p className="mt-3 max-w-2xl text-[16px] font-normal leading-[1.6] text-on-surface-variant">
                  Manage your live sessions, keep bookings organized, and update
                  availability with confidence.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  onClick={() => openSessionModal()}
                >
                  + Create Session
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low px-6 py-3 text-sm font-semibold text-on-surface transition duration-200 hover:bg-surface-container-high"
                  onClick={() => navigate("/mentor/calendar")}
                >
                  Import Calendar
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[20px] border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Sessions live
                </p>
                <p className="mt-4 text-[40px] md:text-[44px] font-semibold text-on-surface">
                  {mentorSessions.length}
                </p>
                <p className="mt-2 text-[14px] text-on-surface-variant">
                  Total sessions currently available.
                </p>
              </div>
              <div className="rounded-[20px] border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Pending requests
                </p>
                <p className="mt-4 text-[40px] md:text-[44px] font-semibold text-on-surface">
                  {pendingRequests.length}
                </p>
                <p className="mt-2 text-[14px] text-on-surface-variant">
                  Requests waiting for your response.
                </p>
              </div>
              <div className="rounded-[20px] border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Upcoming only
                </p>
                <p className="mt-4 text-[40px] md:text-[44px] font-semibold text-on-surface">
                  {upcomingOnly ? "Yes" : "No"}
                </p>
                <p className="mt-2 text-[14px] text-on-surface-variant">
                  Showing {upcomingOnly ? "only upcoming" : "all"} sessions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-on-surface-variant">
                  Sessions overview
                </p>
                <h3 className="mt-2 text-[1.35rem] font-semibold text-on-surface">
                  Live sessions & controls
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition duration-200 ${statusFilter === tab.key ? "bg-primary text-on-primary" : "border border-outline-variant/20 bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
              <div className="relative w-full">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  search
                </span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search sessions..."
                  className="w-full rounded-full border border-outline-variant/20 bg-surface-container-low py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                  className="rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition duration-200 ${upcomingOnly ? "bg-primary text-on-primary" : "border border-outline-variant/20 bg-surface-container-low text-on-surface hover:bg-surface-container-high"}`}
                  onClick={() => setUpcomingOnly((prev) => !prev)}
                >
                  {upcomingOnly ? "Upcoming only" : "All dates"}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-outline-variant/15 bg-surface-container-lowest/60 px-4 py-3 text-sm">
              <p className="text-on-surface-variant">
                Showing {filteredSessions.length} of {mentorSessions.length}{" "}
                sessions
              </p>
              <p className="text-[13px] font-medium text-on-surface">
                {upcomingOnly ? "Upcoming only" : "All dates"}
              </p>
            </div>

            {loading ? (
              <div className="mt-6 rounded-[20px] border border-outline-variant/15 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="mt-6 rounded-[20px] border border-dashed border-outline-variant/30 bg-surface-container-lowest/70 p-12 text-center text-sm text-on-surface-variant shadow-sm flex flex-col items-center justify-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-[40px] mb-4">
                  <span className="material-symbols-outlined text-[40px]">calendar_month</span>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-on-surface">
                  No Sessions Published Yet
                </h3>
                <p className="mt-2 text-[15px] leading-6 text-on-surface-variant max-w-sm mx-auto">
                  Create your first mentoring session to start receiving bookings from learners.
                </p>
                <button
                  type="button"
                  className="mt-6 inline-flex rounded-[14px] bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition duration-200 hover:-translate-y-0.5 hover:opacity-90"
                  onClick={() => openSessionModal()}
                >
                  + Create Session
                </button>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[20px] border border-outline-variant/15 bg-surface-container-low shadow-sm">
                <table className="min-w-full border-separate border-spacing-0 text-left">
                  <thead className="bg-surface-container-lowest">
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Session
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Type
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Date & Time
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Price
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Seats
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Status
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => {
                      const status = getStatusLabel(session);
                      return (
                        <tr
                          key={session.id}
                          className="border-t border-outline-variant/10 transition-colors hover:bg-surface-container-lowest"
                        >
                          <td className="px-5 py-3 align-top">
                            <div className="font-semibold text-on-surface">
                              {session.title || "Untitled session"}
                            </div>
                            <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                              {session.description || "No description."}
                            </p>
                          </td>
                          <td className="px-5 py-3 align-top text-sm text-on-surface">
                            {session.sessionType || "Mentoring"}
                          </td>
                          <td className="px-5 py-3 align-top text-sm text-on-surface">
                            {formatDateTime(session.startTime)} —{" "}
                            {formatDateTime(session.endTime)}
                          </td>
                          <td className="px-5 py-3 align-top text-sm text-on-surface">
                            {formatCurrency(
                              session.priceAmount || session.pricePerHour || 0,
                            )}
                          </td>
                          <td className="px-5 py-3 align-top text-sm text-on-surface">
                            {session.maxParticipants || session.capacity || 1}
                          </td>
                          <td className="px-5 py-3 align-top">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeStyle(status)}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3 align-top">
                            <div className="relative inline-flex">
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveMenu(
                                    activeMenu === session.id
                                      ? null
                                      : session.id,
                                  );
                                }}
                              >
                                <span className="material-symbols-outlined text-base">
                                  more_horiz
                                </span>
                              </button>
                              {activeMenu === session.id && (
                                <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-2 shadow-lg">
                                  <button
                                    type="button"
                                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                                    onClick={() => {
                                      openSessionModal(session);
                                      setActiveMenu(null);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                                    onClick={() => {
                                      duplicateSession(session);
                                      setActiveMenu(null);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                                    onClick={() => {
                                      navigate(`/sessions/${session.id}`);
                                      setActiveMenu(null);
                                    }}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                                    onClick={() => {
                                      deleteSession(session.id);
                                      setActiveMenu(null);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-on-surface-variant">
                  Session Requests
                </p>
                <h2 className="mt-2 text-[1.2rem] font-semibold text-on-surface">
                  Pending Requests
                </h2>
              </div>
              <span className="rounded-full bg-surface-container-lowest px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
                {pendingRequests.length} open
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest/70 p-5 text-center text-sm text-on-surface-variant">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-base">
                      inbox
                    </span>
                  </div>
                  <h3 className="mt-4 text-[1rem] font-semibold text-on-surface">
                    No pending requests
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-on-surface-variant">
                    Requests will appear here as soon as learners book.
                  </p>
                  <Link
                    to="/mentor/messages"
                    className="mt-5 inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high"
                  >
                    View All Requests
                  </Link>
                </div>
              ) : (
                pendingRequests.slice(0, 4).map((booking) => (
                  <div
                    key={booking.id}
                    className="overflow-hidden rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      {booking.learner?.profileImageUrl ? (
                        <img
                          src={booking.learner.profileImageUrl}
                          alt={booking.learner.fullName}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-sm font-bold text-primary">
                          {String(booking.learner?.fullName || "?").charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface">
                          {booking.learner?.fullName || "Learner"}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                          {booking.session?.title || "Session request"}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                          {formatDateOnly(booking.session?.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90"
                        onClick={() =>
                          updateBookingStatus(booking.id, "ACCEPTED")
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                        onClick={() =>
                          updateBookingStatus(booking.id, "REJECTED")
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link
              to="/mentor/messages"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high"
            >
              View all requests
            </Link>
          </div>

          <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <span className="material-symbols-outlined text-base">
                  tips_and_updates
                </span>
              </span>
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Quick tips
                </p>
                <p className="text-sm text-on-surface-variant">
                  Keep the mentor experience polished and predictable.
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-on-surface-variant">
              {[
                "Publish sessions regularly",
                "Keep your availability updated",
                "Respond to requests quickly",
                "Keep session details concise",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-low text-primary">
                    <span className="material-symbols-outlined text-sm">
                      check
                    </span>
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low p-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-on-surface-variant">
              Availability
            </p>
            <h2 className="mt-2 text-[1.35rem] font-semibold text-on-surface sm:text-[1.5rem]">
              Availability
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-200 hover:-translate-y-0.5 hover:opacity-90"
            onClick={() => openAvailabilityModal()}
          >
            + Add Time
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {availabilityByDay.map(({ dayName, dayNumber, slot }) => (
            <div
              key={dayName}
              className="rounded-[20px] border border-outline-variant/15 bg-surface-container-lowest/70 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-on-surface">
                    {dayName}
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">
                    {slot ? `${slot.startTime} – ${slot.endTime}` : "No availability added"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${slot?.active ? "bg-emerald-500/10 text-emerald-700" : "bg-surface-container-high text-on-surface-variant"}`}
                >
                  {slot ? (slot.active ? "Active" : "Open") : "Closed"}
                </span>
              </div>
              {slot && (
                <p className="mt-3 text-[12px] text-on-surface-variant">
                  {slot.timezone || "Timezone not set"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {slot ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                      onClick={() => openAvailabilityModal(slot)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => removeAvailability(slot.id)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                    onClick={() => openAvailabilityModal(null, dayNumber)}
                  >
                    + Add Time
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {availabilityMessage && (
          <p className="mt-4 text-sm font-semibold text-primary">
            {availabilityMessage}
          </p>
        )}
      </section>

      {(isSessionModalOpen || isAvailabilityModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6 shadow-2xl">
            {isSessionModalOpen ? (
              <form onSubmit={saveSession} className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-on-surface-variant">
                      {editingSession ? "Edit session" : "Create session"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-on-surface">
                      {editingSession ? "Update session" : "New session"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
                    onClick={() => setIsSessionModalOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Title
                    </span>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(event) =>
                        handleSessionChange("title", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.title ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.title && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.title}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Type
                    </span>
                    <input
                      type="text"
                      value={sessionForm.sessionType}
                      onChange={(event) =>
                        handleSessionChange("sessionType", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.sessionType ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.sessionType && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.sessionType}
                      </span>
                    )}
                  </label>
                  <label className="sm:col-span-2 grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Description
                    </span>
                    <textarea
                      rows={4}
                      value={sessionForm.description}
                      onChange={(event) =>
                        handleSessionChange("description", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.description ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.description && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.description}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Start
                    </span>
                    <input
                      type="datetime-local"
                      value={sessionForm.startTime}
                      onChange={(event) =>
                        handleSessionChange("startTime", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.startTime ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.startTime && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.startTime}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      End
                    </span>
                    <input
                      type="datetime-local"
                      value={sessionForm.endTime}
                      onChange={(event) =>
                        handleSessionChange("endTime", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.endTime ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.endTime && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.endTime}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Price
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sessionForm.priceAmount}
                      onChange={(event) =>
                        handleSessionChange("priceAmount", event.target.value)
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.priceAmount ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.priceAmount && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.priceAmount}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Seats
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={sessionForm.maxParticipants}
                      onChange={(event) =>
                        handleSessionChange(
                          "maxParticipants",
                          event.target.value,
                        )
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none ${sessionErrors.maxParticipants ? "border-rose-300" : "border-outline-variant/20"}`}
                    />
                    {sessionErrors.maxParticipants && (
                      <span className="text-xs text-rose-600">
                        {sessionErrors.maxParticipants}
                      </span>
                    )}
                  </label>
                  <label className="sm:col-span-2 grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Meeting link
                    </span>
                    <input
                      type="url"
                      value={sessionForm.meetingLink}
                      onChange={(event) =>
                        handleSessionChange("meetingLink", event.target.value)
                      }
                      placeholder="https://meet.example.com/..."
                      className="rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none border-outline-variant/20 bg-surface-container-lowest"
                    />
                  </label>
                </div>

                {sessionMessage && (
                  <p className="text-sm font-semibold text-primary">
                    {sessionMessage}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="rounded-full border border-outline-variant/20 bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                    onClick={() => setIsSessionModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90"
                  >
                    {editingSession ? "Save changes" : "Publish session"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveAvailability} className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-on-surface-variant">
                      {editingAvailability
                        ? "Edit availability"
                        : "Add availability"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-on-surface">
                      {editingAvailability
                        ? "Update availability"
                        : "New availability"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
                    onClick={() => {
                      setIsAvailabilityModalOpen(false);
                      setEditingAvailability(null);
                    }}
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Day
                    </span>
                    <select
                      value={availabilityForm.dayOfWeek}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          dayOfWeek: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none border-outline-variant/20 bg-surface-container-lowest"
                    >
                      {DAYS.map((day, index) => (
                        <option key={day} value={index + 1}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Timezone
                    </span>
                    <input
                      type="text"
                      value={availabilityForm.timezone}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          timezone: event.target.value,
                        }))
                      }
                      className="rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none border-outline-variant/20 bg-surface-container-lowest"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      Start time
                    </span>
                    <input
                      type="time"
                      value={availabilityForm.startTime}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          startTime: event.target.value,
                        }))
                      }
                      className="rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none border-outline-variant/20 bg-surface-container-lowest"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      End time
                    </span>
                    <input
                      type="time"
                      value={availabilityForm.endTime}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          endTime: event.target.value,
                        }))
                      }
                      className="rounded-2xl border px-4 py-3 text-sm text-on-surface focus:outline-none border-outline-variant/20 bg-surface-container-lowest"
                    />
                  </label>
                </div>

                {availabilityMessage && (
                  <p className="text-sm font-semibold text-primary">
                    {availabilityMessage}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="rounded-full border border-outline-variant/20 bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                    onClick={() => {
                      setIsAvailabilityModalOpen(false);
                      setEditingAvailability(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90"
                  >
                    {editingAvailability
                      ? "Save availability"
                      : "Add availability"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="fixed bottom-6 right-6 z-50 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-lg">
          {loadError}
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
