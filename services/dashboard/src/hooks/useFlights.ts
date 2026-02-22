import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Flight } from "@/types/flight"

export function useFlights(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["flights", limit, offset],
    queryFn: () => api.get<Flight[]>(`/api/flights?limit=${limit}&offset=${offset}`),
    refetchInterval: 15_000,
  })
}

export function useUpcomingArrivals(within = "60m") {
  return useQuery({
    queryKey: ["flights", "upcoming", within],
    queryFn: () => api.get<Flight[]>(`/api/flights/arrivals/upcoming?within=${within}`),
    refetchInterval: 30_000,
  })
}
