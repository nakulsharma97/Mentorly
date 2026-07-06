import axios from "axios";

async function run() {
  try {
    const resp = await axios.post(
      "http://localhost:8080/api/v1/auth/login",
      {
        email: "agent-test+1@example.com",
        password: "Test1234!",
      },
      { withCredentials: true },
    );

    console.log("[simulate] full response keys:", Object.keys(resp));
    console.log(
      "[simulate] response.data:",
      JSON.stringify(resp.data, null, 2),
    );

    function visit(value) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
      if (
        value.token ||
        value.accessToken ||
        value.jwt ||
        value.refreshToken ||
        value.email ||
        value.role
      )
        return value;
      for (const candidate of [value.data, value.payload, value.result]) {
        const nested = visit(candidate);
        if (nested) return nested;
      }
      return null;
    }

    const parsed = visit(resp.data);
    console.log("[simulate] parsed auth payload:", parsed);

    const cookieHeader = resp.headers["set-cookie"];
    console.log("[simulate] set-cookie header:", cookieHeader);

    const nextToken =
      parsed?.token ||
      parsed?.accessToken ||
      parsed?.jwt ||
      (cookieHeader && cookieHeader.find((c) => c.startsWith("access_token"))
        ? "cookie-access-token-present"
        : null);
    console.log("[simulate] nextToken resolved:", nextToken);
  } catch (err) {
    console.error("Request failed", err?.response?.data || err.message);
  }
}

run();
