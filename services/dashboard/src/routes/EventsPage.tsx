import { useState } from "react"
import { useEvents, useAlerts } from "@/hooks/useEvents"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { formatDateTime, timeAgo } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import type { Alert } from "@/types/event"

type Tab = "events" | "alerts"

export function EventsPage() {
  const [tab, setTab] = useState<Tab>("events")

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Events & Alerts</h1>

      <div className="flex gap-2">
        {(["events", "alerts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {t === "events" ? "Event Log" : "Alerts"}
          </button>
        ))}
      </div>

      {tab === "events" ? <EventLogTab /> : <AlertsTab />}
    </div>
  )
}

function EventLogTab() {
  const { data: events, isLoading } = useEvents(100)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : events && events.length > 0 ? (
              events.map((ev) => (
                <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground">{ev.event_type}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ev.source_service}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(ev.received_at)}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No events</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AlertsTab() {
  const { data: alerts, isLoading, refetch } = useAlerts()
  const { role } = useAuth()
  const canResolve = role === "admin" || role === "ops_manager"

  const handleResolve = async (alert: Alert) => {
    try {
      await api.patch(`/api/alerts/${alert.id}`, {
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      refetch()
    } catch (e) {
      console.error("Failed to resolve alert:", e)
    }
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">Loading...</p>
      ) : alerts && alerts.length > 0 ? (
        alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={alert.severity} />
                <StatusBadge status={alert.status} />
                <span className="text-xs text-muted-foreground">{alert.alert_type.replace(/_/g, " ")}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{alert.title}</p>
              {alert.description && (
                <p className="text-xs text-muted-foreground">{alert.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</p>
            </div>
            {canResolve && alert.status === "open" && (
              <button
                onClick={() => handleResolve(alert)}
                className="rounded-md bg-status-green/20 px-2 py-1 text-xs font-medium text-status-green hover:bg-status-green/30"
              >
                Resolve
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="py-8 text-center text-muted-foreground">No alerts</p>
      )}
    </div>
  )
}
