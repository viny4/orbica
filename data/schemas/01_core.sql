-- ROCKETPEDIA — core relational schema
-- Agencies → rocket families → rocket vehicles → launch sites → launch events → satellites.

CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    abbrev VARCHAR(50),
    country_code CHAR(3),
    agency_type VARCHAR(50),
    founding_year INT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    total_launches INT DEFAULT 0,
    ll2_id INT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rocket_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    manufacturer_id UUID REFERENCES agencies(id),
    country_code CHAR(3),
    first_flight DATE,
    description TEXT,
    ll2_id INT UNIQUE
);

CREATE TABLE IF NOT EXISTS rocket_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES rocket_families(id),
    name VARCHAR(255) NOT NULL,
    variant VARCHAR(100),
    status VARCHAR(50),
    height_m DECIMAL(8,2),
    diameter_m DECIMAL(8,2),
    mass_kg DECIMAL(12,2),
    stages INT,
    payload_leo_kg DECIMAL(10,2),
    payload_gto_kg DECIMAL(10,2),
    payload_sso_kg DECIMAL(10,2),
    payload_tli_kg DECIMAL(10,2),
    propellant_1 VARCHAR(100),
    propellant_2 VARCHAR(100),
    thrust_kn DECIMAL(10,2),
    isp_vacuum INT,
    reusable BOOLEAN DEFAULT FALSE,
    reuse_type VARCHAR(50),
    model_3d_url TEXT,
    model_3d_scale DECIMAL(6,2) DEFAULT 1.0,
    first_flight DATE,
    last_flight DATE,
    total_launches INT DEFAULT 0,
    successful_launches INT DEFAULT 0,
    failed_launches INT DEFAULT 0,
    ll2_id INT UNIQUE,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS launch_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    operator_id UUID REFERENCES agencies(id),
    country_code CHAR(3),
    location GEOGRAPHY(POINT, 4326),
    altitude_m INT,
    active BOOLEAN DEFAULT TRUE,
    ll2_id INT UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS launch_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rocket_id UUID REFERENCES rocket_vehicles(id),
    agency_id UUID REFERENCES agencies(id),
    launch_site_id UUID REFERENCES launch_sites(id),
    launch_time TIMESTAMPTZ,
    launch_year INT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    outcome VARCHAR(50),
    failure_reason TEXT,
    mission_name VARCHAR(255),
    mission_description TEXT,
    mission_type VARCHAR(100),
    orbit_achieved VARCHAR(50),
    video_url TEXT,
    article_url TEXT,
    ll2_id INT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_launch_events_year ON launch_events(launch_year);
CREATE INDEX IF NOT EXISTS idx_launch_events_agency ON launch_events(agency_id);
CREATE INDEX IF NOT EXISTS idx_launch_events_rocket ON launch_events(rocket_id);

CREATE TABLE IF NOT EXISTS satellites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cospar_id VARCHAR(20) UNIQUE,
    norad_id INT UNIQUE,
    operator_id UUID REFERENCES agencies(id),
    launch_event_id UUID REFERENCES launch_events(id),
    purpose VARCHAR(100),
    purpose_detail TEXT,
    constellation VARCHAR(100),
    orbit_type VARCHAR(50),
    altitude_periapsis_km DECIMAL(10,2),
    altitude_apoapsis_km DECIMAL(10,2),
    inclination_deg DECIMAL(8,4),
    period_minutes DECIMAL(10,4),
    status VARCHAR(50),
    launch_date DATE,
    launch_year INT,
    reentry_date DATE,
    expected_lifetime_years DECIMAL(5,2),
    mass_kg DECIMAL(10,2),
    dry_mass_kg DECIMAL(10,2),
    dimensions TEXT,
    power_watts INT,
    description TEXT,
    image_url TEXT,
    discos_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_satellites_year ON satellites(launch_year);
CREATE INDEX IF NOT EXISTS idx_satellites_purpose ON satellites(purpose);
CREATE INDEX IF NOT EXISTS idx_satellites_norad ON satellites(norad_id);
CREATE INDEX IF NOT EXISTS idx_satellites_constellation ON satellites(constellation);
