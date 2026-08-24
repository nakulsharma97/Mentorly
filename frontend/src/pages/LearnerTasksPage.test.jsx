import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import LearnerTasksPage from "./LearnerTasksPage";
import { server } from "../test/mocks/server";
import client from "../api/client";

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
    const origGet = client.get;
    const origPost = client.post;
    const origPatch = client.patch;
    let currentTasks = [...tasks];
    client.get = vi.fn((url) => {
      if (url === '/api/v1/learning/tasks') return Promise.resolve({ data: { data: currentTasks } });
      if (url === '/api/v1/learning/tasks/stats') return Promise.resolve({ data: { data: { ...stats, completed: 1, remaining: 1, todayCompleted: 1 } } });
      return Promise.resolve({ data: { data: null } });
    });
    client.post = vi.fn(() => Promise.resolve({ data: { data: [] } }));
    client.patch = vi.fn((url) => {
      const id = Number(url.split('/').filter(Boolean).pop());
      currentTasks = currentTasks.map((t) =>
        t.id === id ? { ...t, status: 'COMPLETED', completedAt: new Date().toISOString() } : t,
      );
      return Promise.resolve({ data: { data: currentTasks.find((t) => t.id === id) } });
    });

    try {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Review Java Collections Notes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Mark "Review Java Collections Notes" as done'));

      await waitFor(() => {
        expect(screen.getByText("1 of 2 tasks completed")).toBeInTheDocument();
      });
    } finally {
      client.get = origGet;
      client.post = origPost;
      client.patch = origPatch;
    }
  });

  it("shows the empty state when there are no tasks", async () => {
    const origGet = client.get;
    const origPost = client.post;
    client.get = vi.fn((url) => {
      if (url === '/api/v1/learning/tasks') return Promise.resolve({ data: { data: [] } });
      if (url === '/api/v1/learning/tasks/stats') return Promise.resolve({ data: { data: { total: 0, completed: 0, remaining: 0, overdue: 0, todayTotal: 0, todayCompleted: 0, streak: 0 } } });
      return Promise.resolve({ data: { data: null } });
    });
    client.post = vi.fn(() => Promise.resolve({ data: { data: [] } }));

    try {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/You're all caught up/)).toBeInTheDocument();
      });
      expect(screen.getAllByRole("button", { name: /Add Task/ }).length).toBeGreaterThan(0);
      expect(screen.getByRole("link", { name: /Find a Mentor/ })).toBeInTheDocument();
    } finally {
      client.get = origGet;
      client.post = origPost;
    }
  });
});
