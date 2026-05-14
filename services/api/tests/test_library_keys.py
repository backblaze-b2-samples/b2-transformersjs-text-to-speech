"""Unit tests for generations/ key validation."""

import pytest

from app.service.library import InvalidKeyError, validate_key


def test_valid_keys_pass():
    validate_key("generations/2026/05/0123456789abcdef.wav")
    validate_key("generations/2026/12/abcdef0123456789deadbeef.wav")


def test_bad_keys_are_rejected():
    bad = [
        "",
        "uploads/foo.wav",
        "generations/../etc/passwd",
        "generations/2026/05/file.mp3",
        "generations/2026/05/file.wav.exe",
        "generations\\2026\\05\\foo.wav",
        "generations/%2e%2e/secret.wav",
        "generations/2026/5/foo.wav",  # month not zero-padded
        "generations/2026/05/UPPERCASE.wav",  # hex must be lowercase
    ]
    for k in bad:
        with pytest.raises(InvalidKeyError):
            validate_key(k)
