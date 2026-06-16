# ORBICA — Complete Build Plan

> What we're building: The world's most complete encyclopedia of every rocket and satellite ever launched (1957-present) — with year-by-year and organization-first navigation, deep rocket/satellite detail pages, and live 3D visualization (3D rocket models + real-time satellite orbit tracking on a 3D globe).
>
> Gap we're filling: Gunter's Space Page has the data depth but a 2001 UI. CesiumJS trackers have live 3D but no historical depth. Nobody combines: Timeline -> Agency -> Rocket -> 3D model -> Satellites it launched -> Live 3D orbit, all in one connected graph.

---

## TECH STACK (Final)

### Backend
| Service | Language | Framework | Role |
|---|---|---|---|
| API Server | Go 1.22 | Fiber v2 + gqlgen | REST + GraphQL |
| Data Pipeline | Python 3.12 | FastAPI + Celery + Airflow | Ingestion, orbital math |
| Real-time Tracker | Go 1.22 | Gorilla WebSocket | Live satellite positions |

### Databases
| DB | Purpose |
|---|---|
| PostgreSQL 16 + PostGIS | Core relational + geospatial data |
| TimescaleDB (PG extension) | TLE history, time-series telemetry |
| Elasticsearch 8.x | Full-text search |
| Redis 7 | Cache + pub/sub |

### Frontend
| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| 3D Globe (satellites) | CesiumJS / Resium + satellite.js |
| 3D Rocket Models | Three.js + React Three Fiber |
| Charts/Timeline | D3.js v7 |
| Data fetching | TanStack Query v5 |
| GraphQL client | urql |
| State | Zustand |

### Data Pipeline & Streaming
| Tool | Role |
|---|---|
| Apache Kafka | Event streaming (launches, TLE updates) |
| Apache Airflow | Scheduled sync DAGs |
| Celery + Redis | Task queue |

### Infrastructure
| Layer | Tool |
|---|---|
| Containers | Docker + Docker Compose (dev), Kubernetes (prod) |
| Cloud | AWS (EC2, RDS, MSK, S3, CloudFront) |
| CDN | Cloudflare |
| CI/CD | GitHub Actions + ArgoCD |
| Monitoring | Prometheus + Grafana + Sentry |
| API Gateway | Kong |

### External Data Sources
| Source | Data | Endpoint |
|---|---|---|
| Launch Library 2 (LL2) | Historical + upcoming launches, rockets, agencies | ll.thespacedevs.com/2.3.0 |
| CelesTrak | TLE data for live satellites | celestrak.org |
| Space-Track.org | Official NORAD satellite catalog | space-track.org |
| NASA Open APIs | Mission data, imagery | api.nasa.gov |
| SpaceX API | SpaceX-specific data | github.com/r-spacex/SpaceX-API |
| ESA DISCOS | Satellite catalog, reentry data | discosweb.esoc.esa.int |
| Gunter's Space Page | Historical cross-reference | space.skyrocket.de |

---

## MONOREPO STRUCTURE

```
orbica/
├── services/
│   ├── api/          # Go — REST + GraphQL API
│   ├── pipeline/     # Python — data ingestion + orbital math
│   └── tracker/      # Go — WebSocket live satellite tracker
├── web/              # Next.js 14 + TypeScript frontend
├── infra/
│   ├── docker/
│   ├── k8s/
│   ├── kafka/
│   └── airflow/
├── data/
│   ├── seeds/
│   └── schemas/
├── scripts/
└── docs/
```

---

## DATABASE SCHEMA (PostgreSQL)

