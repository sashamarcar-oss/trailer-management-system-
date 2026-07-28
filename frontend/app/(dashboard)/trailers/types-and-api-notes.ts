/**
 * Trailer module types — mirrors the Django backend (apps/trailers).
 * ──────────────────────────────────────────────────────────────────
 * The backend serializer returns/accepts snake_case fields, so we keep
 * snake_case throughout this module rather than mapping to camelCase.
 * The list endpoint (GET /api/trailers/) uses a *lightweight* serializer
 * (subset of fields); the detail endpoint returns the full object incl.
 * images/documents/maintenance_records. See trailer-api.ts.
 *
 *   GET    /api/trailers/            → Paginated<Trailer> (list serializer)
 *   POST   /api/trailers/            → Trailer
 *   GET    /api/trailers/{id}/       → Trailer (full)
 *   PATCH  /api/trailers/{id}/       → Trailer
 *   DELETE /api/trailers/{id}/       → 204
 *
 * trailer_type / status accept either the code ("flatbed") or the display
 * label ("Flatbed") — the serializer normalizes. We always send the code.
 */

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface TrailerImage {
  id: number
  image: string
  caption: string
  uploaded_at: string
}

export interface TrailerDocument {
  id: number
  document_type: string
  file: string
  expiry_date: string | null
  uploaded_at: string
}

export interface MaintenanceRecord {
  id: number
  service_type: string
  workshop: string
  mechanic: string
  parts_used: string
  cost: string
  downtime_days: number
  scheduled_date: string
  completed_date: string | null
  notes: string
}

export interface Trailer {
  id: number
  trailer_number: string
  registration_number: string
  vin: string
  trailer_type: string
  trailer_type_display?: string
  brand: string
  manufacturer: string
  model: string
  year: number | null
  capacity: string
  weight: string
  dimensions: string
  purchase_date: string | null
  purchase_cost: string | null
  current_value: string | null
  status: string
  status_display?: string
  branch: number | null
  yard_location: string
  gps_lat: string | null
  gps_lng: string | null
  license_expiry: string | null
  insurance_expiry: string | null
  next_inspection_date: string | null
  qr_code_uid?: string
  images?: TrailerImage[]
  documents?: TrailerDocument[]
  maintenance_records?: MaintenanceRecord[]
  created_at?: string
  updated_at?: string
  created_by?: number | null
}

/** Body sent to POST/PATCH — only the writable fields. */
export interface TrailerPayload {
  trailer_number: string
  registration_number: string
  vin: string
  trailer_type: string
  brand?: string
  manufacturer?: string
  model?: string
  year?: number | null
  capacity?: string
  weight?: string
  dimensions?: string
  purchase_date?: string | null
  purchase_cost?: string | null
  current_value?: string | null
  status: string
  yard_location?: string
  gps_lat?: string | null
  gps_lng?: string | null
  license_expiry?: string | null
  insurance_expiry?: string | null
  next_inspection_date?: string | null
}

/** value = code stored by the backend, label = human display. */
export interface Choice {
  value: string
  label: string
}

export const TRAILER_TYPES: Choice[] = [
  { value: "flatbed", label: "Flatbed" },
  { value: "low_loader", label: "Low Loader" },
  { value: "fuel_tanker", label: "Fuel Tanker" },
  { value: "container", label: "Container Trailer" },
  { value: "side_tipper", label: "Side Tipper" },
  { value: "box", label: "Box Trailer" },
  { value: "curtain", label: "Curtain Trailer" },
  { value: "refrigerated", label: "Refrigerated Trailer" },
  { value: "skeletal", label: "Skeletal Trailer" },
  { value: "extendable", label: "Extendable Trailer" },
  { value: "livestock", label: "Livestock Trailer" },
  { value: "other", label: "Other" },
]

export const TRAILER_STATUSES: Choice[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "rented", label: "Rented" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "damaged", label: "Damaged" },
  { value: "retired", label: "Retired" },
]

export function typeLabel(value: string | undefined): string {
  if (!value) return "—"
  return TRAILER_TYPES.find((t) => t.value === value)?.label ?? value
}

export function statusLabel(value: string | undefined): string {
  if (!value) return "—"
  return TRAILER_STATUSES.find((s) => s.value === value)?.label ?? value
}
