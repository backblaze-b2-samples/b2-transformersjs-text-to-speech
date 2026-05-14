"""HTTP surface for browser → B2 direct upload presign."""

import logging

from fastapi import APIRouter

from app.runtime.metrics import record_upload
from app.service.presign import create_upload_url
from app.types import PresignRequest, PresignResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/presign/upload", response_model=PresignResponse)
async def presign_upload_endpoint(req: PresignRequest):
    """Issue a short-lived presigned PUT URL.

    The browser performs the actual PUT — no audio bytes ever flow
    through this service. We count the *issued* URL as one upload for
    metrics purposes; if the PUT later fails the counter is still right
    in spirit (the API did its job).
    """
    result = create_upload_url(req)
    record_upload(success=True)
    return result
