"""Tests for error handling across the API."""

import pytest

from app.service import library as library_service


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500(client, monkeypatch):
    """Global handler catches unhandled exceptions and returns 500 JSON."""

    def explode(max_keys=1000):
        raise RuntimeError("B2 exploded")

    monkeypatch.setattr(library_service, "list_generations", explode)

    response = await client.get("/library")
    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Internal server error"
    # Ensure raw error message is NOT leaked to the client
    assert "B2 exploded" not in body["detail"]


@pytest.mark.asyncio
async def test_stats_b2_failure_returns_500(client, monkeypatch):
    """Stats endpoint returns 500 when B2 is unreachable."""

    def explode():
        raise RuntimeError("B2 stats query failed")

    monkeypatch.setattr(library_service, "get_generation_stats", explode)

    response = await client.get("/library/stats")
    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"
