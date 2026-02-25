package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stephen/flight-service/internal/model"
)

// GateRepository handles persistence of gate records in PostgreSQL.
type GateRepository struct {
	db *sqlx.DB
}

// NewGateRepository creates a new repository backed by the given database connection.
func NewGateRepository(db *sqlx.DB) *GateRepository {
	return &GateRepository{db: db}
}

// List retrieves all active gates ordered by terminal and gate number.
func (r *GateRepository) List(ctx context.Context) ([]model.Gate, error) {
	var gates []model.Gate
	err := r.db.SelectContext(ctx, &gates,
		"SELECT id, gate_number, terminal, is_active FROM gates WHERE is_active = true ORDER BY terminal, gate_number")
	if err != nil {
		return nil, fmt.Errorf("list gates: %w", err)
	}
	return gates, nil
}

// GetByID retrieves a single gate by its UUID.
func (r *GateRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Gate, error) {
	gate := &model.Gate{}
	err := r.db.GetContext(ctx, gate, "SELECT id, gate_number, terminal, is_active FROM gates WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("get gate by id: %w", err)
	}
	return gate, nil
}

// FindConflictingFlights finds flights assigned to the same gate whose time windows overlap
// with the given flight. Excludes departed/cancelled/diverted flights and the flight itself.
func (r *GateRepository) FindConflictingFlights(ctx context.Context, gateID uuid.UUID, flightID uuid.UUID, arrival, departure *time.Time) ([]model.Flight, error) {
	if arrival == nil {
		return nil, nil
	}
	// If no departure time, assume a 3-hour turnaround window
	endTime := arrival.Add(3 * time.Hour)
	if departure != nil {
		endTime = *departure
	}

	var flights []model.Flight
	query := fmt.Sprintf(`SELECT %s FROM flights
		WHERE gate_id = $1
		AND id != $2
		AND status NOT IN ('departed', 'cancelled', 'diverted')
		AND COALESCE(scheduled_arrival, actual_arrival) < $4
		AND COALESCE(scheduled_departure, COALESCE(scheduled_arrival, actual_arrival) + INTERVAL '3 hours') > $3`,
		"id, flight_number, airline_code, aircraft_reg, aircraft_type, origin_iata, destination_iata, scheduled_arrival, scheduled_departure, actual_arrival, actual_departure, gate_id, status, created_at, updated_at")
	err := r.db.SelectContext(ctx, &flights, query, gateID, flightID, *arrival, endTime)
	if err != nil {
		return nil, fmt.Errorf("find conflicting flights: %w", err)
	}
	return flights, nil
}

// GetGateOccupancy returns gate-time blocks for all gates within a time window.
// Used by the stand planning board Gantt visualization.
func (r *GateRepository) GetGateOccupancy(ctx context.Context, from, to time.Time) ([]model.GateOccupancy, error) {
	var occupancy []model.GateOccupancy
	query := `SELECT
		g.id AS gate_id, g.gate_number, g.terminal,
		f.id AS flight_id, f.flight_number, f.aircraft_type, f.status,
		COALESCE(f.actual_arrival, f.scheduled_arrival) AS start_time,
		COALESCE(f.actual_departure, f.scheduled_departure) AS end_time
	FROM flights f
	JOIN gates g ON g.id = f.gate_id
	WHERE f.gate_id IS NOT NULL
	AND f.status NOT IN ('cancelled', 'diverted')
	AND COALESCE(f.actual_arrival, f.scheduled_arrival) < $2
	AND COALESCE(f.actual_departure, f.scheduled_departure, COALESCE(f.actual_arrival, f.scheduled_arrival) + INTERVAL '3 hours') > $1
	ORDER BY g.terminal, g.gate_number, start_time`
	err := r.db.SelectContext(ctx, &occupancy, query, from, to)
	if err != nil {
		return nil, fmt.Errorf("get gate occupancy: %w", err)
	}
	return occupancy, nil
}
