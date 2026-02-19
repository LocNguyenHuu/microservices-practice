// Package model defines the domain entities and request/response types
// for the Flight Service in the SkyTurn airport turnaround operations platform.
package model

import (
	"time"

	"github.com/google/uuid"
)

// FlightStatus represents the operational state of a flight.
type FlightStatus string

const (
	StatusScheduled FlightStatus = "scheduled" // Flight is planned but has not arrived
	StatusArrived   FlightStatus = "arrived"   // Aircraft has touched down and is at gate
	StatusBoarding  FlightStatus = "boarding"   // Passengers are boarding for departure
	StatusDeparted  FlightStatus = "departed"   // Aircraft has left the gate
	StatusCancelled FlightStatus = "cancelled"  // Flight has been cancelled
	StatusDiverted  FlightStatus = "diverted"   // Flight diverted to another airport
)

// Valid returns true if the status is a recognized flight status value.
func (s FlightStatus) Valid() bool {
	switch s {
	case StatusScheduled, StatusArrived, StatusBoarding, StatusDeparted, StatusCancelled, StatusDiverted:
		return true
	}
	return false
}

// Flight represents a scheduled or active flight operation at the airport.
// It tracks both the planned schedule and actual arrival/departure times.
type Flight struct {
	ID                 uuid.UUID    `json:"id" db:"id"`
	FlightNumber       string       `json:"flight_number" db:"flight_number"`               // IATA flight number, e.g. "EK302"
	AirlineCode        string       `json:"airline_code" db:"airline_code"`                  // IATA airline code, e.g. "EK"
	AircraftReg        string       `json:"aircraft_reg" db:"aircraft_reg"`                  // Aircraft tail number, e.g. "A6-EAX"
	AircraftType       string       `json:"aircraft_type" db:"aircraft_type"`                // Aircraft model, e.g. "A380"
	OriginIATA         string       `json:"origin_iata" db:"origin_iata"`                    // Departure airport IATA code
	DestinationIATA    string       `json:"destination_iata" db:"destination_iata"`           // Arrival airport IATA code
	ScheduledArrival   *time.Time   `json:"scheduled_arrival" db:"scheduled_arrival"`         // Planned arrival time
	ScheduledDeparture *time.Time   `json:"scheduled_departure" db:"scheduled_departure"`     // Planned departure time
	ActualArrival      *time.Time   `json:"actual_arrival" db:"actual_arrival"`               // Actual touchdown time
	ActualDeparture    *time.Time   `json:"actual_departure" db:"actual_departure"`           // Actual off-block time
	GateID             *uuid.UUID   `json:"gate_id" db:"gate_id"`                            // Assigned gate (FK to gates table)
	Status             FlightStatus `json:"status" db:"status"`                              // Current operational status
	CreatedAt          time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at" db:"updated_at"`
}

// CreateFlightRequest contains the fields required to schedule a new flight.
type CreateFlightRequest struct {
	FlightNumber       string     `json:"flight_number"`
	AirlineCode        string     `json:"airline_code"`
	AircraftReg        string     `json:"aircraft_reg"`
	AircraftType       string     `json:"aircraft_type"`
	OriginIATA         string     `json:"origin_iata"`
	DestinationIATA    string     `json:"destination_iata"`
	ScheduledArrival   *time.Time `json:"scheduled_arrival"`
	ScheduledDeparture *time.Time `json:"scheduled_departure"`
	GateID             *uuid.UUID `json:"gate_id"`
}

// UpdateFlightRequest contains the mutable fields of a flight.
// Only non-nil fields are applied during update.
type UpdateFlightRequest struct {
	Status          *FlightStatus `json:"status,omitempty"`
	ActualArrival   *time.Time    `json:"actual_arrival,omitempty"`
	ActualDeparture *time.Time    `json:"actual_departure,omitempty"`
	GateID          *uuid.UUID    `json:"gate_id,omitempty"`
}

// ListParams holds pagination parameters for listing flights.
type ListParams struct {
	Limit  int // Maximum number of results (default: 50)
	Offset int // Number of results to skip
}
