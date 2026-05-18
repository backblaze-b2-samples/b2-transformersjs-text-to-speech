"""Bucket CORS application at API startup.

Browser → B2 direct PUTs need a CORSRule on the bucket; without it
every upload from the synthesize page fails with an opaque CORS error
even though the presigned URL itself is valid. This module is the
single source of that rule: it reads `b2CorsRules.json` from the repo
root, normalizes our `s3_*` operation names to S3 `AllowedMethods`,
and writes the configuration via the repo layer. Invoked from the
FastAPI lifespan so the bucket is correctly configured before the
first request lands.
"""

import json
import logging
from pathlib import Path

from app.repo import b2_client

logger = logging.getLogger(__name__)

# Map our op names (see b2CorsRules.json) to S3 AllowedMethod values.
_OP_TO_METHOD = {
    "s3_put": "PUT",
    "s3_get": "GET",
    "s3_head": "HEAD",
    "s3_delete": "DELETE",
    "s3_post": "POST",
}


def _to_s3_cors_rule(rule: dict) -> dict:
    methods = [
        _OP_TO_METHOD.get(op, op.upper()) for op in rule.get("allowedOperations", [])
    ]
    out: dict = {
        "AllowedMethods": methods,
        "AllowedOrigins": list(rule.get("allowedOrigins", [])),
    }
    if rule.get("allowedHeaders"):
        out["AllowedHeaders"] = list(rule["allowedHeaders"])
    if rule.get("exposeHeaders"):
        out["ExposeHeaders"] = list(rule["exposeHeaders"])
    if rule.get("maxAgeSeconds") is not None:
        out["MaxAgeSeconds"] = rule["maxAgeSeconds"]
    return out


def apply_bucket_cors(rules_path: Path) -> None:
    """Read the CORS rules JSON and apply it to the configured bucket."""
    raw_rules = json.loads(rules_path.read_text())
    cors_configuration = {"CORSRules": [_to_s3_cors_rule(r) for r in raw_rules]}
    b2_client.put_bucket_cors(cors_configuration)
    logger.info(
        "Applied bucket CORS rules from %s (%d rule(s))",
        rules_path,
        len(raw_rules),
    )
