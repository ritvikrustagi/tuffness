import io
import logging

import fitz

from app.config import settings

logger = logging.getLogger(__name__)


def render_page_images(pdf_bytes: bytes, scale: float | None = None) -> dict[int, bytes]:
    render_scale = scale or settings.page_render_scale
    matrix = fitz.Matrix(render_scale, render_scale)
    images: dict[int, bytes] = {}

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page_index in range(len(doc)):
            page = doc[page_index]
            try:
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                images[page_index + 1] = pixmap.tobytes("png")
            except Exception as exc:
                logger.warning("Failed to render page %s: %s", page_index + 1, exc)

    return images
