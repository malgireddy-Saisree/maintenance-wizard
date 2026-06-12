from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_chat_deployment: str = "gpt-4o"
    azure_embedding_deployment: str = "text-embedding-3-small"
    azure_api_version: str = "2024-08-01-preview"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
