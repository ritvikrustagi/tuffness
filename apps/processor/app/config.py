from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    processor_api_key: str
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    documents_bucket: str = "documents"
    page_images_bucket: str = "page-images"
    chunk_size_tokens: int = 512
    chunk_overlap_tokens: int = 64
    page_render_scale: float = 2.0


settings = Settings()
