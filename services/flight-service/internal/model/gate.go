package model

import (
	"time"

	"github.com/google/uuid"
)

// Gate represents a physical aircraft gate at the airport.
type Gate struct {
	ID         uuid.UUID `json:"id" db:"id"`
	GateNumber string    `json:"gate_number" db:"gate_number"` // e.g. "A14"
	Terminal   string    `json:"terminal" db:"terminal"`       // e.g. "T3"
	IsActive   bool      `json:"is_active" db:"is_active"`
}

// GateOccupancy represents a time block when a flight occupies a gate.
// Used for the stand planning board (Gantt chart).
type GateOccupancy struct {
	GateID       uuid.UUID  `json:"gate_id" db:"gate_id"`
	GateNumber   string     `json:"gate_number" db:"gate_number"`
	Terminal     string     `json:"terminal" db:"terminal"`
	FlightID     uuid.UUID  `json:"flight_id" db:"flight_id"`
	FlightNumber string     `json:"flight_number" db:"flight_number"`
	AircraftType string     `json:"aircraft_type" db:"aircraft_type"`
	Status       string     `json:"status" db:"status"`
	StartTime    time.Time  `json:"start_time" db:"start_time"`
	EndTime      *time.Time `json:"end_time" db:"end_time"`
}
