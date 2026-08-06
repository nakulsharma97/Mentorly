import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AuthModal from "./AuthModal";
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

describe("AuthModal — login", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = (props = {}) =>
    render(
      <MemoryRouter>
        <AuthModal
          mode="login"
          onClose={vi.fn()}
          onLoggedIn={vi.fn()}
          notify={vi.fn()}
          {...props}
        />
      </MemoryRouter>,
    );

  it("renders a single 'Email or Username' field instead of an email-only field", () => {
    renderLogin();
    expect(screen.getByLabelText("Email or Username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("submits the typed username as emailOrUsername", async () => {
    const onLoggedIn = vi.fn();
    client.post.mockResolvedValue({
      data: { data: { token: "t", role: "LEARNER", email: "user@example.com" } },
    });

    renderLogin({ onLoggedIn });

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "nakul123" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/login", {
      emailOrUsername: "nakul123",
      password: "Secret123",
    });
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(onLoggedIn).toHaveBeenCalledWith(
      "login",
      expect.objectContaining({ role: "LEARNER" }),
    );
  });

  it("submits a typed email address as emailOrUsername", async () => {
    const onLoggedIn = vi.fn();
    client.post.mockResolvedValue({
      data: { data: { token: "t", role: "MENTOR", email: "nakul@gmail.com" } },
    });

    renderLogin({ onLoggedIn });

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "nakul@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/login", {
      emailOrUsername: "nakul@gmail.com",
      password: "Secret123",
    });
  });
});

describe("AuthModal — signup username availability", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderSignup = (props = {}) =>
    render(
      <MemoryRouter>
        <AuthModal
          mode="signup"
          onClose={vi.fn()}
          onLoggedIn={vi.fn()}
          notify={vi.fn()}
          {...props}
        />
      </MemoryRouter>,
    );

  const fillSignupBasics = () => {
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Nakul Sharma" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nakul@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Secret123" },
    });
  };

  it("shows 'Username available' after the debounced backend check", async () => {
    client.get.mockResolvedValue({
      data: { data: { available: true, suggestion: null } },
    });
    renderSignup();

    fillSignupBasics();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul" },
    });

    // 500ms debounce — no request before the delay elapses.
    expect(client.get).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(client.get).toHaveBeenCalledWith(
          "/api/v1/users/check-username",
          expect.objectContaining({ params: { username: "nakul" } }),
        ),
      { timeout: 2000 },
    );
    await waitFor(
      () => expect(screen.getByText("✅ Username available")).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("shows 'Username already taken' and disables submit when the handle is unavailable", async () => {
    client.get.mockResolvedValue({
      data: { data: { available: false, suggestion: "nakul2" } },
    });
    renderSignup();

    fillSignupBasics();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul" },
    });

    await waitFor(
      () =>
        expect(
          screen.getByText(/username already taken/i),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(screen.getByText(/try:/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeDisabled();
  });

  it("keeps submit disabled while the availability check is in flight", async () => {
    let resolveCheck;
    client.get.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    renderSignup();

    fillSignupBasics();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul" },
    });

    await waitFor(
      () => expect(screen.getByText(/checking/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeDisabled();

    resolveCheck({ data: { data: { available: true, suggestion: null } } });
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /create account/i }),
        ).toBeEnabled(),
      { timeout: 2000 },
    );
  });

  it("fails open when the availability check errors (backend re-validates on submit)", async () => {
    const onLoggedIn = vi.fn();
    client.get.mockRejectedValue(new Error("network down"));
    client.post.mockResolvedValue({
      data: { data: { token: "t", role: "LEARNER", email: "nakul@gmail.com" } },
    });
    renderSignup({ onLoggedIn });

    fillSignupBasics();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul" },
    });

    // Once the failed check settles, the guard releases the submit button so
    // the backend (the source of truth) can validate the username itself.
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /create account/i }),
        ).toBeEnabled(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith(
      "/api/v1/auth/signup",
      expect.objectContaining({ username: "nakul" }),
    );
  });

  it("submits a valid signup with the chosen username", async () => {
    const onLoggedIn = vi.fn();
    client.get.mockResolvedValue({
      data: { data: { available: true, suggestion: null } },
    });
    client.post.mockResolvedValue({
      data: { data: { token: "t", role: "MENTOR", email: "nakul@gmail.com" } },
    });

    renderSignup({ onLoggedIn });

    fillSignupBasics();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "MENTOR" },
    });

    await waitFor(
      () => expect(screen.getByText("✅ Username available")).toBeInTheDocument(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith(
      "/api/v1/auth/signup",
      expect.objectContaining({
        username: "nakul",
        role: "MENTOR",
        email: "nakul@gmail.com",
      }),
    );
    expect(onLoggedIn).toHaveBeenCalledWith(
      "signup",
      expect.objectContaining({ role: "MENTOR" }),
    );
  });

  it("strips characters outside A-Z a-z 0-9 _ . - while typing", () => {
    renderSignup();
    const input = screen.getByLabelText("Username");
    fireEvent.change(input, { target: { value: "na kul#@!" } });
    expect(input.value).toBe("nakul");
  });
});
