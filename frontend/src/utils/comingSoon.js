const COMING_SOON_CONTENT = {
  directScheduler:
    "Choose a mentor profile, review open sessions, and book the slot that fits your plan.",
  voiceCall: "Open the saved meeting link to start a voice call.",
  videoCall: "Open the saved meeting link to start a video call.",
  attachments: "Choose files from your device and send them as attachment notes.",
  imageSharing: "Choose images from your device and send them as attachment notes.",
  emojiPicker: "Emoji inserted into the message composer.",
  advancedFilters:
    "Use the current skill filters, resources, and analytics to narrow what matters most.",
  schedulePrev: "Previous date-range controls use the current dashboard schedule.",
  scheduleNext: "Next date-range controls use the current dashboard schedule.",
  sessionOptions: "Open the sessions manager to edit this session.",
};

const INFO_CONTENT = {
  sessionOpened: ({ name }) => ({
    title: "Session",
    message: `Opened ${name || "session"}.`,
  }),
  composer: {
    title: "Composer",
    message: "Select a conversation and use the message box to start chatting.",
  },
  conversationInfo: ({ bookingId, memberName }) => ({
    title: "Conversation",
    message: `Booking #${bookingId || "-"} with ${memberName || "member"}.`,
  }),
  missingMeetingLink: {
    title: "Session Link",
    message:
      "No meeting link is saved yet for this session. Add one in the sessions view.",
  },
  bookingUpdatedStatus: ({ bookingId, status }) => ({
    title: "Booking",
    message: `Booking ${bookingId || "-"} updated to ${status || "UPDATED"}.`,
  }),
  bookingRequestMoved: ({ status }) => ({
    title: "Booking",
    message: `Request moved to ${status || "UPDATED"}.`,
  }),
  reviewLoginRequired: {
    title: "Review",
    message: "Please log in to submit a review.",
  },
  reviewChooseCompletedBooking: {
    title: "Review",
    message: "Please choose a completed booking.",
  },
  reviewThanks: {
    title: "Review",
    message: "Thanks for your review.",
  },
  portfolioSaved: {
    title: "Profile",
    message: "Portfolio saved successfully.",
  },
  sessionPackageCreated: {
    title: "Packages",
    message: "Session package created.",
  },
  verificationTaskCreated: {
    title: "Verification",
    message: "Verification task created.",
  },
  verificationTaskSubmitted: {
    title: "Verification",
    message: "Task submitted for review.",
  },
  verificationSubmissionMarked: ({ status }) => ({
    title: "Verification",
    message: `Submission marked as ${status || "UPDATED"}.`,
  }),
  watchlistMentorSaved: {
    title: "Watchlist",
    message: "Mentor saved to watchlist.",
  },
  watchlistSkillAdded: {
    title: "Watchlist",
    message: "Skill added to watchlist.",
  },
  availabilitySlotAdded: {
    title: "Availability",
    message: "Availability slot added.",
  },
  safetyUserBlocked: {
    title: "Safety",
    message: "User blocked.",
  },
  safetyReportSubmitted: {
    title: "Safety",
    message: "Report submitted to moderation queue.",
  },
  safetyReportEscalated: {
    title: "Safety",
    message: "Report escalated successfully.",
  },
  mentorVerificationSubmitted: {
    title: "Verification",
    message: "Verification request submitted.",
  },
  mentorVerificationMarked: ({ status }) => ({
    title: "Verification",
    message: `Verification request marked ${status || "UPDATED"}.`,
  }),
  learnerReviewSubmitted: {
    title: "Review",
    message: "Learner review submitted.",
  },
  mentorSearchEnterKeyword: {
    title: "Mentor Search",
    message: "Enter a skill or keyword to search mentors.",
  },
  mentorSearchLoginToBook: {
    title: "Mentor Search",
    message: "Please log in to book a session.",
  },
  mentorSearchNoUpcoming: {
    title: "Mentor Search",
    message: "This mentor has no upcoming sessions to book right now.",
  },
  mentorSearchWaitlistAdded: {
    title: "Mentor Search",
    message:
      "Session was full. You were added to the waitlist for the nearest slot.",
  },
  mentorSearchBookedNearest: ({ title, dateTime }) => ({
    title: "Mentor Search",
    message: `Booked nearest session: ${title || "session"} on ${dateTime || "scheduled time"}.`,
  }),
};

