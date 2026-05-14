"""Tests for the presign service.

These tests stub the repo layer so they run offline — no real B2
credentials needed.
"""

import pytest

from app.service import presign as presign_service
from app.types import PresignRequest


def test_presign_builds_key_under_generations_prefix(monkeypatch):
    captured = {}

    def fake_presign_put(*, key, content_type, metadata, expires_in):
        captured["key"] = key
        captured["content_type"] = content_type
        captured["metadata"] = metadata
        captured["expires_in"] = expires_in
        return "https://example.com/signed-put"

    monkeypatch.setattr(presign_service, "presign_put", fake_presign_put)

    req = PresignRequest(
        voice_id="af_heart",
        char_count=128,
        duration_ms=3400,
        model_id="onnx-community/Kokoro-82M-v1.0-ONNX",
        text_preview="Hello world",
    )
    resp = presign_service.create_upload_url(req)

    assert resp.method == "PUT"
    assert resp.url == "https://example.com/signed-put"
    assert resp.key.startswith("generations/")
    assert resp.key.endswith(".wav")
    assert captured["content_type"] == "audio/wav"
    # The browser must echo these on its PUT.
    assert resp.headers["Content-Type"] == "audio/wav"
    assert resp.headers["x-amz-meta-voice-id"] == "af_heart"
    assert resp.headers["x-amz-meta-char-count"] == "128"
    assert resp.headers["x-amz-meta-duration-ms"] == "3400"


def test_presign_omits_optional_metadata(monkeypatch):
    monkeypatch.setattr(
        presign_service,
        "presign_put",
        lambda **_: "https://example.com/signed-put",
    )

    resp = presign_service.create_upload_url(PresignRequest())

    # Only the server-set field is present
    assert "x-amz-meta-generated-at" in resp.headers
    assert "x-amz-meta-voice-id" not in resp.headers
    assert "x-amz-meta-char-count" not in resp.headers


@pytest.mark.asyncio
async def test_presign_upload_endpoint_returns_signed_payload(client, monkeypatch):
    monkeypatch.setattr(
        presign_service,
        "presign_put",
        lambda **_: "https://example.com/signed-put",
    )

    response = await client.post(
        "/presign/upload",
        json={"voice_id": "af_heart", "char_count": 10, "duration_ms": 800},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["method"] == "PUT"
    assert body["key"].startswith("generations/")
    assert body["headers"]["Content-Type"] == "audio/wav"
