-- ORBICA — time-series (TimescaleDB) + materialized views
-- TLE snapshots are append-heavy and queried by (satellite, time) → hypertable.

CREATE TABLE IF NOT EXISTS tle_snapshots (
    satellite_id UUID REFERENCES satellites(id),
    captured_at TIMESTAMPTZ NOT NULL,
    tle_line1 TEXT NOT NULL,
    tle_line2 TEXT NOT NULL,
    source VARCHAR(50)
);

-- Idempotent hypertable creation (no error if already a hypertable).
-- SELECT create_hypertable('tle_snapshots', 'captured_at', if_not_exists => TRUE); (Disabled for Neon/Supabase compatibility)

CREATE INDEX IF NOT EXISTS idx_tle_satellite ON tle_snapshots(satellite_id, captured_at DESC);

-- Year rollup used by the timeline pages. Refreshed by the pipeline after each sync.
CREATE MATERIALIZED VIEW IF NOT EXISTS year_summary AS
SELECT
    launch_year,
    COUNT(*) AS total_launches,
    COUNT(*) FILTER (WHERE outcome = 'success') AS successes,
    COUNT(*) FILTER (WHERE outcome = 'failure') AS failures,
    COUNT(DISTINCT agency_id) AS agencies_active
FROM launch_events
WHERE launch_year IS NOT NULL
GROUP BY launch_year
ORDER BY launch_year;

CREATE UNIQUE INDEX IF NOT EXISTS idx_year_summary_year ON year_summary(launch_year);
