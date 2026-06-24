import time
import requests
from datetime import datetime

# Configure your endpoints
FRONTEND_URL = "https://amarvote2026.me"
BACKEND_URL = "https://amarvote2026.me/api/health"
CHECK_INTERVAL = 1  # seconds between check rounds

# nginx limit_req_status is 429 — rate-limited responses mean nginx is up, not an outage
UP_STATUS_CODES = {200, 401, 429}

print("👀 Dual-monitoring starting... Press Ctrl+C to stop.\n")

# Tracking states
states = {
    "Frontend": {"url": FRONTEND_URL, "is_up": True, "down_start": None, "rate_limited": False},
    "Backend API": {"url": BACKEND_URL, "is_up": True, "down_start": None, "rate_limited": False},
}

while True:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for name, target in states.items():
        try:
            # Strict 2-second timeout so the script doesn't hang
            response = requests.get(target["url"], timeout=2)
            status_code = response.status_code
            # 200/401 = healthy; 429 = nginx rate limit (service stack is still responding)
            current_up = status_code in UP_STATUS_CODES
            if status_code == 429:
                status_desc = "429 (nginx rate limit)"
            else:
                status_desc = str(status_code)
        except Exception:
            current_up = False
            status_desc = "ERROR/TIMEOUT"

        # Rate-limited: log once per streak, do not count as downtime
        if status_desc.startswith("429"):
            if not target["rate_limited"]:
                target["rate_limited"] = True
                print(f"⚠️  [{now}] {name} hit nginx rate limit — still considered UP")
        else:
            target["rate_limited"] = False

        # Transition: just went down
        if target["is_up"] and not current_up:
            target["down_start"] = time.time()
            target["is_up"] = False
            print(f"🚨 [{now}] {name} went DOWN! (Status: {status_desc})")

        # Transition: just came back up
        elif not target["is_up"] and current_up:
            downtime = time.time() - target["down_start"]
            target["is_up"] = True
            print(
                f"✅ [{now}] {name} is BACK UP! "
                f"Outage duration: {downtime:.2f} seconds. (Status: {status_desc})"
            )

    time.sleep(CHECK_INTERVAL)
