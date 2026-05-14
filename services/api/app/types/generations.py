from datetime import datetime

from pydantic import BaseModel


class Generation(BaseModel):
    """A single TTS generation stored in B2.

    Hydrated from `head_object` + `list_objects_v2` — there is no
    application database, so every field below comes from S3 metadata
    (object key, size, last-modified, content-type) or from the
    `x-amz-meta-*` headers the browser sets on PUT.
    """

    key: str
    size_bytes: int
    size_human: str
    content_type: str
    created_at: datetime
    # Per-generation metadata written by the browser via x-amz-meta-*
    # on the presigned PUT. All optional — older objects may pre-date
    # the metadata convention.
    voice_id: str | None = None
    char_count: int | None = None
    duration_ms: int | None = None
    model_id: str | None = None
    text_preview: str | None = None


class GenerationStats(BaseModel):
    total_generations: int
    total_seconds: float
    generations_today: int


class DailyGenerationCount(BaseModel):
    date: str
    generations: int
