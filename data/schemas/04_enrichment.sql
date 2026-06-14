-- ORBICA — enrichment: richer satellite metadata, launch-site reference,
-- real news articles, and the indexes that keep all of it fast at scale.

-- ── Satellite metadata from SATCAT ──────────────────────────────────────────
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS object_type      VARCHAR(8);   -- PAY | R/B | DEB | UNK
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS owner_code       VARCHAR(12);  -- e.g. US, PRC, CIS, ESA
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS launch_site_code VARCHAR(12);  -- SATCAT site code
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS rcs_m2           DECIMAL(10,4);
ALTER TABLE satellites ADD COLUMN IF NOT EXISTS ops_status       VARCHAR(4);

-- ── Launch-site reference (resolves SATCAT codes → human names + geo) ────────
CREATE TABLE IF NOT EXISTS launch_site_codes (
    code         VARCHAR(12) PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    country_code CHAR(3),
    latitude     DECIMAL(9,5),
    longitude    DECIMAL(9,5)
);

INSERT INTO launch_site_codes (code, name, country_code, latitude, longitude) VALUES
  ('AFETR','Cape Canaveral SFS, USA','USA',28.4675,-80.5767),
  ('AFWTR','Vandenberg SFB, USA','USA',34.742,-120.572),
  ('KSC',  'Kennedy Space Center, USA','USA',28.5729,-80.6490),
  ('WLPIS','Wallops Island, USA','USA',37.940,-75.466),
  ('KWAJ', 'Kwajalein / Omelek, Marshall Is.','MHL',9.048,167.743),
  ('TYMSC','Baikonur Cosmodrome, Kazakhstan','KAZ',45.920,63.342),
  ('PLMSC','Plesetsk Cosmodrome, Russia','RUS',62.927,40.575),
  ('KYMSC','Kapustin Yar, Russia','RUS',48.4,56.1),
  ('VOSTO','Vostochny Cosmodrome, Russia','RUS',51.884,128.334),
  ('FRGUI','Guiana Space Centre, Kourou','GUF',5.236,-52.768),
  ('TANSC','Tanegashima, Japan','JPN',30.4,130.97),
  ('KSCUT','Uchinoura, Japan','JPN',31.251,131.079),
  ('SRILR','Satish Dhawan / Sriharikota, India','IND',13.733,80.235),
  ('JSC',  'Jiuquan, China','CHN',40.958,100.291),
  ('TSC',  'Taiyuan, China','CHN',38.849,111.608),
  ('XSC',  'Xichang, China','CHN',28.246,102.026),
  ('WSC',  'Wenchang, China','CHN',19.614,110.951),
  ('SEAL', 'Sea Launch (Odyssey, Pacific)','XXX',0.0,-154.0),
  ('SNMLP','San Marco Platform, Kenya','KEN',-2.938,40.213),
  ('SADOL','Dombarovsky, Russia','RUS',51.094,59.843),
  ('OREN', 'Orenburg / Yasny, Russia','RUS',51.2,59.8),
  ('SEMLS','Semnan, Iran','IRN',35.234,53.921),
  ('YAVNE','Palmachim, Israel','ISR',31.884,34.680),
  ('NSC',  'Naro Space Center, S. Korea','KOR',34.432,127.535),
  ('MAHIA','Mahia Peninsula, New Zealand','NZL',-39.261,177.865)
ON CONFLICT (code) DO NOTHING;

-- ── Real news articles (Spaceflight News API) ───────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapi_id     BIGINT UNIQUE,
    title        TEXT NOT NULL,
    url          TEXT UNIQUE NOT NULL,
    summary      TEXT,
    image_url    TEXT,
    news_site    VARCHAR(120),
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Polymorphic link so one article can attach to a rocket, satellite, agency, etc.
CREATE TABLE IF NOT EXISTS article_links (
    article_id  UUID REFERENCES articles(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,  -- 'rocket' | 'satellite' | 'constellation' | 'agency'
    entity_key  TEXT NOT NULL,         -- uuid for rocket/satellite, name for constellation
    PRIMARY KEY (article_id, entity_type, entity_key)
);

-- ── Indexes for scale ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_satellites_launch_event ON satellites(launch_event_id);
CREATE INDEX IF NOT EXISTS idx_satellites_object_type  ON satellites(object_type);
CREATE INDEX IF NOT EXISTS idx_satellites_owner        ON satellites(owner_code);
CREATE INDEX IF NOT EXISTS idx_satellites_orbit_type   ON satellites(orbit_type);
CREATE INDEX IF NOT EXISTS idx_satellites_launch_site  ON satellites(launch_site_code);
CREATE INDEX IF NOT EXISTS idx_article_links_entity    ON article_links(entity_type, entity_key);
CREATE INDEX IF NOT EXISTS idx_articles_published      ON articles(published_at DESC);
