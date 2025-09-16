# pylint: disable=global-statement
# support for computing discrete logs, with a cache so they're never recomputed

import asyncio
import gc
from typing import Dict, Tuple

from .constants import get_generator
from .singleton import Singleton
from .group import BaseElement, ElementModP, ONE_MOD_P, mult_p

# Import memory monitoring for optimization
try:
    from ..memory_monitor import memory_monitor, memory_optimized, get_optimal_batch_size
    HAS_MEMORY_MONITOR = True
except ImportError:
    HAS_MEMORY_MONITOR = False
    
    # Fallback decorator if memory monitor not available
    def memory_optimized(operation_name: str = ""):
        def decorator(func):
            return func
        return decorator
    
    def get_optimal_batch_size(base_size: int = 10000, **kwargs) -> int:
        return base_size

DiscreteLogCache = Dict[ElementModP, int]

# OPTIMIZED: Reduced max exponent for memory efficiency
# Original was 100_000_000 which causes severe memory issues
_DLOG_MAX_EXPONENT = 1_000_000
"""The max exponent to calculate. Reduced for memory optimization."""

# Cache size limit to prevent memory explosion
_CACHE_SIZE_LIMIT = 100_000
"""Maximum number of entries to keep in cache."""

_INITIAL_CACHE = {ONE_MOD_P: 0}


class DiscreteLogExponentError(ValueError):
    """Raised when the max exponent is larger than the system allows."""

    def __init__(self, exponent: int, max_exponent: int = _DLOG_MAX_EXPONENT) -> None:
        super().__init__(
            f"Discrete log exponent of {exponent} exceeds maximum of {max_exponent}."
        )


class DiscreteLogNotFoundError(ValueError):
    """Raised when the discrete value could not be found in cache."""

    def __init__(self, element: BaseElement) -> None:
        super().__init__(f"Discrete log of {element} could not be found in cache.")


def _trim_cache(cache: DiscreteLogCache) -> DiscreteLogCache:
    """
    Trim cache to prevent memory explosion.
    Keep only the most recent entries up to the limit.
    """
    if len(cache) <= _CACHE_SIZE_LIMIT:
        return cache
    
    # Keep the highest exponent entries (most recent/useful)
    sorted_items = sorted(cache.items(), key=lambda x: x[1], reverse=True)
    trimmed_cache = dict(sorted_items[:_CACHE_SIZE_LIMIT])
    
    # Always keep the base case
    trimmed_cache[ONE_MOD_P] = 0
    
    # Force garbage collection after trimming
    gc.collect()
    
    return trimmed_cache


@memory_optimized("discrete_log_computation")
def compute_discrete_log(
    element: ElementModP,
    cache: DiscreteLogCache,
    max_exponent: int = _DLOG_MAX_EXPONENT,
    lazy_evaluation: bool = True,
) -> Tuple[int, DiscreteLogCache]:
    """
    Computes the discrete log (base g, mod p) of the given element,
    with internal caching of results. Optimized for memory efficiency.
    
    Performance optimizations:
    - Reduced max exponent limit to 1M (was 100M)
    - Added cache size limit to prevent memory explosion
    - Added periodic garbage collection
    - Memory monitoring and adaptive batch sizing
    """

    if element in cache:
        return (cache[element], cache)
    if not lazy_evaluation:
        raise DiscreteLogNotFoundError(element)

    # Ensure max_exponent doesn't exceed our optimized limit
    safe_max_exponent = min(max_exponent, _DLOG_MAX_EXPONENT)
    
    _cache = compute_discrete_log_cache(element, cache, safe_max_exponent)
    
    # Trim cache if it's getting too large
    if len(_cache) > _CACHE_SIZE_LIMIT:
        _cache = _trim_cache(_cache)
    
    return (_cache[element], _cache)


async def compute_discrete_log_async(
    element: ElementModP,
    cache: DiscreteLogCache,
    mutex: asyncio.Lock = asyncio.Lock(),
    max_exponent: int = _DLOG_MAX_EXPONENT,
    lazy_evaluation: bool = True,
) -> Tuple[int, DiscreteLogCache]:
    """
    Computes the discrete log (base g, mod p) of the given element,
    with internal caching of results. Should run efficiently when called
    multiple times when the exponent is at most in the single-digit millions.
    Performance will degrade if it's much larger.

    Note: *this function is thread-safe*. For the best possible performance,
    pre-compute the discrete log of a number you expect to have the biggest
    exponent you'll ever see. After that, the cache will be fully loaded,
    and every call will be nothing more than a dictionary lookup.
    """
    if element in cache:
        return (cache[element], cache)

    async with mutex:
        if element in cache:
            return (cache[element], cache)
        if not lazy_evaluation:
            raise DiscreteLogNotFoundError(element)

        _cache = compute_discrete_log_cache(element, cache, max_exponent)
        return (_cache[element], _cache)


