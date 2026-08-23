import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { beforeEach } from "vitest";
import LearnerLearningPage from "./LearnerLearningPage";
import { server } from "../test/mocks/server";
import { clearGetCache } from "../api/client";

// A start time inside the CURRENT month so the calendar grid renders the chip.
const thisMonthEvent = (day, hour) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const date = new Date(now.getFullYear(), now.getMonth(), Math.min(day, daysInMonth), hour, 0, 0, 0);
  return date.toISOString();
};

const upcomingStart = thisMonthEvent(12, 16);
const upcomingEnd = new Date(new Date(upcomingStart).getTime() + 60 * 60000).toISOString();

const dashboard = {
  learnerName: "Aisha Khan",
  overview: { completedSessions: 18, upcomingSessions: 3, learningHours: 42, activeMentors: 4, certificates: 3, notes: 5 },
  continueLearning: {
    type: "UPCOMING",
    bookingId: 30,
    sessionId: 5,
    title: "React Basics",
    description: "Learn React fundamentals.",
    mentorId: 21,
    mentorName: "Ankit Verma",
    mentorPhotoUrl: null,
    durationMinutes: 60,
    date: upcomingStart,
    startTime: upcomingStart,
    status: "CONFIRMED",
    meetingLink: "https://meet.google.com/abc-defg",
    canJoin: true,
    hasNote: false,
  },
  timeline: [
    {
      bookingId: 30,
      sessionId: 5,
      eventType: "SESSION_ACCEPTED",
      eventLabel: "Session Accepted",
      topic: "React Basics",
      mentorId: 21,
      mentorName: "Ankit Verma",
      mentorPhotoUrl: null,
      eventTime: upcomingStart,
      status: "CONFIRMED",
      durationMinutes: 60,
    },
    {
      bookingId: 11,
      sessionId: 1,
      eventType: "SESSION_COMPLETED",
      eventLabel: "Session Completed",
      topic: "Spring Boot REST API",
      mentorId: 20,
      mentorName: "Rahul Sharma",
      mentorPhotoUrl: null,
      eventTime: "2026-08-06T12:00:00Z",
      status: "COMPLETED",
      durationMinutes: 120,
    },
    {
      bookingId: 10,
      sessionId: 2,
      eventType: "SESSION_COMPLETED",
      eventLabel: "Session Completed",
      topic: "Java Collections",
      mentorId: 20,
      mentorName: "Rahul Sharma",
      mentorPhotoUrl: null,
      eventTime: "2026-08-04T12:00:00Z",
      status: "COMPLETED",
      durationMinutes: 90,
    },
  ],
  activeMentors: [
    {
      mentorId: 20,
      name: "Rahul Sharma",
      photoUrl: null,
      specialization: "Senior Java Developer",
      totalSessions: 3,
      upcomingSessions: 1,
      rating: 4.8,
    },
  ],
  calendar: [
    {
      bookingId: 30,
      sessionId: 5,
      title: "React Basics",
      mentorId: 21,
      mentorName: "Ankit Verma",
      startTime: upcomingStart,
      endTime: upcomingEnd,
      meetingLink: "https://meet.google.com/abc-defg",
      canJoin: true,
      durationMinutes: 60,
      status: "CONFIRMED",
    },
  ],
  todos: [{ id: 1, task: "Complete Java assignment", done: false }],
  todoSuggestions: [{ key: "attend-30", text: "Attend upcoming session: React Basics" }],
  recentActivity: [
    { type: "SCHEDULED", title: "Scheduled a session", detail: "React Basics", timestamp: upcomingStart },
    { type: "COMPLETED", title: "Completed a session", detail: "Spring Boot REST API", timestamp: "2026-08-06T12:00:00Z" },
  ],
  statistics: {
    sessionsCompleted: 18,
    learningHours: 42,
    mentorsLearnedFrom: 4,
    certificatesEarned: 3,
    projectsCompleted: 7,
    notesCreated: 5,
    currentStreak: 2,
    monthlyHours: 12,
    upcomingSessions: 3,
  },
  hasCertificates: true,
};

const emptyDashboard = {
  learnerName: "Aisha Khan",
  overview: { completedSessions: 0, upcomingSessions: 0, learningHours: 0, activeMentors: 0, certificates: 0, notes: 0 },
  continueLearning: null,
  timeline: [],
  activeMentors: [],
  calendar: [],
  todos: [],
  todoSuggestions: [],
  recentActivity: [],
  statistics: {
    sessionsCompleted: 0,
    learningHours: 0,
    mentorsLearnedFrom: 0,
    certificatesEarned: 0,
    projectsCompleted: 0,
    notesCreated: 0,
    currentStreak: 0,
    monthlyHours: 0,
    upcomingSessions: 0,
  },
  hasCertificates: false,
};

