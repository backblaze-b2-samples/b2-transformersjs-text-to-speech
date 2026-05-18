"""Data-access layer for Backblaze B2 over the S3-compatible API.

Single source of truth for every `boto3` call site in the project.
Higher layers (`service/`, `runtime/`) interact with B2 strictly through
the functions exported here — verified mechanically by
`tests/test_structure.py::test_boto3_only_in_repo`.
"""

import contextlib
import functools
import mimetypes
from datetime import UTC, datetime
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings
from app.types import Generation
from app.types.formatting import humanize_bytes

# Standardized custom user agent — per parent-CLAUDE / b2-doctor every
# S3-client construction in a sample must carry the `(backblaze-b2-samples)`
# marker so Backblaze can attribute traffic to the canonical sample set.
_USER_AGENT_EXTRA = (
    "b2-transformersjs-text-to-speech/0.1.0 (backblaze-b2-samples)"
)


def _guess_content_type(key: str) -> str:
    mime, _ = mimetypes.guess_type(key)
    return mime or "application/octet-stream"


@functools.lru_cache(maxsize=1)
def get_s3_client():
    """Return a process-singleton S3 client configured for B2.

    The region is sourced from `B2_REGION` — never hardcoded — so the
    same image can run against `us-west-004`, `eu-central-003`, etc.
    without code changes.
    """
    return boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint,
        region_name=settings.b2_region,
        aws_access_key_id=settings.b2_key_id,
        aws_secret_access_key=settings.b2_application_key,
        config=Config(
            signature_version="s3v4",
            user_agent_extra=_USER_AGENT_EXTRA,
        ),
    )


def check_connectivity() -> bool:
    try:
        client = get_s3_client()
        client.head_bucket(Bucket=settings.b2_bucket_name)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------
# Presigned URLs — browser ↔ B2 direct
# ---------------------------------------------------------------------


def presign_put(
    key: str,
    content_type: str,
    metadata: dict[str, str],
    expires_in: int,
) -> str:
    """Mint a presigned PUT URL the browser uses to upload directly to B2.

    `metadata` keys are written as `x-amz-meta-*` on the object. The
    browser MUST send the exact same headers on its PUT — boto signs
    them into the URL and B2 will reject the upload otherwise.
    """
    client = get_s3_client()
    try:
        return client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.b2_bucket_name,
                "Key": key,
                "ContentType": content_type,
                "Metadata": metadata,
            },
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 presign (PUT) failed for '{key}': {e}") from e


def presign_get(
    key: str,
    expires_in: int,
    download_filename: str | None = None,
) -> str:
    """Mint a presigned GET URL for browser playback or download.

    When `download_filename` is supplied the link forces a download via
    `Content-Disposition: attachment`; otherwise the URL plays inline,
    which is what the library page wants for the audio element.
    """
    client = get_s3_client()
    params: dict = {"Bucket": settings.b2_bucket_name, "Key": key}
    if download_filename:
        encoded = quote(download_filename, safe="")
        params["ResponseContentDisposition"] = (
            f"attachment; filename=\"{encoded}\"; filename*=UTF-8''{encoded}"
        )
    try:
        return client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 presign (GET) failed for '{key}': {e}") from e


# ---------------------------------------------------------------------
# Library — list / head / delete
# ---------------------------------------------------------------------


def _generation_from_head(key: str, head: dict) -> Generation:
    """Hydrate a Generation from a head_object response."""
    meta = head.get("Metadata") or {}
    size = head["ContentLength"]

    def _int_or_none(v: str | None) -> int | None:
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return Generation(
        key=key,
        size_bytes=size,
        size_human=humanize_bytes(size),
        content_type=head.get("ContentType", _guess_content_type(key)),
        created_at=head["LastModified"],
        voice_id=meta.get("voice-id"),
        char_count=_int_or_none(meta.get("char-count")),
        duration_ms=_int_or_none(meta.get("duration-ms")),
        model_id=meta.get("model-id"),
        text_preview=meta.get("text-preview"),
    )


def list_generations(
    prefix: str | None = None, max_keys: int = 1000
) -> list[Generation]:
    """Return Generations under the prefix, newest-first.

    Issues a single `list_objects_v2` for keys + sizes + timestamps,
    then a `head_object` per key to read `x-amz-meta-*`. For a sample
    optimized for clarity over throughput this is fine; production
    deployments should cache HEADs or fold metadata into the key.
    """
    client = get_s3_client()
    effective_prefix = prefix if prefix is not None else settings.generations_prefix
    try:
        response = client.list_objects_v2(
            Bucket=settings.b2_bucket_name,
            Prefix=effective_prefix,
            MaxKeys=max_keys,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 list failed: {e}") from e

    generations: list[Generation] = []
    for obj in response.get("Contents", []):
        try:
            head = client.head_object(
                Bucket=settings.b2_bucket_name, Key=obj["Key"]
            )
        except ClientError:
            # An object listed but not head-able is a transient B2
            # consistency artifact — skip it rather than 500 the whole
            # library page.
            continue
        generations.append(_generation_from_head(obj["Key"], head))

    generations.sort(key=lambda g: g.created_at, reverse=True)
    return generations


def head_generation(key: str) -> Generation | None:
    client = get_s3_client()
    try:
        head = client.head_object(Bucket=settings.b2_bucket_name, Key=key)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise
    return _generation_from_head(key, head)


def delete_generation(key: str) -> None:
    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.b2_bucket_name, Key=key)
    except ClientError as e:
        raise RuntimeError(f"B2 delete failed for '{key}': {e}") from e


def get_generation_stats() -> dict:
    """Aggregate counts across the generations/ prefix.

    Paginates so totals are correct past the 1000-object listing limit.
    """
    client = get_s3_client()
    total_files = 0
    total_seconds = 0.0
    generations_today = 0
    today = datetime.now(UTC).date()

    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": settings.generations_prefix,
        "MaxKeys": 1000,
    }
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                total_files += 1
                if obj["LastModified"].date() == today:
                    generations_today += 1
                try:
                    head = client.head_object(
                        Bucket=settings.b2_bucket_name, Key=obj["Key"]
                    )
                    duration_ms = head.get("Metadata", {}).get("duration-ms")
                    if duration_ms:
                        with contextlib.suppress(TypeError, ValueError):
                            total_seconds += int(duration_ms) / 1000.0
                except ClientError:
                    continue
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except ClientError as e:
        raise RuntimeError(f"B2 stats query failed: {e}") from e

    return {
        "total_generations": total_files,
        "total_seconds": round(total_seconds, 2),
        "generations_today": generations_today,
    }
