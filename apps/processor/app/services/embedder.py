import logging

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 64


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = OpenAI(api_key=settings.openai_api_key)
    embeddings: list[list[float]] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        response = client.embeddings.create(
            model=settings.openai_embedding_model,
            input=batch,
        )
        batch_embeddings = [item.embedding for item in response.data]
        embeddings.extend(batch_embeddings)
        logger.info("Embedded batch %s-%s of %s", start + 1, start + len(batch), len(texts))

    return embeddings
