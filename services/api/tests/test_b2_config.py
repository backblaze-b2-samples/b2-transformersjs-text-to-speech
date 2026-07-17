"""Tests for standardized B2 configuration."""

import pytest

from app.config.settings import Settings
from app.repo import b2_client
from main import validate_b2_startup_settings

B2_ENV_KEYS = (
    "B2_APPLICATION_KEY_ID",
    "B2_KEY_ID",
    "B2_APPLICATION_KEY",
    "B2_BUCKET_NAME",
    "B2_REGION",
    "B2_ENDPOINT",
    "B2_PUBLIC_URL_BASE",
)


def _valid_settings(**overrides) -> Settings:
    values = {
        "b2_application_key_id": "key-id",
        "b2_application_key": "key",
        "b2_bucket_name": "bucket",
        "b2_region": "aa-bbb-001",
    }
    values.update(overrides)
    return Settings(**values)


def _write_env(tmp_path, content: str):
    env_file = tmp_path / ".env"
    env_file.write_text(content)
    return env_file


def _clear_b2_env(monkeypatch):
    for key in B2_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_startup_validation_accepts_consumed_standard_vars():
    validate_b2_startup_settings(_valid_settings())


def test_startup_validation_rejects_missing_consumed_standard_var():
    settings = _valid_settings(b2_application_key_id="")

    with pytest.raises(RuntimeError, match="B2_APPLICATION_KEY_ID"):
        validate_b2_startup_settings(settings)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"b2_region": "evil.com/"}, "Invalid B2_REGION"),
        (
            {
                "b2_region": "",
                "b2_endpoint": "https://s3.aa..bbb-001.backblazeb2.com",
            },
            "Invalid B2_ENDPOINT",
        ),
    ],
)
def test_startup_validation_wraps_invalid_b2_destination(overrides, expected):
    settings = _valid_settings(**overrides)

    with pytest.raises(RuntimeError, match=f"Invalid B2 configuration: {expected}"):
        validate_b2_startup_settings(settings)


def test_settings_accepts_legacy_env_aliases(tmp_path, monkeypatch):
    _clear_b2_env(monkeypatch)
    env_file = _write_env(
        tmp_path,
        "\n".join(
            [
                "B2_KEY_ID=legacy-key-id",
                "B2_APPLICATION_KEY=key",
                "B2_BUCKET_NAME=bucket",
                "B2_ENDPOINT=https://s3.aa-bbb-001.backblazeb2.com",
            ]
        ),
    )
    settings = Settings(_env_file=env_file)

    validate_b2_startup_settings(settings)
    assert settings.b2_application_key_id == "legacy-key-id"
    assert settings.b2_effective_region == "aa-bbb-001"
    assert settings.b2_s3_endpoint_url == "https://s3.aa-bbb-001.backblazeb2.com"


def test_new_env_values_take_precedence_when_both_present(tmp_path, monkeypatch):
    _clear_b2_env(monkeypatch)
    env_file = _write_env(
        tmp_path,
        "\n".join(
            [
                "B2_APPLICATION_KEY_ID=new-key-id",
                "B2_KEY_ID=legacy-key-id",
                "B2_APPLICATION_KEY=key",
                "B2_BUCKET_NAME=bucket",
                "B2_REGION=aa-bbb-001",
                "B2_ENDPOINT=https://s3.cc-ddd-002.backblazeb2.com",
                "B2_PUBLIC_URL_BASE=https://f004.backblazeb2.com/file/bucket",
            ]
        ),
    )
    settings = Settings(_env_file=env_file)

    validate_b2_startup_settings(settings)
    assert settings.b2_application_key_id == "new-key-id"
    assert settings.b2_effective_region == "aa-bbb-001"
    assert settings.b2_s3_endpoint_url == "https://s3.aa-bbb-001.backblazeb2.com"


@pytest.mark.parametrize(
    "region",
    [
        "evil.attacker.com/",
        "aa-bbb-001@evil.example",
        "aa-bbb-001/path",
        " aa-bbb-001",
        "aa..bbb-001",
    ],
)
def test_malformed_region_is_rejected(region):
    settings = _valid_settings(b2_region=region)

    with pytest.raises(ValueError, match="Invalid B2_REGION"):
        _ = settings.b2_s3_endpoint_url


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://s3.aa-bbb-001.backblazeb2.com",
        "https://s3.aa-bbb-001.backblazeb2.com/path",
        "https://s3.aa-bbb-001@evil.example/.backblazeb2.com",
        "https://evil.example",
        "https://s3.aa..bbb-001.backblazeb2.com",
    ],
)
def test_malformed_legacy_endpoint_is_rejected(endpoint):
    settings = _valid_settings(b2_region="", b2_endpoint=endpoint)

    with pytest.raises(ValueError, match="Invalid B2_ENDPOINT"):
        _ = settings.b2_s3_endpoint_url


def test_invalid_region_prevents_s3_client_construction(monkeypatch):
    def fail_boto3_client(*_args, **_kwargs):
        raise AssertionError("boto3.client should not be called")

    monkeypatch.setattr(b2_client, "settings", _valid_settings(b2_region="evil.com/"))
    monkeypatch.setattr(b2_client.boto3, "client", fail_boto3_client)
    b2_client.get_s3_client.cache_clear()

    try:
        with pytest.raises(ValueError, match="Invalid B2_REGION"):
            b2_client.get_s3_client()
    finally:
        b2_client.get_s3_client.cache_clear()


def test_placeholder_values_fail_startup_validation():
    settings = _valid_settings(b2_application_key_id="your_application_key_id")

    with pytest.raises(RuntimeError, match="placeholder values"):
        validate_b2_startup_settings(settings)


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
        b2_region="aa-bbb-001",
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
    assert captured["endpoint_url"] == "https://s3.aa-bbb-001.backblazeb2.com"
    assert captured["region_name"] == "aa-bbb-001"
    assert captured["aws_access_key_id"] == "key-id"
    assert captured["aws_secret_access_key"] == "key"
    assert captured["config"].user_agent_extra == (
        "b2-transformersjs-text-to-speech/0.1.0 (backblaze-b2-samples)"
    )
