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
		Port:             env("API_PORT", "8080"),
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
