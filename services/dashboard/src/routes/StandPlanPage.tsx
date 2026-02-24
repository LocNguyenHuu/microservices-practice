import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useMemo } from "react"

interface GateOccupancy {
  gate_id: string
  gate_number: string
  terminal: string
  flight_id: string
  flight_number: string
  aircraft_type: string
  status: string
  start_time: string
  end_time: string | null
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  arrived: "#22c55e",
  boarding: "#f59e0b",
  in_progress: "#3b82f6",
  departed: "#71717a",
}

const CONFLICT_COLOR = "#ef4444"

export function StandPlanPage() {
  // Get today's 24h window in UTC
  const { from, to } = useMemo(() => {
    const now = new Date()
    const f = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const t = new Date(f.getTime() + 24 * 60 * 60 * 1000)
    return { from: f.toISOString(), to: t.toISOString() }
  }, [])

  const { data: occupancy, isLoading } = useQuery({
    queryKey: ["gate-occupancy", from, to],
    queryFn: () => api.get<GateOccupancy[]>(`/api/gates/occupancy?from=${from}&to=${to}`),
    refetchInterval: 30_000,
  })

  // Group occupancy by gate
  const gates = useMemo(() => {
    if (!occupancy) return []

    const gateMap = new Map<string, { gate_number: string; terminal: string; flights: GateOccupancy[] }>()

    for (const occ of occupancy) {
      const key = occ.gate_id
      if (!gateMap.has(key)) {
        gateMap.set(key, { gate_number: occ.gate_number, terminal: occ.terminal, flights: [] })
      }
      gateMap.get(key)!.flights.push(occ)
    }

    return Array.from(gateMap.values()).sort((a, b) =>
      `${a.terminal}-${a.gate_number}`.localeCompare(`${b.terminal}-${b.gate_number}`),
    )
  }, [occupancy])

  // Detect conflicts: two flights on the same gate with overlapping times
  const conflictFlightIds = useMemo(() => {
    const ids = new Set<string>()
    for (const gate of gates) {
      for (let i = 0; i < gate.flights.length; i++) {
        for (let j = i + 1; j < gate.flights.length; j++) {
          const a = gate.flights[i]
          const b = gate.flights[j]
          const aStart = new Date(a.start_time).getTime()
          const aEnd = a.end_time ? new Date(a.end_time).getTime() : aStart + 3 * 60 * 60 * 1000
          const bStart = new Date(b.start_time).getTime()
          const bEnd = b.end_time ? new Date(b.end_time).getTime() : bStart + 3 * 60 * 60 * 1000
          if (aStart < bEnd && bStart < aEnd) {
            ids.add(a.flight_id)
            ids.add(b.flight_id)
          }
        }
      }
    }
    return ids
  }, [gates])

  const dayStart = new Date(from).getTime()
  const dayEnd = new Date(to).getTime()
  const dayDuration = dayEnd - dayStart

  // Current time marker
  const nowOffset = ((Date.now() - dayStart) / dayDuration) * 100

  // Generate hour labels
  const hours = Array.from({ length: 25 }, (_, i) => i)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Stand Planning Board</h1>
        {conflictFlightIds.size > 0 && (
          <span className="rounded-md bg-status-red/20 px-2 py-1 text-xs font-medium text-status-red">
            {conflictFlightIds.size / 2} conflict{conflictFlightIds.size > 2 ? "s" : ""} detected
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading stand plan...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          {/* Time axis header */}
          <div className="flex border-b border-border">
            <div className="w-20 shrink-0 border-r border-border px-2 py-2 text-xs font-medium text-muted-foreground">
              Gate
            </div>
            <div className="relative flex-1" style={{ minWidth: 1200 }}>
              <div className="flex">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-r border-border/50 py-2 text-center text-[10px] text-muted-foreground"
                    style={{ width: `${100 / 24}%` }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gate rows */}
          {gates.length > 0 ? (
            gates.map((gate) => (
              <div key={`${gate.terminal}-${gate.gate_number}`} className="flex border-b border-border last:border-0">
                <div className="flex w-20 shrink-0 items-center border-r border-border px-2 py-3">
                  <span className="text-xs font-mono font-medium text-foreground">{gate.gate_number}</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">{gate.terminal}</span>
                </div>
                <div className="relative flex-1" style={{ minWidth: 1200, height: 40 }}>
                  {/* Hour grid lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 h-full border-r border-border/20"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}

                  {/* Flight blocks */}
                  {gate.flights.map((flight) => {
                    const start = new Date(flight.start_time).getTime()
                    const end = flight.end_time
                      ? new Date(flight.end_time).getTime()
                      : start + 3 * 60 * 60 * 1000
                    const left = Math.max(0, ((start - dayStart) / dayDuration) * 100)
                    const width = Math.min(100 - left, ((end - start) / dayDuration) * 100)
                    const isConflict = conflictFlightIds.has(flight.flight_id)
                    const color = isConflict ? CONFLICT_COLOR : (STATUS_COLORS[flight.status] || "#71717a")

                    return (
                      <div
                        key={flight.flight_id}
                        className="absolute top-1 flex items-center rounded px-1.5 text-[10px] font-medium text-white shadow-sm"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1)}%`,
                          height: 30,
                          backgroundColor: color,
                          opacity: flight.status === "departed" ? 0.5 : 1,
                          border: isConflict ? "2px dashed #fbbf24" : "none",
                        }}
                        title={`${flight.flight_number} (${flight.aircraft_type}) — ${flight.status}`}
                      >
                        <span className="truncate">
                          {flight.flight_number}
                        </span>
                      </div>
                    )
                  })}

                  {/* Current time marker */}
                  {nowOffset >= 0 && nowOffset <= 100 && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-status-red/70"
                      style={{ left: `${nowOffset}%` }}
                    />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No gate occupancy data for today
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.scheduled }} />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.arrived }} />
          <span>Arrived</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.boarding }} />
          <span>Boarding</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.departed }} />
          <span>Departed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border border-dashed border-yellow-400" style={{ backgroundColor: CONFLICT_COLOR }} />
          <span>Conflict</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-0.5 bg-status-red/70" />
          <span>Current time</span>
        </div>
      </div>
    </div>
  )
}
