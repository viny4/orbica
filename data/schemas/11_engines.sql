-- Rocket propulsion: a catalogue of real rocket engines and which vehicles /
-- stages use them. LL2 doesn't carry clean engine data, so `engines` is curated
-- (see services/pipeline/src/seed/engines_seed.py) and `rocket_engines` maps each
-- engine to a vehicle by stage + count.

CREATE TABLE IF NOT EXISTS engines (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL UNIQUE,
    manufacturer  TEXT,
    cycle         TEXT,          -- gas-generator | staged-combustion | full-flow staged combustion | electric-pump | expander | pressure-fed | solid
    propellant    TEXT,          -- "RP-1 / LOX", "LH2 / LOX", "CH4 / LOX", "UDMH / N2O4", "solid"
    thrust_sl_kn  NUMERIC,       -- sea-level thrust, per engine
    thrust_vac_kn NUMERIC,       -- vacuum thrust, per engine
    isp_sl_s      NUMERIC,
    isp_vac_s     NUMERIC,
    first_flight  INT,           -- year of first flight
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rocket_engines (
    rocket_id  UUID NOT NULL REFERENCES rocket_vehicles(id) ON DELETE CASCADE,
    engine_id  UUID NOT NULL REFERENCES engines(id) ON DELETE CASCADE,
    stage      INT  NOT NULL DEFAULT 1,   -- 0 = booster/strap-on, 1 = first/core, 2 = second, 3 = third
    engine_count INT NOT NULL DEFAULT 1,
    note       TEXT,
    PRIMARY KEY (rocket_id, engine_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_rocket_engines_rocket ON rocket_engines(rocket_id);
