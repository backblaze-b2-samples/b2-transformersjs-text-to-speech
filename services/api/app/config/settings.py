import re
from urllib.parse import urlparse

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings

B2_REGION_RE = re.compile(r"[a-z]{2}(?:-[a-z]+)+-\d{3}")


def _validate_b2_region(region: str) -> str:
    if not B2_REGION_RE.fullmatch(region):
        raise ValueError(f"Invalid B2_REGION: {region!r}")
    return region


def _region_from_legacy_endpoint(endpoint: str) -> str:
    parsed = urlparse(endpoint)
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.port
        or parsed.path not in ("", "/")
        or parsed.params
        or parsed.query
        or parsed.fragment
        or not parsed.hostname
    ):
        raise ValueError(f"Invalid B2_ENDPOINT: {endpoint!r}")

    host = parsed.hostname
    prefix = "s3."
    suffix = ".backblazeb2.com"
    if not (host.startswith(prefix) and host.endswith(suffix)):
        raise ValueError(f"Invalid B2_ENDPOINT: {endpoint!r}")

    return _validate_b2_region(host[len(prefix) : -len(suffix)])


class Settings(BaseSettings):
    b2_application_key_id: str = Field(
        default="",
        validation_alias=AliasChoices("B2_APPLICATION_KEY_ID", "B2_KEY_ID"),
    )
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    b2_region: str = ""
    b2_endpoint: str = Field(default="", validation_alias="B2_ENDPOINT")

    api_port: int = 8000
    # Explicit allowlist by default — covers Next on :3000 and the
    # fallback :3001 it picks if 3000 is busy. Production deploys should
    # override with the exact frontend origin.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional dev-only escape hatch: a regex that matches additional
    # allowed origins. Empty by default — set this to e.g.
    # `^http://localhost:\d+$` to accept any localhost port without
    # listing each one. NEVER ship this to production.
    api_cors_origin_regex: str = ""

    # Browser → B2 direct-upload limits. WAVs from short TTS prompts are
    # measured in low MBs, not GBs — keep the cap tight so a leaked
    # presigned URL can't be used to dump arbitrary payloads.
    max_upload_size: int = 50 * 1024 * 1024  # 50MB

    # Presigned URL TTL for both PUT (browser → B2 upload) and GET
    # (library playback / download). 10 minutes covers slow networks
    # without keeping links usable long after a tab closes.
    presign_expires_in: int = 600

    # B2 key prefix where synthesized audio lands. Library list/head/delete
    # all scope their bucket operations to this prefix.
    generations_prefix: str = "generations/"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]

    @property
    def b2_s3_endpoint_url(self) -> str:
        if self.b2_region:
            region = _validate_b2_region(self.b2_region)
            return f"https://s3.{region}.backblazeb2.com"
        if self.b2_endpoint:
            _region_from_legacy_endpoint(self.b2_endpoint)
            return self.b2_endpoint.rstrip("/")
        return ""

    @property
    def b2_effective_region(self) -> str:
        if self.b2_region:
            return _validate_b2_region(self.b2_region)
        if self.b2_endpoint:
            return _region_from_legacy_endpoint(self.b2_endpoint)
        return ""


settings = Settings()
