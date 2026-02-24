import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface WeatherData {
  icao: string
  raw_metar: string
  temperature_c: number | null
  dewpoint_c: number | null
  wind_speed_kt: number | null
  wind_direction: number | null
  wind_gust_kt: number | null
  visibility_m: number | null
  pressure_hpa: number | null
  conditions: string[]
  is_icing: boolean
  is_lvp: boolean
  ceiling_ft: number | null
  updated_at: string | null
}

export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: () => api.get<WeatherData>("/api/weather/current"),
    refetchInterval: 60_000,
    retry: false,
  })
}
