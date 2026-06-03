from dataclasses import dataclass
from typing import Literal

import tiktoken

ContentType = Literal["text", "table", "note", "title_block"]


@dataclass
class TextChunk:
    chunk_index: int
    page_number: int
    content: str
    content_type: ContentType
    token_count: int
    metadata: dict


def _get_encoder(model: str = "gpt-4o"):
    try:
        return tiktoken.encoding_for_model(model)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str, encoder=None) -> int:
    enc = encoder or _get_encoder()
    return len(enc.encode(text))


def chunk_page_text(
    *,
    page_number: int,
    text: str,
    start_index: int,
    chunk_size_tokens: int,
    chunk_overlap_tokens: int,
    section_heading: str | None = None,
    sheet_number: str | None = None,
    sheet_title: str | None = None,
) -> tuple[list[TextChunk], int]:
    encoder = _get_encoder()
    text = text.strip()
    if not text:
        return [], start_index

    tokens = encoder.encode(text)
    if len(tokens) <= chunk_size_tokens:
        metadata = {
            "page_number": page_number,
            "section": section_heading,
            "sheet_number": sheet_number,
            "sheet_title": sheet_title,
        }
        return [
            TextChunk(
                chunk_index=start_index,
                page_number=page_number,
                content=text,
                content_type="text",
                token_count=len(tokens),
                metadata={k: v for k, v in metadata.items() if v},
            )
        ], start_index + 1

    chunks: list[TextChunk] = []
    step = max(chunk_size_tokens - chunk_overlap_tokens, 1)
    chunk_idx = start_index

    for start in range(0, len(tokens), step):
        end = min(start + chunk_size_tokens, len(tokens))
        piece = encoder.decode(tokens[start:end]).strip()
        if not piece:
            continue

        metadata = {
            "page_number": page_number,
            "section": section_heading,
            "sheet_number": sheet_number,
            "sheet_title": sheet_title,
            "token_start": start,
            "token_end": end,
        }

        chunks.append(
            TextChunk(
                chunk_index=chunk_idx,
                page_number=page_number,
                content=piece,
                content_type="text",
                token_count=len(tokens[start:end]),
                metadata={k: v for k, v in metadata.items() if v is not None},
            )
        )
        chunk_idx += 1

        if end >= len(tokens):
            break

    return chunks, chunk_idx