const ERROR_CONTENT = {
  genericRetry: {
    title: "Error",
    message: "Please try again.",
  },
  mentorProfileLoadFailed: {
    title: "Mentor Profile",
    message: "Could not load mentor profile. Please try again.",
  },
  reviewSubmitFailed: {
    title: "Review",
    message: "Could not submit review.",
  },
  bookingRetryConflict: {
    title: "Booking",
    message: "Temporary booking conflict. Please retry.",
  },
  roadmapLoadFailed: {
    title: "Roadmap",
    message:
      "Unable to load roadmap progress. Check backend connection and retry.",
  },
  roadmapLoadHint: {
    title: "Roadmap",
    message: "Start backend on port 8080 or retry when network is stable.",
  },
  analyticsLoadFailed: {
    title: "Analytics",
    message:
      "Unable to fetch analytics data right now. Showing fallback insights.",
  },
  mentorWorkspaceLoadFailed: {
    title: "Workspace",
    message:
      "Unable to load mentor workspace. Check backend connection and retry.",
  },
  mentorWorkspaceLoadHint: {
    title: "Workspace",
    message: "Start backend on port 8080 or retry the load.",
  },
  mentorMetricsPartial: {
    title: "Workspace",
    message:
      "Some mentor metrics could not be loaded. Retry to get the latest data.",
  },
  bookingStatusUpdateFailed: {
    title: "Booking",
    message: "Unable to update booking status. Please retry in a few seconds.",
  },
  conversationsLoadFailed: {
    title: "Conversations",
    message:
      "Unable to load conversations. Check backend connection and retry.",
  },
  conversationsLoadHint: {
    title: "Conversations",
    message: "Start backend on port 8080 or retry in a moment.",
  },
  chatHistoryLoadFailed: {
    title: "Chat",
    message: "Unable to load this chat history. Retry from the panel below.",
  },
  realtimeMessageParseFailed: {
    title: "Realtime",
    message: "A realtime message could not be parsed.",
  },
  messageSendFailed: {
    title: "Chat",
    message: "Message send failed. Check connection and retry.",
  },
  messageSendFailedToast: {
    title: "Chat",
    message: "Your message could not be sent. Please retry.",
  },
  dashboardBookingStatusUpdateFailed: {
    title: "Booking",
    message: "Could not update booking status.",
  },
  saveMeetingLinkFailed: {
    title: "Session Link",
    message: "Could not save meeting link for this session.",
  },
  savePortfolioFailed: {
    title: "Profile",
    message: "Failed to save portfolio.",
  },
  createPackageFailed: {
    title: "Packages",
    message: "Failed to create package.",
  },
  createVerificationTaskFailed: {
    title: "Verification",
    message: "Failed to create verification task.",
  },
  submitVerificationTaskFailed: {
    title: "Verification",
    message: "Could not submit verification task.",
  },
  reviewVerificationSubmissionFailed: {
    title: "Verification",
    message: "Could not review submission.",
  },
  updateRoadmapProgressFailed: {
    title: "Roadmap",
    message: "Could not update roadmap progress.",
  },
  markNotificationReadFailed: {
    title: "Notifications",
    message: "Could not mark notification as read.",
  },
  markAllNotificationsReadFailed: {
    title: "Notifications",
    message: "Could not mark all notifications as read.",
  },
  mentorSearchFailed: {
    title: "Mentor Search",
    message: "Mentor search failed. Please try again.",
  },
  mentorSearchNoMatches: {
    title: "Mentor Search",
    message: "No mentors matched this search. Try another skill.",
  },
  mentorSearchNoValidSession: {
    title: "Mentor Search",
    message: "Could not find a valid upcoming session for this mentor.",
  },
  mentorSearchWaitlistFailed: {
    title: "Mentor Search",
    message: "Session is full and waitlist join failed. Please try again.",
  },
  mentorSearchBookFailed: {
    title: "Mentor Search",
    message: "Could not book session from search result.",
  },
  dashboardReducedFeaturesProfilePending: {
    title: "Dashboard",
    message: "Dashboard loaded with reduced features - profile sync pending.",
  },
  dashboardLoadingBasicView: {
    title: "Dashboard",
    message: "Dashboard loading error - basic view available.",
  },
  dashboardChatHistoryLoadFailed: {
    title: "Chat",
    message: "Unable to load chat history for this booking.",
  },
  dashboardRealtimeMalformedMessage: {
    title: "Realtime",
    message: "Received malformed realtime message.",
  },
  dashboardRealtimeConnectionError: {
    title: "Realtime",
    message: "Realtime connection error. You can still send by retrying.",
  },
  paymentIntentCreateFailed: {
    title: "Payments",
    message: "Could not create payment intent. Check booking and amount.",
  },
  paymentStatusUpdateFailed: {
    title: "Payments",
    message: "Failed to update payment status.",
  },
  watchlistSaveMentorFailed: {
    title: "Watchlist",
    message: "Could not save mentor.",
  },
  watchlistRemoveMentorFailed: {
    title: "Watchlist",
    message: "Could not remove mentor.",
  },
  watchlistAddSkillFailed: {
    title: "Watchlist",
    message: "Could not add skill.",
  },
  watchlistRemoveSkillFailed: {
    title: "Watchlist",
    message: "Could not remove skill.",
  },
  availabilityAddSlotFailed: {
    title: "Availability",
    message: "Could not add availability slot.",
  },
  availabilityDeleteSlotFailed: {
    title: "Availability",
    message: "Could not delete availability slot.",
  },
  availabilityOverlapFetchFailed: {
    title: "Availability",
    message: "Could not fetch overlap slots.",
  },
  availabilityRecommendationsFetchFailed: {
    title: "Availability",
    message: "Could not fetch smart recommendations.",
  },
  safetyBlockUserFailed: {
    title: "Safety",
    message: "Could not block user.",
  },
  safetySubmitReportFailed: {
    title: "Safety",
    message: "Could not submit report.",
  },
  safetyEscalateReportFailed: {
    title: "Safety",
    message: "Could not escalate report.",
  },
  mentorVerificationSubmitFailed: {
    title: "Verification",
    message: "Could not submit verification request.",
  },
  mentorVerificationUpdateFailed: {
    title: "Verification",
    message: "Could not update verification request.",
  },
  learnerReviewSubmitFailed: {
    title: "Review",
    message: "Could not submit learner review.",
  },
  dashboardChatSendFailed: {
    title: "Chat",
    message: "Unable to send message right now.",
  },
  recommendationsLoadFailed: {
    title: "Recommendations",
    message: "Could not load recommendations right now.",
  },
  profileSetupMissingSkills: {
    title: "Missing skills",
    message: "Please add at least one skill tag before saving.",
  },
  profileSetupInvalidLinks: {
    title: "Invalid profile links",
    message:
      "Please provide full URLs for GitHub and LinkedIn (include https://).",
  },
  profileSetupSaveFailed: {
    title: "Profile update failed",
    message: "Could not save profile. Please check required fields and retry.",
  },
};

