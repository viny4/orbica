# 🚀 ORBICA — orbica.space

> The world's most complete encyclopedia of every rocket and satellite ever launched (1957–present) — year-by-year and organization-first navigation, deep detail pages, 3D rocket models, and real-time satellite orbit tracking on a 3D globe.

Gunter's Space Page has the data depth but a 2001 UI. CesiumJS trackers have live 3D but no historical depth. **Orbica combines both**: Timeline → Agency → Rocket → 3D model → Satellites it launched → Live 3D orbit, all in one connected graph.

---

## Architecture (microservices)

```
                         ┌──────────────┐
                         │   Next.js    │  web/        (App Router, R3F, Cesium)
                         └──────┬───────┘
              REST/GraphQL      │      WebSocket
                    ┌───────────┴───────────┐
            ┌───────▼───────┐       ┌────────▼────────┐
            │   Go API      │       │  Go Tracker     │
            │ services/api  │       │ services/tracker│  (sgp4 live positions)
            │ Fiber+gqlgen  │       └────────┬────────┘
            └───────┬───────┘                │
                    │            ┌───────────▼───────────┐
        ┌───────────┼────────────┤  Python Pipeline      │  services/pipeline
        │           │            │  FastAPI+Celery+Airflow│  (LL2/CelesTrak ingest)
        │           │            └───────────┬───────────┘
   ┌────▼────┐ ┌────▼─────┐ ┌─────▼─────┐ ┌──▼──┐ ┌────────┐
   │Postgres │ │Timescale │ │Elastic    │ │Redis│ │ Kafka  │
   │+PostGIS │ │ (TLE)    │ │search     │ │     │ │        │
   └─────────┘ └──────────┘ └───────────┘ └─────┘ └────────┘
```

## Repo layout

```
orbica/
├── services/
│   ├── api/          # Go — REST + GraphQL (Fiber v2, gqlgen, pgx/v5)
│   ├── pipeline/     # Python — data ingestion + orbital math (FastAPI, Celery, Airflow)
│   └── tracker/      # Go — WebSocket live satellite tracker (sgp4)
├── web/              # Next.js 14 + TypeScript frontend
├── infra/            # docker / k8s / kafka / airflow
├── data/
│   ├── schemas/      # SQL migrations (auto-run by docker-compose)
│   └── seeds/        # static seed data
├── scripts/          # migrate.go and ops helpers
└── docs/
```

## Quickstart

Requires: Docker, Go 1.22+, Python 3.12+, Node 20+.

```bash
cp .env.example .env

make up          # start postgres, redis, elasticsearch, kafka
make migrate     # apply schema (also auto-applied on first postgres boot)
make seed        # ingest real data from Launch Library 2 + CelesTrak

make api         # terminal 1 — Go API on :8080
make tracker     # terminal 2 — Go tracker on :8081
make pipeline    # terminal 3 — Python pipeline on :8000
make web         # terminal 4 — Next.js on :3000

open http://localhost:3000
```

Run `make help` for all targets.

## Data scale targets

| Entity | Target |
|---|---|
| Launch events (1957→now) | 7,500+ |
| Satellites cataloged | 19,000+ |
| Active satellites (live tracked) | ~10,000 |
| Rocket vehicles | 500+ |
| Agencies | 70+ |
| Years covered | 1957–2026 |

See [docs/PLAN.md](docs/PLAN.md) for the full build plan and phase breakdown.
