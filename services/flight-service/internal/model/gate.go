package model

import "github.com/google/uuid"

// Gate represents a physical aircraft gate at the airport.
type Gate struct {
	ID         uuid.UUID `json:"id" db:"id"`
	GateNumber string    `json:"gate_number" db:"gate_number"` // e.g. "A14"
	Terminal   string    `json:"terminal" db:"terminal"`       // e.g. "T3"
	IsActive   bool      `json:"is_active" db:"is_active"`
}
