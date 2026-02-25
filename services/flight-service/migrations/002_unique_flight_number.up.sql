-- Unique constraint for idempotent flight ingestion.
-- Prevents duplicate flights with the same flight number and scheduled arrival.
-- Partial index: only applies when scheduled_arrival is NOT NULL.
CREATE UNIQUE INDEX idx_flights_number_arrival
  ON flights(flight_number, scheduled_arrival)
  WHERE scheduled_arrival IS NOT NULL;
