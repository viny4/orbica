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
        │  / SNAPI ingest + orbital math; runs every 6h via         │
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
├── .github/workflows/ # CI + the 6-hourly data sync
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

## Operations notes (Oct 2026 upgrade)

### Deploy order

Any order works: the web app runs against both the old and new RPC functions, the Go
API doesn't depend on the new columns, and the pipeline skips columns a database lacks
(so the database can also be rolled back on its own). Apply the migration first anyway:
the first sync after the deploy refreshes rocket data, and if it runs before the
migration, rocket thumbnails/credits stay empty until the next daily refresh.

### Database migration: `data/schemas/16_api_rpc_v2.sql`

Additive and backwards compatible: functions keep their names and signatures, new
columns are nullable, nothing is dropped. Timings are from a production-sized copy.

| Change | Effect |
|---|---|
| Index-friendly slug/UUID lookups in the `api_*` functions | satellite lookup 12.5 ms → 0.02 ms |
| `api_all_tles` probes the newest TLE per satellite | 152 ms → ~55 ms, no 26 MB sort |
| Trigram indexes on satellite `description` and `cospar_id` | search 36 ms → ~1–7 ms |
| Server-side clamps on client-supplied `LIMIT`/`OFFSET` | same bounds as the Go API |
| Failure archive includes `partial_failure` launches | 522 → 556 rows |
| Nullable `rocket_vehicles` columns, filled by the LL2 sync | `thumbnail_url`, `image_credit`, `image_license_name`, `image_license_url` |
| New public `api_sync_status()` function | see Observability |

Apply from the repo root between sync runs (cron: 00/06/12/18 UTC); it briefly locks
`rocket_vehicles`, `satellites` and `sync_logs`. `migrate.go` reads `POSTGRES_URL`
from the environment only, and `make migrate` only applies 00–02.

```bash
export POSTGRES_URL=...
go run scripts/migrate.go status   # 16_api_rpc_v2.sql should be the only pending file
go run scripts/migrate.go up       # each pending file in a transaction, recorded in schema_migrations
```

If older files are pending too, don't run `up` (it would re-apply them): apply 16 alone
with `psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 --single-transaction -f data/schemas/16_api_rpc_v2.sql`
and insert its `schema_migrations` row by hand.

Rollback (from the header of `data/schemas/rollback/16_down.sql`, plus a `SET`):

```bash
psql "$POSTGRES_URL" -c 'SET check_function_bodies = off' -f data/schemas/15_api_rpc.sql  # restore v1 bodies
psql "$POSTGRES_URL" -f data/schemas/rollback/16_down.sql  # drops v2 additions, keeps the image columns
psql "$POSTGRES_URL" -c "DELETE FROM schema_migrations WHERE filename = '16_api_rpc_v2.sql'"
```

The `SET` works around a pre-existing quirk: the first `api_timeline_year(text, …)`
body in `15_api_rpc.sql` is ill-typed (it's dropped and replaced later in the file), so
with body checks on, that statement errors (plain `psql -f` prints it and carries on).
On a brand-new Postgres, 15 only applies with `check_function_bodies = off` (for
`migrate.go`, append `?check_function_bodies=off` to `POSTGRES_URL`) and, outside
Supabase, after `CREATE ROLE anon NOLOGIN`, since 15 and 16 grant to `anon`.

### Admin sign-in (`/sync-logs`)

Sessions are now HMAC-signed and expire after 24 h (`web/src/lib/adminSession.ts`,
cookie `admin_session`); credentials still come from `ADMIN_USERNAME` and
`ADMIN_PASSWORD`. Optional `ADMIN_SESSION_SECRET` (a long random string) sets the
signing key; unset, it's derived from `ADMIN_PASSWORD`, so changing the password
signs everyone out. Admins sign in once more after the deploy: the old `admin_token`
cookie is no longer accepted. Login redirects only go to same-site relative paths.

### Security headers

`web/next.config.mjs` sends HSTS (1 year, no `includeSubDomains`/`preload`), `nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, an enforced minimal CSP
(`frame-ancestors`, `base-uri`, `object-src`, `form-action`) and the full allow-list as
`Content-Security-Policy-Report-Only`, whose `connect-src` is built at build time from
the `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_ANALYTICS_URL` origins.

To promote it, browse home, `/track`, `/iss`, a satellite page and a launch page with a
video with DevTools open (there's no report endpoint; the console is the only place
violations show). Once it's clean, change the `Content-Security-Policy` value from
`CSP_ENFORCED` to `CSP_REPORT_ONLY`, delete the `Content-Security-Policy-Report-Only`
entry (the full list already has the four enforced directives) and redeploy. Check
what's live with `curl -sI https://orbica.space | grep -i content-security`.

### Data sync (`services/pipeline`)

- LL2 reference data (agencies, rockets, pads) refreshes at most every 24 h
  (`REFERENCE_MAX_AGE_HOURS` in `services/pipeline/src/sync/refresh.py`); launches sync
  every run.
- Writes are batched (`upsert_many` in `services/pipeline/src/db/pool.py`) and unchanged
  rows aren't rewritten, so `sync_logs` "updated" counts are real; measured locally, a
  no-change re-run of the launch sync takes ~5 s.
- TLE snapshots are only stored when an element set changed.
- The LL2, CelesTrak, SATCAT, SNAPI and Wikidata clients retry only transient errors
  (network, 408/425/429, 500/502/503/504) and honour `Retry-After`, capped at 120 s
  (`services/pipeline/src/clients/http_retry.py`).
- Intel jobs run via `python -m src.run` in `services/intel` and record success or
  failure in `sync_logs`; that workflow step fails only if every job failed.
- The workflow has a concurrency guard (a second trigger waits) and a 45-minute timeout.

### Observability

The Go API logs one JSON line per request to stdout (`method`, `path`, `status`,
`ms`, `cache`, `request_id`; health checks are skipped), accepts and echoes
`X-Request-Id`, and logs queries slower than 500 ms as `slow query`. Raw DB errors
never reach clients: 5xx responses carry a `request_id` to grep the logs for (query
timeouts are 503s). Only successful responses are cached. Public freshness is
`GET /api/v1/sync-status` (Go) or `api_sync_status()` (RPC): `last_run_at`,
`last_run_status` and `last_success_at` from the `refresh-run` rows in `sync_logs`
(a run is `failure` if `launches`, `tle-active` or `news` failed).

### Tests

```bash
(cd services/api && go test ./...)                       # unit tests, no database needed
(cd services/pipeline && .venv/bin/python -m pytest -q)  # likewise; or `pytest -q` in a venv with requirements.txt
(cd web && npx tsc --noEmit && npm run build)
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
