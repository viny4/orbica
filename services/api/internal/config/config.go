package config

import "os"

// Config holds runtime configuration sourced from the environment.
type Config struct {
	Port             string
	PostgresURL      string
	RedisURL         string
	ElasticsearchURL string
}

// Load reads configuration from the environment, applying sane local defaults.
func Load() Config {
	return Config{
		// Most PaaS (Koyeb, Render, Fly, Cloud Run) inject PORT and expect the
		// app to bind it; API_PORT remains the local/compose override.
		Port:             env("PORT", env("API_PORT", "8080")),
		PostgresURL:      env("POSTGRES_URL", "postgresql://rocketpedia:rocketpedia@localhost:5432/rocketpedia"),
		RedisURL:         env("REDIS_URL", "redis://localhost:6379"),
		ElasticsearchURL: env("ELASTICSEARCH_URL", "http://localhost:9200"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
