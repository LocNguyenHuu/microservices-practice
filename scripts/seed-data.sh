#!/bin/bash
set -e

BASE_URL="${1:-http://localhost:8080}"

# Wait for service to be healthy
echo "Waiting for flight service..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "Flight service is ready."
    break
  fi
  sleep 1
done

echo ""
echo "Seeding flight data..."

echo "1. Emirates EK302 (LHR → DXB, A380)"
curl -sf -X POST "$BASE_URL/api/flights" \
  -H "Content-Type: application/json" \
  -d '{
    "flight_number": "EK302",
    "airline_code": "EK",
    "aircraft_reg": "A6-EAX",
    "aircraft_type": "A380",
    "origin_iata": "LHR",
    "destination_iata": "DXB",
    "scheduled_arrival": "2026-02-20T14:30:00Z",
    "scheduled_departure": "2026-02-20T16:45:00Z"
  }' | jq .

echo "2. Singapore Airlines SQ21 (SIN → JFK, A350)"
curl -sf -X POST "$BASE_URL/api/flights" \
  -H "Content-Type: application/json" \
  -d '{
    "flight_number": "SQ21",
    "airline_code": "SQ",
    "aircraft_reg": "9V-SGA",
    "aircraft_type": "A350",
    "origin_iata": "SIN",
    "destination_iata": "JFK",
    "scheduled_arrival": "2026-02-20T18:00:00Z",
    "scheduled_departure": "2026-02-20T20:30:00Z"
  }' | jq .

echo "3. Qantas QF1 (SYD → LHR, B787)"
curl -sf -X POST "$BASE_URL/api/flights" \
  -H "Content-Type: application/json" \
  -d '{
    "flight_number": "QF1",
    "airline_code": "QF",
    "aircraft_reg": "VH-ZNA",
    "aircraft_type": "B787",
    "origin_iata": "SYD",
    "destination_iata": "LHR",
    "scheduled_arrival": "2026-02-20T06:15:00Z",
    "scheduled_departure": "2026-02-20T08:45:00Z"
  }' | jq .

echo ""
echo "Seed complete. Listing all flights:"
curl -sf "$BASE_URL/api/flights" | jq .
