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

test("booking retry flow redirects to sessions on second attempt", async ({
  page,
  request,
}) => {
  const token = await loginAndGetToken(request);
  test.skip(!token, "Unable to authenticate seeded learner test account.");

  const target = await findBookableMentor(request, token);
  test.skip(!target, "No future mentor session found to run booking E2E test.");

  await page.addInitScript((authToken) => {
    window.localStorage.setItem("token", authToken);
  }, token);

  let interceptedOnce = false;
  await page.route("**/api/v1/bookings", async (route) => {
    if (!interceptedOnce) {
      interceptedOnce = true;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Request failed",
          data: {
            code: "BOOKING_TEMPORARY_CONFLICT",
            error: "Temporary booking conflict. Please retry.",
            message: "Temporary booking conflict. Please retry.",
            retryable: true,
            traceId: "e2e-forced-conflict",
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto(`/mentors/${target.mentorId}`);

  const firstBookButton = page
    .getByRole("button", { name: "Book now" })
    .first();
  await firstBookButton.click();

  await expect(
    page.getByText("Temporary booking conflict. Please retry."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retry booking" }).first().click();

  await expect(page).toHaveURL(/\/sessions/);
  await expect(
    page.getByText("People guiding the learning path."),
  ).toBeVisible();
});
