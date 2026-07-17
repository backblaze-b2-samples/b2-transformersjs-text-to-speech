"""Tests for standardized B2 configuration."""

from app.config.settings import Settings
from app.repo import b2_client
from main import REQUIRED_B2_SETTINGS


def test_required_b2_settings_use_standard_env_names():
    assert REQUIRED_B2_SETTINGS == (
        ("b2_application_key_id", "B2_APPLICATION_KEY_ID"),
        ("b2_application_key", "B2_APPLICATION_KEY"),
        ("b2_bucket_name", "B2_BUCKET_NAME"),
        ("b2_region", "B2_REGION"),
        ("b2_public_url_base", "B2_PUBLIC_URL_BASE"),
    )


def test_settings_derives_s3_endpoint_from_region():
    settings = Settings(b2_region="sample-region")

    assert settings.b2_s3_endpoint_url == "https://s3.sample-region.backblazeb2.com"


def test_s3_client_uses_application_key_id_and_custom_user_agent(monkeypatch):
    captured = {}
    fake_client = object()

    def fake_boto3_client(service_name, **kwargs):
        captured["service_name"] = service_name
        captured.update(kwargs)
        return fake_client

    settings = Settings(
        b2_application_key_id="key-id",
        b2_application_key="key",
        b2_bucket_name="bucket",
        b2_region="sample-region",
        b2_public_url_base="https://f004.backblazeb2.com/file/bucket",
    )
    monkeypatch.setattr(b2_client, "settings", settings)
    monkeypatch.setattr(b2_client.boto3, "client", fake_boto3_client)
    b2_client.get_s3_client.cache_clear()

    try:
        client = b2_client.get_s3_client()
    finally:
        b2_client.get_s3_client.cache_clear()

    assert client is fake_client
    assert captured["service_name"] == "s3"
    assert captured["endpoint_url"] == "https://s3.sample-region.backblazeb2.com"
    assert captured["region_name"] == "sample-region"
    assert captured["aws_access_key_id"] == "key-id"
    assert captured["aws_secret_access_key"] == "key"
    assert captured["config"].user_agent_extra == b2_client._USER_AGENT_EXTRA
