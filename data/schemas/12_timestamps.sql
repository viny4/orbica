-- Uniform audit timestamps across every application table.
--
-- Guarantees every table has created_at + updated_at (TIMESTAMPTZ, default now())
-- and a BEFORE UPDATE trigger that stamps updated_at automatically — so future
-- tables/queries can always rely on these columns. Idempotent: safe to re-run.
--
-- Excludes spatial_ref_sys (PostGIS-managed reference data).

-- Ensure the stamping function exists even if this runs standalone (also in 08).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  app_tables text[] := ARRAY[
    'agencies', 'article_links', 'articles', 'conjunctions', 'engines',
    'launch_events', 'launch_site_codes', 'launch_sites', 'reentries',
    'rocket_engines', 'rocket_families', 'rocket_vehicles', 'satcat_owners',
    'satellites', 'space_events', 'space_weather', 'tle_snapshots'
  ];
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    -- columns (no-op if already present)
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    -- one canonical updated_at trigger per table
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- Retire the legacy rocket_vehicles trigger name from 08 (now standardised above).
DROP TRIGGER IF EXISTS trg_rockets_updated_at ON rocket_vehicles;
