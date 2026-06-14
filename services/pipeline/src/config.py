"""Pipeline configuration sourced from the environment / .env."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_url: str = "postgresql://rocketpedia:rocketpedia@localhost:5432/rocketpedia"
    redis_url: str = "redis://localhost:6379"

    ll2_base_url: str = "https://ll.thespacedevs.com/2.3.0"
    # Dev cache: same data + LL2 ids, relaxed limits, but only complete for
    # *reference* entities (agencies/rockets/pads). Launches are recent-only.
    ll2_dev_base_url: str = "https://lldev.thespacedevs.com/2.3.0"
    ll2_api_key: str = ""
    celestrak_base_url: str = "https://celestrak.org"
    space_track_user: str = ""
    space_track_pass: str = ""
    nasa_api_key: str = ""

    # Politeness: LL2 free tier is heavily rate-limited.
    ll2_page_size: int = 100
    request_timeout_s: float = 30.0


settings = Settings()
