#!/bin/bash
set -e

FLIGHT_URL="${1:-http://localhost:8080}"
PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); echo "  ✓ $1"; }
fail() { FAILED=$((FAILED + 1)); echo "  ✗ $1"; }

echo "=== SkyTurn Flight Service — End-to-End Test ==="
echo ""

# Wait for service
echo "Waiting for flight service..."
for i in $(seq 1 30); do
  if curl -sf "$FLIGHT_URL/health" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 1. Health check
echo "1. Health check"
HEALTH=$(curl -sf "$FLIGHT_URL/health")
echo "$HEALTH" | jq .
if echo "$HEALTH" | jq -e '.service == "flight-service"' > /dev/null 2>&1; then
  pass "Health check returns flight-service"
else
  fail "Unexpected health response"
fi
echo ""

# 2. Create flight
echo "2. Scheduling flight EK302 (LHR → DXB, A380)"
FLIGHT=$(curl -sf -X POST "$FLIGHT_URL/api/flights" \
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
  }')
echo "$FLIGHT" | jq .
FLIGHT_ID=$(echo "$FLIGHT" | jq -r '.id')
if [ "$FLIGHT_ID" != "null" ] && [ -n "$FLIGHT_ID" ]; then
  pass "Flight created with ID: $FLIGHT_ID"
else
  fail "Failed to create flight"
fi
echo ""

# 3. Get flight by ID
echo "3. Retrieving flight by ID"
GET_RESULT=$(curl -sf "$FLIGHT_URL/api/flights/$FLIGHT_ID")
echo "$GET_RESULT" | jq .
if echo "$GET_RESULT" | jq -e '.flight_number == "EK302"' > /dev/null 2>&1; then
  pass "Flight retrieved with correct flight number"
else
  fail "Flight data mismatch"
fi
echo ""

# 4. Update flight status to arrived
echo "4. Updating flight status to 'arrived'"
UPDATED=$(curl -sf -X PATCH "$FLIGHT_URL/api/flights/$FLIGHT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "arrived", "actual_arrival": "2026-02-20T14:35:00Z"}')
echo "$UPDATED" | jq .
if echo "$UPDATED" | jq -e '.status == "arrived"' > /dev/null 2>&1; then
  pass "Flight status updated to arrived (triggers flight.arrived event)"
else
  fail "Status update failed"
fi
echo ""

# 5. Update flight status to boarding
echo "5. Updating flight status to 'boarding'"
BOARDING=$(curl -sf -X PATCH "$FLIGHT_URL/api/flights/$FLIGHT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "boarding"}')
echo "$BOARDING" | jq .
if echo "$BOARDING" | jq -e '.status == "boarding"' > /dev/null 2>&1; then
  pass "Flight status updated to boarding"
else
  fail "Boarding status update failed"
fi
echo ""

# 6. List flights with pagination
echo "6. Listing flights (limit=10)"
LIST=$(curl -sf "$FLIGHT_URL/api/flights?limit=10")
echo "$LIST" | jq .
COUNT=$(echo "$LIST" | jq 'length')
if [ "$COUNT" -ge 1 ]; then
  pass "Listed $COUNT flight(s)"
else
  fail "No flights returned"
fi
echo ""

# Summary
echo "=== Results: $PASSED passed, $FAILED failed ==="
if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
