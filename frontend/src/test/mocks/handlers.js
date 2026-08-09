import { http, HttpResponse, ws } from "msw";

const now = Date.now();

// Mirrors the REAL backend shape: users.skills is a comma-separated string and
// SkillSession serializes a computed sessionSkills: List<String> array. Any
// test rendering these must normalize before .map/.slice (see utils/skills.js).
// Mirrors the real backend shapes (raw Booking entity with nested
// session/learner/payment, raw SkillSession entity with sessionSkills,
// and the ReviewSummaryResponse object for /reviews/mentor).
const mockBookings = [
  {
    id: 101,
    bookingStatus: "PENDING",
    paymentStatus: "PENDING",
    learner: { id: 11, fullName: "Learner One", displayUsername: "learner1" },
    session: {
      id: 501,
      title: "React Fundamentals",
      startTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now + 24 * 60 * 60 * 1000 + 60 * 60000).toISOString(),
      priceAmount: 999,
      meetingProvider: "GOOGLE_CALENDAR",
      liveSessionStatus: "SCHEDULED",
      sessionSkills: ["React", "JavaScript", "Redux"],
      mentor: { id: 21, fullName: "Mentor Prime" },
    },
    payment: { amount: 0 },
  },
  {
    id: 102,
    bookingStatus: "COMPLETED",
    paymentStatus: "COMPLETED",
    learner: { id: 12, fullName: "Learner Two", displayUsername: "learner2" },
    session: {
      id: 502,
      title: "Spring Boot API Design",
      startTime: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now - 7 * 24 * 60 * 60 * 1000 + 90 * 60000).toISOString(),
      priceAmount: 1499,
      meetingProvider: "GOOGLE_CALENDAR",
      liveSessionStatus: "ENDED",
      sessionSkills: ["Java", "Spring Boot", "REST APIs"],
      mentor: { id: 21, fullName: "Mentor Prime" },
    },
    payment: { amount: 1000 },
  },
  {
    id: 103,
    bookingStatus: "ACCEPTED",
    paymentStatus: "COMPLETED",
    learner: { id: 13, fullName: "Learner Three", displayUsername: "learner3" },
    session: {
      id: 503,
      title: "System Design Deep Dive",
      startTime: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now + 3 * 24 * 60 * 60 * 1000 + 90 * 60000).toISOString(),
      priceAmount: 1999,
      meetingProvider: "GOOGLE_CALENDAR",
      liveSessionStatus: "SCHEDULED",
      sessionSkills: ["System Design", "Scalability"],
      mentor: { id: 21, fullName: "Mentor Prime" },
    },
    payment: { amount: 1999 },
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
    endTime: new Date(now + 48 * 60 * 60 * 1000 + 60 * 60000).toISOString(),
    priceAmount: 1200,
    status: "PENDING",
    sessionSkills: ["React", "JavaScript"],
  },
];

// GET /api/v1/reviews/mentor returns a ReviewSummaryResponse OBJECT
// (not an array): { averageRating, totalReviews, reviews: [...] }.
const mockReviews = {
  averageRating: 4.8,
  totalReviews: 1,
  recommendationRate: 100,
  fiveStarReviews: 1,
  distribution: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 },
  reviews: [
    {
      id: 401,
      mentorId: 21,
      learnerId: 11,
      learnerName: "Learner One",
      learnerUsername: "learner1",
      rating: 5,
      comment: "Great session!",
      replyText: null,
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

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
