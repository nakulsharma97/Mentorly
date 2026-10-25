import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { clearGetCache } from "../api/client";
import ShareReviewPage from "./ShareReviewPage";

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

const pendingReview = {
  id: 7,
  rating: 4,
  title: "Great place to learn",
  comment: "Mentorly made finding a mentor effortless for me.",
  status: "PENDING",
  adminNote: null,
  createdAt: "2026-10-01T10:00:00.000Z",
};

function mockMe(result, status = 200) {
  server.use(
    http.get("*/api/v1/site-reviews/me", () =>
      HttpResponse.json(
        status >= 400 ? { message: "Something broke" } : { data: result },
        { status },
      ),
    ),
  );
}

function renderPage(notify = vi.fn()) {
  const utils = render(
    <ShareReviewPage profile={{ role: "LEARNER" }} notify={notify} />,
    { wrapper },
  );
  return { ...utils, notify };
}

describe("ShareReviewPage", () => {
  // The axios client deduplicates GETs for 5s; without clearing, one test's
  // /site-reviews/me response would be replayed into the next test.
  beforeEach(() => {
    clearGetCache();
  });

  it("shows an empty form when the account has no review yet", async () => {
    mockMe(null);
    renderPage();

    const comment = await screen.findByLabelText(/your review/i);
    expect(comment).toBeInTheDocument();
    // Rating + comment are both required before submitting.
    expect(screen.getByRole("button", { name: /submit review/i })).toBeDisabled();
    expect(
      screen.getByRole("radiogroup", { name: /rating, 1 to 5 stars/i }),
    ).toBeInTheDocument();
  });

  it("submits a valid review and shows the pending-approval state", async () => {
    mockMe(null);
    let posted = null;
    server.use(
      http.post("*/api/v1/site-reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          data: {
            id: 8,
            ...posted,
            status: "PENDING",
            createdAt: "2026-10-24T10:00:00.000Z",
          },
        });
      }),
    );
    const { notify } = renderPage();

    const comment = await screen.findByLabelText(/your review/i);
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    fireEvent.change(comment, {
      target: { value: "Mentorly made learning with mentors effortless." },
    });

    const submit = screen.getByRole("button", { name: /submit review/i });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(
      await screen.findByText(
        /thanks! your review will appear on the landing page after approval/i,
      ),
    ).toBeInTheDocument();
    expect(posted).toMatchObject({
      rating: 5,
      comment: "Mentorly made learning with mentors effortless.",
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("shows an existing pending review with status and lets the user edit it", async () => {
    mockMe(pendingReview);
    let putBody = null;
    server.use(
      http.put("*/api/v1/site-reviews/me", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({
          data: { ...pendingReview, ...putBody, status: "PENDING" },
        });
      }),
    );
    renderPage();

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    expect(screen.getByText(pendingReview.comment)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const comment = await screen.findByLabelText(/your review/i);
    expect(comment).toHaveValue(pendingReview.comment);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody.comment).toBe(pendingReview.comment);
    expect(
      await screen.findByText(
        /thanks! your review will appear on the landing page after approval/i,
      ),
    ).toBeInTheDocument();
  });

  it("deletes the review after confirmation and returns to the form", async () => {
    mockMe(pendingReview);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let deleted = false;
    server.use(
      http.delete("*/api/v1/site-reviews/me", () => {
        deleted = true;
        return HttpResponse.json({ data: true });
      }),
    );
    renderPage();

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /submit review/i }),
    ).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("shows an inline error card with retry when loading fails", async () => {
    mockMe(null, 500);
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
