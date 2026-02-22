import { useState } from "react"
import { useFlights } from "@/hooks/useFlights"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { formatTime } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { FlightStatus } from "@/types/flight"

const STATUS_FILTERS: (FlightStatus | "all")[] = [
  "all", "scheduled", "arrived", "boarding", "departed", "cancelled", "diverted",
]

export function FlightsPage() {
  const { data: flights, isLoading, refetch } = useFlights(100)
  const { role } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [ingesting, setIngesting] = useState(false)

  const canEdit = role === "admin" || role === "ops_manager"

  const filtered = flights?.filter(
    (f) => statusFilter === "all" || f.status === statusFilter,
  )

  const handleIngest = async () => {
    setIngesting(true)
    try {
      await api.post("/api/ingest/trigger")
      setTimeout(() => refetch(), 2000)
    } catch (e) {
      console.error("Ingestion failed:", e)
    } finally {
      setIngesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Flights</h1>
        {canEdit && (
          <button
            onClick={handleIngest}
            disabled={ingesting}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {ingesting ? "Ingesting..." : "Ingest Now"}
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Flights Table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Flight</th>
                <th className="px-4 py-3 font-medium">Airline</th>
                <th className="px-4 py-3 font-medium">Aircraft</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Sched. Arrival</th>
                <th className="px-4 py-3 font-medium">Actual Arrival</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered && filtered.length > 0 ? (
                filtered.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{f.flight_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.airline_code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.aircraft_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.origin_iata} → {f.destination_iata}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{formatTime(f.scheduled_arrival)}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{formatTime(f.actual_arrival)}</td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No flights found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
