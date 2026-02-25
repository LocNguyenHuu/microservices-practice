import { cn } from "@/lib/utils"
import { getStatusColor } from "@/lib/constants"

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        getStatusColor(status),
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  )
}
