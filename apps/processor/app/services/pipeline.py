import logging
from typing import Any

from app.models.schemas import (
    ChunkResult,
    PageResult,
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    ProcessOptions,
)
from app.services.chunker import chunk_page_text
from app.services.embedder import embed_texts
from app.services.page_renderer import render_page_images
from app.services.pdf_extractor import extract_pages
from app.services.sheet_detector import detect_sheet_metadata
from app.services.storage import (
    delete_existing_pages_and_chunks,
    download_pdf,
    get_supabase,
    insert_chunks,
    insert_document_page,
    update_document_status,
    upload_page_image,
)

logger = logging.getLogger(__name__)


class DocumentProcessingError(Exception):
    pass


def process_document(request: ProcessDocumentRequest) -> ProcessDocumentResponse:
    client = get_supabase()
    options = request.options

    logger.info("Starting processing for document %s", request.document_id)
    update_document_status(client, request.document_id, "processing")

    try:
        pdf_bytes = download_pdf(client, request.storage_path)
        page_texts = extract_pages(pdf_bytes)
        page_images = (
            render_page_images(pdf_bytes)
            if options.generate_page_images
            else {}
        )

        delete_existing_pages_and_chunks(client, request.document_id)

        page_results: list[PageResult] = []
        text_chunks = []
        chunk_index = 0
        page_id_by_number: dict[int, str] = {}

        for page in page_texts:
            metadata = detect_sheet_metadata(pdf_bytes, page.page_number)
            image_path = None

            if options.generate_page_images and page.page_number in page_images:
                image_path = (
                    f"{request.organization_id}/{request.project_id}/pages/"
                    f"{request.document_id}_p{page.page_number}.png"
                )
                upload_page_image(client, image_path, page_images[page.page_number])

            page_id = insert_document_page(
                client,
                document_id=request.document_id,
                page_number=page.page_number,
                sheet_number=metadata.sheet_number,
                sheet_title=metadata.sheet_title,
                text_content=page.text,
                image_storage_path=image_path,
                metadata={
                    "section_heading": metadata.section_heading,
                    "table_count": len(page.tables),
                },
            )
            page_id_by_number[page.page_number] = page_id

            page_results.append(
                PageResult(
                    page_number=page.page_number,
                    sheet_number=metadata.sheet_number,
                    sheet_title=metadata.sheet_title,
                    text_content=page.text,
                    image_path=image_path,
                )
            )

            page_chunks, chunk_index = chunk_page_text(
                page_number=page.page_number,
                text=page.text,
                start_index=chunk_index,
                chunk_size_tokens=options.chunk_size_tokens,
                chunk_overlap_tokens=options.chunk_overlap_tokens,
                section_heading=metadata.section_heading,
                sheet_number=metadata.sheet_number,
                sheet_title=metadata.sheet_title,
            )
            text_chunks.extend(page_chunks)

        embeddings = embed_texts([chunk.content for chunk in text_chunks])

        db_chunks: list[dict[str, Any]] = []
        chunk_results: list[ChunkResult] = []

        for chunk, embedding in zip(text_chunks, embeddings, strict=True):
            db_chunks.append(
                {
                    "document_id": request.document_id,
                    "document_page_id": page_id_by_number.get(chunk.page_number),
                    "project_id": request.project_id,
                    "organization_id": request.organization_id,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "content_type": chunk.content_type,
                    "token_count": chunk.token_count,
                    "embedding": embedding,
                    "metadata": chunk.metadata,
                }
            )
            chunk_results.append(
                ChunkResult(
                    chunk_index=chunk.chunk_index,
                    page_number=chunk.page_number,
                    content=chunk.content,
                    content_type=chunk.content_type,
                    token_count=chunk.token_count,
                    embedding=embedding,
                    metadata=chunk.metadata,
                )
            )

        insert_chunks(
            client,
            document_id=request.document_id,
            project_id=request.project_id,
            organization_id=request.organization_id,
            chunks=db_chunks,
        )

        update_document_status(
            client,
            request.document_id,
            "ready",
            page_count=len(page_results),
        )

        logger.info(
            "Completed document %s: %s pages, %s chunks",
            request.document_id,
            len(page_results),
            len(chunk_results),
        )

        return ProcessDocumentResponse(
            document_id=request.document_id,
            page_count=len(page_results),
            chunk_count=len(chunk_results),
            pages=page_results,
        )

    except Exception as exc:
        logger.exception("Document processing failed for %s", request.document_id)
        update_document_status(
            client,
            request.document_id,
            "failed",
            error_message=str(exc)[:500],
        )
        raise DocumentProcessingError(str(exc)) from exc
