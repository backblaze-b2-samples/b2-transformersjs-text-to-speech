from pydantic import BaseModel, Field


class PresignRequest(BaseModel):
    """Caller-provided hints for issuing a browser → B2 PUT URL.

    All metadata fields are optional — the API derives a key from the
    timestamp + a UUID and sets it directly so the browser cannot
    smuggle a `..`/absolute path through this surface.
    """

    voice_id: str | None = Field(default=None, max_length=64)
    char_count: int | None = Field(default=None, ge=0, le=100_000)
    duration_ms: int | None = Field(default=None, ge=0)
    model_id: str | None = Field(default=None, max_length=128)
    text_preview: str | None = Field(default=None, max_length=200)


class PresignResponse(BaseModel):
    """Everything the browser needs to PUT a WAV directly to B2."""

    url: str
    key: str
    method: str = "PUT"
    expires_in: int
    # `x-amz-meta-*` headers the browser must send on the PUT so the
    # object ships to B2 with the same metadata the library will read
    # back via head_object. Header *values* are strings even when the
    # underlying field is numeric — S3 metadata is string-only.
    headers: dict[str, str]


class PlaybackUrlResponse(BaseModel):
    url: str
    expires_in: int
