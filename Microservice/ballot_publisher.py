"""
Integration script for secure ballot publication in ElectionGuard API.

CAST ballots are sanitized and returned in the response only (stateless).
Persistent storage lives in the AmarVote backend database.

AUDITED ballots use a small in-process LRU cache so /ballots/* debug endpoints
can still serve recent audit workflows without unbounded memory growth.
"""

import json
import os
import time
from collections import OrderedDict
from typing import Any, Dict, Optional

from ballot_sanitizer import process_ballot_response

# Bounded cache for audited ballots only (CAST is fully stateless).
AUDITED_BALLOT_CACHE_MAX = int(os.environ.get("AUDITED_BALLOT_CACHE_MAX", "32"))


class _LRUStore:
    """Fixed-size LRU keyed store."""

    def __init__(self, max_size: int):
        self.max_size = max(1, max_size)
        self._data: OrderedDict[str, Any] = OrderedDict()

    def __len__(self) -> int:
        return len(self._data)

    def set(self, key: str, value: Any) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = value
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)

    def get(self, key: str) -> Optional[Any]:
        if key not in self._data:
            return None
        self._data.move_to_end(key)
        return self._data[key]

    def items(self):
        return self._data.items()


class BallotPublisher:
    """
    Sanitize ballots for publication. CAST path is stateless; audited ballots
    are kept in a bounded LRU for optional /ballots/* retrieval.
    """

    def __init__(self):
        self._audited_ballots = _LRUStore(AUDITED_BALLOT_CACHE_MAX)
        self._ballot_nonces = _LRUStore(AUDITED_BALLOT_CACHE_MAX)
        self._cast_processed_count = 0

    def publish_ballot(
        self, ballot_id: str, encrypted_ballot_response: str, ballot_status: str
    ) -> Dict[str, Any]:
        """
        Publish a ballot securely based on its status.

        CAST: sanitize and return — nothing stored in memory.
        AUDITED: sanitize, return, and cache in bounded LRU for nonce retrieval.
        """
        if ballot_status.upper() not in ["CAST", "AUDITED"]:
            raise ValueError("ballot_status must be either 'CAST' or 'AUDITED'")

        try:
            publication_data = process_ballot_response(
                encrypted_ballot_response, ballot_status
            )

            if ballot_status.upper() == "CAST":
                self._cast_processed_count += 1
                return {
                    "ballot_id": ballot_id,
                    "status": "CAST",
                    "ballot_hash": publication_data["ballot_hash"],
                    "encrypted_ballot": publication_data["sanitized_encrypted_ballot"],
                    "publication_status": "published_without_nonces",
                }

            # AUDITED — bounded LRU for /ballots/* endpoints
            self._audited_ballots.set(
                ballot_id,
                {
                    "ballot_id": ballot_id,
                    "status": "AUDITED",
                    "published_at": self._get_timestamp(),
                    "ballot_hash": publication_data["ballot_hash"],
                    "sanitized_ballot": publication_data["sanitized_encrypted_ballot"],
                },
            )
            self._ballot_nonces.set(ballot_id, publication_data["nonces_to_reveal"])

            return {
                "ballot_id": ballot_id,
                "status": "AUDITED",
                "ballot_hash": publication_data["ballot_hash"],
                "encrypted_ballot": publication_data["sanitized_encrypted_ballot"],
                "ballot_nonces": publication_data["nonces_to_reveal"],
                "publication_status": "published_with_nonces",
            }

        except Exception as e:
            raise Exception(f"Failed to publish ballot {ballot_id}: {str(e)}") from e

    def get_published_ballot(self, ballot_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a published ballot. CAST ballots are not stored — use the backend DB."""
        audited = self._audited_ballots.get(ballot_id)
        if audited:
            ballot_data = audited.copy()
            ballot_data["nonces_available"] = True
            ballot_data["ballot_nonces"] = self._ballot_nonces.get(ballot_id)
            return ballot_data

        return None

    def get_ballot_nonces(self, ballot_id: str) -> Optional[Dict[str, str]]:
        """Get nonces for an audited ballot (not available for CAST)."""
        if self._audited_ballots.get(ballot_id):
            return self._ballot_nonces.get(ballot_id)
        return None

    def list_published_ballots(self, status_filter: Optional[str] = None) -> Dict[str, list]:
        """List cached audited ballots. CAST ballots are not retained in memory."""
        result = {"cast_ballots": [], "audited_ballots": []}

        if not status_filter or status_filter.upper() == "AUDITED":
            result["audited_ballots"] = [
                {
                    "ballot_id": bid,
                    "ballot_hash": data["ballot_hash"],
                    "published_at": data["published_at"],
                    "nonces_available": True,
                    "nonce_count": len(self._ballot_nonces.get(bid) or {}),
                }
                for bid, data in self._audited_ballots.items()
            ]

        return result

    def get_publication_stats(self) -> Dict[str, Any]:
        """Publication statistics (CAST count is cumulative, not stored ballots)."""
        return {
            "cast_ballots_processed": self._cast_processed_count,
            "cast_ballots_cached": 0,
            "audited_ballots_cached": len(self._audited_ballots),
            "nonces_stored": len(self._ballot_nonces),
            "audited_cache_max": AUDITED_BALLOT_CACHE_MAX,
            "cast_storage": "stateless",
        }

    def _get_timestamp(self) -> int:
        return int(time.time())


def create_ballot_publication_endpoints(app, publisher: BallotPublisher):
    """
    Example function showing how to integrate with a Flask app.

    Args:
        app: Flask application instance
        publisher: BallotPublisher instance
    """

    @app.route("/api/ballots/publish", methods=["POST"])
    def publish_ballot_endpoint():
        """Endpoint to publish a ballot securely."""
        try:
            data = request.get_json()

            ballot_id = data.get("ballot_id")
            encrypted_ballot_response = data.get("encrypted_ballot_response")
            ballot_status = data.get("ballot_status")

            if not all([ballot_id, encrypted_ballot_response, ballot_status]):
                return {"error": "Missing required fields"}, 400

            result = publisher.publish_ballot(
                ballot_id=ballot_id,
                encrypted_ballot_response=encrypted_ballot_response,
                ballot_status=ballot_status,
            )

            return result, 200

        except Exception as e:
            return {"error": str(e)}, 500

    @app.route("/api/ballots/<ballot_id>", methods=["GET"])
    def get_ballot_endpoint(ballot_id):
        """Endpoint to retrieve a published ballot."""
        ballot = publisher.get_published_ballot(ballot_id)
        if ballot:
            return ballot, 200
        return {"error": "Ballot not found"}, 404

    @app.route("/api/ballots/<ballot_id>/nonces", methods=["GET"])
    def get_ballot_nonces_endpoint(ballot_id):
        """Endpoint to get nonces for an audited ballot."""
        nonces = publisher.get_ballot_nonces(ballot_id)
        if nonces:
            return {"ballot_id": ballot_id, "nonces": nonces}, 200
        return {"error": "Nonces not available for this ballot"}, 404

    @app.route("/api/ballots", methods=["GET"])
    def list_ballots_endpoint():
        """Endpoint to list all published ballots."""
        status_filter = request.args.get("status")
        ballots = publisher.list_published_ballots(status_filter)
        return ballots, 200

    @app.route("/api/ballots/stats", methods=["GET"])
    def get_stats_endpoint():
        """Endpoint to get publication statistics."""
        stats = publisher.get_publication_stats()
        return stats, 200


def example_usage():
    """Example usage of the BallotPublisher class."""
    print("=== BALLOT PUBLISHER EXAMPLE ===\n")

    publisher = BallotPublisher()

    try:
        with open("create_encrypted_ballot_response.json", "r") as f:
            sample_ballot_response = f.read()
    except FileNotFoundError:
        print("Sample ballot response file not found")
        return

    print("1. Publishing CAST ballot (stateless)...")
    cast_result = publisher.publish_ballot(
        ballot_id="ballot-001-cast",
        encrypted_ballot_response=sample_ballot_response,
        ballot_status="CAST",
    )
    print(f"Cast ballot published: {cast_result['publication_status']}")
    print(f"Retrievable from cache: {publisher.get_published_ballot('ballot-001-cast') is not None}")

    print("\n2. Publishing AUDITED ballot (bounded LRU)...")
    audited_result = publisher.publish_ballot(
        ballot_id="ballot-002-audited",
        encrypted_ballot_response=sample_ballot_response,
        ballot_status="AUDITED",
    )
    print(f"Audited ballot published: {audited_result['publication_status']}")

    print("\n3. Publication statistics:")
    stats = publisher.get_publication_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")

    print("\n✓ Ballot publisher example completed successfully")


if __name__ == "__main__":
    example_usage()
