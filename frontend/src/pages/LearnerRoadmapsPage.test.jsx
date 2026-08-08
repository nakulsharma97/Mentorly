import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import LearnerRoadmapsPage from "./LearnerRoadmapsPage";
import { server } from "../test/mocks/server";

const careerPaths = [
  {
    id: 1,
    name: "Java Backend Developer",
    slug: "java-backend-developer",
    description: "Learn Java, OOP, Collections and Spring Boot.",
    durationWeeks: 16,
    difficulty: "Intermediate",
    skills: ["Java", "Spring Boot"],
    icon: "code",
  },
  {
    id: 2,
    name: "React Developer",
    slug: "react-developer",
    description: "Master modern frontend development with React.",
    durationWeeks: 14,
    difficulty: "Beginner",
    skills: ["HTML", "CSS", "JavaScript"],
    icon: "view_quilt",
  },
];

const roadmapList = [
  {
    id: 5,
    status: "ACTIVE",
    progressPercent: 42,
    completedLessons: 5,
    totalLessons: 12,
    canDelete: false,
    createdAt: "2026-08-01T10:00:00Z",
    careerPath: careerPaths[0],
  },
  {
    id: 6,
    status: "ARCHIVED",
    progressPercent: 18,
    completedLessons: 2,
    totalLessons: 12,
    canDelete: false,
    createdAt: "2026-07-20T10:00:00Z",
    careerPath: careerPaths[1],
  },
  {
    id: 7,
    status: "NOT_STARTED",
    progressPercent: 0,
    completedLessons: 0,
    totalLessons: 12,
    canDelete: true,
    createdAt: "2026-08-05T10:00:00Z",
    careerPath: {
      id: 3,
      name: "Python Developer",
      slug: "python-developer",
      description: "Learn Python from fundamentals to Flask APIs.",
      durationWeeks: 12,
      difficulty: "Beginner",
      skills: ["Python", "Flask"],
      icon: "code_blocks",
    },
  },
];

function stubBase(roadmaps = roadmapList) {
  server.use(
    http.get("*/api/v1/learning/roadmaps", () => HttpResponse.json({ data: roadmaps })),
    http.get("*/api/v1/career-paths", () => HttpResponse.json({ data: careerPaths })),
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/learner/roadmaps"]}>
      <LearnerRoadmapsPage />
    </MemoryRouter>,
  );
}

describe("LearnerRoadmapsPage", () => {
  afterEach(() => server.resetHandlers());

  it("renders every roadmap with its status badge and actions", async () => {
    stubBase();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Java Backend Developer")).toBeInTheDocument();
    });

    expect(screen.getByText("React Developer")).toBeInTheDocument();
    expect(screen.getByText("Python Developer")).toBeInTheDocument();

    // Status badges
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();

    // Progress
    expect(screen.getAllByText(/42% complete/).length).toBeGreaterThan(0);

    // Action buttons: Continue everywhere, Switch on non-active, Archive on
    // active, Delete only when never started.
    expect(screen.getAllByText("Continue").length).toBe(3);
    expect(screen.getAllByText("Switch").length).toBe(2);
    expect(screen.getAllByText("Archive").length).toBe(1);
    expect(screen.getAllByText("Delete").length).toBe(1);
  });

  it("shows the 'Choose Your Learning Goal' catalog for a learner without roadmaps", async () => {
    stubBase([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Choose Your Learning Goal")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Select the career path you want to follow/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Java Backend Developer")).toBeInTheDocument();
    expect(screen.getByText("React Developer")).toBeInTheDocument();
    expect(screen.getAllByText("Create Roadmap").length).toBeGreaterThanOrEqual(2);
    // Skills covered + duration chips render from backend data.
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("16 Weeks")).toBeInTheDocument();
  });

  it("creates a roadmap from the onboarding catalog and switches to the list view", async () => {
    let roadmaps = [];
    stubBase(roadmaps);
    server.use(
      http.post("*/api/v1/learning/roadmaps", async ({ request }) => {
        const body = await request.json();
        roadmaps = [
          {
            id: 8,
            status: "ACTIVE",
            progressPercent: 0,
            completedLessons: 0,
            totalLessons: 12,
            canDelete: true,
            createdAt: "2026-08-07T10:00:00Z",
            careerPath: careerPaths.find((path) => path.id === body.careerPathId),
          },
        ];
        return HttpResponse.json({ data: roadmaps[0] });
      }),
      http.get("*/api/v1/learning/roadmaps", () => HttpResponse.json({ data: roadmaps })),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Choose Your Learning Goal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Create Roadmap")[0]);

    // Wait for the reload to swap the catalog for the ACTIVE roadmap list.
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
    expect(screen.queryByText("Choose Your Learning Goal")).not.toBeInTheDocument();
  });

  it("opens the New Roadmap picker and creates the selected path", async () => {
    stubBase();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Java Backend Developer")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /New Roadmap/ }));

    const dialog = await screen.findByRole("dialog", { name: "Start a new learning path" });
    expect(within(dialog).getByText("React Developer")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText("React Developer"));
    expect(screen.getByRole("button", { name: /Create Roadmap/ })).not.toBeDisabled();
  });
});
