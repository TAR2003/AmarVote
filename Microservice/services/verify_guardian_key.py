#!/usr/bin/env python

import json
from typing import Any, Dict, Union

from electionguard.group import g_pow_p, int_to_p, int_to_q


def _extract_key_int(payload: Union[str, int, Dict[str, Any]], field_name: str) -> int:
    if payload is None:
        raise ValueError(f"Missing {field_name}")

    if isinstance(payload, int):
        return payload

    if isinstance(payload, str):
        trimmed = payload.strip()
        if trimmed.isdigit():
            return int(trimmed)
        parsed = json.loads(trimmed)
        return _extract_key_int(parsed, field_name)

    if isinstance(payload, dict):
        value = payload.get(field_name)
        if value is None and field_name == "public_key":
            value = payload.get("publicKey")
        if value is None and field_name == "private_key":
            value = payload.get("privateKey")
        if value is None:
            raise ValueError(f"Missing {field_name} in payload")
        return int(value)

    raise ValueError(f"Unsupported payload type for {field_name}")


def verify_guardian_key_service(private_key_payload: str, stored_public_key: str) -> Dict[str, Any]:
    """
    Verify that a guardian's decrypted private key matches the public key stored in the database.
    Nothing is persisted; the result is returned only to the caller.
    """
    try:
        private_key_int = _extract_key_int(private_key_payload, "private_key")
        stored_public_key_int = _extract_key_int(stored_public_key, "public_key")

        private_key = int_to_q(private_key_int)
        computed_public_key = g_pow_p(private_key)
        expected_public_key = int_to_p(stored_public_key_int)

        verified = computed_public_key == expected_public_key

        return {
            "status": "success",
            "verified": verified,
            "message": (
                "Your credential file matches the public key on record for this election."
                if verified
                else "Your credential file does not match the public key stored for this election."
            ),
        }
    except (ValueError, json.JSONDecodeError, TypeError):
        return {
            "status": "success",
            "verified": False,
            "message": "Unable to verify credentials. Ensure you uploaded the correct credentials.txt file.",
        }
    except Exception:
        return {
            "status": "error",
            "message": "Verification could not be completed. Please try again.",
        }
