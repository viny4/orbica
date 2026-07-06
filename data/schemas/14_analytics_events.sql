CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anonymous_user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB,
    path TEXT,
    referrer TEXT,
    country VARCHAR(255),
    city VARCHAR(255),
    region VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    browser VARCHAR(255),
    os VARCHAR(255),
    device VARCHAR(255),
    screen_resolution VARCHAR(50),
    is_bot BOOLEAN DEFAULT FALSE,
    cf_ray VARCHAR(255),
    ip_hash VARCHAR(255),
    tracker_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- We need at least one active partition to insert into. For a production system
-- we'd use pg_partman or a cron job to roll monthly partitions forward. Until
-- that's automated, the DEFAULT partition below guarantees inserts NEVER fail —
-- any row outside the explicit ranges lands there instead of erroring. Pre-create
-- named monthly partitions for query pruning; migrate rows out of DEFAULT later.

CREATE TABLE IF NOT EXISTS analytics_events_2026_07 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026_08 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026_09 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026_10 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026_11 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026_12 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Catch-all so a missing month never rejects an insert (data-loss backstop).
CREATE TABLE IF NOT EXISTS analytics_events_default PARTITION OF analytics_events DEFAULT;

CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_payload ON analytics_events USING GIN (payload);
