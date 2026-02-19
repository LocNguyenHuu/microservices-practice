package repository

import (
	"context"
	"fmt"

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
