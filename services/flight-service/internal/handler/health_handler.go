package handler

import "net/http"

// HealthCheck handles GET /health — returns service status for Docker health checks
// and load balancer probes.
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "flight-service"})
}