```sql
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    abbrev VARCHAR(50),
    country_code CHAR(3),
    agency_type VARCHAR(50),
    founding_year INT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    total_launches INT DEFAULT 0,
    ll2_id INT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rocket_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    manufacturer_id UUID REFERENCES agencies(id),
    country_code CHAR(3),
    first_flight DATE,
    description TEXT,
    ll2_id INT UNIQUE
);

CREATE TABLE rocket_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES rocket_families(id),
    name VARCHAR(255) NOT NULL,
    variant VARCHAR(100),
    status VARCHAR(50),
    height_m DECIMAL(8,2),
    diameter_m DECIMAL(8,2),
    mass_kg DECIMAL(12,2),
    stages INT,
    payload_leo_kg DECIMAL(10,2),
    payload_gto_kg DECIMAL(10,2),
    payload_sso_kg DECIMAL(10,2),
    payload_tli_kg DECIMAL(10,2),
    propellant_1 VARCHAR(100),
    propellant_2 VARCHAR(100),
    thrust_kn DECIMAL(10,2),
    isp_vacuum INT,
    reusable BOOLEAN DEFAULT FALSE,
    reuse_type VARCHAR(50),
    model_3d_url TEXT,
    model_3d_scale DECIMAL(6,2) DEFAULT 1.0,
    first_flight DATE,
    last_flight DATE,
    total_launches INT DEFAULT 0,
    successful_launches INT DEFAULT 0,
    failed_launches INT DEFAULT 0,
    ll2_id INT UNIQUE,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE launch_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    operator_id UUID REFERENCES agencies(id),
    country_code CHAR(3),
    location GEOGRAPHY(POINT, 4326),
    altitude_m INT,
    active BOOLEAN DEFAULT TRUE,
    ll2_id INT UNIQUE,
    description TEXT
);

CREATE TABLE launch_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rocket_id UUID REFERENCES rocket_vehicles(id),
    agency_id UUID REFERENCES agencies(id),
    launch_site_id UUID REFERENCES launch_sites(id),
    launch_time TIMESTAMPTZ,
    launch_year INT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    outcome VARCHAR(50),
    failure_reason TEXT,
    mission_name VARCHAR(255),
    mission_description TEXT,
    mission_type VARCHAR(100),
    orbit_achieved VARCHAR(50),
    video_url TEXT,
    article_url TEXT,
    ll2_id INT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_launch_events_year ON launch_events(launch_year);
CREATE INDEX idx_launch_events_agency ON launch_events(agency_id);
CREATE INDEX idx_launch_events_rocket ON launch_events(rocket_id);

CREATE TABLE satellites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cospar_id VARCHAR(20) UNIQUE,
    norad_id INT UNIQUE,
    operator_id UUID REFERENCES agencies(id),
    launch_event_id UUID REFERENCES launch_events(id),
    purpose VARCHAR(100),
    purpose_detail TEXT,
    constellation VARCHAR(100),
    orbit_type VARCHAR(50),
    altitude_periapsis_km DECIMAL(10,2),
    altitude_apoapsis_km DECIMAL(10,2),
    inclination_deg DECIMAL(8,4),
    period_minutes DECIMAL(10,4),
    status VARCHAR(50),
    launch_date DATE,
    launch_year INT,
    reentry_date DATE,
    expected_lifetime_years DECIMAL(5,2),
    mass_kg DECIMAL(10,2),
    dry_mass_kg DECIMAL(10,2),
    dimensions TEXT,
    power_watts INT,
    description TEXT,
    image_url TEXT,
    discos_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_satellites_year ON satellites(launch_year);
CREATE INDEX idx_satellites_purpose ON satellites(purpose);
CREATE INDEX idx_satellites_norad ON satellites(norad_id);
CREATE INDEX idx_satellites_constellation ON satellites(constellation);

CREATE TABLE tle_snapshots (
    satellite_id UUID REFERENCES satellites(id),
    captured_at TIMESTAMPTZ NOT NULL,
    tle_line1 TEXT NOT NULL,
    tle_line2 TEXT NOT NULL,
    source VARCHAR(50)
);
SELECT create_hypertable('tle_snapshots', 'captured_at');
CREATE INDEX idx_tle_satellite ON tle_snapshots(satellite_id, captured_at DESC);

CREATE MATERIALIZED VIEW year_summary AS
SELECT
    launch_year,
    COUNT(*) AS total_launches,
    COUNT(*) FILTER (WHERE outcome = 'success') AS successes,
    COUNT(*) FILTER (WHERE outcome = 'failure') AS failures,
    COUNT(DISTINCT agency_id) AS agencies_active
FROM launch_events
GROUP BY launch_year
ORDER BY launch_year;
```

---

## NAVIGATION & UX FLOW

```
                       HOME
          Stats overview + 4 entry points
                         |
   -----------------------------------------------------
   |               |               |                    |
TIMELINE        AGENCIES         ROCKETS            SATELLITES
Year-wise        Org-wise          List                 List
   |               |               |                    |
YEAR PAGE          |          ROCKET DETAIL              |
(launches)         |---------> + 3D model                |
   |                          + tabs:                    |
   |                            specs / launches /       |
   |                            payloads                  |
   |                               |                      |
   ---------------------------------------------------- |
                                   |
                          SATELLITE DETAIL
                          + live 3D orbit
                          + tabs: orbit / specs / history
                          links back to launch rocket
```

