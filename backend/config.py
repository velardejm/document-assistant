from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # OpenAI
    openai_api_key: str

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Google Drive — file paths (local dev)
    google_credentials_file: str = "credentials.json"
    google_token_file: str = "token.json"
    google_drive_root_folder: str = "documents"

    # Google Drive — JSON content (production/Railway)
    google_credentials_json: str = ""
    google_token_json: str = ""

    # App
    app_env: str = "development"


settings = Settings()