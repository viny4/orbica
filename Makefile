.DEFAULT_GOAL := help
SHELL := /bin/bash

# Load .env if present so targets can use $(POSTGRES_URL) etc.
ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: help up down logs ps migrate seed api tracker pipeline web fmt test clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Start all infra (postgres, redis, elasticsearch, kafka)
	docker compose up -d

down: ## Stop all infra
	docker compose down

logs: ## Tail infra logs
	docker compose logs -f

ps: ## Show infra status
	docker compose ps

migrate: ## Apply DB schema (idempotent)
	psql "$(POSTGRES_URL)" -v ON_ERROR_STOP=1 \
		-f data/schemas/00_extensions.sql \
		-f data/schemas/01_core.sql \
		-f data/schemas/02_timeseries.sql

seed: ## Run the historical data seed (LL2 + CelesTrak)
	cd services/pipeline && python -m src.seed.historical_seed

api: ## Run the Go API server
	cd services/api && go run ./cmd/server


pipeline: ## Run the Python pipeline API
	cd services/pipeline && uvicorn src.main:app --reload --port $(PIPELINE_PORT)

web: ## Run the Next.js frontend
	cd web && npm run dev

sync: ## Refresh live data once (launches, TLEs, satellites, news) — what cron runs
	./scripts/sync.sh && tail -n 12 logs/sync.log

cron-install: ## Install the every-4-hours auto-refresh cron job
	./scripts/install-cron.sh

fmt: ## Format Go + Python + web
	cd services/api && go fmt ./... || true
	cd services/pipeline && ruff format src tests || true
	cd web && npm run format || true

test: ## Run all test suites
	cd services/api && go test ./... || true
	cd services/pipeline && pytest -q || true
	cd web && npm test || true

clean: ## Stop infra and remove volumes (DESTROYS local data)
	docker compose down -v
