-- ORBICA — extensions
-- Enable everything the schema relies on. Order matters: extensions first.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;         -- GEOGRAPHY/GEOMETRY
-- CREATE EXTENSION IF NOT EXISTS timescaledb;     -- hypertables for TLE time-series (Disabled for Neon/Supabase compatibility)
