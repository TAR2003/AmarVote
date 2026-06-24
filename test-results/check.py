import time
import requests
from datetime import datetime

# Configure your endpoints
FRONTEND_URL = "https://amarvote2026.me"
BACKEND_URL = "https://amarvote2026.me/api/auth/session"
CHECK_INTERVAL = 1.5  # Check every 1.5 seconds for higher precision

print("👀 Dual-monitoring starting... Press Ctrl+C to stop.\n")

# Tracking states
states = {
    "Frontend": {"url": FRONTEND_URL, "is_up": True, "down_start": None},
    "Backend API": {"url": BACKEND_URL, "is_up": True, "down_start": None}
}

while True:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    for name, target in states.items():
        try:
            # Strict 2-second timeout so the script doesn't hang
            response = requests.get(target["url"], timeout=2)
            # Adjust if /api/auth/session returns 401 Unauthenticated normally, 
            # as long as it responds, the service itself is UP.
            current_up = response.status_code in [200, 401]
            status_desc = str(response.status_code)
        except Exception as e:
            current_up = False
            status_desc = "ERROR/TIMEOUT"

        # Transition: Just went down
        if target["is_up"] and not current_up:
            target["down_start"] = time.time()
            target["is_up"] = False
            print(f"🚨 [{now}] {name} went DOWN! (Status: {status_desc})")

        # Transition: Just came back up
        elif not target["is_up"] and current_up:
            downtime = time.time() - target["down_start"]
            target["is_up"] = True
            print(f"✅ [{now}] {name} is BACK UP! Outage duration: {downtime:.2f} seconds. (Status: {status_desc})")

    time.sleep(CHECK_INTERVAL)