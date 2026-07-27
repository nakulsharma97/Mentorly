import { expect, test } from "@playwright/test";

const backendBaseURL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

async function loginAndGetToken(request) {
  const candidates = ["password", "test@123"];
  for (const password of candidates) {
    const response = await request.post(`${backendBaseURL}/api/v1/auth/login`, {
      data: {
        email: "learner@test.com",
        password,
      },
    });
    if (response.ok()) {
      const body = await response.json();
      const token = body?.data?.token;
      if (token) {
        return token;
      }
    }
  }
  return null;
}

async function findBookableMentor(request, token) {
  const mentorsResponse = await request.get(
    `${backendBaseURL}/api/v1/users/mentors`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!mentorsResponse.ok()) {
    return null;
  }

  const mentorsBody = await mentorsResponse.json();
  const mentors = Array.isArray(mentorsBody?.data) ? mentorsBody.data : [];

  for (const mentor of mentors) {
    if (!mentor?.id) {
      continue;
    }

    const sessionsResponse = await request.get(
      `${backendBaseURL}/api/v1/sessions/mentor/${mentor.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!sessionsResponse.ok()) {
      continue;
    }

    const sessionsBody = await sessionsResponse.json();
    const sessions = Array.isArray(sessionsBody?.data) ? sessionsBody.data : [];

    const candidate = sessions.find((session) => {
      if (!session?.startTime) {
        return false;
      }
      const start = new Date(session.startTime).getTime();
      return Number.isFinite(start) && start > Date.now() + 10 * 60 * 1000;
    });

    if (candidate) {
      return { mentorId: mentor.id };
    }
  }

  return null;
}

test("booking retry — mentor profile shows session type buttons and opens booking flow overlay", async ({
  page,
  request,
}) => {
  const token = await loginAndGetToken(request);
  test.skip(!token, "Skipping – unable to authenticate seeded learner test account.");

  const target = await findBookableMentor(request, token);
  test.skip(!target, "Skipping – no future mentor session found to run booking E2E test.");

  await page.addInitScript((authToken) => {
    window.localStorage.setItem("token", authToken);
  }, token);

  // Navigate to the mentor's profile page
  await page.goto(`/mentors/${target.mentorId}`);

  // Wait for the hero section to load (indicates mentor profile is fully rendered)
  await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 15000 });

  // Verify session type buttons are rendered in the booking card
  const sessionButtons = page.locator(".mpr-booking-card__type");
  await expect(sessionButtons.first()).toBeVisible({ timeout: 15000 });

  // Verify the booking card has session options (check for a session title)
  await expect(
    page.locator(".mpr-booking-card__type-name").first()
  ).toBeVisible({ timeout: 10000 });

  // Click on a session type button to open the booking flow overlay
  await sessionButtons.first().click();

  // Wait for the BookingFlowPage overlay to appear
  await page.waitForTimeout(2000);

  // Verify the booking flow renderer is visible (the mpr-overlay should be visible)
  const overlay = page.locator(".mpr-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Verify the booking flow loaded session details (either the details or a loading/error state)
  // The BookingFlowPage should render some content (session details or error message)
  const bookingFlowContent = page.locator(".mpr-overlay");
  await expect(bookingFlowContent).not.toBeEmpty({ timeout: 15000 });
});
