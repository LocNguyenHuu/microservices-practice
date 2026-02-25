import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Equipment } from "@/types/equipment"

export function useEquipment(limit = 100) {
  return useQuery({
    queryKey: ["equipment", limit],
    queryFn: () => api.get<Equipment[]>(`/api/equipment?limit=${limit}`),
    refetchInterval: 15_000,
  })
}

export function useAvailableEquipment(type?: string) {
  return useQuery({
    queryKey: ["equipment", "available", type],
    queryFn: () =>
      api.get<Equipment[]>(
        `/api/equipment/available${type ? `?equipment_type=${type}` : ""}`,
      ),
    refetchInterval: 15_000,
  })
}
