# 🚀 ORBICA — orbica.space

> The world's most complete encyclopedia of every rocket and satellite ever launched (1957–present) — year-by-year and organization-first navigation, deep detail pages, 3D rocket models, and real-time satellite orbit tracking on a 3D globe.

Gunter's Space Page has the data depth but a 2001 UI. CesiumJS trackers have live 3D but no historical depth. **Orbica combines both**: Timeline → Agency → Rocket → 3D model → Satellites it launched → Live 3D orbit, all in one connected graph.

---

## Architecture

```
                         ┌──────────────────────┐
                         │       Next.js        │  web/   (App Router, R3F)
                         │   Cloudflare Pages   │
                         └──────┬───────────┬───┘
                                │           │
              PostgREST (primary)│           │REST + WebSocket (fallback)
                                │           │
                                │   ┌───────▼──────────────┐
                                │   │        Go API        │  services/api
                                │   │  REST + live tracker │  (Fiber v2, pgx/v5,
                                │   │  (sgp4 propagation)  │   sgp4) — optional
                                │   └───────┬──────────────┘
                                │           │
        ┌───────────────────────┼───────────┼───────────────────────┐
        │  Python Pipeline (services/pipeline) — LL2 / CelesTrak    │
        │  / SNAPI ingest + orbital math; runs every 4h via         │
        │  GitHub Actions (.github/workflows/sync.yml)              │
        │  Python Intel (services/intel) — conjunctions,            │
        │  reentry watch, space weather                             │
        └───────────────────────┬───────────┬───────────────────────┘
                                │           │
                         ┌──────▼───────────▼───┐
                         │  Postgres (Supabase) │  + PostGIS + pg_trgm
                         └──────────────────────┘

Local dev also brings up Redis, Elasticsearch and Kafka (see docker-compose.yml).
```

### Why two paths to the database

Every read endpoint exists twice: as a Go REST handler, and as a read-only
Postgres function (`data/schemas/15_api_rpc.sql`) exposed through Supabase's
PostgREST running that handler's exact SQL. Responses are identical, so the
frontend does not care which answered.

**Supabase is the primary.** It queries Postgres directly with no dyno to wake,
and because every `api_*` function is `STABLE` the calls are plain cacheable
`GET`s. The Go API is the fallback, and the only backend in local development.
This is what keeps the site up when the API host is down — a free-tier host
suspending the service used to take the whole site with it.

The live tracker degrades the same way: if the WebSocket hub is unreachable, the
browser fetches the TLE catalogue once and runs SGP4 itself
(`web/src/lib/localTracker.ts`) — ~16k satellites in 18ms per tick, and no
streaming bandwidth at all.

## Repo layout

```
orbica/
├── services/
│   ├── api/          # Go — REST API + live WebSocket tracker (Fiber v2, pgx/v5, sgp4)
│   ├── pipeline/     # Python — data ingestion + orbital math (LL2/CelesTrak/SNAPI)
│   └── intel/        # Python — computed space intelligence (conjunctions, reentry, weather)
├── web/              # Next.js 14 + TypeScript + React-Three-Fiber
├── data/
│   ├── schemas/      # SQL migrations (auto-run by docker-compose)
│   └── seeds/        # static seed data
├── .github/workflows/ # CI + the 4-hourly data sync
├── scripts/          # migrate.go, sync.sh, and ops helpers
└── docs/
```

## Quickstart

Requires: Docker, Go 1.22+, Python 3.12+, Node 20+.

```bash
cp .env.example .env

make up          # start postgres, redis, elasticsearch, kafka
make migrate     # apply schema (also auto-applied on first postgres boot)
make seed        # ingest real data from Launch Library 2 + CelesTrak

make api         # terminal 1 — Go API + live tracker on :8090
make web         # terminal 2 — Next.js on :3000

open http://localhost:3000
```

Two terminals is the whole loop. The live tracker is part of the Go API, not a
separate process, and `make pipeline` (Python, :8000) is only needed when you are
working on ingestion.

If `POSTGRES_URL` already points at Supabase you can skip `make up`, `make
migrate` and `make seed` entirely — `make api` and `make web` are enough.

Run `make help` for all targets.

**Ports in use:** if a page serves stale chunks or a server won't bind, a
previous run is still holding the port:

```bash
lsof -ti:3000 -ti:8090 | xargs kill -9
```

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
