"""Business logic for issuing presigned URLs.

The browser is the *only* uploader in this app — synthesized WAVs never
touch the API. The service layer chooses the object key, packs the
caller's metadata into `x-amz-meta-*`, and asks the repo for a signed
PUT URL plus the exact headers the browser must echo back on its PUT.
"""

import logging
import re
import uuid
from datetime import UTC, datetime

from app.config import settings
from app.repo import presign_put
from app.types import PresignRequest, PresignResponse

logger = logging.getLogger(__name__)

WAV_CONTENT_TYPE = "audio/wav"

# HTTP header field-values forbid CR / LF / NUL and other control bytes
# (RFC 9110 §5.5); browsers also reject non-ASCII via
# `XMLHttpRequest.setRequestHeader`, and S3 user-metadata is ASCII-only.
# A `text_preview` slice that contains any of those — common when the
# user pastes prose with embedded newlines — would otherwise make the
# browser throw `Failed to execute 'setRequestHeader' on
# 'XMLHttpRequest': '…' is not a valid HTTP header field value` and the
# PUT to B2 never leaves the page. Collapse anything outside printable
# ASCII into a single space so the value the API signs is the same
# value the browser is allowed to echo back.
_HEADER_INVALID = re.compile(r"[^\x20-\x7E]+")
_WHITESPACE_RUN = re.compile(r"\s+")


def _sanitize_header_value(value: str, *, max_length: int) -> str:
    """Return `value` reduced to a single line of printable ASCII."""
    sanitized = _HEADER_INVALID.sub(" ", value)
    sanitized = _WHITESPACE_RUN.sub(" ", sanitized).strip()
    return sanitized[:max_length]


def _build_key() -> str:
    """Generate a unique, time-bucketed key for a new WAV."""
    now = datetime.now(UTC)
    return (
        f"{settings.generations_prefix}"
        f"{now.year:04d}/{now.month:02d}/{uuid.uuid4().hex}.wav"
    )


def _metadata_from_request(req: PresignRequest) -> dict[str, str]:
    """Map the validated request to `x-amz-meta-*` string values.

    S3 metadata values are always strings, even when the underlying
    field is numeric. `generated-at` is set server-side so the library
    can't be confused by a wildly-skewed client clock.
    """
    meta: dict[str, str] = {
        "generated-at": datetime.now(UTC).isoformat(),
    }
    if req.voice_id:
        meta["voice-id"] = req.voice_id
    if req.char_count is not None:
        meta["char-count"] = str(req.char_count)
    if req.duration_ms is not None:
        meta["duration-ms"] = str(req.duration_ms)
    if req.model_id:
        meta["model-id"] = req.model_id
    if req.text_preview:
        preview = _sanitize_header_value(req.text_preview, max_length=200)
        if preview:
            meta["text-preview"] = preview
    return meta


def create_upload_url(req: PresignRequest) -> PresignResponse:
    """Issue a short-lived presigned PUT URL plus echo-back headers."""
    key = _build_key()
    metadata = _metadata_from_request(req)
    url = presign_put(
        key=key,
        content_type=WAV_CONTENT_TYPE,
        metadata=metadata,
        expires_in=settings.presign_expires_in,
    )

    # Headers the browser MUST send on its PUT. The Content-Type is
    # required because it's part of the signature; the x-amz-meta-*
    # headers must match exactly or B2 rejects the request.
    headers = {"Content-Type": WAV_CONTENT_TYPE}
    for k, v in metadata.items():
        headers[f"x-amz-meta-{k}"] = v

    logger.info("Presigned PUT issued: key=%s", key)
    return PresignResponse(
        url=url,
        key=key,
        method="PUT",
        expires_in=settings.presign_expires_in,
        headers=headers,
    )
