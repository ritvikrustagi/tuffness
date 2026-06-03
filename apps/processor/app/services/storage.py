import io
import logging
from typing import Any

import pdfplumber
from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger(__name__)


def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def download_pdf(client: Client, storage_path: str) -> bytes:
    response = client.storage.from_(settings.documents_bucket).download(storage_path)
    if isinstance(response, bytes):
        return response
    raise RuntimeError(f"Failed to download PDF from {storage_path}")


def upload_page_image(
    client: Client,
    image_path: str,
    image_bytes: bytes,
) -> None:
    client.storage.from_(settings.page_images_bucket).upload(
        image_path,
        image_bytes,
        file_options={"content-type": "image/png", "upsert": "true"},
    )


def update_document_status(
    client: Client,
    document_id: str,
    status: str,
    *,
    page_count: int | None = None,
    error_message: str | None = None,
) -> None:
    payload: dict[str, Any] = {"status": status}
    if page_count is not None:
        payload["page_count"] = page_count
    if error_message is not None:
        payload["error_message"] = error_message
    elif status != "failed":
        payload["error_message"] = None

    client.table("documents").update(payload).eq("id", document_id).execute()


def delete_existing_pages_and_chunks(client: Client, document_id: str) -> None:
    client.table("chunks").delete().eq("document_id", document_id).execute()
    client.table("document_pages").delete().eq("document_id", document_id).execute()


def insert_document_page(
    client: Client,
    *,
    document_id: str,
    page_number: int,
    sheet_number: str | None,
    sheet_title: str | None,
    text_content: str,
    image_storage_path: str | None,
    metadata: dict[str, Any],
) -> str:
    row = {
        "document_id": document_id,
        "page_number": page_number,
        "sheet_number": sheet_number,
        "sheet_title": sheet_title,
        "text_content": text_content,
        "image_storage_path": image_storage_path,
        "metadata": metadata,
    }
    result = client.table("document_pages").insert(row).select("id").single().execute()
    return result.data["id"]


def insert_chunks(
    client: Client,
    *,
    document_id: str,
    project_id: str,
    organization_id: str,
    chunks: list[dict[str, Any]],
) -> None:
    if not chunks:
        return
    client.table("chunks").insert(chunks).execute()
