import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MentorCalendarPage from "./MentorCalendarPage";
import client from "../api/client";

vi.mock("../api/client", () => ({
  createIdempotencyKey: (prefix = "req") => `${prefix}-test-key`,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("MentorCalendarPage", () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();

    client.get.mockImplementation((url) => {
      if (url === "/api/v1/bookings") {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === "/api/v1/sessions") {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === "/api/v1/availability/my-slots") {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("renders the mentor calendar and summary cards", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorCalendarPage
          profile={{ id: 21, fullName: "Mentor Prime" }}
          notify={() => {}}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Calendar/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Upcoming Sessions")).toBeInTheDocument();
    expect(screen.getByText("Completed Sessions")).toBeInTheDocument();
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();
  });
});
