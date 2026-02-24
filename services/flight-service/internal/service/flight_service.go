// Package service contains the business logic for the Flight Service.
// It orchestrates between the repository layer and event publishing,
// enforcing domain rules and validation.
package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/stephen/flight-service/internal/event"
	"github.com/stephen/flight-service/internal/model"
	"github.com/stephen/flight-service/internal/repository"
)

// FlightService implements the core business logic for flight operations.
type FlightService struct {
	repo      *repository.FlightRepository
	gateRepo  *repository.GateRepository
	publisher event.Publisher
}

// NewFlightService creates a new service with the given repository and event publisher.
func NewFlightService(repo *repository.FlightRepository, gateRepo *repository.GateRepository, publisher event.Publisher) *FlightService {
	return &FlightService{repo: repo, gateRepo: gateRepo, publisher: publisher}
}

// CreateFlight validates the request, persists a new flight, and returns it.
func (s *FlightService) CreateFlight(ctx context.Context, req model.CreateFlightRequest) (*model.Flight, error) {
	if req.FlightNumber == "" {
		return nil, fmt.Errorf("flight_number is required")
	}
	if req.AirlineCode == "" {
		return nil, fmt.Errorf("airline_code is required")
	}
	if req.AircraftReg == "" {
		return nil, fmt.Errorf("aircraft_reg is required")
	}
	if req.AircraftType == "" {
		return nil, fmt.Errorf("aircraft_type is required")
	}
	if req.OriginIATA == "" {
		return nil, fmt.Errorf("origin_iata is required")
	}
	if req.DestinationIATA == "" {
		return nil, fmt.Errorf("destination_iata is required")
	}

	flight, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create flight: %w", err)
	}

	slog.Info("flight created",
		"flight_id", flight.ID,
		"flight_number", flight.FlightNumber,
		"aircraft_type", flight.AircraftType,
		"route", fmt.Sprintf("%s→%s", flight.OriginIATA, flight.DestinationIATA),
	)

	return flight, nil
}

// GetFlight retrieves a single flight by ID.
func (s *FlightService) GetFlight(ctx context.Context, id uuid.UUID) (*model.Flight, error) {
	flight, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("flight not found: %w", err)
	}
	return flight, nil
}

// ListFlights retrieves flights with pagination.
func (s *FlightService) ListFlights(ctx context.Context, params model.ListParams) ([]model.Flight, error) {
	return s.repo.List(ctx, params)
}

// ListUpcomingArrivals retrieves flights scheduled to arrive within the given window.
func (s *FlightService) ListUpcomingArrivals(ctx context.Context, within time.Duration) ([]model.Flight, error) {
	return s.repo.ListUpcomingArrivals(ctx, within)
}

// UpdateFlight applies partial updates and publishes relevant domain events
// based on what changed (status transition, gate reassignment, etc.).
func (s *FlightService) UpdateFlight(ctx context.Context, id uuid.UUID, req model.UpdateFlightRequest) (*model.Flight, error) {
	if req.Status == nil && req.ActualArrival == nil && req.ActualDeparture == nil && req.GateID == nil {
		return nil, fmt.Errorf("nothing to update")
	}

	// Validate status if provided
	if req.Status != nil && !req.Status.Valid() {
		return nil, fmt.Errorf("invalid status: %s", *req.Status)
	}

	// Fetch existing flight to detect what changed
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("flight not found: %w", err)
	}

	// Apply update atomically
	flight, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("update flight: %w", err)
	}

	// Publish domain events based on what changed
	s.publishStatusEvents(existing, flight, req)

	return flight, nil
}

// publishStatusEvents determines which domain events to publish based on
// the state transition that occurred.
func (s *FlightService) publishStatusEvents(before, after *model.Flight, req model.UpdateFlightRequest) {
	// Status changed → publish the appropriate event
	if req.Status != nil && *req.Status != before.Status {
		var eventType event.EventType
		switch after.Status {
		case model.StatusArrived:
			eventType = event.FlightArrived
		case model.StatusBoarding:
			eventType = event.FlightBoarding
		case model.StatusDeparted:
			eventType = event.FlightDeparted
		default:
			eventType = event.EventType(fmt.Sprintf("flight.%s", after.Status))
		}

		payload := map[string]any{
			"old_status":    before.Status,
			"new_status":    after.Status,
			"flight":        after,
			"aircraft_type": after.AircraftType,
		}

		if err := s.publisher.Publish(eventType, after.ID, payload); err != nil {
			slog.Error("failed to publish flight status event",
				"event_type", string(eventType),
				"flight_id", after.ID,
				"error", err,
			)
		}

		slog.Info("flight status changed",
			"flight_id", after.ID,
			"flight_number", after.FlightNumber,
			"old_status", string(before.Status),
			"new_status", string(after.Status),
		)
	}

	// Gate changed → publish gate change event + check for conflicts
	if req.GateID != nil && (before.GateID == nil || *req.GateID != *before.GateID) {
		payload := map[string]any{
			"old_gate_id": before.GateID,
			"new_gate_id": after.GateID,
			"flight":      after,
		}
		if err := s.publisher.Publish(event.FlightGateChanged, after.ID, payload); err != nil {
			slog.Error("failed to publish gate change event",
				"flight_id", after.ID,
				"error", err,
			)
		}

		slog.Info("flight gate reassigned",
			"flight_id", after.ID,
			"flight_number", after.FlightNumber,
			"new_gate_id", after.GateID,
		)

		// Check for gate conflicts
		s.checkGateConflicts(after)
	}
}

// checkGateConflicts detects overlapping gate assignments and publishes conflict events.
func (s *FlightService) checkGateConflicts(flight *model.Flight) {
	if flight.GateID == nil || s.gateRepo == nil {
		return
	}

	conflicts, err := s.gateRepo.FindConflictingFlights(
		context.Background(), *flight.GateID, flight.ID,
		flight.ScheduledArrival, flight.ScheduledDeparture,
	)
	if err != nil {
		slog.Error("failed to check gate conflicts", "error", err)
		return
	}

	for _, conflicting := range conflicts {
		payload := map[string]any{
			"flight":            flight,
			"conflicting_flight": conflicting,
			"gate_id":           flight.GateID,
		}
		if err := s.publisher.Publish(event.FlightGateConflict, flight.ID, payload); err != nil {
			slog.Error("failed to publish gate conflict event", "error", err)
		}
		slog.Warn("gate conflict detected",
			"flight", flight.FlightNumber,
			"conflicting_flight", conflicting.FlightNumber,
			"gate_id", flight.GateID,
		)
	}
}
