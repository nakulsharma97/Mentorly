import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UsernameSettingsCard from "./UsernameSettingsCard";
import client from "../api/client";

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
  resolveAuthResponsePayload: vi.fn(),
  API_BASE_URL: "http://localhost:8080",
}));

describe("UsernameSettingsCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    profile: { username: "nakul" },
    notify: vi.fn(),
    onProfileUpdated: vi.fn(),
  };

  it("renders the current username as the handle", () => {
    render(<UsernameSettingsCard {...defaultProps} />);
    expect(screen.getByLabelText("Username")).toHaveValue("nakul");
    expect(screen.getByText(/@nakul/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save username/i }),
    ).toBeDisabled();
  });

  it("checks availability (debounced 500ms) before enabling save", async () => {
    client.get.mockResolvedValue({
      data: { data: { available: true, suggestion: null } },
    });
    const { onProfileUpdated } = defaultProps;
    const notify = vi.fn();

    render(
      <UsernameSettingsCard
        profile={{ username: "nakul" }}
        notify={notify}
        onProfileUpdated={onProfileUpdated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul_new" },
    });
    expect(client.get).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(client.get).toHaveBeenCalledWith(
          "/api/v1/users/check-username",
          expect.objectContaining({ params: { username: "nakul_new" } }),
        ),
      { timeout: 2000 },
    );
    await waitFor(
      () =>
        expect(
          screen.getByText("✅ Username available"),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );

    const saveButton = screen.getByRole("button", { name: /save username/i });
    expect(saveButton).toBeEnabled();
  });

  it("prevents saving a username that is already taken", async () => {
    client.get.mockResolvedValue({
      data: { data: { available: false, suggestion: "nakul_new2" } },
    });

    render(<UsernameSettingsCard {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul_new" },
    });

    await waitFor(
      () =>
        expect(
          screen.getByText(/username already taken/i),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(
      screen.getByRole("button", { name: /save username/i }),
    ).toBeDisabled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it("saves via PUT /api/v1/users/me/username and notifies on success", async () => {
    client.get.mockResolvedValue({
      data: { data: { available: true, suggestion: null } },
    });
    client.put.mockResolvedValue({
      data: { data: { username: "nakul_new" } },
    });
    const onProfileUpdated = vi.fn();
    const notify = vi.fn();

    render(
      <UsernameSettingsCard
        profile={{ username: "nakul" }}
        notify={notify}
        onProfileUpdated={onProfileUpdated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "nakul_new" },
    });
    await waitFor(
      () =>
        expect(
          screen.getByText("✅ Username available"),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByRole("button", { name: /save username/i }));

    await waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.put).toHaveBeenCalledWith("/api/v1/users/me/username", {
      username: "nakul_new",
    });
    expect(onProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ username: "nakul_new" }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Username updated" }),
    );
  });

  it("strips characters outside A-Z a-z 0-9 _ . - while typing", () => {
    render(<UsernameSettingsCard {...defaultProps} />);
    const input = screen.getByLabelText("Username");
    fireEvent.change(input, { target: { value: "na kul#@!" } });
    expect(input.value).toBe("nakul");
  });
});
