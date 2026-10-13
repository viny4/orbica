-- Rollback for 16_api_rpc_v2.sql. NOT picked up by scripts/migrate.go (it only
-- globs data/schemas/*.sql). Run by hand if v2 must be reverted:
--
--   psql "$POSTGRES_URL" -c 'SET check_function_bodies = off' -f data/schemas/15_api_rpc.sql   # restore v1 bodies
--     (15 contains an ill-typed early api_timeline_year body that is replaced later in
--      the same file; with body checks on, psql prints errors even though the end state is right)
--   psql "$POSTGRES_URL" -f data/schemas/rollback/16_down.sql
--   psql "$POSTGRES_URL" -c "DELETE FROM schema_migrations WHERE filename = '16_api_rpc_v2.sql'"
--
-- Re-applying 15 restores every function v2 replaced (same signatures). This
-- file removes what v2 added. The image columns are left in place on purpose:
-- dropping them would discard data the sync has already filled; uncomment if
-- you really want them gone.

DROP FUNCTION IF EXISTS public.api_sync_status();
DROP INDEX IF EXISTS idx_satellites_description_trgm;
DROP INDEX IF EXISTS idx_satellites_cospar_trgm;
DROP INDEX IF EXISTS idx_sync_logs_job_time;

-- ALTER TABLE rocket_vehicles DROP COLUMN IF EXISTS thumbnail_url;
-- ALTER TABLE rocket_vehicles DROP COLUMN IF EXISTS image_credit;
-- ALTER TABLE rocket_vehicles DROP COLUMN IF EXISTS image_license_name;
-- ALTER TABLE rocket_vehicles DROP COLUMN IF EXISTS image_license_url;
