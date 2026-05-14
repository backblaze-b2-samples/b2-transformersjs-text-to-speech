"""HTTP surface for the audio library — list / playback / download / delete."""

import logging

from fastapi import APIRouter, HTTPException

from app.service.library import (
    KeyError_,
    NotFoundError,
    get_activity,
    get_download_url,
    get_playback_url,
    get_stats,
    list_recent,
    remove,
)
from app.types import (
    DailyGenerationCount,
    Generation,
    GenerationStats,
    PlaybackUrlResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/library", response_model=list[Generation])
async def list_library_endpoint(limit: int = 100):
    try:
        return list_recent(limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/library/stats", response_model=GenerationStats)
async def library_stats_endpoint():
    return get_stats()


@router.get("/library/stats/activity", response_model=list[DailyGenerationCount])
async def library_activity_endpoint(days: int = 7):
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")
    return get_activity(days=days)


@router.get("/library/{key:path}/playback", response_model=PlaybackUrlResponse)
async def playback_url_endpoint(key: str):
    try:
        return get_playback_url(key)
    except KeyError_ as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.get("/library/{key:path}/download", response_model=PlaybackUrlResponse)
async def download_url_endpoint(key: str):
    try:
        return get_download_url(key)
    except KeyError_ as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.delete("/library/{key:path}")
async def delete_library_endpoint(key: str):
    try:
        remove(key)
    except KeyError_ as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(
            status_code=500, detail="Failed to delete generation"
        ) from None
    logger.info("Generation deleted: key=%s", key)
    return {"deleted": True, "key": key}
