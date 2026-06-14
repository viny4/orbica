-- ORBICA — schema adjustments discovered during ingestion.
--
-- Launch Library 2 identifies LAUNCHES by UUID string (only agencies and
-- launcher_configurations use integer ids). The base schema's launch_events.ll2_id
-- is INT, which can't hold a launch UUID — so we add a dedicated text key that
-- the pipeline upserts against.
ALTER TABLE launch_events ADD COLUMN IF NOT EXISTS ll2_uuid TEXT UNIQUE;

-- Satellites carry an OBJECT_ID (COSPAR) and NORAD id from CelesTrak GP data;
-- norad_id is already UNIQUE in the base schema, used as the upsert key.

-- Trigram index to make the cross-entity ILIKE search in the API fast until
-- Elasticsearch is wired up (Phase 2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_rockets_name_trgm ON rocket_vehicles USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_satellites_name_trgm ON satellites USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agencies_name_trgm ON agencies USING gin (name gin_trgm_ops);
