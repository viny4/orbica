-- ROCKETPEDIA — the few triggers worth having.
--
-- Philosophy: this is a read-heavy catalogue with batched writes, so we avoid
-- trigger "magic" almost everywhere. We add exactly two integrity guards that
-- can't be forgotten by a writer:
--   1. updated_at is always stamped on UPDATE (some writers forget to).
--   2. launch_year can never drift from launch_time.
-- Counts stay LL2-sourced; year_summary stays a scheduled refresh (a trigger
-- there would re-aggregate on every insert — far too expensive).

-- 1) Auto-stamp updated_at on any UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agencies_updated_at ON agencies;
CREATE TRIGGER trg_agencies_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_rockets_updated_at ON rocket_vehicles;
CREATE TRIGGER trg_rockets_updated_at BEFORE UPDATE ON rocket_vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_satellites_updated_at ON satellites;
CREATE TRIGGER trg_satellites_updated_at BEFORE UPDATE ON satellites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) Keep launch_year consistent with launch_time.
CREATE OR REPLACE FUNCTION sync_launch_year() RETURNS trigger AS $$
BEGIN
  IF NEW.launch_time IS NOT NULL THEN
    NEW.launch_year := EXTRACT(YEAR FROM NEW.launch_time)::int;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_launch_year ON launch_events;
CREATE TRIGGER trg_launch_year BEFORE INSERT OR UPDATE OF launch_time ON launch_events
  FOR EACH ROW EXECUTE FUNCTION sync_launch_year();
