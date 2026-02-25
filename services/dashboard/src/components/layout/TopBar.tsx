import { useAuth } from "@/contexts/AuthContext"
import { useSSE } from "@/contexts/SSEContext"
import { useAlerts } from "@/hooks/useEvents"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { Bell, LogOut, Plane, Radio } from "lucide-react"
import { useState, useEffect } from "react"

export function TopBar() {
  const { user, logout } = useAuth()
  const { connected } = useSSE()
  const { data: alerts } = useAlerts("open")
  const [utcTime, setUtcTime] = useState(getUTC())

  useEffect(() => {
    const interval = setInterval(() => setUtcTime(getUTC()), 1000)
    return () => clearInterval(interval)
  }, [])

  const openAlertCount = alerts?.length ?? 0

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <Plane size={20} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">SkyTurn DXB</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <Radio size={14} className={connected ? "text-status-green" : "text-status-red"} />
          <span className="text-xs text-muted-foreground">{connected ? "LIVE" : "OFFLINE"}</span>
        </div>

        <span className="font-mono text-sm text-muted-foreground">
          UTC {utcTime}
        </span>

        {user && (
          <StatusBadge status={user.role} className="bg-secondary text-secondary-foreground" />
        )}

        <button className="relative rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Bell size={18} />
          {openAlertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-red text-[10px] font-bold text-white">
              {openAlertCount > 9 ? "9+" : openAlertCount}
            </span>
          )}
        </button>

        <button
          onClick={logout}
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

function getUTC(): string {
  return new Date().toISOString().slice(11, 19)
}
