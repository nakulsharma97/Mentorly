import { http, HttpResponse } from "msw";

const now = Date.now();

const mockBookings = [
  {
    id: 101,
    bookingStatus: "PENDING",
    learner: { id: 11, fullName: "Learner One" },
    session: {
      id: 501,
      title: "React Fundamentals",
      startTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      mentor: { id: 21, fullName: "Mentor Prime" },
      skill: { name: "React" },
    },
    payment: { amount: 0 },
  },
  {
    id: 102,
    bookingStatus: "COMPLETED",
    learner: { id: 12, fullName: "Learner Two" },
    session: {
      id: 502,
      title: "Spring Boot API Design",
      startTime: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      mentor: { id: 21, fullName: "Mentor Prime" },
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

export const handlers = [
  http.get("*/api/v1/bookings", () => {
    return HttpResponse.json({ data: mockBookings });
  }),
  http.get("*/api/v1/roadmaps", () => {
    return HttpResponse.json({ data: mockRoadmaps });
  }),
  http.get("*/api/v1/watchlist", () => {
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