const historyPage = {
  items: [
    {
      bookingId: 11,
      sessionId: 1,
      title: "Spring Boot REST API",
      description: "Build a production REST service.",
      mentorId: 20,
      mentorName: "Rahul Sharma",
      mentorPhotoUrl: null,
      date: "2026-08-06T12:00:00Z",
      durationMinutes: 120,
      status: "COMPLETED",
      hasNote: false,
    },
  ],
  total: 1,
  page: 0,
  size: 8,
  totalPages: 1,
  certificatesAvailable: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/learner/learning"]}>
      <LearnerLearningPage />
    </MemoryRouter>,
  );
}

function stubDashboard(payload = dashboard) {
  server.use(
    http.get("*/api/v1/learning/dashboard", () => HttpResponse.json({ data: payload })),
    http.get("*/api/v1/learning/history", () => HttpResponse.json({ data: historyPage })),
  );
}

describe("LearnerLearningPage", () => {
  beforeEach(() => { server.resetHandlers(); clearGetCache(); });
  afterEach(() => { server.resetHandlers(); clearGetCache(); });

  it("renders the hero greeting and all dashboard sections", async () => {
    stubDashboard();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening)/)).toBeInTheDocument();
    });
    // Greeting + first name from the backend payload.
    expect(screen.getByText(/Aisha/)).toBeInTheDocument();

    // Hero quick-stats and Learning Overview numbers from the backend.
    expect(screen.getAllByText("18").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42 Hrs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upcoming Sessions").length).toBeGreaterThan(0);

    // All section headings render.
    expect(screen.getByText("Learning Overview")).toBeInTheDocument();
    expect(screen.getAllByText(/Continue Learning/).length).toBeGreaterThan(0);
    expect(screen.getByText("Session Timeline")).toBeInTheDocument();
    expect(screen.getByText("Learning History")).toBeInTheDocument();
    expect(screen.getAllByText("Active Mentors").length).toBeGreaterThan(0);
    expect(screen.getByText("Learning Calendar")).toBeInTheDocument();
    expect(screen.getByText("Today's Todo List")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Learning Statistics")).toBeInTheDocument();

    // Statistics mini cards.
    expect(screen.getByText("Sessions Completed")).toBeInTheDocument();
    expect(screen.getByText("Certificates Earned")).toBeInTheDocument();
  });

  it("renders priority continue learning, timeline, mentors, calendar and todos", async () => {
    stubDashboard();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Spring Boot REST API/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThan(0);
    expect(screen.getByText("Java Collections")).toBeInTheDocument();
    expect(screen.getByText("Senior Java Developer")).toBeInTheDocument();

    // Continue Learning shows the accepted UPCOMING session with its actions.
    expect(screen.getByText("Upcoming Session")).toBeInTheDocument();
    expect(screen.getByText("Add Reminder")).toBeInTheDocument();
    expect(screen.getByText("View Session")).toBeInTheDocument();

    // Calendar event chip opens a session detail modal with a join link.
    fireEvent.click(screen.getByTitle("React Basics"));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Join Session/ })).toBeInTheDocument();
    });
    // Footer Close button (the modal also has an X with the same label).
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]);

    // Todos: saved task + auto-generated suggestion + progress.
    expect(screen.getByText("Complete Java assignment")).toBeInTheDocument();
    expect(screen.getByText("Attend upcoming session: React Basics")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 tasks done")).toBeInTheDocument();

    expect(screen.getByText("Scheduled a session")).toBeInTheDocument();
  });

  it("shows honest empty states for a brand-new learner", async () => {
    stubDashboard(emptyDashboard);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No active learning sessions yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Your learning timeline will appear here")).toBeInTheDocument();
    // Active Mentors section is hidden entirely when there are no mentors.
    expect(screen.queryByRole("heading", { name: "Active Mentors" })).not.toBeInTheDocument();
    expect(screen.getByText("No upcoming sessions")).toBeInTheDocument();
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();

    // Illustrated empty-state scenes render for timeline and calendar, and are
    // immediately visible in test environments (no IntersectionObserver), so
    // the decorative art can never be stuck hidden.
    expect(screen.getByTestId("empty-art-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("empty-art-calendar")).toBeInTheDocument();
    // The is-in-view flag lands in a post-commit effect re-render, so await it.
    await waitFor(() => {
      expect(screen.getByTestId("empty-art-timeline")).toHaveClass("is-in-view");
    });
    await waitFor(() => {
      expect(screen.getByTestId("empty-art-calendar")).toHaveClass("is-in-view");
    });
  });

  it("shows illustrated empty states for learning history (empty and no-match)", async () => {
    stubDashboard(emptyDashboard);
    server.use(
      http.get("*/api/v1/learning/history", () =>
        HttpResponse.json({
          data: { items: [], total: 0, page: 0, size: 8, totalPages: 0, certificatesAvailable: false },
        }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("empty-art-history")).toBeInTheDocument();
    });
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();

    // Searching with no matches swaps to the search illustration.
    fireEvent.change(screen.getByLabelText("Search learning history"), { target: { value: "zzz" } });

    await waitFor(() => {
      expect(screen.getByTestId("empty-art-search")).toBeInTheDocument();
    });
    expect(screen.getByText("No sessions match")).toBeInTheDocument();
  });

  it("adds a todo through the backend and refreshes the list", async () => {
    let todos = dashboard.todos;
    stubDashboard();
    server.use(
      http.post("*/api/v1/learning/todos", async ({ request }) => {
        const body = await request.json();
        todos = [...todos, { id: 2, task: body.task, done: false }];
        clearGetCache();
        return HttpResponse.json({ data: todos });
      }),
      http.get("*/api/v1/learning/dashboard", () =>
        HttpResponse.json({ data: { ...dashboard, todos } }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("New task")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New task"), { target: { value: "Revise Collections" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Revise Collections")).toBeInTheDocument();
    });
  });

  it("completes a suggested task in one action", async () => {
    let todos = dashboard.todos;
    stubDashboard();
    server.use(
      http.post("*/api/v1/learning/todos", async ({ request }) => {
        const body = await request.json();
        todos = [...todos, { id: 2, task: body.task, done: Boolean(body.done) }];
        clearGetCache();
        return HttpResponse.json({ data: todos });
      }),
      http.get("*/api/v1/learning/dashboard", () =>
        HttpResponse.json({ data: { ...dashboard, todos } }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Attend upcoming session: React Basics")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Complete suggested task: Attend upcoming session: React Basics" }),
    );

    // The completed suggestion joins the saved list; the suggestion itself
    // remains in the mock payload, so 2 saved + 1 suggestion = 3 total.
    await waitFor(() => {
      expect(screen.getByText("1 of 3 tasks done")).toBeInTheDocument();
    });
  });

  it("toggles a todo complete", async () => {
    let todos = dashboard.todos;
    stubDashboard();
    server.use(
      http.patch("*/api/v1/learning/todos/:id", async ({ request }) => {
        const body = await request.json();
        todos = todos.map((todo) => (todo.id === 1 ? { ...todo, done: body.done } : todo));
        clearGetCache();
        return HttpResponse.json({ data: todos });
      }),
      http.get("*/api/v1/learning/dashboard", () =>
        HttpResponse.json({ data: { ...dashboard, todos } }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Complete Java assignment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mark "Complete Java assignment" as done/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Mark "Complete Java assignment" as not done/ })).toBeInTheDocument();
    });
  });

  it("opens session notes and saves them", async () => {
    stubDashboard();
    let savedNote = null;
    server.use(
      http.get("*/api/v1/learning/sessions/11/notes", () =>
        HttpResponse.json({ data: { bookingId: 11, content: "", updatedAt: null } }),
      ),
      http.put("*/api/v1/learning/sessions/11/notes", async ({ request }) => {
        const body = await request.json();
        savedNote = body.content;
        return HttpResponse.json({ data: { bookingId: 11, content: body.content } });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Add Notes").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Add Notes")[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Note content")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "Learn the request lifecycle." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Note/ }));

    await waitFor(() => {
      expect(savedNote).toBe("Learn the request lifecycle.");
    });
  });  it("searches and filters the learning history", async () => {
    clearGetCache();
    stubDashboard();
    let lastParams = null;
    // Override history handler AFTER stubDashboard so it takes priority
    server.use(
      http.get("*/api/v1/learning/history", ({ request }) => {
        const url = new URL(request.url);
        lastParams = {
          search: url.searchParams.get("search"),
          status: url.searchParams.get("status"),
          page: url.searchParams.get("page"),
        };
        clearGetCache();
        return HttpResponse.json({ data: historyPage });
      }),
    );

    renderPage();

    // Wait for initial history load to complete
    await waitFor(() => {
      expect(screen.getAllByText("Spring Boot REST API").length).toBeGreaterThan(0);
    });
    expect(lastParams).not.toBeNull();

    // Clear captured params for filter test
    lastParams = null;
    clearGetCache();

    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "COMPLETED" },
    });

    await waitFor(() => {
      expect(lastParams?.status).toBe("COMPLETED");
    });
  });
});
