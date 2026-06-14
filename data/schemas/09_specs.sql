-- ROCKETPEDIA — spacecraft physical/operational specs that SATCAT lacks but the
-- UCS Satellite Database provides (mass, power, lifetime are existing columns;
-- these three are new). Joined by NORAD id.

ALTER TABLE satellites ADD COLUMN IF NOT EXISTS operator_name TEXT;  -- "SpaceX", "Intelsat", ...
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS contractor    TEXT;  -- manufacturer / prime contractor
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS users         TEXT;  -- Civil / Commercial / Government / Military
