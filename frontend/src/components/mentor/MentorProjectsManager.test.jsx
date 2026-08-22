import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MentorProjectsManager from "./MentorProjectsManager";

vi.mock("../../api/projects", () => ({
  listMyProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import { listMyProjects, createProject, deleteProject } from "../../api/projects";

describe("MentorProjectsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state and lets the mentor add a project", async () => {
    listMyProjects.mockResolvedValue([]);
    createProject.mockResolvedValue({ id: 1, title: "Mentorly" });

    render(<MentorProjectsManager notify={vi.fn()} />);

    expect(await screen.findByText("No Projects Added Yet")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Add Project/i })[0]);
    const titleInput = screen.getByPlaceholderText(/e.g. Mentorly/i);
    fireEvent.change(titleInput, { target: { value: "Mentorly" } });
    const descInput = screen.getByPlaceholderText(/What did you build/i);
    fireEvent.change(descInput, { target: { value: "A mentor marketplace" } });
    const techInput = screen.getByPlaceholderText(/Type a technology/i);
    fireEvent.change(techInput, { target: { value: "React" } });
    fireEvent.keyDown(techInput, { key: "Enter" });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2025-01-01" } });

    fireEvent.click(screen.getByRole("button", { name: /Add Project$/i }));

    await waitFor(() => expect(createProject).toHaveBeenCalled());
    expect(createProject.mock.calls[0][0]).toMatchObject({
      title: "Mentorly",
      description: "A mentor marketplace",
      technologies: "React",
      startDate: "2025-01-01",
    });
  });

  it("lists existing projects with their links", async () => {
    listMyProjects.mockResolvedValue([
      {
        id: 7,
        title: "AI Resume Builder",
        description: "Generates tailored resumes.",
        technologies: "Python, React",
        githubUrl: "https://github.com/u/ai-resume",
        liveDemoUrl: "https://ai-resume.dev",
        startDate: "2024-06-01",
        endDate: null,
        currentlyWorking: true,
      },
    ]);

    render(<MentorProjectsManager notify={vi.fn()} />);

    expect(await screen.findByText("AI Resume Builder")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Expand/i }));
    expect(await screen.findByRole("link", { name: /GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/u/ai-resume",
    );
    expect(screen.getByRole("link", { name: /Live Demo/i })).toHaveAttribute(
      "href",
      "https://ai-resume.dev",
    );
  });

  it("deletes a project after confirmation", async () => {
    listMyProjects.mockResolvedValue([
      { id: 3, title: "Expense Tracker", description: "Track spend.", technologies: "JS", startDate: "2024-01-01" },
    ]);
    deleteProject.mockResolvedValue("ok");
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MentorProjectsManager notify={vi.fn()} />);

    expect(await screen.findByText("Expense Tracker")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Expand/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Remove/i }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith(3));
    expect(window.confirm).toHaveBeenCalledWith('Delete "Expense Tracker"?');
  });

  it("reports the project count to the parent", async () => {
    listMyProjects.mockResolvedValue([
      { id: 1, title: "A", description: "d", technologies: "t", startDate: "2024-01-01" },
      { id: 2, title: "B", description: "d", technologies: "t", startDate: "2024-01-01" },
    ]);
    const onCountChange = vi.fn();

    render(<MentorProjectsManager notify={vi.fn()} onCountChange={onCountChange} />);

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });
});