export const getComingSoonFeedback = (key) => ({
  title: "Feature",
  message: COMING_SOON_CONTENT[key] || "This feature is available from the matching workflow.",
});

export const showComingSoon = ({ key, notify, setInlineMessage }) => {
  const feedback = getComingSoonFeedback(key);

  if (notify) {
    notify({ type: "info", title: feedback.title, message: feedback.message });
    return feedback;
  }

  if (setInlineMessage) {
    setInlineMessage(`${feedback.title}: ${feedback.message}`);
  }

  return feedback;
};

export const getInfoFeedback = (key, params = {}) => {
  const entry = INFO_CONTENT[key];
  if (!entry) {
    return { title: "Info", message: "Action completed." };
  }

  return typeof entry === "function" ? entry(params) : entry;
};

export const showInfoFeedback = ({ key, params, notify, setInlineMessage }) => {
  const feedback = getInfoFeedback(key, params);

  if (notify) {
    notify({ type: "info", title: feedback.title, message: feedback.message });
    return feedback;
  }

  if (setInlineMessage) {
    setInlineMessage(`${feedback.title}: ${feedback.message}`);
  }

  return feedback;
};

export const getErrorFeedback = (key, params = {}) => {
  const entry = ERROR_CONTENT[key];
  if (!entry) {
    return { title: "Error", message: ERROR_CONTENT.genericRetry.message };
  }

  return typeof entry === "function" ? entry(params) : entry;
};

export const showErrorFeedback = ({
  key,
  params,
  notify,
  setInlineMessage,
}) => {
  const feedback = getErrorFeedback(key, params);

  if (notify) {
    notify({ type: "error", title: feedback.title, message: feedback.message });
    return feedback;
  }

  if (setInlineMessage) {
    setInlineMessage(`${feedback.title}: ${feedback.message}`);
  }

  return feedback;
};
