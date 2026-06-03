import io
import logging
from dataclasses import dataclass

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class PageText:
    page_number: int
    text: str
    tables: list[str]


def extract_pages(pdf_bytes: bytes) -> list[PageText]:
    pages: list[PageText] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            tables: list[str] = []

            try:
                extracted_tables = page.extract_tables() or []
                for table in extracted_tables:
                    rows = []
                    for row in table:
                        cells = [str(cell).strip() if cell is not None else "" for cell in row]
                        rows.append(" | ".join(cells))
                    if rows:
                        tables.append("\n".join(rows))
            except Exception as exc:
                logger.warning("Table extraction failed on page %s: %s", index, exc)

            combined = text.strip()
            if tables:
                combined = (combined + "\n\n" + "\n\n".join(tables)).strip()

            pages.append(PageText(page_number=index, text=combined, tables=tables))

    return pages
