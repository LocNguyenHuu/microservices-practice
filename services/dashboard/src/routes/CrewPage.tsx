import { useCrew, useAssignments } from "@/hooks/useCrew"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { CERT_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useState } from "react"

type AvailabilityFilter = "all" | "available" | "assigned" | "inactive"

export function CrewPage() {
  const { data: crew, isLoading } = useCrew(100)
  const { data: assignments } = useAssignments()
  const [filter, setFilter] = useState<AvailabilityFilter>("all")

  // Build a set of crew IDs with active assignments
  const assignedCrewIds = new Set(
    assignments
      ?.filter((a) => a.status === "assigned" || a.status === "active")
      .map((a) => a.crew_member_id) ?? [],
  )

  const filteredCrew = crew?.filter((c) => {
    if (filter === "all") return true
    if (filter === "inactive") return !c.is_active
    if (filter === "assigned") return c.is_active && assignedCrewIds.has(c.id)
    if (filter === "available") return c.is_active && !assignedCrewIds.has(c.id)
    return true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Crew Management</h1>

      <div className="flex gap-2">
        {(["all", "available", "assigned", "inactive"] as AvailabilityFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Certifications</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filteredCrew && filteredCrew.length > 0 ? (
                filteredCrew.map((c) => {
                  const isAssigned = assignedCrewIds.has(c.id)
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-3 font-mono text-sm text-foreground">{c.employee_id}</td>
                      <td className="px-4 py-3 text-foreground">{c.first_name} {c.last_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.certifications?.filter((cert) => cert.status === "active").map((cert) => (
                            <span
                              key={cert.id}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                                CERT_COLORS[cert.cert_type] || "bg-zinc-600",
                              )}
                            >
                              {cert.cert_type}
                            </span>
                          ))}
                          {(!c.certifications || c.certifications.length === 0) && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.is_active ? "active" : "inactive"} />
                      </td>
                      <td className="px-4 py-3">
                        {c.is_active ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            isAssigned ? "text-status-amber" : "text-status-green",
                          )}>
                            <span className={cn(
                              "h-2 w-2 rounded-full",
                              isAssigned ? "bg-status-amber" : "bg-status-green",
                            )} />
                            {isAssigned ? "Assigned" : "Available"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Off duty</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No crew members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
