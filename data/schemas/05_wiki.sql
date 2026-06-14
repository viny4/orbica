-- ORBICA — encyclopedic enrichment for satellites: a real description,
-- a real photo, and a source link (Wikipedia), plus the fields a "what happened
-- to it" legacy section needs (decay date + lifetime are already present).

ALTER TABLE satellites ADD COLUMN IF NOT EXISTS wikipedia_url TEXT;

CREATE INDEX IF NOT EXISTS idx_satellites_status ON satellites(status);
CREATE INDEX IF NOT EXISTS idx_satellites_reentry ON satellites(reentry_date);
