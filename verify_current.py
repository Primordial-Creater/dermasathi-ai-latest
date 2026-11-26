import urllib.request
import urllib.error
import json
import time

BASE = "http://127.0.0.1:8000"
ts = int(time.time())

def req(method, path, data=None, token=None, file_bytes=None, filename="test.png"):
    url = BASE + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None
    if file_bytes is not None:
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        body = b"--" + boundary.encode() + b"\r\n"
        body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
        body += b"Content-Type: image/png\r\n\r\n"
        body += file_bytes
        body += f"\r\n--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif data and not isinstance(data, bytes):
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except:
            return e.code, {"detail": str(e)}

EMAIL1 = f"verify1-{ts}@dermasathi.ai"
EMAIL2 = f"verify2-{ts}@dermasathi.ai"

results = []

def check(name, condition, detail=""):
    results.append((name, condition, detail))
    status_icon = "PASS" if condition else "FAIL"
    print(f"  [{status_icon}] {name}" + (f" - {detail}" if detail else ""))

print("=" * 60)
print("WORKFLOW 1: User Registration, Login, Profile, Logout")
print("=" * 60)

# Register user 1
status, body = req("POST", "/api/v1/auth/register", {
    "email": EMAIL1,
    "password": "VerifyPass123!",
    "full_name": "Verify User One",
    "preferred_language": "en"
})
check("Register user1", status == 201, f"got {status}")

# Login user 1
status, body = req("POST", "/api/v1/auth/login", {
    "email": EMAIL1,
    "password": "VerifyPass123!"
})
token1 = body.get("access_token") if status == 200 else None
check("Login user1", status == 200 and token1, f"got {status}, token={bool(token1)}")
user1 = body.get("user", {}) if status == 200 else {}

# Get profile
status, body = req("GET", "/api/v1/auth/me", token=token1)
check("Get /me profile", status == 200 and body.get("email") == EMAIL1, f"got {status}")

# Logout user 1
status, body = req("POST", "/api/v1/auth/logout", token=token1)
check("Logout user1", status == 200, f"got {status}")

# Re-login
status, body = req("POST", "/api/v1/auth/login", {
    "email": EMAIL1,
    "password": "VerifyPass123!"
})
token1 = body.get("access_token") if status == 200 else None
check("Re-login user1", status == 200, f"got {status}")

print("\n" + "=" * 60)
print("WORKFLOW 2: Symptom Assessment")
print("=" * 60)

status, body = req("POST", "/api/v1/symptoms/check", {
    "symptoms": ["itching", "redness"],
    "has_fever": False,
    "has_rapid_spread": False,
    "has_pain_or_bleeding": False,
    "severity": "mild",
    "language": "en"
}, token=token1)
check("Symptom check", status == 200, f"got {status}, triage={body.get('triage_level') if status==200 else 'N/A'}")

print("\n" + "=" * 60)
print("WORKFLOW 3: Medication Safety")
print("=" * 60)

status, body = req("POST", "/api/v1/medications/check-safety", {
    "medications": ["hydrocortisone"],
    "allergies": [],
    "patient_conditions": []
}, token=token1)
check("Medication safety", status == 200, f"got {status}, safe={body.get('safe_to_combine') if status==200 else 'N/A'}")

print("\n" + "=" * 60)
print("WORKFLOW 4: Wellness Guidance")
print("=" * 60)

status, body = req("POST", "/api/v1/wellness/guidance", {
    "skin_concern": "dry skin",
    "season": "autumn"
}, token=token1)
check("Wellness guidance", status == 200, f"got {status}")

print("\n" + "=" * 60)
print("WORKFLOW 5: Emergency Assessment")
print("=" * 60)

status, body = req("POST", "/api/v1/emergency/assess", {
    "symptoms_description": "Mild rash, no breathing difficulty",
    "has_facial_swelling": False,
    "has_breathing_difficulty": False,
    "has_peeling_or_mucosal_involvement": False,
    "has_rapid_blistering": False,
    "has_high_fever": False,
    "has_severe_uncontrollable_pain": False,
    "language": "en"
}, token=token1)
check("Emergency assess", status == 200, f"got {status}, emergency={body.get('is_emergency') if status==200 else 'N/A'}")

