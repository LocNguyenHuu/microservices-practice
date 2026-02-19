CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Gates: physical aircraft parking positions at the airport.
-- Seeded with sample gates across terminals T1-T3.
CREATE TABLE gates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_number  VARCHAR(10) NOT NULL UNIQUE,
    terminal     VARCHAR(5) NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true
);

-- Seed gates for local development
INSERT INTO gates (gate_number, terminal) VALUES
    ('A1', 'T1'), ('A2', 'T1'), ('A3', 'T1'), ('A4', 'T1'), ('A5', 'T1'),
    ('B1', 'T2'), ('B2', 'T2'), ('B3', 'T2'), ('B4', 'T2'), ('B5', 'T2'),
    ('C1', 'T3'), ('C2', 'T3'), ('C3', 'T3'), ('C4', 'T3'), ('C5', 'T3');

-- Flights: scheduled and actual flight operations.
-- Each flight references an aircraft (by registration) and an assigned gate.
CREATE TABLE flights (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_number       VARCHAR(10) NOT NULL,
    airline_code        VARCHAR(3) NOT NULL,
    aircraft_reg        VARCHAR(10) NOT NULL,
    aircraft_type       VARCHAR(10) NOT NULL,
    origin_iata         VARCHAR(3) NOT NULL,
    destination_iata    VARCHAR(3) NOT NULL,
    scheduled_arrival   TIMESTAMPTZ,
    scheduled_departure TIMESTAMPTZ,
    actual_arrival      TIMESTAMPTZ,
    actual_departure    TIMESTAMPTZ,
    gate_id             UUID REFERENCES gates(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','arrived','boarding','departed','cancelled','diverted')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index strategy:
-- status: scheduler queries flights by operational state
-- scheduled_arrival: upcoming arrivals query (WHERE scheduled_arrival BETWEEN now AND now + interval)
-- flight_number: lookup by IATA flight number
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_scheduled_arrival ON flights(scheduled_arrival);
CREATE INDEX idx_flights_flight_number ON flights(flight_number);
