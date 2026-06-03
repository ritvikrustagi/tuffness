import logging

from fastapi import FastAPI

from app.routers import health, process

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(
    title="AI Project Engineer — Document Processor",
    description="PDF ingestion: text extraction, page images, chunking, embeddings",
    version="0.2.0",
)

app.include_router(health.router)
app.include_router(process.router)
