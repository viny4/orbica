-- ORBICA — Sync Logs & Auditing
-- Logs metadata, status, records added/updated, and granular details for each pipeline sync run.

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    records_added INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(timestamp DESC);
