export interface Equipment {
  id: string
  equipment_type: EquipmentType
  registration: string
  terminal: string | null
  status: EquipmentStatus
  created_at: string
  updated_at: string
}

export type EquipmentType =
  | "gpu"
  | "pushback_tug"
  | "belt_loader"
  | "fuel_truck"
  | "lavatory_truck"
  | "water_truck"
  | "catering_truck"
  | "air_start_unit"
  | "de_icing_truck"

export type EquipmentStatus = "available" | "in_use" | "maintenance" | "out_of_service"

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  gpu: "Ground Power Unit",
  pushback_tug: "Pushback Tug",
  belt_loader: "Belt Loader",
  fuel_truck: "Fuel Truck",
  lavatory_truck: "Lavatory Truck",
  water_truck: "Water Truck",
  catering_truck: "Catering Truck",
  air_start_unit: "Air Start Unit",
  de_icing_truck: "De-icing Truck",
}
