import { http, HttpResponse, ws } from "msw";

const now = Date.now();

// Mirrors the REAL backend shape: users.skills is a comma-separated string and
// SkillSession serializes a computed sessionSkills: List<String> array. Any
// test rendering these must normalize before .map/.slice (see utils/skills.js).
const mockBookings = [
  {
    id: 101,
    bookingStatus: "PENDING",
    paymentStatus: "PENDING",
    learner: { id: 11, fullName: "Learner One" },
    session: {
      id: 501,
      title: "React Fundamentals",
      startTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now + 24 * 60 * 60 * 1000 + 60 * 60000).toISOString(),
      priceAmount: 999,
      meetingProvider: "GOOGLE_CALENDAR",
      liveSessionStatus: "SCHEDULED",
      sessionSkills: ["React", "JavaScript", "Redux"],
      mentor: { id: 21, fullName: "Mentor Prime", skills: "React, JavaScript, Redux" },
      skill: { name: "React" },
    },
    payment: { amount: 0 },
  },
  {
    id: 102,
    bookingStatus: "COMPLETED",
    paymentStatus: "COMPLETED",
    learner: { id: 12, fullName: "Learner Two" },
    session: {
      id: 502,
      title: "Spring Boot API Design",
      startTime: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now - 7 * 24 * 60 * 60 * 1000 + 90 * 60000).toISOString(),
      priceAmount: 1499,
      meetingProvider: "GOOGLE_CALENDAR",
      liveSessionStatus: "ENDED",
      sessionSkills: ["Java", "Spring Boot", "REST APIs"],
      mentor: { id: 21, fullName: "Mentor Prime", skills: "Java, Spring Boot, REST APIs" },
      skill: { name: "Spring Boot" },
    },
    payment: { amount: 1000 },
  },
];

const mockRoadmaps = [
  {
    id: 301,
    title: "Full-Stack Roadmap",
    mentorName: "Mentor Prime",
    progressPercent: 50,
    milestones: [{}, {}],
  },
];

const mockSessions = [
  {
    id: 601,
    title: "Mentor Upcoming Session",
    startTime: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    pricePerHour: 1200,
    confirmedBookings: 1,
    skill: { name: "React" },
  },
];

const mockReviews = [
  {
    id: 401,
    rating: 5,
    comment: "Great session!",
    learner: { id: 11, fullName: "Learner One" },
  },
];

// Accept the NotificationCenter real-time WebSocket connection in unit tests.
// The component opens ws://<host>/ws/notifications on mount; without a
// matching handler, MSW logs "intercepted a WebSocket connection without a
// matching event handler". The virtual connection is closed on unmount.
const notificationSocket = ws.link("*/ws/notifications");

export const handlers = [
  notificationSocket.addEventListener("connection", () => {
    // Connection accepted — no server frames are needed in unit tests.
  }),

  http.get("*/api/v1/bookings", () => {
    return HttpResponse.json({ data: mockBookings });
  }),
  http.get("*/api/v1/roadmaps", () => {
    return HttpResponse.json({ data: mockRoadmaps });
  }),
  http.get("*/api/v1/watchlist/skills", () => {
    return HttpResponse.json({ data: [] });
  }),
  http.get("*/api/v1/watchlist/mentors", () => {
    return HttpResponse.json({ data: [] });
  }),
  http.get("*/api/v1/favorites", () => {
    return HttpResponse.json({ data: [] });
  }),
  http.get("*/api/v1/favorites/check/*", () => {
    return HttpResponse.json({ data: false });
  }),
  http.post("*/api/v1/favorites/*", () => {
    return HttpResponse.json({ data: { id: 1, mentorId: 1 } });
  }),
  http.delete("*/api/v1/favorites/*", () => {
    return HttpResponse.json({ data: true });
  }),
  http.get("*/api/v1/users/mentors", () => {
    return HttpResponse.json({ data: [] });
  }),
  http.get("*/api/v1/certifications/me", () => {
    return HttpResponse.json({ data: [] });
  }),
  http.get("*/api/v1/users/me/referral", () => {
    return HttpResponse.json({
      data: {
        referralCode: "SKILLSWAP",
        totalReferrals: 3,
        totalCreditsEarned: 150,
      },
    });
  }),
  http.get("*/api/v1/sessions", () => {
    return HttpResponse.json({ data: mockSessions });
  }),
  http.get("*/api/v1/reviews/mentor", () => {
    return HttpResponse.json({ data: mockReviews });
  }),
  http.get("*/api/v1/verification/mentor/status", () => {
    return HttpResponse.json({ data: null });
  }),
  http.post("*/api/v1/certifications/evaluate", () => {
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),
];
