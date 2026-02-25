export interface Flight {
  id: string
  flight_number: string
  airline_code: string
  aircraft_reg: string
  aircraft_type: string
  origin_iata: string
  destination_iata: string
  scheduled_arrival: string | null
  scheduled_departure: string | null
  actual_arrival: string | null
  actual_departure: string | null
  gate_id: string | null
  status: FlightStatus
  created_at: string
  updated_at: string
}

export type FlightStatus =
  | "scheduled"
  | "arrived"
  | "boarding"
  | "departed"
  | "cancelled"
  | "diverted"
