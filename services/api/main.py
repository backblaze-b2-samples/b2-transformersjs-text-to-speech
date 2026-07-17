import json
import logging
import sys
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv

# Single source of truth: repo-root .env. Anchored to this file's path so it
# resolves correctly regardless of where uvicorn is invoked from (local
# `cd services/api && uvicorn`, Docker WORKDIR, etc.).
REPO_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(REPO_ROOT_ENV)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from starlette.middleware.base import BaseHTTPMiddleware  # noqa: E402

from app.config import Settings, settings  # noqa: E402
from app.runtime import health, library, metrics, presign  # noqa: E402
from app.service import cors as cors_service  # noqa: E402

REPO_ROOT = REPO_ROOT_ENV.parent
CORS_RULES_FILE = REPO_ROOT / "b2CorsRules.json"

# --- Startup validation ---
# Required B2 settings are declared with empty-string defaults so that
# `Settings()` instantiation (and therefore `from main import app`) never
# raises during test collection. We instead fail fast at server startup
# with a human-readable message — uvicorn surfaces this as the first log
# line, so misconfiguration is obvious within seconds rather than turning
# into mysterious 500s on the first request.
REQUIRED_B2_SETTINGS = (
    ("b2_application_key_id", "B2_APPLICATION_KEY_ID or legacy B2_KEY_ID"),
    ("b2_application_key", "B2_APPLICATION_KEY"),
    ("b2_bucket_name", "B2_BUCKET_NAME"),
    ("b2_s3_endpoint_url", "B2_REGION or legacy B2_ENDPOINT"),
)

# Exact placeholder strings shipped in current and legacy examples. If
# a user copied an example and didn't edit it, Settings will pass the
# "non-empty" check above but every B2 call will still 403. Catch that
# here.
PLACEHOLDER_VALUES = frozenset({
    "your_application_key_id",
    "your_key_id",
    "your-key-id",
    "your_application_key",
    "your-key",
    "your-bucket-name",
    "your-bucket",
})


def validate_b2_startup_settings(config: Settings = settings) -> None:
    try:
        missing = [
            env_name
            for attr, env_name in REQUIRED_B2_SETTINGS
            if not getattr(config, attr)
        ]
    except ValueError as e:
        raise RuntimeError(f"Invalid B2 configuration: {e}") from e

    if missing:
        raise RuntimeError(
            "Missing required B2 configuration: "
            + ", ".join(missing)
            + f". Add them to {REPO_ROOT_ENV} (see .env.example) and restart."
        )

    placeholders = [
        env_name
        for attr, env_name in REQUIRED_B2_SETTINGS
        if getattr(config, attr) in PLACEHOLDER_VALUES
    ]
    if placeholders:
        raise RuntimeError(
            "B2 configuration still has placeholder values: "
            + ", ".join(placeholders)
            + f". Edit {REPO_ROOT_ENV} with your real B2 credentials and restart."
        )


@asynccontextmanager
async def lifespan(_app: "FastAPI"):
    validate_b2_startup_settings()

    # Browser → B2 direct PUTs need a CORSRule on the bucket. Apply it at
    # startup so a fresh clone "just works" after `pnpm dev` without an
    # out-of-band bootstrap step. Idempotent; requires `writeBucketCors`.
    try:
        cors_service.apply_bucket_cors(CORS_RULES_FILE)
    except Exception as e:
        raise RuntimeError(
            f"Failed to apply bucket CORS rules from {CORS_RULES_FILE}. "
            "Ensure the application key has `writeBucketCors`. "
            f"Underlying error: {e}"
        ) from e

    yield

# --- Structured JSON logging ---

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = str(record.exc_info[1])
        return json.dumps(log_entry)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logging.root.handlers = [handler]
logging.root.setLevel(logging.INFO)
# Quiet noisy libraries
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

logger = logging.getLogger("api")


# --- App setup ---

app = FastAPI(
    title="B2 Transformers.js Text-to-Speech API",
    description=(
        "Stateless signing + library API for browser-side Kokoro TTS, "
        "backed by Backblaze B2."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Optional regex (empty by default). When set, any origin matching
    # the pattern is allowed in addition to the explicit allowlist.
    allow_origin_regex=settings.api_cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Request ID + timing middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=metrics.timing_middleware)

app.include_router(health.router, tags=["health"])
app.include_router(presign.router, tags=["presign"])
app.include_router(library.router, tags=["library"])
app.include_router(metrics.router, tags=["metrics"])
