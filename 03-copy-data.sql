CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS ttc_delay CASCADE;
DROP TABLE IF EXISTS toronto_weather CASCADE;
DROP TABLE IF EXISTS ttc_location CASCADE;

CREATE TABLE ttc_location(
	location_id UUID NOT NULL PRIMARY KEY,
	location TEXT NOT NULL UNIQUE
);

CREATE TABLE ttc_reason(
	reason_id UUID NOT NULL PRIMARY KEY,
	reason TEXT NOT NULL UNIQUE
);

CREATE TABLE ttc_delay(
	date DATE NOT NULL,
	line NUMERIC(3),
	time TIME NOT NULL,
	day TEXT NOT NULL,
	location TEXT NOT NULL,
	incident TEXT NOT NULL,
	min_delay NUMERIC(3) NOT NULL,
	min_gap NUMERIC(3) NOT NULL,
	bound CHAR,
	vehicle NUMERIC(5) NOT NULL
);

CREATE TABLE toronto_weather(
	date DATE NOT NULL,
	temperature_min NUMERIC(4, 2) NOT NULL,
	temperature_max NUMERIC(4, 2) NOT NULL,
	precipitation_total NUMERIC(4, 2) NOT NULL,
	wind_max_speed NUMERIC(4, 2) NOT NULL
);

COPY ttc_delay
FROM '/Users/ari/Documents/willamette/data503/project2/ttc-streetcar-delay-data-2023.csv'
DELIMITER ','
CSV HEADER;

COPY toronto_weather
FROM '/Users/ari/Documents/willamette/data503/project2/toronto-weather.csv'
DELIMITER ','
CSV HEADER;

ALTER TABLE ttc_delay DROP COLUMN day;

INSERT INTO ttc_location
SELECT GEN_RANDOM_UUID() AS location_id, location FROM ttc_delay GROUP BY location;

ALTER TABLE ttc_delay ADD location_id UUID REFERENCES ttc_location(location_id);

UPDATE ttc_delay
SET location_id = ttc_location.location_id
FROM ttc_location
WHERE ttc_delay.location = ttc_location.location;

ALTER TABLE ttc_delay DROP COLUMN location;

INSERT INTO ttc_reason
SELECT GEN_RANDOM_UUID() AS reason_id, incident FROM ttc_delay GROUP BY incident;

ALTER TABLE ttc_delay ADD reason_id UUID REFERENCES ttc_reason(reason_id);

UPDATE ttc_delay
SET reason_id = ttc_reason.reason_id
FROM ttc_reason
WHERE ttc_delay.incident = ttc_reason.reason;

ALTER TABLE ttc_delay DROP COLUMN incident;


