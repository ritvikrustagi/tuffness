import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import verify_api_key
from app.models.schemas import ProcessDocumentRequest, ProcessDocumentResponse
from app.services.pipeline import DocumentProcessingError, process_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/process", tags=["process"])


@router.post("/document", response_model=ProcessDocumentResponse)
async def process_document_endpoint(
    request: ProcessDocumentRequest,
    _: None = Depends(verify_api_key),
) -> ProcessDocumentResponse:
    try:
        return process_document(request)
    except DocumentProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