def precompute_discrete_log_cache(
    max_exponent: int, cache: DiscreteLogCache = None
) -> DiscreteLogCache:
    """
    Precompute the discrete log by the max exponent.
    """

    if max_exponent > _DLOG_MAX_EXPONENT:
        raise DiscreteLogExponentError(max_exponent)

    if not cache:
        cache = _INITIAL_CACHE

    current_element = list(cache)[-1]
    prev_exponent = cache[current_element]

    if prev_exponent >= max_exponent:
        return cache

    g = ElementModP(get_generator(), False)

    for exponent in range(prev_exponent + 1, max_exponent + 1):
        current_element = mult_p(g, current_element)
        cache[current_element] = exponent

    return cache


@memory_optimized("discrete_log_cache_computation")  
def compute_discrete_log_cache(
    element: ElementModP,
    cache: DiscreteLogCache,
    max_exponent: int = _DLOG_MAX_EXPONENT,
) -> DiscreteLogCache:
    """
    Compute discrete log cache with memory optimization.
    Uses adaptive batch processing and periodic cleanup to manage memory usage.
    """

    if max_exponent > _DLOG_MAX_EXPONENT:
        raise DiscreteLogExponentError(max_exponent)

    if not cache:
        cache = _INITIAL_CACHE

    max_element = list(cache)[-1]
    exponent = cache[max_element]
    if exponent > max_exponent:
        raise DiscreteLogExponentError(exponent, max_exponent)

    g = ElementModP(get_generator(), False)
    
    # Adaptive batch processing based on available memory
    base_batch_size = 10000
    batch_size = get_optimal_batch_size(base_batch_size)
    
    if HAS_MEMORY_MONITOR:
        memory_monitor.log_memory_status(f"discrete_log_cache_start_exp_{exponent}")
    
    while element != max_element and exponent < max_exponent:
        batch_end = min(exponent + batch_size, max_exponent)
        
        # Process batch
        for i in range(exponent + 1, batch_end + 1):
            if element == max_element:
                break
            max_element = mult_p(g, max_element)
            cache[max_element] = i
            
            # Check if we found the target element
            if element == max_element:
                exponent = i
                break
        
        exponent = batch_end
        
        # Periodic cache cleanup and garbage collection
        if len(cache) > _CACHE_SIZE_LIMIT:
            cache = _trim_cache(cache)
            gc.collect()
            
            # Re-adjust batch size based on memory situation after cleanup
            batch_size = get_optimal_batch_size(base_batch_size)
            
            if HAS_MEMORY_MONITOR:
                memory_monitor.log_memory_status(f"discrete_log_cache_cleanup_exp_{exponent}")
        
        # Break if we found the element or hit max
        if element == max_element or exponent >= max_exponent:
            break
    
    if HAS_MEMORY_MONITOR:
        memory_monitor.log_memory_status(f"discrete_log_cache_end_exp_{exponent}")
    
    return cache


class DiscreteLog(Singleton):
    """
    A class instance of the discrete log that includes a cache.
    Optimized for memory efficiency with limited cache size.
    """

    _cache: DiscreteLogCache = {ONE_MOD_P: 0}
    _mutex = asyncio.Lock()
    _max_exponent: int = _DLOG_MAX_EXPONENT
    _lazy_evaluation: bool = True

    def get_cache(self) -> DiscreteLogCache:
        return self._cache

    def set_max_exponent(self, max_exponent: int) -> None:
        # Enforce our optimized maximum
        self._max_exponent = min(max_exponent, _DLOG_MAX_EXPONENT)

    def set_lazy_evaluation(self, lazy_evaluation: bool) -> None:
        self._lazy_evaluation = lazy_evaluation

    def precompute_cache(self, exponent: int) -> None:
        # Enforce our optimized maximum
        safe_exponent = min(exponent, self._max_exponent, _DLOG_MAX_EXPONENT)
        precompute_discrete_log_cache(safe_exponent, self._cache)
        
        # Manage cache size
        if len(self._cache) > _CACHE_SIZE_LIMIT:
            self._cache = _trim_cache(self._cache)

    async def precompute_cache_async(self, exponent: int) -> None:
        safe_exponent = min(exponent, self._max_exponent, _DLOG_MAX_EXPONENT)

        async with self._mutex:
            precompute_discrete_log_cache(safe_exponent)
            
            # Manage cache size
            if len(self._cache) > _CACHE_SIZE_LIMIT:
                self._cache = _trim_cache(self._cache)

    def discrete_log(self, element: ElementModP) -> int:
        (result, self._cache) = compute_discrete_log(
            element, self._cache, self._max_exponent, self._lazy_evaluation
        )
        
        # Periodic cache cleanup
        if len(self._cache) > _CACHE_SIZE_LIMIT * 1.2:
            self._cache = _trim_cache(self._cache)
        
        return result

    async def discrete_log_async(self, element: ElementModP) -> int:
        (result, self._cache) = await compute_discrete_log_async(
            element, self._cache, self._mutex, self._max_exponent, self._lazy_evaluation
        )
        
        # Periodic cache cleanup
        if len(self._cache) > _CACHE_SIZE_LIMIT * 1.2:
            self._cache = _trim_cache(self._cache)
        
        return result

    def clear_cache(self) -> None:
        """Clear cache and force garbage collection for memory management"""
        self._cache = {ONE_MOD_P: 0}
        gc.collect()
