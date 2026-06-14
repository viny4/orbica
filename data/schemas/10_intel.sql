-- ORBICA — "Space Intelligence": original, computed data the intel service
-- produces from our TLE catalogue + space-weather feeds (not relayed articles).

-- Close approaches between catalogued objects (conjunction screening).
CREATE TABLE IF NOT EXISTS conjunctions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sat_a_id      UUID REFERENCES satellites(id),
    sat_b_id      UUID REFERENCES satellites(id),
    sat_a_name    TEXT,
    sat_b_name    TEXT,
    tca           TIMESTAMPTZ,        -- time of closest approach
    miss_km       NUMERIC(10,3),
    rel_speed_kms NUMERIC(8,3),
    computed_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conjunctions_tca ON conjunctions(tca);
CREATE INDEX IF NOT EXISTS idx_conjunctions_miss ON conjunctions(miss_km);

-- Objects decaying toward reentry (low perigee, sinking).
CREATE TABLE IF NOT EXISTS reentries (
    satellite_id UUID PRIMARY KEY REFERENCES satellites(id),
    name         TEXT,
    perigee_km   NUMERIC(10,2),
    apogee_km    NUMERIC(10,2),
    status       VARCHAR(16),         -- imminent | decaying | low
    est_days     NUMERIC(8,2),        -- rough days to reentry
    computed_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reentries_perigee ON reentries(perigee_km);

-- Latest space-weather snapshot (geomagnetic / solar).
CREATE TABLE IF NOT EXISTS space_weather (
    id          SERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    kp          NUMERIC(4,2),
    kp_state    VARCHAR(24),          -- Quiet / Unsettled / Storm G1..G5
    solar_wind_kms NUMERIC(8,1),
    xray_class  VARCHAR(8),           -- e.g. C3.2, M1.0, X2.1
    note        TEXT
);

-- Derived event feed (deployments, storms, imminent reentries…).
CREATE TABLE IF NOT EXISTS space_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        VARCHAR(24),          -- deployment | storm | reentry | conjunction
    title       TEXT,
    detail      TEXT,
    occurred_at TIMESTAMPTZ,
    href        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (kind, title, occurred_at)
);
CREATE INDEX IF NOT EXISTS idx_space_events_time ON space_events(occurred_at DESC);
