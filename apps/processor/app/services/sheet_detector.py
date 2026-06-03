import io
import re
from dataclasses import dataclass

import pdfplumber

SHEET_NUMBER_PATTERN = re.compile(
    r"\b([A-Z]{1,3}[-.]?\d{2,4}(?:[-.][A-Z0-9]{1,3})?)\b"
)
SECTION_HEADER_PATTERN = re.compile(
    r"^(?:PART\s+\d+|SECTION\s+\d{2}\s+\d{2}\s+\d{2}|§+\s*\d+\.\d+).*$",
    re.IGNORECASE | re.MULTILINE,
)


@dataclass
class SheetMetadata:
    sheet_number: str | None
    sheet_title: str | None
    section_heading: str | None


def _clean_line(line: str) -> str:
    return " ".join(line.split()).strip()


def _detect_sheet_number(text: str) -> str | None:
    lines = [_clean_line(line) for line in text.splitlines() if _clean_line(line)]
    candidates: list[str] = []

    for line in lines[:12] + lines[-8:]:
        for match in SHEET_NUMBER_PATTERN.finditer(line):
            value = match.group(1).upper().replace(".", "-")
            if len(value) >= 3:
                candidates.append(value)

    if not candidates:
        return None

    # Prefer drawing-style sheet numbers (letter prefix + digits)
    drawing = [c for c in candidates if re.match(r"^[A-Z]{1,3}-\d", c)]
    return drawing[0] if drawing else candidates[0]


def _detect_sheet_title(text: str, sheet_number: str | None) -> str | None:
    lines = [_clean_line(line) for line in text.splitlines() if _clean_line(line)]
    if not lines:
        return None

    for line in lines[:15]:
        if sheet_number and sheet_number.replace(".", "-") in line.replace(".", "-"):
            continue
        if len(line) < 4:
            continue
        if line.isupper() and len(line.split()) <= 12:
            return line.title() if len(line) > 40 else line
        if re.match(r"^[A-Z][A-Za-z0-9\s,&/-]{8,}$", line) and len(line.split()) <= 10:
            return line

    return None


def _detect_section_heading(text: str) -> str | None:
    match = SECTION_HEADER_PATTERN.search(text)
    if match:
        return _clean_line(match.group(0))
    return None


def detect_sheet_metadata(pdf_bytes: bytes, page_number: int) -> SheetMetadata:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if page_number < 1 or page_number > len(pdf.pages):
            return SheetMetadata(None, None, None)

        page = pdf.pages[page_number - 1]
        width = page.width
        height = page.height

        # Title block heuristics: bottom-right quadrant common on construction drawings
        regions = [
            page.crop((width * 0.55, height * 0.70, width, height)),
            page.crop((0, 0, width, height * 0.20)),
            page,
        ]

        best_number: str | None = None
        best_title: str | None = None
        section: str | None = None

        for region in regions:
            region_text = region.extract_text() or ""
            if not region_text.strip():
                continue

            number = _detect_sheet_number(region_text)
            title = _detect_sheet_title(region_text, number)
            heading = _detect_section_heading(region_text)

            if number and not best_number:
                best_number = number
            if title and not best_title:
                best_title = title
            if heading and not section:
                section = heading

        full_text = page.extract_text() or ""
        if not section:
            section = _detect_section_heading(full_text)

        return SheetMetadata(
            sheet_number=best_number,
            sheet_title=best_title,
            section_heading=section,
        )