### Pages (Next.js routes)

```
/                          Home — stats, 4 entry cards
/timeline                  Era selector + year quick-jump
/timeline/[year]           All launches that year, links to rockets/satellites
/agencies                  All 70+ agencies, sorted by launch count
/agencies/[id]             Agency profile — their rockets, launch history
/rockets                   Filterable rocket list (active/retired/reusable/heavy)
/rockets/[id]              Rocket detail: 3D model + specs/launches/payloads tabs
/satellites                Filterable satellite list (purpose/orbit/status)
/satellites/[id]           Satellite detail: live 3D orbit + orbit/specs/history tabs
/launches/[id]             Single launch detail page
/track                     Full-screen live 3D globe — all/filtered satellites
/compare                   Side-by-side rocket comparison
/on-this-day               "On this day in space history"
/constellations/[name]     Starlink/GPS/Galileo group view
/search                    Elasticsearch-powered search
/stats                     Leaderboards by country/agency/decade
```

---

## 3D VISUALIZATION SPEC

### A. Rocket 3D Viewer (/rockets/[id])

Tech: Three.js + React Three Fiber + drei (components/rockets/RocketViewer3D.tsx)

- Load .glb/.gltf model from rocket_vehicles.model_3d_url
- OrbitControls — drag to rotate, scroll to zoom
- Stage highlighting — click "Stage 1" in specs tab -> highlights that stage on model
- Fallback: if no 3D model exists, render a procedurally generated cylinder+cone+fins placeholder scaled to height_m / diameter_m

Model sourcing plan:
- Phase 1: Procedural placeholders for ALL 500+ rockets (cylinder body, cone nose, fins generated from specs — guarantees no rocket is ever "missing" a 3D view)
- Phase 2: Hand-modeled/sourced GLTF for top 30 most-viewed rockets (Falcon 9, Saturn V, Soyuz, Starship, PSLV, Ariane, Long March, etc.) — community GLTF sources (NASA 3D Resources, Sketchfab CC-licensed)

```typescript
function generateProceduralRocket(spec: RocketSpec) {
  const bodyHeight = spec.height_m * 0.85;
  const bodyRadius = spec.diameter_m / 2;
  return (
    <group>
      <mesh position={[0, bodyHeight/2, 0]}>
        <cylinderGeometry args={[bodyRadius, bodyRadius, bodyHeight, 32]} />
        <meshStandardMaterial color="#c0cce0" />
      </mesh>
      <mesh position={[0, bodyHeight + spec.height_m*0.075, 0]}>
        <coneGeometry args={[bodyRadius, spec.height_m*0.15, 32]} />
        <meshStandardMaterial color="#d8e4f0" />
      </mesh>
    </group>
  );
}
```

### B. Satellite Live 3D Orbit (/satellites/[id] + /track)

Tech: CesiumJS / Resium + satellite.js + Go WebSocket tracker (components/satellites/OrbitViewer3D.tsx, components/track/GlobalTracker.tsx)

- CesiumJS globe with Natural Earth imagery (free tier, no Cesium Ion token needed for base imagery)
- Satellite position computed client-side via satellite.js from latest TLE (fetched via Go tracker WebSocket)
- Orbit path drawn as SampledPositionProperty — full orbit ground track visible
- Day/night terminator overlay
- /track page: filter by purpose (comm/nav/weather/military/science), constellation toggle (show all Starlink, etc.)
- Click any satellite dot on globe -> navigates to /satellites/[id]

WebSocket protocol (Go tracker):
```json
{ "action": "subscribe", "norad_id": 25544 }

{
  "norad_id": 25544,
  "name": "ISS",
  "lat": 51.4, "lng": -30.2, "altitude_km": 408,
  "velocity_km_s": 7.66,
  "timestamp": "2026-06-13T10:30:00Z"
}
```

---

## API ENDPOINTS (Go API Server)

