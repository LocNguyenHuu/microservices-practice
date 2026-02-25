import { useTurnarounds } from "@/hooks/useTurnarounds"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { cn } from "@/lib/utils"
import { useState } from "react"
import type { TurnaroundStatus } from "@/types/turnaround"

const STATUS_FILTERS: (TurnaroundStatus | "all")[] = [
  "all", "pending", "in_progress", "completed", "delayed", "cancelled",
]

const TASK_BAR_COLORS: Record<string, string> = {
  pending: "bg-status-gray",
  in_progress: "bg-status-blue",
  completed: "bg-status-green",
  blocked: "bg-status-red",
  skipped: "bg-zinc-700",
}

export function TurnaroundsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const status = statusFilter === "all" ? undefined : statusFilter
  const { data: turnarounds, isLoading } = useTurnarounds(100, 0, status)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Turnarounds</h1>

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
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : turnarounds && turnarounds.length > 0 ? (
          turnarounds.map((t) => (
            <div
              key={t._id}
              className="rounded-lg border border-border bg-card"
            >
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === t._id ? null : t._id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-medium text-foreground">{t.flightNumber}</span>
                  <span className="text-xs text-muted-foreground">{t.aircraftType}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${t.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.progressPercent}%</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.tasks.length} tasks
                  </span>
                </div>
              </button>

              {/* Expanded Task Timeline */}
              {expanded === t._id && (
                <div className="border-t border-border px-4 py-3">
                  <div className="space-y-2">
                    {t.tasks
                      .sort((a, b) => a.order - b.order)
                      .map((task) => (
                        <div key={task._id} className="flex items-center gap-3">
                          <span className="w-28 text-xs text-muted-foreground truncate">{task.name}</span>
                          <div className="flex-1">
                            <div className="h-5 overflow-hidden rounded bg-secondary">
                              <div
                                className={cn(
                                  "flex h-full items-center px-2 text-[10px] font-medium text-white transition-all",
                                  TASK_BAR_COLORS[task.status] || "bg-status-gray",
                                )}
                                style={{
                                  width: task.status === "completed" ? "100%" :
                                         task.status === "in_progress" ? "60%" :
                                         task.status === "pending" ? "0%" : "30%",
                                  minWidth: task.status !== "pending" ? "40px" : "0",
                                }}
                              >
                                {task.status !== "pending" && task.status}
                              </div>
                            </div>
                          </div>
                          <span className="w-8 text-right text-xs text-muted-foreground">
                            {task.estimatedDurationMinutes}m
                          </span>
                          {task.requiredCertification && (
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                              {task.requiredCertification}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">No turnarounds found</p>
        )}
      </div>
    </div>
  )
}
