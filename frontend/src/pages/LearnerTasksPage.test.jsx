import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import LearnerTasksPage from "./LearnerTasksPage";
import { server } from "../test/mocks/server";

const tasks = [
  {
    id: 1,
    title: "Review Java Collections notes",
    description: "Go over the notes from the session.",
    type: "NOTE_REVIEW",
    priority: "HIGH",
    status: "TODO",
    dueDate: new Date().toISOString(),
    completedAt: null,
    relatedSessionId: 5,
    relatedMentorId: 20,
    mentorName: "Rahul Sharma",
    sessionTitle: "Java Collections",
    systemGenerated: true,
    reminderAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Practice 5 ArrayList problems",
    description: "LeetCode easy/medium.",
    type: "PRACTICE",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: new Date().toISOString(),
    completedAt: null,
    relatedSessionId: null,
    relatedMentorId: null,
    mentorName: null,
    sessionTitle: null,
    systemGenerated: false,
    reminderAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const stats = { total: 2, completed: 0, remaining: 2, overdue: 0, todayTotal: 2, todayCompleted: 0, streak: 0 };

function stubBase(taskList = tasks, taskStats = stats) {
  server.use(
    http.get("*/api/v1/learning/tasks", () => HttpResponse.json({ data: taskList })),
    http.get("*/api/v1/learning/tasks/stats", () => HttpResponse.json({ data: taskStats })),
    http.post("*/api/v1/learning/tasks/generate", () => HttpResponse.json({ data: [] })),
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/learner/tasks"]}>
      <LearnerTasksPage />
    </MemoryRouter>,
  );
}

describe("LearnerTasksPage", () => {
  afterEach(() => server.resetHandlers());

  it("renders the hero, progress and task cards", async () => {
    stubBase();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Review Java Collections Notes")).toBeInTheDocument();
    });

    expect(screen.getByText("Practice 5 ArrayList Problems")).toBeInTheDocument();
    expect(screen.getByText("Daily Tasks")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 tasks completed")).toBeInTheDocument();
    // Task-type badge from backend data (no AI/Auto badge).
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.queryByText("Auto")).not.toBeInTheDocument();
    // Labelled mentor + session context lines.
    expect(screen.getByText(/Mentor: Rahul Sharma/)).toBeInTheDocument();
    expect(screen.getByText(/Session: Java Collections/)).toBeInTheDocument();
  });

  it("marks a task complete and refreshes the progress", async () => {
    let current = tasks;
    stubBase(current);
    server.use(
      http.patch("*/api/v1/learning/tasks/:id/complete", async ({ request }) => {
        const body = await request.json();
        const id = Number(request.url.pathname.split("/").pop());
        current = current.map((t) =>
          t.id === id ? { ...t, status: body.completed ? "COMPLETED" : "TODO", completedAt: body.completed ? new Date().toISOString() : null } : t,
        );
        return HttpResponse.json({ data: current.find((t) => t.id === id) });
      }),
      http.get("*/api/v1/learning/tasks", () => HttpResponse.json({ data: current })),
      http.get("*/api/v1/learning/tasks/stats", () =>
        HttpResponse.json({ data: { ...stats, completed: 1, remaining: 1, todayCompleted: 1 } }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Review Java Collections Notes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Mark "Review Java Collections Notes" as done'));

    await waitFor(() => {
      expect(screen.getByText("1 of 2 tasks completed")).toBeInTheDocument();
    });
  });

  it("shows the empty state when there are no tasks", async () => {
    stubBase([], { total: 0, completed: 0, remaining: 0, overdue: 0, todayTotal: 0, todayCompleted: 0, streak: 0 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button", { name: /Add Task/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Find a Mentor/ })).toBeInTheDocument();
  });
});