### REST
```
GET  /api/v1/timeline/years
GET  /api/v1/timeline/years/:year
GET  /api/v1/agencies
GET  /api/v1/agencies/:id
GET  /api/v1/rockets
GET  /api/v1/rockets/:id
GET  /api/v1/rockets/:id/launches
GET  /api/v1/rockets/:id/payloads
GET  /api/v1/satellites
GET  /api/v1/satellites/:id
GET  /api/v1/satellites/:id/tle
GET  /api/v1/launches/:id
GET  /api/v1/on-this-day?date=MM-DD
GET  /api/v1/constellations/:name
GET  /api/v1/search?q=
GET  /api/v1/stats/leaderboard?by=country|agency|decade
```

### GraphQL (key types)
```graphql
type Rocket {
  id: ID!
  name: String!
  family: RocketFamily!
  manufacturer: Agency!
  specs: RocketSpecs!
  model3dUrl: String
  launches(year: Int, outcome: Outcome): [Launch!]!
  payloads: [Satellite!]!
  successRate: Float!
}

type Satellite {
  id: ID!
  name: String!
  cosparId: String
  noradId: Int
  operator: Agency!
  launchEvent: Launch!
  orbit: OrbitalElements!
  purpose: Purpose!
  status: SatelliteStatus!
  currentTle: TLE
}

type YearSummary {
  year: Int!
  totalLaunches: Int!
  successes: Int!
  failures: Int!
  launches: [Launch!]!
}
```

---

## BUILD PHASES

### Phase 0 — Foundation (Days 1-5)
- [ ] Init monorepo (Go modules in services/api and services/tracker, Python venv in services/pipeline, Next.js in web/)
- [ ] docker-compose.yml: PostgreSQL+PostGIS, TimescaleDB extension, Redis, Elasticsearch, Kafka+Zookeeper
- [ ] Run schema migrations (full SQL above)
- [ ] GitHub Actions CI skeleton
- [ ] .env.example with all required keys

Done when: docker-compose up brings up all infra, empty DB has all tables.

---

### Phase 1 — Data Seeding (Days 6-12)
- [ ] Python pipeline: LL2 client — fetch all agencies, rocket families, rocket configs, launches (paginated, 1957->now)
- [ ] Seed agencies, rocket_families, rocket_vehicles, launch_sites, launch_events
- [ ] Python: CelesTrak + Space-Track client — fetch satellite catalog, populate satellites
- [ ] Link satellites.launch_event_id to launch_events via COSPAR/launch date matching
- [ ] Populate launch_year / denormalized fields
- [ ] Refresh year_summary materialized view
- [ ] Airflow DAGs: sync_launches (6h), sync_tle (2h), sync_satellites (daily)

Done when: DB has ~7,500 launches, ~19,000 satellites, ~500 rockets, ~70 agencies, year_summary populated for 1957-2026.

---

### Phase 2 — Go API (Days 13-22)
- [ ] Fiber v2 app skeleton, pgx/v5 connection pool
- [ ] Implement all REST endpoints listed above
- [ ] gqlgen schema + resolvers for GraphQL types above
- [ ] Elasticsearch indexer — index rockets, satellites, launches with full-text fields
- [ ] Redis caching for /timeline/years, /agencies, /rockets (list endpoints)
- [ ] Swagger/OpenAPI docs at /api/docs

Done when: All endpoints return real seeded data, search works, cached responses <50ms.

---

### Phase 3 — Frontend Core Pages (Days 23-35)
- [ ] Next.js 14 setup, Tailwind config, dark space theme
- [ ] / Home — stats cards + 4 navigation entry cards
- [ ] /timeline — era selector (5 eras) + year grid
- [ ] /timeline/[year] — launch list for that year, links to rockets/satellites
- [ ] /agencies + /agencies/[id]
- [ ] /rockets (filterable grid) + /rockets/[id] (specs/launches/payloads tabs — NO 3D yet)
- [ ] /satellites (filterable grid) + /satellites/[id] (orbit/specs/history tabs — NO 3D yet)
- [ ] /launches/[id]
- [ ] /search

Done when: Full click-through navigation works end-to-end with real data, matches the UX flow diagram above.

---

