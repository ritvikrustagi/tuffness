from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessOptions(BaseModel):
    chunk_size_tokens: int = Field(default=512, ge=128, le=8192)
    chunk_overlap_tokens: int = Field(default=64, ge=0, le=1024)
    generate_page_images: bool = True


class ProcessDocumentRequest(BaseModel):
    document_id: str
    storage_path: str
    project_id: str
    organization_id: str
    options: ProcessOptions = Field(default_factory=ProcessOptions)


class PageResult(BaseModel):
    page_number: int
    sheet_number: str | None = None
    sheet_title: str | None = None
    text_content: str
    image_path: str | None = None


class ChunkResult(BaseModel):
    chunk_index: int
    page_number: int
    content: str
    content_type: Literal["text", "table", "note", "title_block"] = "text"
    token_count: int
    embedding: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProcessDocumentResponse(BaseModel):
    document_id: str
    page_count: int
    chunk_count: int
    pages: list[PageResult]
    status: Literal["ready"] = "ready"


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "document-processor"
