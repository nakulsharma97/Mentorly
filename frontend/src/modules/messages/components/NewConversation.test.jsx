import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import NewConversation from "./NewConversation";

vi.mock("../../../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import client from "../../../api/client";

const wrapper = ({ children }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </MemoryRouter>
);

const baseUser = (over = {}) => ({
  userId: 1,
  id: 1,
  fullName: "Rahul Sharma",
  username: "rahul97",
  role: "LEARNER",
  skills: "Java, Spring Boot, React",
  online: true,
  ...over,
});

describe("NewConversation — role-aware messaging redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: { message: "Users found", data: [] } });
    client.post.mockResolvedValue({
      data: { data: { conversationId: 99, participantName: "Rahul Sharma" } },
    });
  });

  it("mentor page searches learners with learner placeholder", async () => {
    render(
      <NewConversation profile={{ id: 5, role: "MENTOR" }} onClose={vi.fn()} onStart={vi.fn()} notify={vi.fn()} variant="MENTOR" />,
      { wrapper },
    );

    const input = screen.getByPlaceholderText(/Search learners by name, username or skill/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByLabelText("Search learners")).toBeInTheDocument();
    expect(screen.getByText("Suggested Learners")).toBeInTheDocument();
  });

  it("learner page searches mentors with mentor placeholder", async () => {
    render(
      <NewConversation profile={{ id: 5, role: "LEARNER" }} onClose={vi.fn()} onStart={vi.fn()} notify={vi.fn()} variant="LEARNER" />,
      { wrapper },
    );

    expect(screen.getByPlaceholderText(/Search mentors by name, username or skill/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Search mentors")).toBeInTheDocument();
    expect(screen.getByText("Suggested Mentors")).toBeInTheDocument();
  });

  it("shows role-aware empty state when no matches", async () => {
    client.get.mockResolvedValue({ data: { message: "Users found", data: [] } });
    render(
      <NewConversation profile={{ id: 5, role: "LEARNER" }} onClose={vi.fn()} onStart={vi.fn()} notify={vi.fn()} variant="LEARNER" />,
      { wrapper },
    );

    fireEvent.change(screen.getByPlaceholderText(/Search mentors/i), { target: { value: "zzz" } });

    await waitFor(() => expect(screen.getByText("No mentors found")).toBeInTheDocument());
  });

  it("mentor page suggests learners only, not mentors", async () => {
    client.get.mockResolvedValue({
      data: {
        message: "Users found",
        data: [
          baseUser({ id: 1, fullName: "Learner One", role: "LEARNER" }),
          baseUser({ id: 2, fullName: "Mentor One", role: "MENTOR" }),
        ],
      },
    });

    render(
      <NewConversation profile={{ id: 5, role: "MENTOR" }} onClose={vi.fn()} onStart={vi.fn()} notify={vi.fn()} variant="MENTOR" />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByText("Learner One")).toBeInTheDocument());
    // Mentor suggestion pool is role-filtered — Mentor One is not suggested.
    expect(screen.queryByText("Mentor One")).not.toBeInTheDocument();
  });

  it("top rated pool is also role-filtered on the mentor page", async () => {
    // A rated MENTOR in the results must never surface in Top Rated on the
    // mentor page — only learners may be suggested there.
    client.get.mockResolvedValue({
      data: {
        message: "Users found",
        data: [
          baseUser({ id: 1, fullName: "Rated Learner", role: "LEARNER", rating: 4.9 }),
          baseUser({ id: 2, fullName: "Rated Mentor", role: "MENTOR", rating: 5.0 }),
        ],
      },
    });

    render(
      <NewConversation profile={{ id: 5, role: "MENTOR" }} onClose={vi.fn()} onStart={vi.fn()} notify={vi.fn()} variant="MENTOR" />,
      { wrapper },
    );

    // The rated learner appears in both the suggestion pool and Top Rated.
    await waitFor(() =>
      expect(screen.getAllByText("Rated Learner").length).toBeGreaterThan(0),
    );
    expect(screen.getByText("Top Rated")).toBeInTheDocument();
    // A rated MENTOR must never surface on the mentor page — not even in
    // the Top Rated section.
    expect(screen.queryByText("Rated Mentor")).not.toBeInTheDocument();
  });
});
