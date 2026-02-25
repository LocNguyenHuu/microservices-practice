package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stephen/flight-service/internal/repository"
)

// GateHandler handles HTTP requests for gate operations.
type GateHandler struct {
	gateRepo *repository.GateRepository
}

// NewGateHandler creates a new handler backed by the given repository.
func NewGateHandler(gateRepo *repository.GateRepository) *GateHandler {
	return &GateHandler{gateRepo: gateRepo}
}

// Routes returns a chi.Router with all gate endpoint routes mounted.
func (h *GateHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListGates)
	r.Get("/occupancy", h.GetGateOccupancy)
	return r
}

// ListGates handles GET /api/gates — lists all active gates.
func (h *GateHandler) ListGates(w http.ResponseWriter, r *http.Request) {
	gates, err := h.gateRepo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list gates")
		return
	}
	writeJSON(w, http.StatusOK, gates)
}

// GetGateOccupancy handles GET /api/gates/occupancy — returns gate-time blocks
// for the stand planning board Gantt chart.
// Query params: ?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z
func (h *GateHandler) GetGateOccupancy(w http.ResponseWriter, r *http.Request) {
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	// Default: today's 24-hour window
	now := time.Now().UTC()
	from := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	to := from.Add(24 * time.Hour)

	if fromStr != "" {
		parsed, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid 'from' timestamp (RFC3339)")
			return
		}
		from = parsed
	}
	if toStr != "" {
		parsed, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid 'to' timestamp (RFC3339)")
			return
		}
		to = parsed
	}

	occupancy, err := h.gateRepo.GetGateOccupancy(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get gate occupancy")
		return
	}

	writeJSON(w, http.StatusOK, occupancy)
}
