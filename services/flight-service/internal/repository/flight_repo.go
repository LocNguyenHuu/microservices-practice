// Package repository provides data access for the Flight Service domain entities.
// It uses sqlx for type-safe PostgreSQL queries.
package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stephen/flight-service/internal/model"
)

// FlightRepository handles persistence of flight records in PostgreSQL.
type FlightRepository struct {
	db *sqlx.DB
}

// NewFlightRepository creates a new repository backed by the given database connection.
func NewFlightRepository(db *sqlx.DB) *FlightRepository {
	return &FlightRepository{db: db}
}

// allColumns lists every column in the flights table for RETURNING clauses.
const allColumns = `id, flight_number, airline_code, aircraft_reg, aircraft_type,
	origin_iata, destination_iata, scheduled_arrival, scheduled_departure,
	actual_arrival, actual_departure, gate_id, status, created_at, updated_at`

// Create inserts a new flight record and returns the created flight.
func (r *FlightRepository) Create(ctx context.Context, req model.CreateFlightRequest) (*model.Flight, error) {
	flight := &model.Flight{}
	query := fmt.Sprintf(`
		INSERT INTO flights (flight_number, airline_code, aircraft_reg, aircraft_type,
			origin_iata, destination_iata, scheduled_arrival, scheduled_departure, gate_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING %s`, allColumns)

	err := r.db.QueryRowxContext(ctx, query,
		req.FlightNumber, req.AirlineCode, req.AircraftReg, req.AircraftType,
		req.OriginIATA, req.DestinationIATA, req.ScheduledArrival,
		req.ScheduledDeparture, req.GateID,
	).StructScan(flight)
	if err != nil {
		return nil, fmt.Errorf("create flight: %w", err)
	}
	return flight, nil
}

// GetByID retrieves a single flight by its UUID.
func (r *FlightRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Flight, error) {
	flight := &model.Flight{}
	query := fmt.Sprintf("SELECT %s FROM flights WHERE id = $1", allColumns)
	err := r.db.QueryRowxContext(ctx, query, id).StructScan(flight)
	if err != nil {
		return nil, fmt.Errorf("get flight by id: %w", err)
	}
	return flight, nil
}

// List retrieves flights ordered by scheduled arrival, with pagination.
func (r *FlightRepository) List(ctx context.Context, params model.ListParams) ([]model.Flight, error) {
	if params.Limit <= 0 {
		params.Limit = 50
	}
	var flights []model.Flight
	query := fmt.Sprintf("SELECT %s FROM flights ORDER BY scheduled_arrival DESC NULLS LAST LIMIT $1 OFFSET $2", allColumns)
	err := r.db.SelectContext(ctx, &flights, query, params.Limit, params.Offset)
	if err != nil {
		return nil, fmt.Errorf("list flights: %w", err)
	}
	return flights, nil
}

// ListUpcomingArrivals retrieves flights arriving within the given duration from now.
func (r *FlightRepository) ListUpcomingArrivals(ctx context.Context, within time.Duration) ([]model.Flight, error) {
	var flights []model.Flight
	query := fmt.Sprintf(`SELECT %s FROM flights
		WHERE status = 'scheduled'
		AND scheduled_arrival IS NOT NULL
		AND scheduled_arrival BETWEEN NOW() AND NOW() + $1::interval
		ORDER BY scheduled_arrival ASC`, allColumns)
	err := r.db.SelectContext(ctx, &flights, query, fmt.Sprintf("%d minutes", int(within.Minutes())))
	if err != nil {
		return nil, fmt.Errorf("list upcoming arrivals: %w", err)
	}
	return flights, nil
}

// Update applies partial updates to a flight using a single atomic query.
// Only non-nil fields in the request are modified.
func (r *FlightRepository) Update(ctx context.Context, id uuid.UUID, req model.UpdateFlightRequest) (*model.Flight, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1

	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, string(*req.Status))
		argIdx++
	}
	if req.ActualArrival != nil {
		setClauses = append(setClauses, fmt.Sprintf("actual_arrival = $%d", argIdx))
		args = append(args, *req.ActualArrival)
		argIdx++
	}
	if req.ActualDeparture != nil {
		setClauses = append(setClauses, fmt.Sprintf("actual_departure = $%d", argIdx))
		args = append(args, *req.ActualDeparture)
		argIdx++
	}
	if req.GateID != nil {
		setClauses = append(setClauses, fmt.Sprintf("gate_id = $%d", argIdx))
		args = append(args, *req.GateID)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE flights SET %s WHERE id = $%d RETURNING %s`,
		strings.Join(setClauses, ", "), argIdx, allColumns)

	flight := &model.Flight{}
	err := r.db.QueryRowxContext(ctx, query, args...).StructScan(flight)
	if err != nil {
		return nil, fmt.Errorf("update flight: %w", err)
	}
	return flight, nil
}
