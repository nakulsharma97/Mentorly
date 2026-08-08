"""Live E2E: complete mentor verification workflow — auto-submit, admin queue,
notifications, approve, reject (default + custom), resubmit, search visibility."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8080/api/v1"
ADMIN_EMAIL = "nakulsharma@gmail.com"
ADMIN_PASS = "nakul97"


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def complete_payload(name, username, rate=299):
    return {
        "fullName": name, "profileImageUrl": "https://example.com/photo.jpg",
        "headline": "Full Stack Mentor", "aboutMe": "Teaching Java and React.",
        "skills": "Java, React", "languages": "English, Hindi",
        "yearsOfExperience": 2, "monthsOfExperience": 6, "education": "B.Tech",
        "linkedinUrl": "https://linkedin.com/in/x", "portfolioUrl": "https://x.dev",
        "hourlyRate": rate, "timezone": "Asia/Kolkata", "availability": "Weekends",
        "country": "India", "state": "Delhi", "city": "New Delhi",
        "phoneNumber": "+91 99999 00000",
    }


ok = True
results = []


def check(label, passed, extra=""):
    global ok
    ok = ok and passed
    results.append((label, "PASS" if passed else "FAIL", extra))
    print(f"{'PASS' if passed else 'FAIL'} | {label} {extra}")


def signup_mentor(email, username, name):
    code, body = req("POST", "/auth/signup", {
        "email": email, "password": "MentorPass1", "fullName": name,
        "username": username, "role": "MENTOR"})
    if code != 200:
        raise SystemExit(f"signup failed: {code} {body}")
    return body["data"]["token"]


def notifications(token, admin=False):
    code, body = req("GET", "/notifications", token=token)
    data = body.get("data") if code == 200 else None
    if isinstance(data, dict):
        return data.get("content") or []
    return data if isinstance(data, list) else []


# ── 1. Mentor A: complete profile -> auto-created PENDING request ──
tA = signup_mentor("e2e.a@example.com", "e2ementora", "E2E Mentor A")
code, body = req("POST", "/users/me/profile/complete", complete_payload("E2E Mentor A", "e2ementora"), tA)
check("A: profile complete (200)", code == 200)

code, body = req("GET", "/verification/mentor/status", token=tA)
st = body["data"]
check("A: status PENDING + requestId + submittedAt",
      st.get("verificationStatus") == "PENDING" and st.get("requestId") and st.get("submittedAt"),
      f"status={st.get('verificationStatus')} requestId={st.get('requestId')}")

# ── 2. Admin queue shows the request ──
admin = None
code, body = req("POST", "/auth/login", {"emailOrUsername": ADMIN_EMAIL, "password": ADMIN_PASS})
if code == 200:
    admin = body["data"]["token"]
check("admin login", admin is not None)
code, body = req("GET", "/verification/mentor/requests?status=PENDING", token=admin)
queue = body["data"]
a_req = next((r for r in queue if r.get("mentor", {}).get("email") == "e2e.a@example.com"), None)
check("admin queue contains A", a_req is not None, f"pending={len(queue)}")
a_id = a_req["id"] if a_req else None

# ── 3. Admin notification created ──
admin_notifs = notifications(admin)
check("admin got 'New Mentor Verification Request'",
      any(n.get("type") == "MENTOR_VERIFICATION_REQUEST" and n.get("referenceId") == a_id for n in admin_notifs),
      f"adminNotifs={len(admin_notifs)}")

# ── 4. Admin approves -> mentor notified + searchable ──
code, body = req("PATCH", f"/verification/mentor/requests/{a_id}",
                 {"status": "APPROVED", "adminNote": "Verified by admin"}, admin)
check("A: approve (200)", code == 200)

code, body = req("GET", "/verification/mentor/status", token=tA)
st = body["data"]
check("A: now APPROVED + mentorVerified", st.get("verificationStatus") == "APPROVED" and st.get("mentorVerified") is True)

a_notifs = notifications(tA)
check("A: got congratulations notification",
      any(n.get("type") == "VERIFICATION_APPROVED" for n in a_notifs),
      [n.get("title") for n in a_notifs][:2])

code, body = req("GET", "/users/mentors", token=admin)
mentors = body["data"] if isinstance(body.get("data"), list) else []
check("A: appears in mentor listing", any(m.get("username") == "e2ementora" for m in mentors),
      f"mentors={len(mentors)}")

# ── 5. Mentor B: reject with DEFAULT reason (no customMessage) ──
tB = signup_mentor("e2e.b@example.com", "e2ementorb", "E2E Mentor B")
req("POST", "/users/me/profile/complete", complete_payload("E2E Mentor B", "e2ementorb"), tB)
code, body = req("GET", "/verification/mentor/requests?status=PENDING", token=admin)
b_req = next((r for r in body["data"] if r.get("mentor", {}).get("email") == "e2e.b@example.com"), None)
check("B: in admin queue", b_req is not None)
code, body = req("PATCH", f"/verification/mentor/requests/{b_req['id']}",
                 {"status": "REJECTED", "adminNote": "Incomplete Profile"}, admin)
check("B: reject default (200)", code == 200)
b_notifs = notifications(tB)
b_rej = next((n for n in b_notifs if n.get("type") == "VERIFICATION_REJECTED"), None)
check("B: default rejection notification w/ reason",
      b_rej is not None and "Incomplete Profile" in (b_rej.get("message") or ""),
      f"msg={ (b_rej or {}).get('message', '')[:80] }")

# ── 6. Mentor C: reject with CUSTOM message -> verbatim ──
tC = signup_mentor("e2e.c@example.com", "e2ementorc", "E2E Mentor C")
req("POST", "/users/me/profile/complete", complete_payload("E2E Mentor C", "e2ementorc"), tC)
code, body = req("GET", "/verification/mentor/requests?status=PENDING", token=admin)
c_req = next((r for r in body["data"] if r.get("mentor", {}).get("email") == "e2e.c@example.com"), None)
custom = "Please upload a clearer identity proof and improve your profile description before submitting again."
code, body = req("PATCH", f"/verification/mentor/requests/{c_req['id']}",
                 {"status": "REJECTED", "adminNote": custom, "customMessage": custom}, admin)
check("C: reject custom (200)", code == 200)
c_notifs = notifications(tC)
c_rej = next((n for n in c_notifs if n.get("type") == "VERIFICATION_REJECTED"), None)
check("C: exact custom message delivered",
      c_rej is not None and (c_rej.get("message") or "").strip() == custom,
      f"msg={ (c_rej or {}).get('message', '')[:80] }")

# ── 7. Mentor C: resubmit -> UNDER_REVIEW + new admin notification ──
code, body = req("POST", "/verification/mentor/request", {
    "fullName": "E2E Mentor C", "email": "e2e.c@example.com",
    "headline": "Full Stack Mentor", "skills": "Java, React",
    "yearsOfExperience": 2, "monthsOfExperience": 0, "aboutMe": "Updated bio.",
    "hourlyRate": 199, "linkedinUrl": "https://linkedin.com/in/c",
    "portfolioUrl": "https://c.dev", "resumeUrl": "https://example.com/c.pdf",
    "availability": "Weekends"}, tC)
check("C: resubmit (200)", code == 200)
code, body = req("GET", "/verification/mentor/status", token=tC)
check("C: resubmitted -> UNDER_REVIEW", body["data"].get("verificationStatus") == "UNDER_REVIEW")

admin_notifs2 = notifications(admin)
check("C: admin notified again on resubmission",
      any(n.get("type") == "MENTOR_VERIFICATION_REQUEST" for n in admin_notifs2))

c_notifs2 = notifications(tC)
check("C: got 'Verification Request Submitted' notification",
      any(n.get("title") == "Verification Request Submitted" for n in c_notifs2))

# ── 8. Mentor A can now create a session (VERIFIED gate) ──
code, body = req("POST", "/sessions", {
    "title": "Java Masterclass", "description": "Learn Java", "sessionType": "1:1",
    "startTime": "2030-01-01T10:00:00Z", "endTime": "2030-01-01T11:00:00Z",
    "priceAmount": 299, "meetingLink": "https://meet.example.com/x1"}, tA)
check("A: verified mentor creates session (200/201)", code in (200, 201),
      f"code={code} err={(body.get('data') or body.get('message')) if code != 200 else ''}")

print()
print("=== SUMMARY ===")
for label, status, extra in results:
    print(f"{status}  {label}  {extra}")
print("E2E", "ALL PASS" if ok else "FAILED")
