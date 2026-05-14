from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    b2_endpoint: str = ""
    b2_region: str = ""
    b2_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""

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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]


settings = Settings()
