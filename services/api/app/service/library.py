"""Business logic for the audio library — list / play / download / delete.

B2 is the system of record. There is no application database: every
field shown on the library page is derived from `list_objects_v2` +
`head_object`, and every deletion is a single `delete_object` call.
"""

import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from app.config import settings
from app.repo import (
    delete_generation,
    get_generation_stats,
    head_generation,
    list_generations,
    presign_get,
)
from app.types import (
    DailyGenerationCount,
    Generation,
    GenerationStats,
    PlaybackUrlResponse,
)

# A valid generations/ key looks like `generations/<yyyy>/<mm>/<hex>.wav`.
# Anything else is either path-traversal probing or a stale link from
# before the key convention; either way, reject.
_KEY_RE = re.compile(r"^generations/\d{4}/\d{2}/[0-9a-f]+\.wav$")
_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")


class KeyError_(Exception):
    """Raised when a key is invalid or out of scope."""

    def __init__(self, detail: str = "Invalid key"):
        self.detail = detail
        super().__init__(detail)


class NotFoundError(Exception):
    def __init__(self, detail: str = "Generation not found"):
        self.detail = detail
        super().__init__(detail)


def validate_key(key: str) -> None:
    """Reject anything that isn't a well-formed generations/ key."""
    if not key:
        raise KeyError_("Empty key")
    if _DANGEROUS_KEY_RE.search(key.lower()):
        raise KeyError_("Path traversal pattern in key")
    if not key.startswith(settings.generations_prefix):
        raise KeyError_("Key outside generations/ prefix")
    if not _KEY_RE.match(key):
        raise KeyError_("Malformed generations/ key")


def list_recent(limit: int = 100) -> list[Generation]:
    if limit < 1 or limit > 500:
        raise ValueError("Limit must be between 1 and 500")
    generations = list_generations(max_keys=1000)
    return generations[:limit]


def get_stats() -> GenerationStats:
    data = get_generation_stats()
    return GenerationStats(**data)


def get_playback_url(key: str) -> PlaybackUrlResponse:
    validate_key(key)
    meta = head_generation(key)
    if not meta:
        raise NotFoundError()
    url = presign_get(key=key, expires_in=settings.presign_expires_in)
    return PlaybackUrlResponse(url=url, expires_in=settings.presign_expires_in)


def get_download_url(key: str) -> PlaybackUrlResponse:
    """Like `get_playback_url`, but force `Content-Disposition: attachment`."""
    validate_key(key)
    meta = head_generation(key)
    if not meta:
        raise NotFoundError()
    filename = key.rsplit("/", 1)[-1]
    url = presign_get(
        key=key,
        expires_in=settings.presign_expires_in,
        download_filename=filename,
    )
    return PlaybackUrlResponse(url=url, expires_in=settings.presign_expires_in)


def remove(key: str) -> None:
    validate_key(key)
    delete_generation(key)


def get_activity(days: int = 7) -> list[DailyGenerationCount]:
    """Daily generation counts over the last N days."""
    generations = list_generations(max_keys=1000)
    today = datetime.now(UTC).date()
    cutoff = today - timedelta(days=days - 1)

    counts: dict[str, int] = defaultdict(int)
    for g in generations:
        d = g.created_at.date()
        if d >= cutoff:
            counts[d.isoformat()] += 1

    return [
        DailyGenerationCount(
            date=(cutoff + timedelta(days=i)).isoformat(),
            generations=counts.get((cutoff + timedelta(days=i)).isoformat(), 0),
        )
        for i in range(days)
    ]
