import { axiosClient } from "@/lib/api"
import type { Paginated, Trailer, TrailerPayload } from "./types-and-api-notes"

export interface TrailerListParams {
  search?: string
  status?: string
  trailerType?: string
  yardLocation?: string
  insuranceExpiryBefore?: string
  nextInspectionBefore?: string
  ordering?: string
  page?: number
}

/** Drop empty/undefined values so we never send `?status=` with no value. */
function clean(payload: TrailerPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return
    if (typeof value === "string" && value.trim() === "") {
      // Send null for optional dates/decimals that were cleared, empty string for text.
      out[key] = ["purchase_date", "purchase_cost", "current_value", "gps_lat", "gps_lng", "license_expiry", "insurance_expiry", "next_inspection_date", "year"].includes(key)
        ? null
        : ""
      return
    }
    out[key] = value
  })
  return out
}

export const trailerApi = {
  async list(params: TrailerListParams = {}): Promise<Paginated<Trailer>> {
    const { data } = await axiosClient.get<Paginated<Trailer>>("/trailers/", {
      params: {
        search: params.search || undefined,
        status: params.status || undefined,
        trailer_type: params.trailerType || undefined,
        yard_location: params.yardLocation || undefined,
        insurance_expiry_before: params.insuranceExpiryBefore || undefined,
        next_inspection_before: params.nextInspectionBefore || undefined,
        ordering: params.ordering || undefined,
        page: params.page || undefined,
      },
    })
    return data
  },

  async retrieve(id: number): Promise<Trailer> {
    const { data } = await axiosClient.get<Trailer>(`/trailers/${id}/`)
    return data
  },

  async create(payload: TrailerPayload): Promise<Trailer> {
    const { data } = await axiosClient.post<Trailer>("/trailers/", clean(payload))
    return data
  },

  async update(id: number, payload: TrailerPayload): Promise<Trailer> {
    const { data } = await axiosClient.patch<Trailer>(`/trailers/${id}/`, clean(payload))
    return data
  },

  async setStatus(id: number, status: string): Promise<Trailer> {
    const { data } = await axiosClient.patch<Trailer>(`/trailers/${id}/`, { status })
    return data
  },

  async delete(id: number): Promise<void> {
    await axiosClient.delete(`/trailers/${id}/`)
  },
}
