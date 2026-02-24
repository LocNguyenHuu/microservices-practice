import { useEquipment } from "@/hooks/useEquipment"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EQUIPMENT_TYPE_LABELS } from "@/types/equipment"
import type { EquipmentStatus, EquipmentType } from "@/types/equipment"
import { cn } from "@/lib/utils"
import { useState } from "react"

type StatusFilter = "all" | EquipmentStatus

const EQUIPMENT_ICONS: Record<EquipmentType, string> = {
  gpu: "Zap",
  pushback_tug: "ArrowLeft",
  belt_loader: "Package",
  fuel_truck: "Fuel",
  lavatory_truck: "Droplets",
  water_truck: "Droplets",
  catering_truck: "UtensilsCrossed",
  air_start_unit: "Wind",
  de_icing_truck: "Snowflake",
}

const TYPE_COLORS: Record<string, string> = {
  gpu: "bg-yellow-600",
  pushback_tug: "bg-indigo-600",
  belt_loader: "bg-amber-700",
  fuel_truck: "bg-orange-600",
  lavatory_truck: "bg-cyan-600",
  water_truck: "bg-sky-600",
  catering_truck: "bg-pink-600",
  air_start_unit: "bg-purple-600",
  de_icing_truck: "bg-blue-600",
}

export function EquipmentPage() {
  const { data: equipment, isLoading } = useEquipment()
  const [filter, setFilter] = useState<StatusFilter>("all")

  const filtered = equipment?.filter((e) => {
    if (filter === "all") return true
    return e.status === filter
  })

  // Summary counts
  const counts = {
    total: equipment?.length ?? 0,
    available: equipment?.filter((e) => e.status === "available").length ?? 0,
    in_use: equipment?.filter((e) => e.status === "in_use").length ?? 0,
    maintenance: equipment?.filter((e) => e.status === "maintenance").length ?? 0,
  }

  // Group by type for overview
  const typeGroups = equipment?.reduce(
    (acc, e) => {
      if (!acc[e.equipment_type]) {
        acc[e.equipment_type] = { total: 0, available: 0, in_use: 0 }
      }
      acc[e.equipment_type].total++
      if (e.status === "available") acc[e.equipment_type].available++
      if (e.status === "in_use") acc[e.equipment_type].in_use++
      return acc
    },
    {} as Record<string, { total: number; available: number; in_use: number }>,
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Ground Support Equipment</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Available", value: counts.available, color: "text-status-green" },
          { label: "In Use", value: counts.in_use, color: "text-status-blue" },
          { label: "Maintenance", value: counts.maintenance, color: "text-status-amber" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Type overview grid */}
      {typeGroups && Object.keys(typeGroups).length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {Object.entries(typeGroups).map(([type, group]) => (
            <div
              key={type}
              className="rounded-lg border border-border bg-card p-2 text-center"
            >
              <span
                className={cn(
                  "mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                  TYPE_COLORS[type] || "bg-zinc-600",
                )}
              >
                {type.replace(/_/g, " ")}
              </span>
              <div className="text-xs text-muted-foreground">
                <span className="text-status-green">{group.available}</span>
                {" / "}
                <span className="text-foreground">{group.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex gap-2">
        {(["all", "available", "in_use", "maintenance", "out_of_service"] as StatusFilter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {f === "all"
                ? "All"
                : f
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ),
        )}
      </div>

      {/* Equipment table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Terminal</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : filtered && filtered.length > 0 ? (
                filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-foreground">
                      {e.registration}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                          TYPE_COLORS[e.equipment_type] || "bg-zinc-600",
                        )}
                      >
                        {EQUIPMENT_TYPE_LABELS[e.equipment_type] || e.equipment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {e.terminal || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No equipment found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