### Phase 4 — 3D Visualization (Days 36-48)
- [ ] React Three Fiber setup in web/
- [ ] RocketViewer3D.tsx — procedural rocket generator for ALL rockets (cylinder/cone/fins from specs)
- [ ] Integrate into /rockets/[id] — drag/zoom controls, stage highlighting
- [ ] Source/add 10 hand-modeled GLTF rockets for top vehicles (Falcon 9, Saturn V, Soyuz, Starship, etc.)
- [ ] Go WebSocket tracker service — sgp4 propagation from latest TLE, broadcast every 5s
- [ ] CesiumJS/Resium globe setup — OrbitViewer3D.tsx
- [ ] Integrate into /satellites/[id] — show live position + orbit path
- [ ] /track — full-screen global tracker with purpose filters + constellation toggle

Done when: Every rocket page shows a 3D model (procedural minimum), every active satellite shows live position on a 3D globe.

---

### Phase 5 — Advanced Features (Days 49-60)
- [ ] /on-this-day — query launches by MM-DD across all years
- [ ] /compare — side-by-side rocket spec comparison (2-3 rockets)
- [ ] /constellations/[name] — Starlink/GPS/Galileo grouped views with 3D constellation render
- [ ] /stats — leaderboards by country/agency/decade (D3 charts)
- [ ] Failure archive — filter /timeline by outcome=failure with failure_reason detail
- [ ] Upcoming launches widget on Home (from LL2 /launches/upcoming/)

Done when: All Phase 5 pages functional with real data and charts.

---

### Phase 6 — Production (Days 61-75)
- [ ] Kubernetes manifests for api/pipeline/tracker/web
- [ ] AWS infra: RDS (Postgres+TimescaleDB), MSK (Kafka), S3+CloudFront for 3D models/images
- [ ] ArgoCD GitOps pipeline
- [ ] Cloudflare CDN in front of Next.js
- [ ] Prometheus + Grafana dashboards (API latency, Kafka lag, DB size)
- [ ] SEO: SSG for all /rockets/[id], /satellites/[id], /timeline/[year] pages, sitemap.xml generation (15,000+ URLs)
- [ ] Load test: 10k concurrent users on /timeline and /track

Done when: Production deployment live, Lighthouse SEO score >90 on encyclopedia pages.

---

## ENVIRONMENT VARIABLES

```env
POSTGRES_URL=postgresql://user:pass@localhost:5432/rocketpedia
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_LAUNCHES=launches.new
KAFKA_TOPIC_TLE=tle.updates

LL2_API_KEY=
NASA_API_KEY=
SPACE_TRACK_USER=
SPACE_TRACK_PASS=

JWT_SECRET=

NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_TRACKER_WS_URL=ws://localhost:8081

AWS_S3_BUCKET=orbica-media
AWS_CLOUDFRONT_URL=
```

---

## DAY 1 COMMANDS

```bash
git clone https://github.com/yourname/orbica
cd orbica

docker-compose up -d

cd scripts && go run migrate.go up

cd services/pipeline
pip install -r requirements.txt --break-system-packages
python src/seed/historical_seed.py

cd services/api
go run cmd/server/main.go

cd web
npm install
npm run dev

open http://localhost:3000
```

---

## DATA SCALE TARGETS

| Entity | Target |
|---|---|
| Launch events (1957->now) | 7,500+ |
| Satellites cataloged | 19,000+ |
| Active satellites (live tracked) | ~10,000 |
| Rocket vehicles | 500+ |
| Rocket families | 100+ |
| Agencies | 70+ |
| Launch sites | 90+ |
| Years covered | 1957-2026 (70 years) |

---

## DEFINITION OF DONE (per feature)

1. Unit tests pass (Go: testify, Python: pytest, Frontend: vitest)
2. Endpoint documented in Swagger
3. Data validated against LL2/Space-Track
4. Works fully in docker-compose up
5. Page matches UX flow diagram navigation
6. Lighthouse score >90 on public pages

---

## BUILD ORDER SUMMARY

1. Phase 0 -> infra + schema
2. Phase 1 -> seed real data (this is the foundation everything depends on)
3. Phase 2 -> Go API serving that data
4. Phase 3 -> Frontend pages consuming the API (no 3D yet — get navigation right first)
5. Phase 4 -> Add 3D (procedural rockets first, then CesiumJS satellite tracking)
6. Phase 5 -> Advanced features
7. Phase 6 -> Production deployment

Start with Phase 0 + Phase 1 together — without real seeded data, nothing else can be properly tested.

---

No shortcuts. World-class engineering. Every rocket, every satellite, from 1957 to today.
