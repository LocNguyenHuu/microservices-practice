import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Turnaround } from "@/types/turnaround"

export function useTurnarounds(limit = 50, offset = 0, status?: string) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) params.set("status", status)

  return useQuery({
    queryKey: ["turnarounds", limit, offset, status],
    queryFn: () => api.get<Turnaround[]>(`/api/turnarounds?${params}`),
    refetchInterval: 15_000,
  })
}
