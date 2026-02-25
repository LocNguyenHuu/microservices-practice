// Package event provides the event publishing abstraction for the Flight Service.
// In Phase 1, a StubPublisher logs events to stdout. In Phase 2, a RabbitMQPublisher
// sends events to the flight.events topic exchange.
package event

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// EventType identifies the kind of domain event being published.
type EventType string

const (
	FlightArrived      EventType = "flight.arrived"       // Aircraft has landed and reached gate
	FlightDeparted     EventType = "flight.departed"       // Aircraft has left the gate
	FlightBoarding     EventType = "flight.boarding"       // Passengers are boarding
	FlightGateChanged  EventType = "flight.gate.changed"   // Gate reassignment occurred
	FlightDelayed      EventType = "flight.delayed"        // Schedule has been updated with delay
	FlightGateConflict EventType = "flight.gate.conflict"  // Two flights overlap on the same gate
)

// FlightEvent is the envelope for all flight-related domain events
// published to the message broker.
type FlightEvent struct {
	ID            string    `json:"id"`            // Unique event ID
	Type          EventType `json:"type"`          // Event type (routing key)
	FlightID      string    `json:"flight_id"`     // ID of the flight that triggered this event
	CorrelationID string    `json:"correlationId"` // Correlation ID for end-to-end tracing
	Timestamp     time.Time `json:"timestamp"`     // When the event was created
	Data          any       `json:"data"`          // Event-specific payload
}

// Publisher defines the interface for publishing flight domain events.
// Implementations must be safe for concurrent use.
type Publisher interface {
	Publish(eventType EventType, flightID uuid.UUID, data any) error
	Close() error
}

// StubPublisher logs events to stdout using structured logging.
// Used during Phase 1 before RabbitMQ is integrated.
type StubPublisher struct{}

// NewStubPublisher creates a new stub publisher for local development.
func NewStubPublisher() *StubPublisher {
	return &StubPublisher{}
}

// Publish logs the event as structured JSON. In Phase 2, this will be replaced
// by RabbitMQPublisher which sends to the flight.events topic exchange.
func (p *StubPublisher) Publish(eventType EventType, flightID uuid.UUID, data any) error {
	evt := FlightEvent{
		ID:            uuid.New().String(),
		Type:          eventType,
		FlightID:      flightID.String(),
		CorrelationID: uuid.New().String(),
		Timestamp:     time.Now().UTC(),
		Data:          data,
	}

	payload, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	slog.Info("event published (stub)",
		"type", string(eventType),
		"flight_id", flightID.String(),
		"payload", string(payload),
	)
	return nil
}

// Close is a no-op for the stub publisher.
func (p *StubPublisher) Close() error {
	return nil
}
