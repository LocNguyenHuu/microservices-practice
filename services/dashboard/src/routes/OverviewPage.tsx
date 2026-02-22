import { KpiCard } from "@/components/ui/KpiCard"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { useFlights, useUpcomingArrivals } from "@/hooks/useFlights"
import { useTurnarounds } from "@/hooks/useTurnarounds"
import { useCrew } from "@/hooks/useCrew"
import { useAlerts } from "@/hooks/useEvents"
import { useEvents } from "@/hooks/useEvents"
import { formatTime, timeAgo } from "@/lib/utils"
import { Plane, RefreshCw, AlertTriangle, Users, Bell } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const CHART_COLORS = ["#71717a", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]

export function OverviewPage() {
  const { data: flights } = useFlights(200)
  const { data: upcoming } = useUpcomingArrivals()
  const { data: turnarounds } = useTurnarounds(200)
  const { data: crew } = useCrew(200)
  const { data: alerts } = useAlerts("open")
  const { data: events } = useEvents(10)

  const activeFlights = flights?.filter((f) =>
    ["arrived", "boarding"].includes(f.status),
  ).length ?? 0

  const inProgressTurnarounds = turnarounds?.filter(
    (t) => t.status === "in_progress",
  ).length ?? 0

  const delayedCount = turnarounds?.filter(
    (t) => t.status === "delayed",
  ).length ?? 0

  const crewOnDuty = crew?.filter((c) => c.is_active).length ?? 0
  const openAlerts = alerts?.length ?? 0

  // Turnaround status breakdown for donut chart
  const statusCounts = ["pending", "in_progress", "completed", "delayed", "cancelled"].map(
    (status) => ({
      name: status.replace(/_/g, " "),
      value: turnarounds?.filter((t) => t.status === status).length ?? 0,
    }),
  ).filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Command Center</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Active Flights" value={activeFlights} icon={<Plane size={18} />} />
        <KpiCard title="In-Progress Turnarounds" value={inProgressTurnarounds} icon={<RefreshCw size={18} />} />
        <KpiCard title="Delayed" value={delayedCount} icon={<AlertTriangle size={18} />} />
        <KpiCard title="Crew On Duty" value={crewOnDuty} icon={<Users size={18} />} />
        <KpiCard title="Open Alerts" value={openAlerts} icon={<Bell size={18} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Turnaround Status Chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Turnaround Status</h2>
          {statusCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusCounts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {statusCounts.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#131320", border: "1px solid #27272a", borderRadius: "6px" }}
                  itemStyle={{ color: "#e4e4e7" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No turnarounds</p>
          )}
        </div>

        {/* Upcoming Arrivals */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Upcoming Arrivals</h2>
          <div className="space-y-2">
            {upcoming && upcoming.length > 0 ? (
              upcoming.slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-foreground">{f.flight_number}</span>
                    <span className="text-muted-foreground">{f.origin_iata}</span>
                  </div>
                  <span className="text-muted-foreground">{formatTime(f.scheduled_arrival)}</span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No upcoming arrivals</p>
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Events</h2>
          <div className="space-y-2">
            {events && events.length > 0 ? (
              events.slice(0, 8).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ev.event_type.split(".")[0]} />
                    <span className="text-muted-foreground">{ev.event_type}</span>
                  </div>
                  <span className="text-muted-foreground">{timeAgo(ev.received_at)}</span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No events yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
