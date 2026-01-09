#!/usr/bin/env python
"""
Diagnostic script to monitor microservice for hangs and bottlenecks.
Run this while processing chunks to see where it gets stuck.
"""

import requests
import time
import json
from datetime import datetime

MICROSERVICE_URL = "http://localhost:5000"

def check_health():
    """Check microservice health and look for stuck requests"""
    try:
        response = requests.get(f"{MICROSERVICE_URL}/health", timeout=5)
        data = response.json()
        
        print(f"\n{'='*80}")
        print(f"Health Check: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*80}")
        print(f"Status: {data.get('status', 'unknown')}")
        print(f"Active Requests: {data.get('active_requests', 0)}")
        print(f"Active Threads: {data.get('thread_count', 0)}")
        
        stuck = data.get('stuck_requests', [])
        if stuck:
            print(f"\n⚠️  STUCK REQUESTS DETECTED ({len(stuck)}):")
            for req in stuck:
                print(f"  - Request ID: {req['request_id']}")
                print(f"    Endpoint: {req['endpoint']}")
                print(f"    Stuck for: {req['elapsed_seconds']} seconds")
                print(f"    Thread ID: {req['thread_id']}")
                print()
        else:
            print("✓ No stuck requests detected")
        
        stats = data.get('ballot_publication_stats', {})
        if stats:
            print(f"\nBallot Stats:")
            print(f"  Cast: {stats.get('cast_count', 0)}")
            print(f"  Audited: {stats.get('audited_count', 0)}")
            print(f"  Total: {stats.get('total_count', 0)}")
        
        return data
        
    except requests.exceptions.Timeout:
        print("❌ Health check TIMEOUT - microservice may be completely hung")
        return None
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to microservice - is it running?")
        return None
    except Exception as e:
        print(f"❌ Error checking health: {e}")
        return None

def monitor_continuous(interval=5):
    """Continuously monitor the microservice"""
    print("Starting continuous monitoring...")
    print(f"Checking every {interval} seconds. Press Ctrl+C to stop.")
    
    try:
        while True:
            health = check_health()
            
            # Alert if there are issues
            if health:
                stuck = health.get('stuck_requests', [])
                if stuck:
                    print("\n🚨 ALERT: Requests are stuck! Check the details above.")
                
                active = health.get('active_requests', 0)
                if active > 10:
                    print(f"\n⚠️  WARNING: High number of active requests ({active})")
            
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "continuous":
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            monitor_continuous(interval)
        elif sys.argv[1] == "once":
            check_health()
    else:
        print("Usage:")
        print("  python monitor_microservice.py once           - Single health check")
        print("  python monitor_microservice.py continuous [N] - Monitor every N seconds (default 5)")
        print("\nRunning single check...\n")
        check_health()
