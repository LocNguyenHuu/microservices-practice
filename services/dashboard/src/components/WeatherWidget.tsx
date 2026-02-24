import { useWeather } from "@/hooks/useWeather"
import { cn } from "@/lib/utils"
import {
  Thermometer,
  Wind,
  Eye,
  Snowflake,
  CloudRain,
  Sun,
  CloudFog,
  AlertTriangle,
} from "lucide-react"

const CONDITION_MAP: Record<string, { label: string; icon: typeof Sun }> = {
  SN: { label: "Snow", icon: Snowflake },
  FZRA: { label: "Freezing Rain", icon: Snowflake },
  FZFG: { label: "Freezing Fog", icon: CloudFog },
  IC: { label: "Ice Crystals", icon: Snowflake },
  PL: { label: "Ice Pellets", icon: Snowflake },
  GR: { label: "Hail", icon: Snowflake },
  RA: { label: "Rain", icon: CloudRain },
  BR: { label: "Mist", icon: CloudFog },
  HZ: { label: "Haze", icon: CloudFog },
  FG: { label: "Fog", icon: CloudFog },
}

function windDir(deg: number | null): string {
  if (deg === null) return "VRB"
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
  return dirs[Math.round(deg / 22.5) % 16]
}

export function WeatherWidget() {
  const { data: weather, isLoading, isError } = useWeather()

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Loading weather...</div>
      </div>
    )
  }

  if (isError || !weather) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Weather unavailable</div>
      </div>
    )
  }

  const hasIcing = weather.is_icing
  const hasLVP = weather.is_lvp

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        hasIcing ? "border-blue-500/50 bg-blue-950/20" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {weather.icao} METAR
          </span>
          {hasIcing && (
            <span className="flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <Snowflake size={10} /> ICING
            </span>
          )}
          {hasLVP && (
            <span className="flex items-center gap-1 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <AlertTriangle size={10} /> LVP
            </span>
          )}
        </div>
        {weather.conditions.length === 0 && (
          <Sun size={16} className="text-yellow-500" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Temperature */}
        <div className="flex items-center gap-2">
          <Thermometer size={14} className="text-muted-foreground" />
          <div>
            <div className="text-lg font-bold text-foreground">
              {weather.temperature_c != null ? `${weather.temperature_c}°C` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">Temperature</div>
          </div>
        </div>

        {/* Wind */}
        <div className="flex items-center gap-2">
          <Wind size={14} className="text-muted-foreground" />
          <div>
            <div className="text-lg font-bold text-foreground">
              {weather.wind_speed_kt != null
                ? `${weather.wind_speed_kt}kt`
                : "—"}
              {weather.wind_gust_kt != null && (
                <span className="text-xs text-status-amber">
                  G{weather.wind_gust_kt}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {windDir(weather.wind_direction)} Wind
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          <div>
            <div
              className={cn(
                "text-lg font-bold",
                hasLVP ? "text-status-amber" : "text-foreground",
              )}
            >
              {weather.visibility_m != null
                ? weather.visibility_m >= 9999
                  ? "10km+"
                  : `${(weather.visibility_m / 1000).toFixed(1)}km`
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">Visibility</div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      {weather.conditions.length > 0 && (
        <div className="mt-2 flex gap-1">
          {weather.conditions.map((c) => {
            const info = CONDITION_MAP[c]
            const Icon = info?.icon || CloudRain
            return (
              <span
                key={c}
                className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-foreground"
              >
                <Icon size={10} />
                {info?.label || c}
              </span>
            )
          })}
        </div>
      )}

      {/* Raw METAR */}
      <div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
        {weather.raw_metar}
      </div>
    </div>
  )
}
