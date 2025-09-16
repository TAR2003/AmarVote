#!/usr/bin/env python3
"""
Test script for memory-optimized discrete log computation.
Run this before deploying to test the optimizations.
"""

import sys
import time
from electionguard.discrete_log import DiscreteLog, _DLOG_MAX_EXPONENT
from electionguard.group import ElementModP, int_to_p
from memory_monitor import memory_monitor, MemoryMonitor

def test_discrete_log_memory_optimization():
    """Test the discrete log optimization with memory monitoring."""
    print("Testing ElectionGuard discrete log memory optimizations...")
    print(f"Max exponent limit: {_DLOG_MAX_EXPONENT:,}")
    
    # Initialize memory monitor
    monitor = MemoryMonitor(warning_threshold_mb=500, critical_threshold_mb=800)
    
    # Initialize discrete log instance
    dlog = DiscreteLog()
    
    # Test with small values first
    print("\n=== Testing small discrete log computations ===")
    test_values = [1, 2, 5, 10, 100, 1000]
    
    for val in test_values:
        monitor.log_memory_status(f"test_value_{val}_start")
        
        start_time = time.time()
        element = int_to_p(val)
        result = dlog.discrete_log(element)
        end_time = time.time()
        
        monitor.log_memory_status(f"test_value_{val}_end")
        print(f"  Value {val}: discrete_log = {result}, time = {end_time - start_time:.3f}s")
    
    # Test cache size management
    print(f"\n=== Cache size after tests: {len(dlog.get_cache())} entries ===")
    
    # Test larger computation (but within limits)
    print("\n=== Testing larger computation ===")
    monitor.log_memory_status("large_test_start")
    
    start_time = time.time()
    large_element = int_to_p(50000)  # This should be manageable with optimizations
    try:
        result = dlog.discrete_log(large_element)
        end_time = time.time()
        print(f"  Large test (50000): discrete_log = {result}, time = {end_time - start_time:.3f}s")
    except Exception as e:
        print(f"  Large test failed: {e}")
    
    monitor.log_memory_status("large_test_end")
    print(f"  Final cache size: {len(dlog.get_cache())} entries")
    
    # Test cache cleanup
    print("\n=== Testing cache cleanup ===")
    dlog.clear_cache()
    monitor.force_cleanup()
    monitor.log_memory_status("cleanup_complete")
    print(f"  Cache size after cleanup: {len(dlog.get_cache())} entries")

if __name__ == "__main__":
    try:
        test_discrete_log_memory_optimization()
        print("\n✅ Memory optimization test completed successfully!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)