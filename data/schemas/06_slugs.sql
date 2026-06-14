-- ROCKETPEDIA — human-readable, SEO-friendly URL slugs for rockets, satellites
-- and agencies (e.g. /rockets/falcon-9 instead of a UUID). Unique per table;
-- the "primary" entry (most launches / earliest) keeps the clean slug, dupes get
-- a numeric suffix.

ALTER TABLE rocket_vehicles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE satellites      ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE agencies        ADD COLUMN IF NOT EXISTS slug TEXT;

-- rockets — clean slug goes to the most-flown variant
WITH b AS (
  SELECT id,
    COALESCE(NULLIF(trim(BOTH '-' FROM lower(regexp_replace(COALESCE(name,''), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'rocket') AS base,
    total_launches
  FROM rocket_vehicles
), r AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY total_launches DESC NULLS LAST, id) AS rn FROM b
)
UPDATE rocket_vehicles t SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM r WHERE t.id = r.id;

-- satellites
WITH b AS (
  SELECT id,
    COALESCE(NULLIF(trim(BOTH '-' FROM lower(regexp_replace(COALESCE(name,''), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'object') AS base,
    launch_date
  FROM satellites
), r AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY launch_date ASC NULLS LAST, id) AS rn FROM b
)
UPDATE satellites t SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM r WHERE t.id = r.id;

-- agencies
WITH b AS (
  SELECT id,
    COALESCE(NULLIF(trim(BOTH '-' FROM lower(regexp_replace(COALESCE(name,''), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'agency') AS base,
    total_launches
  FROM agencies
), r AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY total_launches DESC NULLS LAST, id) AS rn FROM b
)
UPDATE agencies t SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM r WHERE t.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rockets_slug    ON rocket_vehicles(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_satellites_slug ON satellites(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_slug   ON agencies(slug);
