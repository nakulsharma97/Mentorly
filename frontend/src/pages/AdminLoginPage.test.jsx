import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AdminLoginPage from "./AdminLoginPage";
import client, { clearAuthSessionState } from "../api/client";

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  },
  clearAuthSessionState: vi.fn(),
  resolveAuthResponsePayload: (payload) =>
    payload?.data?.data || payload?.data || payload,
  API_BASE_URL: "http://localhost:8080",
}));

vi.mock("../utils/analyticsEvents", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

describe("AdminLoginPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const fillAndSubmit = () => {
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@skillswap.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in to admin/i }));
  };

  it("renders the dedicated admin login form", () => {
    render(
      <MemoryRouter>
        <AdminLoginPage onLoggedIn={() => {}} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /admin portal/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByText(/restricted access/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to main login/i }),
    ).toBeInTheDocument();
  });

  it("calls onLoggedIn for an ADMIN account (redirect handled upstream)", async () => {
    const onLoggedIn = vi.fn();
    client.post.mockResolvedValue({
      data: {
        data: {
          token: "admin-token",
          role: "ADMIN",
          email: "admin@skillswap.dev",
        },
      },
    });

    render(
      <MemoryRouter>
        <AdminLoginPage onLoggedIn={onLoggedIn} notify={vi.fn()} />
      </MemoryRouter>,
    );

    fillAndSubmit();

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(onLoggedIn).toHaveBeenCalledWith(
      "login",
      expect.objectContaining({ role: "ADMIN" }),
    );
  });

  it("rejects LEARNER accounts without calling onLoggedIn and clears any session", async () => {
    const onLoggedIn = vi.fn();
    client.post.mockResolvedValue({
      data: {
        data: {
          token: "learner-token",
          role: "LEARNER",
          email: "learner@skillswap.dev",
        },
      },
    });

    render(
      <MemoryRouter>
        <AdminLoginPage onLoggedIn={onLoggedIn} notify={vi.fn()} />
      </MemoryRouter>,
    );

    fillAndSubmit();

    await waitFor(() =>
      expect(
        screen.getByText(/restricted to skillswap administrators/i),
      ).toBeInTheDocument(),
    );
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect(clearAuthSessionState).toHaveBeenCalled();
  });

  it("shows the backend error message on invalid credentials", async () => {
    const onLoggedIn = vi.fn();
    client.post.mockRejectedValue({
      response: { status: 401, data: { data: { error: "Invalid credentials" } } },
    });

    render(
      <MemoryRouter>
        <AdminLoginPage onLoggedIn={onLoggedIn} notify={vi.fn()} />
      </MemoryRouter>,
    );

    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument(),
    );
    expect(onLoggedIn).not.toHaveBeenCalled();
  });
});
