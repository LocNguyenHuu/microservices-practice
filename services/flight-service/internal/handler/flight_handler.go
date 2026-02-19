// Package handler provides HTTP request handlers for the Flight Service REST API.
// It translates HTTP requests into service calls and formats responses.
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stephen/flight-service/internal/model"
	"github.com/stephen/flight-service/internal/service"
)

// FlightHandler handles HTTP requests for flight operations.
type FlightHandler struct {
	svc *service.FlightService
}

// NewFlightHandler creates a new handler backed by the given service.
func NewFlightHandler(svc *service.FlightService) *FlightHandler {
	return &FlightHandler{svc: svc}
}

// Routes returns a chi.Router with all flight endpoint routes mounted.
func (h *FlightHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.CreateFlight)
	r.Get("/", h.ListFlights)
	r.Get("/arrivals/upcoming", h.ListUpcomingArrivals)
	r.Get("/{id}", h.GetFlight)
	r.Patch("/{id}", h.UpdateFlight)
	return r
}

// CreateFlight handles POST /api/flights — schedules a new flight.
func (h *FlightHandler) CreateFlight(w http.ResponseWriter, r *http.Request) {
	var req model.CreateFlightRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	flight, err := h.svc.CreateFlight(r.Context(), req)
	if err != nil {
		slog.Error("create flight failed", "error", err)
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, flight)
}

// GetFlight handles GET /api/flights/{id} — retrieves a single flight.
func (h *FlightHandler) GetFlight(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid flight id")
		return
	}

	flight, err := h.svc.GetFlight(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "flight not found")
		return
	}

	writeJSON(w, http.StatusOK, flight)
}

// ListFlights handles GET /api/flights — lists flights with pagination.
// Query params: ?limit=50&offset=0
func (h *FlightHandler) ListFlights(w http.ResponseWriter, r *http.Request) {
	params := model.ListParams{
		Limit:  parseIntParam(r, "limit", 50),
		Offset: parseIntParam(r, "offset", 0),
	}

	flights, err := h.svc.ListFlights(r.Context(), params)
	if err != nil {
		slog.Error("list flights failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list flights")
		return
	}

	writeJSON(w, http.StatusOK, flights)
}

// ListUpcomingArrivals handles GET /api/flights/arrivals/upcoming — lists flights
// arriving within a time window. Query param: ?within=60m (default: 60m)
func (h *FlightHandler) ListUpcomingArrivals(w http.ResponseWriter, r *http.Request) {
	withinStr := r.URL.Query().Get("within")
	within := 60 * time.Minute // default 60 minutes
	if withinStr != "" {
		parsed, err := time.ParseDuration(withinStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid 'within' duration (e.g. 60m, 2h)")
			return
		}
		within = parsed
	}

	flights, err := h.svc.ListUpcomingArrivals(r.Context(), within)
	if err != nil {
		slog.Error("list upcoming arrivals failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list upcoming arrivals")
		return
	}

	writeJSON(w, http.StatusOK, flights)
}

// UpdateFlight handles PATCH /api/flights/{id} — partially updates a flight.
// Used to record arrivals, departures, gate changes, and status transitions.
func (h *FlightHandler) UpdateFlight(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid flight id")
		return
	}

	var req model.UpdateFlightRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	flight, err := h.svc.UpdateFlight(r.Context(), id, req)
	if err != nil {
		slog.Error("update flight failed", "flight_id", id, "error", err)
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, flight)
}

// parseIntParam reads an integer query parameter with a default fallback.
func parseIntParam(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 0 {
		return defaultVal
	}
	return v
}

// writeJSON serializes data as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