print("\n" + "=" * 60)
print("WORKFLOW 6: Healthcare Facilities")
print("=" * 60)

status, body = req("GET", "/api/v1/healthcare/facilities", token=token1)
check("Healthcare facilities", status == 200, f"got {status}, count={len(body) if status==200 else 'N/A'}")

print("\n" + "=" * 60)
print("WORKFLOW 7: Prescription Reminders CRUD")
print("=" * 60)

# List reminders
status, body = req("GET", "/api/v1/prescriptions/reminders/today", token=token1)
check("List reminders (empty)", status == 200, f"got {status}, count={len(body) if status==200 else 'N/A'}")

# Create reminder
status, body = req("POST", "/api/v1/prescriptions/reminders", {
    "medicine_name": "Test Medicine",
    "dosage": "1 tablet",
    "scheduled_time": "08:00",
    "scheduled_date": "2026-11-18",
    "notes": "Test reminder"
}, token=token1)
check("Create reminder", status == 201, f"got {status}")
reminder_id = body.get("id") if status == 201 else None

# List reminders after create
status, body = req("GET", "/api/v1/prescriptions/reminders/today", token=token1)
check("List reminders after create", status == 200 and len(body) == 1, f"got {status}, count={len(body) if status==200 else 'N/A'}")

# Mark taken
status, body = req("PATCH", f"/api/v1/prescriptions/reminders/{reminder_id}/action", {
    "action": "taken"
}, token=token1)
check("Mark reminder taken", status == 200, f"got {status}")

print("\n" + "=" * 60)
print("WORKFLOW 8: Patient Data Isolation (Cross-User Access)")
print("=" * 60)

# Register user 2
status, body = req("POST", "/api/v1/auth/register", {
    "email": EMAIL2,
    "password": "VerifyPass123!",
    "full_name": "Verify User Two",
    "preferred_language": "en"
})
check("Register user2", status == 201)

# Login user 2
status, body = req("POST", "/api/v1/auth/login", {
    "email": EMAIL2,
    "password": "VerifyPass123!"
})
token2 = body.get("access_token") if status == 200 else None
check("Login user2", status == 200 and token2)

# User2 tries to access user1's reminder
status, body = req("PATCH", f"/api/v1/prescriptions/reminders/{reminder_id}/action", {
    "action": "taken"
}, token=token2)
check("User2 access to User1 reminder denied", status == 403, f"got {status}")

# User2 lists their own reminders
status, body = req("GET", "/api/v1/prescriptions/reminders/today", token=token2)
check("User2 reminders count 0", status == 200 and len(body) == 0, f"got {status}, count={len(body) if status==200 else 'N/A'}")

# User1 lists their reminders
status, body = req("GET", "/api/v1/prescriptions/reminders/today", token=token1)
check("User1 reminders count 1", status == 200 and len(body) == 1, f"got {status}, count={len(body) if status==200 else 'N/A'}")

print("\n" + "=" * 60)
print("WORKFLOW 9: Skin Analysis Status")
print("=" * 60)

status, body = req("GET", "/api/v1/skin/status", token=token1)
check("Skin status", status == 200, f"got {status}, ready={body.get('service_ready')}")

print("\n" + "=" * 60)
print("WORKFLOW 10: Skin Analysis Inference")
print("=" * 60)

# Create minimal 1x1 PNG
import base64
png_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

status, body = req("POST", "/api/v1/skin/analyze", file_bytes=png_data, token=token1)
check("Skin analyze", status == 200, f"got {status}, status={body.get('status')}, requires_review={body.get('requires_professional_review')}")

print("\n" + "=" * 60)
print("WORKFLOW 11: Health Endpoint")
print("=" * 60)

status, body = req("GET", "/api/v1/health/status", token=token1)
check("Health endpoint", status == 200, f"got {status}, db={body.get('database')}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for _, c, _ in results if c)
total = len(results)
print(f"Total checks: {total}, Passed: {passed}, Failed: {total - passed}")
for name, condition, detail in results:
    if not condition:
        print(f"  FAILED: {name} - {detail}")
