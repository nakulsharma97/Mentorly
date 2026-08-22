import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { setUnreadMessages } from "../../messages/unreadMessagesStore";
import WorkspaceLayout from "./WorkspaceLayout";

// Count every document.title assignment so we can prove the title observer
// applies the prefix exactly once per change instead of looping forever.
const titleDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "title",
);
let titleWrites = 0;
function countTitleWrites() {
  titleWrites = 0;
  Object.defineProperty(Document.prototype, "title", {
    configurable: true,
    get: titleDescriptor.get,
    set(value) {
      titleWrites += 1;
      titleDescriptor.set.call(this, value);
    },
  });
}
function restoreTitleWrites() {
  Object.defineProperty(Document.prototype, "title", titleDescriptor);
}

// Isolate the shell logic: sidebar and topbar are irrelevant for the
// tab-title behavior under test.
vi.mock("./WorkspaceSidebar", () => ({
  default: () => <aside data-testid="mock-sidebar" />,
}));
vi.mock("./WorkspaceTopbar", () => ({
  default: () => <header data-testid="mock-topbar" />,
}));

const BASE_PROPS = {
  profile: { role: "GUEST", email: "guest@mentorly.test", fullName: "Guest" },
  onLogout: vi.fn(),
  unreadNotifications: 0,
  onUnreadCountChange: vi.fn(),
  onNotify: vi.fn(),
  brand: { name: "Mentorly" },
  groups: [],
  secondaryLinks: [],
  pageMeta: {},
  crumbRoot: { to: "/", label: "Home" },
  notificationsTo: "/notifications",
  profileMenu: [],
};

function renderLayout(initialTitle = "My Page | Mentorly") {
  document.title = initialTitle;
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<WorkspaceLayout {...BASE_PROPS} />}>
          <Route
            path="*"
            element={<main data-testid="page-content">Page body</main>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspaceLayout tab title", () => {
  beforeEach(() => {
    setUnreadMessages(0);
    countTitleWrites();
  });

  afterEach(() => {
    restoreTitleWrites();
  });

  it("renders page content through the outlet", () => {
    renderLayout();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByTestId("mock-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topbar")).toBeInTheDocument();
  });

  it("prefixes the tab title with the unread count and removes it when read", () => {
    renderLayout();
    expect(document.title).toBe("My Page | Mentorly");

    act(() => setUnreadMessages(4));
    expect(document.title).toBe("(4) My Page | Mentorly");

    act(() => setUnreadMessages(0));
    expect(document.title).toBe("My Page | Mentorly");
  });

  it("re-applies the prefix when a page effect writes a fresh title, then settles", async () => {
    renderLayout();
    act(() => setUnreadMessages(3));
    expect(document.title).toBe("(3) My Page | Mentorly");

    // Simulate navigation: the page-level effect writes a new title.
    // Regression: this used to create a self-sustaining MutationObserver loop
    // (every write to document.title fired the observer, which wrote again)
    // that froze the entire workspace in real browsers.
    act(() => {
      document.title = "Reviews & Ratings | Mentorly Mentor";
    });

    // Let the observer deliver its mutation and re-apply the prefix once.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.title).toBe("(3) Reviews & Ratings | Mentorly Mentor");

    // The observer must not keep rewriting the title.
    const settled = document.title;
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.title).toBe(settled);
  });

  it("writes the title exactly once per change (regression: observer loop)", async () => {
    renderLayout();
    titleWrites = 0; // ignore the renderLayout seed write

    // Unread count arrives -> exactly one prefix write, then the observer
    // re-fires but must no-op (identical value) instead of writing again.
    act(() => setUnreadMessages(3));
    expect(document.title).toBe("(3) My Page | Mentorly");
    await act(async () => {
      await Promise.resolve();
    });
    expect(titleWrites).toBe(1);

    // Page navigation writes a fresh title: the page's own write (2) plus
    // the observer re-prefixing exactly once (3). It must then settle — the
    // count must not keep growing across further microtask ticks.
    act(() => {
      document.title = "Reviews & Ratings | Mentorly Mentor";
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.title).toBe("(3) Reviews & Ratings | Mentorly Mentor");
    expect(titleWrites).toBe(3);
    const afterRePrefix = titleWrites;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(titleWrites).toBe(afterRePrefix);

    // Removing the count drops the prefix with exactly one write (4).
    act(() => setUnreadMessages(0));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.title).toBe("Reviews & Ratings | Mentorly Mentor");
    expect(titleWrites).toBe(4);
  });
});
