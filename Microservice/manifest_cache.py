"""
Manifest and context caching to avoid expensive recreation.
The manifest creation is expensive (~100-200ms) and gets called for EVERY operation.
Bounded LRU caches prevent unbounded memory growth across elections.
"""

import hashlib
import json
import os
import threading
from collections import OrderedDict
from typing import Callable, Dict, Tuple, TypeVar

from electionguard.election import CiphertextElectionContext
from electionguard.manifest import InternalManifest, Manifest
from electionguard_tools.helpers.election_builder import ElectionBuilder
from electionguard.group import int_to_p, int_to_q
from electionguard.utils import get_optional

T = TypeVar("T")

MANIFEST_CACHE_MAX = int(os.environ.get("MANIFEST_CACHE_MAX", "16"))
CONTEXT_CACHE_MAX = int(os.environ.get("CONTEXT_CACHE_MAX", "32"))


class _LRUCache:
    """Thread-safe fixed-size LRU cache."""

    def __init__(self, max_size: int):
        self.max_size = max(1, max_size)
        self._data: OrderedDict[str, T] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def set(self, key: str, value: T) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = value
            while len(self._data) > self.max_size:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


class ManifestCache:
    """Thread-safe manifest and context cache with bounded LRU eviction."""

    def __init__(
        self,
        manifest_max: int = MANIFEST_CACHE_MAX,
        context_max: int = CONTEXT_CACHE_MAX,
    ):
        self._manifest_cache = _LRUCache[Manifest](manifest_max)
        self._context_cache = _LRUCache[
            Tuple[InternalManifest, CiphertextElectionContext]
        ](context_max)

    def _get_manifest_key(
        self, party_names: list, candidate_names: list, max_choices: int = 1
    ) -> str:
        key_data = json.dumps(
            {
                "parties": sorted(party_names),
                "candidates": sorted(candidate_names),
                "max_choices": max_choices,
            },
            sort_keys=True,
        )
        return hashlib.sha256(key_data.encode()).hexdigest()

    def _get_context_key(
        self,
        manifest_key: str,
        joint_public_key: int,
        commitment_hash: int,
        number_of_guardians: int,
        quorum: int,
    ) -> str:
        key_data = (
            f"{manifest_key}:{joint_public_key}:{commitment_hash}:"
            f"{number_of_guardians}:{quorum}"
        )
        return hashlib.sha256(key_data.encode()).hexdigest()

    def get_or_create_manifest(
        self,
        party_names: list,
        candidate_names: list,
        create_manifest_func: Callable,
        max_choices: int = 1,
    ) -> Manifest:
        cache_key = self._get_manifest_key(party_names, candidate_names, max_choices)

        cached = self._manifest_cache.get(cache_key)
        if cached is not None:
            print(
                f"  ⚡ MANIFEST FROM CACHE (max_choices={max_choices}) - "
                f"key: {cache_key[:8]}... (FAST!)"
            )
            return cached

        manifest = create_manifest_func(party_names, candidate_names, max_choices)
        self._manifest_cache.set(cache_key, manifest)
        print(
            f"  📝 MANIFEST CREATED (cached, max_choices={max_choices}) - "
            f"key: {cache_key[:8]}..."
        )
        return manifest

    def get_or_create_context(
        self,
        party_names: list,
        candidate_names: list,
        joint_public_key_int: int,
        commitment_hash_int: int,
        number_of_guardians: int,
        quorum: int,
        create_manifest_func: Callable,
        max_choices: int = 1,
    ) -> Tuple[InternalManifest, CiphertextElectionContext]:
        manifest_key = self._get_manifest_key(party_names, candidate_names, max_choices)
        context_key = self._get_context_key(
            manifest_key,
            joint_public_key_int,
            commitment_hash_int,
            number_of_guardians,
            quorum,
        )

        cached = self._context_cache.get(context_key)
        if cached is not None:
            print(
                f"  ⚡ CONTEXT FROM CACHE (max_choices={max_choices}) - "
                f"key: {context_key[:8]}... (FAST!)"
            )
            return cached

        manifest = self.get_or_create_manifest(
            party_names, candidate_names, create_manifest_func, max_choices
        )

        joint_public_key = int_to_p(joint_public_key_int)
        commitment_hash = int_to_q(commitment_hash_int)

        election_builder = ElectionBuilder(
            number_of_guardians=number_of_guardians,
            quorum=quorum,
            manifest=manifest,
        )
        election_builder.set_public_key(joint_public_key)
        election_builder.set_commitment_hash(commitment_hash)

        internal_manifest, context = get_optional(election_builder.build())
        result = (internal_manifest, context)
        self._context_cache.set(context_key, result)
        print(
            f"  🔨 CONTEXT CREATED (cached, max_choices={max_choices}) - "
            f"key: {context_key[:8]}..."
        )
        return result

    def clear(self) -> None:
        """Clear all caches."""
        self._manifest_cache.clear()
        self._context_cache.clear()
        print("  🗑️  CACHE CLEARED")


_global_cache = ManifestCache()


def get_manifest_cache() -> ManifestCache:
    """Get the global manifest cache instance."""
    return _global_cache
