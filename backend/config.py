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

    # Google Drive
    google_credentials_file: str = "credentials.json"
    google_token_file: str = "token.json"
    google_drive_root_folder: str = "contracts"

    # App
    app_env: str = "development"


settings = Settings()
