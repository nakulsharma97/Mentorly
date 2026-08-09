const STATUS_TOKENS = {
  REQUESTED: {
    label: "Requested",
    chip: "bg-amber-100 text-amber-800",
    action: "Wait for mentor confirmation",
  },
  PENDING: {
    label: "Requested",
    chip: "bg-amber-100 text-amber-800",
    action: "Wait for mentor confirmation",
  },
  CONFIRMED: {
    label: "Confirmed",
    chip: "bg-emerald-100 text-emerald-800",
    action: "Prepare for the session",
  },
  ACCEPTED: {
    label: "Confirmed",
    chip: "bg-emerald-100 text-emerald-800",
    action: "Prepare for the session",
  },
  RESCHEDULE_REQUESTED: {
    label: "Reschedule Requested",
    chip: "bg-sky-100 text-sky-800",
    action: "Review schedule update in messages",
  },
  COMPLETED: {
    label: "Completed",
    chip: "bg-indigo-100 text-indigo-800",
    action: "Share a review and book next",
  },
  CANCELLED: {
    label: "Cancelled",
    chip: "bg-rose-100 text-rose-800",
    action: "Book another slot",
  },
  REJECTED: {
    label: "Declined",
    chip: "bg-rose-100 text-rose-800",
    action: "Try another mentor",
  },
};

export const getBookingStatusMeta = (booking) => {
  const raw = String(
    booking?.bookingStatus || booking?.status || "",
  ).toUpperCase();
  return (
    STATUS_TOKENS[raw] || {
      label: raw || "Pending",
      chip: "bg-slate-100 text-slate-700",
      action: "Check details in messages",
    }
  );
};

