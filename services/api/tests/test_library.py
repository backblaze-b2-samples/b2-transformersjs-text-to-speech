"""Tests for the library service — list / stats / delete / playback."""

from datetime import UTC, datetime, timedelta

import pytest

from app.service import library as library_service
from app.types import Generation


def _make_generation(key: str, hours_ago: int = 0) -> Generation:
    return Generation(
        key=key,
        size_bytes=12345,
        size_human="12.0 KB",
        content_type="audio/wav",
        created_at=datetime.now(UTC) - timedelta(hours=hours_ago),
        voice_id="af_heart",
        char_count=42,
        duration_ms=1500,
        model_id="onnx-community/Kokoro-82M-v1.0-ONNX",
        text_preview="Hello, world.",
    )


@pytest.mark.asyncio
async def test_library_returns_newest_first(client, monkeypatch):
    items = [
        _make_generation("generations/2026/05/aaaa.wav", hours_ago=24),
        _make_generation("generations/2026/05/bbbb.wav", hours_ago=0),
        _make_generation("generations/2026/05/cccc.wav", hours_ago=12),
    ]
    # repo.list_generations is responsible for sorting; emulate that.
    items.sort(key=lambda g: g.created_at, reverse=True)
    monkeypatch.setattr(
        library_service, "list_generations", lambda max_keys=1000: items
    )

    response = await client.get("/library?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["key"] == "generations/2026/05/bbbb.wav"
    assert data[1]["key"] == "generations/2026/05/cccc.wav"


@pytest.mark.asyncio
async def test_delete_propagates_repo_error(client, monkeypatch):
    valid_key = "generations/2026/05/deadbeef.wav"

    def fake_head(_key):
        return _make_generation(valid_key)

    def fake_delete(_key):
        raise RuntimeError("B2 delete failed")

    monkeypatch.setattr(library_service, "head_generation", fake_head)
    monkeypatch.setattr(library_service, "delete_generation", fake_delete)

    response = await client.delete(f"/library/{valid_key}")
    assert response.status_code == 500
    assert "Failed to delete generation" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_rejects_bad_key(client):
    response = await client.delete("/library/uploads/notmykey.wav")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_playback_returns_signed_url(client, monkeypatch):
    valid_key = "generations/2026/05/abcdef0123.wav"
    monkeypatch.setattr(
        library_service, "head_generation", lambda _k: _make_generation(valid_key)
    )
    monkeypatch.setattr(
        library_service,
        "presign_get",
        lambda *, key, expires_in, download_filename=None: "https://example.com/get",
    )

    response = await client.get(f"/library/{valid_key}/playback")
    assert response.status_code == 200
    assert response.json()["url"] == "https://example.com/get"


@pytest.mark.asyncio
async def test_playback_404_when_missing(client, monkeypatch):
    valid_key = "generations/2026/05/abcdef0123.wav"
    monkeypatch.setattr(library_service, "head_generation", lambda _k: None)

    response = await client.get(f"/library/{valid_key}/playback")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_activity_fills_missing_days(client, monkeypatch):
    monkeypatch.setattr(
        library_service, "list_generations", lambda max_keys=1000: []
    )

    response = await client.get("/library/stats/activity?days=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(d["generations"] == 0 for d in data)


@pytest.mark.asyncio
async def test_activity_rejects_invalid_days(client):
    response = await client.get("/library/stats/activity?days=0")
    assert response.status_code == 400
    response = await client.get("/library/stats/activity?days=200")
    assert response.status_code == 400
