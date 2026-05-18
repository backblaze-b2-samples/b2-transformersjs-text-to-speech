"""Unit tests for the bucket-CORS startup task."""

import json
from pathlib import Path

import pytest

from app.service import cors as cors_service


def test_to_s3_cors_rule_maps_op_names():
    rule = {
        "allowedOrigins": ["http://localhost:3000"],
        "allowedOperations": ["s3_put", "s3_get", "s3_head", "s3_delete"],
        "allowedHeaders": ["Content-Type"],
        "exposeHeaders": ["ETag"],
        "maxAgeSeconds": 3600,
    }
    result = cors_service._to_s3_cors_rule(rule)
    assert result == {
        "AllowedMethods": ["PUT", "GET", "HEAD", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000"],
        "AllowedHeaders": ["Content-Type"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600,
    }


def test_to_s3_cors_rule_omits_optional_fields():
    rule = {
        "allowedOrigins": ["http://localhost:3000"],
        "allowedOperations": ["s3_get"],
    }
    result = cors_service._to_s3_cors_rule(rule)
    assert result == {
        "AllowedMethods": ["GET"],
        "AllowedOrigins": ["http://localhost:3000"],
    }


def test_apply_bucket_cors_loads_file_and_calls_repo(tmp_path, monkeypatch):
    rules_file = tmp_path / "b2CorsRules.json"
    rules_file.write_text(
        json.dumps(
            [
                {
                    "allowedOrigins": ["http://localhost:3000"],
                    "allowedOperations": ["s3_put"],
                    "allowedHeaders": ["Content-Type"],
                }
            ]
        )
    )

    captured: dict = {}

    def fake_put(cors_configuration):
        captured["config"] = cors_configuration

    monkeypatch.setattr(cors_service.b2_client, "put_bucket_cors", fake_put)
    cors_service.apply_bucket_cors(rules_file)

    assert captured["config"] == {
        "CORSRules": [
            {
                "AllowedMethods": ["PUT"],
                "AllowedOrigins": ["http://localhost:3000"],
                "AllowedHeaders": ["Content-Type"],
            }
        ]
    }


def test_apply_bucket_cors_propagates_repo_errors(tmp_path, monkeypatch):
    rules_file = tmp_path / "b2CorsRules.json"
    rules_file.write_text("[]")

    def boom(_cors_configuration):
        raise RuntimeError("simulated B2 failure")

    monkeypatch.setattr(cors_service.b2_client, "put_bucket_cors", boom)
    with pytest.raises(RuntimeError, match="simulated B2 failure"):
        cors_service.apply_bucket_cors(rules_file)


def test_repo_root_rules_file_parses():
    # Sanity-check the committed rules file: any drift to a shape that
    # apply_bucket_cors() can't translate will trip this test.
    here = Path(__file__).resolve().parent
    rules_file = here.parent.parent.parent / "b2CorsRules.json"
    raw_rules = json.loads(rules_file.read_text())
    for rule in raw_rules:
        translated = cors_service._to_s3_cors_rule(rule)
        assert translated["AllowedMethods"], (
            f"empty AllowedMethods after translation: {rule}"
        )
        assert translated["AllowedOrigins"], (
            f"empty AllowedOrigins after translation: {rule}"
        )
