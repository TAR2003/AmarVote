#!/usr/bin/env python3
"""
Memory monitoring utility for ElectionGuard discrete log operations.
Helps track and manage memory usage during cryptographic computations.
"""

import gc
import psutil
import os
import time
from typing import Dict, Any
from functools import wraps


class MemoryMonitor:
    """Monitor and manage memory usage during ElectionGuard operations."""
    
    def __init__(self, warning_threshold_mb: int = 800, critical_threshold_mb: int = 950):
        """
        Initialize memory monitor.
        
        Args:
            warning_threshold_mb: Memory usage to trigger warnings (MB)
            critical_threshold_mb: Memory usage to trigger aggressive cleanup (MB)
        """
        self.warning_threshold = warning_threshold_mb * 1024 * 1024  # Convert to bytes
        self.critical_threshold = critical_threshold_mb * 1024 * 1024
        self.process = psutil.Process(os.getpid())
        
    def get_memory_info(self) -> Dict[str, Any]:
        """Get detailed memory information."""
        memory_info = self.process.memory_info()
        memory_percent = self.process.memory_percent()
        
        # System memory
        system_memory = psutil.virtual_memory()
        swap_memory = psutil.swap_memory()
        
        return {
            'process_rss_mb': memory_info.rss / 1024 / 1024,
            'process_vms_mb': memory_info.vms / 1024 / 1024,
            'process_percent': memory_percent,
            'system_total_mb': system_memory.total / 1024 / 1024,
            'system_available_mb': system_memory.available / 1024 / 1024,
            'system_used_percent': system_memory.percent,
            'swap_total_mb': swap_memory.total / 1024 / 1024,
            'swap_used_mb': swap_memory.used / 1024 / 1024,
            'swap_percent': swap_memory.percent
        }
        
    def check_memory_status(self) -> str:
        """Check current memory status and return status level."""
        memory_info = self.process.memory_info()
        
        if memory_info.rss >= self.critical_threshold:
            return "CRITICAL"
        elif memory_info.rss >= self.warning_threshold:
            return "WARNING"
        else:
            return "OK"
            
    def force_cleanup(self) -> None:
        """Force aggressive garbage collection and memory cleanup."""
        # Force garbage collection multiple times
        for _ in range(3):
            gc.collect()
            time.sleep(0.1)
            
        # Force collection of all generations
        if hasattr(gc, 'collect'):
            collected = []
            for generation in range(gc.get_count().__len__()):
                collected.append(gc.collect(generation))
                
    def log_memory_status(self, operation: str = "operation") -> None:
        """Log current memory status with operation context."""
        info = self.get_memory_info()
        status = self.check_memory_status()
        
        print(f"[MEMORY-{status}] {operation}: "
              f"Process={info['process_rss_mb']:.1f}MB ({info['process_percent']:.1f}%), "
              f"System={info['system_used_percent']:.1f}%, "
              f"Swap={info['swap_percent']:.1f}%")
              
        if status == "CRITICAL":
            print(f"[MEMORY-CRITICAL] Triggering aggressive cleanup for {operation}")
            self.force_cleanup()


# Global memory monitor instance
memory_monitor = MemoryMonitor()


def memory_optimized(operation_name: str = "discrete_log_operation"):
    """
    Decorator to monitor and optimize memory usage for functions.
    
    Args:
        operation_name: Name of the operation for logging
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Pre-operation memory check
            memory_monitor.log_memory_status(f"{operation_name}_start")
            
            try:
                result = func(*args, **kwargs)
                
                # Post-operation memory check
                memory_monitor.log_memory_status(f"{operation_name}_end")
                
                # Cleanup if needed
                status = memory_monitor.check_memory_status()
                if status in ["WARNING", "CRITICAL"]:
                    memory_monitor.force_cleanup()
                    memory_monitor.log_memory_status(f"{operation_name}_cleanup")
                    
                return result
                
            except Exception as e:
                # Error cleanup
                memory_monitor.log_memory_status(f"{operation_name}_error")
                memory_monitor.force_cleanup()
                raise e
                
        return wrapper
    return decorator


def check_memory_before_operation(required_mb: int = 100) -> bool:
    """
    Check if there's enough memory available for an operation.
    
    Args:
        required_mb: Estimated memory requirement in MB
        
    Returns:
        True if enough memory is available
    """
    info = memory_monitor.get_memory_info()
    available_mb = info['system_available_mb']
    
    if available_mb < required_mb:
        print(f"[MEMORY-WARNING] Insufficient memory: need {required_mb}MB, have {available_mb:.1f}MB")
        # Try cleanup
        memory_monitor.force_cleanup()
        
        # Recheck after cleanup
        info = memory_monitor.get_memory_info()
        available_mb = info['system_available_mb']
        
        if available_mb < required_mb:
            print(f"[MEMORY-ERROR] Still insufficient memory after cleanup: {available_mb:.1f}MB")
            return False
            
    return True


def get_optimal_batch_size(base_size: int = 10000, available_memory_mb: float = None) -> int:
    """
    Calculate optimal batch size based on available memory.
    
    Args:
        base_size: Base batch size
        available_memory_mb: Available memory in MB (auto-detected if None)
        
    Returns:
        Optimal batch size
    """
    if available_memory_mb is None:
        info = memory_monitor.get_memory_info()
        available_memory_mb = info['system_available_mb']
    
    # Adjust batch size based on available memory
    if available_memory_mb < 200:  # Less than 200MB available
        return max(base_size // 4, 1000)  # Reduce to 25%
    elif available_memory_mb < 500:  # Less than 500MB available  
        return max(base_size // 2, 5000)  # Reduce to 50%
    else:
        return base_size


if __name__ == "__main__":
    # Test memory monitoring
    memory_monitor.log_memory_status("test")
    print("Memory monitor initialized successfully")