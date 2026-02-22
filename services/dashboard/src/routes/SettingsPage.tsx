import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import type { User } from "@/types/auth"
import { StatusBadge } from "@/components/ui/StatusBadge"

interface IngestConfig {
  target_airport: string
  poll_interval_minutes: number
  api_key_configured: boolean
  flight_service_url: string
}

interface IngestStatus {
  is_running: boolean
  last_run_at: string | null
  last_run_flights_ingested: number
  last_run_flights_skipped: number
  last_run_errors: string[]
  total_runs: number
  scheduler_active: boolean
}

interface ServiceHealth {
  name: string
  url: string
  healthy: boolean | null
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <IngestConfigPanel />
        <SystemHealthPanel />
        <UserManagementPanel />
      </div>
    </div>
  )
}

function IngestConfigPanel() {
  const [config, setConfig] = useState<IngestConfig | null>(null)
  const [status, setStatus] = useState<IngestStatus | null>(null)
  const [airport, setAirport] = useState("")

  useEffect(() => {
    api.get<IngestConfig>("/api/ingest/config").then((c) => {
      setConfig(c)
      setAirport(c.target_airport)
    }).catch(() => {})
    api.get<IngestStatus>("/api/ingest/status").then(setStatus).catch(() => {})
  }, [])

  const handleUpdate = async () => {
    try {
      const updated = await api.patch<IngestConfig>("/api/ingest/config", {
        target_airport: airport,
      })
      setConfig(updated)
    } catch (e) {
      console.error("Failed to update config:", e)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">Data Ingestion</h2>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">API Key</span>
          <StatusBadge status={config?.api_key_configured ? "active" : "warning"} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Scheduler</span>
          <StatusBadge status={status?.scheduler_active ? "active" : "inactive"} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Runs</span>
          <span className="text-foreground">{status?.total_runs ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last Ingested</span>
          <span className="text-foreground">{status?.last_run_flights_ingested ?? 0} flights</span>
        </div>

        <div className="border-t border-border pt-3">
          <label className="mb-1 block text-xs text-muted-foreground">Target Airport</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={airport}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            />
            <button
              onClick={handleUpdate}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SystemHealthPanel() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: "Flight Service", url: "/api/flights?limit=1", healthy: null },
    { name: "Turnaround Service", url: "/api/turnarounds?limit=1", healthy: null },
    { name: "Crew Service", url: "/api/crew?limit=1", healthy: null },
    { name: "Ops Hub Service", url: "/api/alerts?limit=1", healthy: null },
  ])

  useEffect(() => {
    services.forEach((svc, i) => {
      api.get(svc.url)
        .then(() => {
          setServices((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], healthy: true }
            return next
          })
        })
        .catch(() => {
          setServices((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], healthy: false }
            return next
          })
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">System Health</h2>
      <div className="space-y-2">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{svc.name}</span>
            <span className={`flex items-center gap-1.5 text-xs ${
              svc.healthy === null ? "text-muted-foreground" :
              svc.healthy ? "text-status-green" : "text-status-red"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                svc.healthy === null ? "bg-muted-foreground" :
                svc.healthy ? "bg-status-green" : "bg-status-red"
              }`} />
              {svc.healthy === null ? "Checking..." : svc.healthy ? "Healthy" : "Down"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UserManagementPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<User[]>("/api/users")
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
      <h2 className="mb-3 text-sm font-medium text-foreground">User Management</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : users.length > 0 ? (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{u.username}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email || "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={u.role} className="bg-secondary text-secondary-foreground" /></td>
                  <td className="px-3 py-2"><StatusBadge status={u.is_active ? "active" : "inactive"} /></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
