import { axiosClient } from "@/lib/api"
import type {
  ActivatePayload, AvailabilityCheckResult, ClientLite, DriverLite, InspectionRecord,
  Paginated, Rental, RentalPayload, ReturnPayload, TrailerLite,
} from "./types-and-api-notes"

type BackendRental = {
  id: number | string
  rental_number: string
  client: number | string
  client_name?: string
  trailer: number | string
  trailer_number?: string
  quotation?: number | string | null
  pickup_date: string
  return_date: string
  actual_return_date?: string | null
  pickup_location?: string
  dropoff_location?: string
  rate?: number | string
  discount?: number | string
  tax?: number | string
  security_deposit?: number | string
  status: string
  total?: number | string
  created_at?: string
  updated_at?: string
  inspections?: BackendInspection[]
}

type BackendInspection = {
  id: number | string
  stage: "pickup" | "return"
  checklist?: Record<string, unknown>
  notes?: string
  inspected_at?: string
  inspected_by?: number | string | null
}

const numberValue = (value: number | string | undefined) => Number(value || 0)

function mapInspection(item: BackendInspection): InspectionRecord {
  const checklist = item.checklist || {}
  return {
    id: String(item.id), type: item.stage === "pickup" ? "checkout" : "return",
    odometerOrHours: typeof checklist.odometerOrHours === "number" ? checklist.odometerOrHours : undefined,
    fuelLevel: checklist.fuelLevel as InspectionRecord["fuelLevel"],
    conditionNotes: item.notes || "",
    damageNoted: Boolean(checklist.damageNoted), damageNotes: typeof checklist.damageNotes === "string" ? checklist.damageNotes : undefined,
    photoUrls: Array.isArray(checklist.photoUrls) ? checklist.photoUrls.filter((url): url is string => typeof url === "string") : undefined,
    inspectedBy: item.inspected_by == null ? undefined : String(item.inspected_by), inspectedAt: item.inspected_at || "",
  }
}

function mapRental(item: BackendRental): Rental {
  const rate = numberValue(item.rate)
  const total = numberValue(item.total) || rate - numberValue(item.discount) + numberValue(item.tax)
  const inspections = item.inspections || []
  return {
    id: String(item.id), rentalNumber: item.rental_number, clientId: String(item.client),
    clientName: item.client_name || `Client ${item.client}`, quotationId: item.quotation == null ? null : String(item.quotation),
    trailers: [{ id: `${item.id}-${item.trailer}`, trailerId: String(item.trailer), trailerName: item.trailer_number || `Trailer ${item.trailer}`, rate, rateUnit: "flat", quantity: 1 }],
    pickupDate: item.pickup_date, scheduledReturnDate: item.return_date, actualReturnDate: item.actual_return_date,
    pickupLocation: item.pickup_location, returnLocation: item.dropoff_location, deliveryRequired: Boolean(item.dropoff_location),
    driverId: null, driverName: null, status: item.status === "completed" ? "Returned" : item.status === "cancelled" ? "Cancelled" : ["active", "overdue"].includes(item.status) ? "Active" : item.status === "reserved" ? "Reserved" : "Draft",
    subtotal: total, total, depositAmount: numberValue(item.security_deposit), depositReturned: item.actual_return_date ? numberValue(item.security_deposit) : 0,
    depositForfeited: 0, checkoutInspection: inspections.find((inspection) => inspection.stage === "pickup") ? mapInspection(inspections.find((inspection) => inspection.stage === "pickup") as BackendInspection) : null,
    returnInspection: inspections.find((inspection) => inspection.stage === "return") ? mapInspection(inspections.find((inspection) => inspection.stage === "return") as BackendInspection) : null,
    createdAt: item.created_at || "", updatedAt: item.updated_at || "",
  }
}

function toBackendPayload(payload: RentalPayload) {
  if (payload.trailers.length !== 1) throw new Error("The backend currently supports one trailer per rental.")
  const trailer = payload.trailers[0]
  const days = Math.max(1, Math.ceil((new Date(payload.scheduledReturnDate).getTime() - new Date(payload.pickupDate).getTime()) / 86400000))
  const units = trailer.rateUnit === "flat" ? 1 : trailer.rateUnit === "week" ? Math.ceil(days / 7) : trailer.rateUnit === "month" ? Math.ceil(days / 30) : days
  return {
    client: payload.clientId, trailer: trailer.trailerId, quotation: payload.quotationId,
    pickup_date: payload.pickupDate, return_date: payload.scheduledReturnDate,
    pickup_location: payload.pickupLocation || "", dropoff_location: payload.returnLocation || "",
    rate: trailer.rate * units * trailer.quantity, security_deposit: payload.depositAmount, status: "draft",
  }
}

function inspectionPayload(record: InspectionRecord, stage: "pickup" | "return") {
  return { stage, notes: record.conditionNotes, checklist: { odometerOrHours: record.odometerOrHours, fuelLevel: record.fuelLevel, damageNoted: record.damageNoted, damageNotes: record.damageNotes, photoUrls: record.photoUrls } }
}

export const rentalApi = {
  async list(params: { search?: string; status?: string; from?: string; to?: string; overdueOnly?: boolean; page?: number }): Promise<Paginated<Rental>> {
    const { data } = await axiosClient.get<{ count: number; next: string | null; previous: string | null; results: BackendRental[] }>("/rentals/", {
      params: { search: params.search, status: params.status?.toLowerCase(), pickup_after: params.from, return_before: params.to, page: params.page },
    })
    let results = data.results.map(mapRental)
    if (params.overdueOnly) results = results.filter((rental) => rental.status === "Active" && new Date(rental.scheduledReturnDate) < new Date())
    return { ...data, results }
  },
  async retrieve(id: string): Promise<Rental> { const { data } = await axiosClient.get<BackendRental>(`/rentals/${id}/`); return mapRental(data) },
  async create(payload: RentalPayload): Promise<Rental> { const { data } = await axiosClient.post<BackendRental>("/rentals/", toBackendPayload(payload)); return mapRental(data) },
  async update(id: string, payload: RentalPayload): Promise<Rental> { const { data } = await axiosClient.patch<BackendRental>(`/rentals/${id}/`, toBackendPayload(payload)); return mapRental(data) },
  async delete(id: string): Promise<void> { await axiosClient.delete(`/rentals/${id}/`) },
  async cancel(id: string, reason?: string): Promise<Rental> { const { data } = await axiosClient.patch<BackendRental>(`/rentals/${id}/`, { status: "cancelled" }); return mapRental(data) },
  async activate(id: string, payload: ActivatePayload): Promise<Rental> {
    const { data } = await axiosClient.patch<BackendRental>(`/rentals/${id}/`, { status: "active" })
    await axiosClient.post(`/rentals/inspections/`, { rental: id, ...inspectionPayload({ ...payload.checkoutInspection, id: "", type: "checkout", inspectedAt: "" }, "pickup") })
    return mapRental(data)
  },
  async markReturned(id: string, payload: ReturnPayload): Promise<Rental> {
    const { data } = await axiosClient.patch<BackendRental>(`/rentals/${id}/`, { status: "completed", actual_return_date: payload.actualReturnDate })
    await axiosClient.post(`/rentals/inspections/`, { rental: id, ...inspectionPayload({ ...payload.returnInspection, id: "", type: "return", inspectedAt: "" }, "return") })
    return mapRental(data)
  },
  async checkAvailability(params: { trailerIds: string[]; pickupDate: string; returnDate: string; excludeRentalId?: string }): Promise<AvailabilityCheckResult[]> {
    const { data } = await axiosClient.get<{ results: BackendRental[] }>("/rentals/", { params: { trailer: params.trailerIds[0], pickup_after: params.pickupDate, return_before: params.returnDate } })
    const conflicts = data.results.filter((rental) => ["reserved", "active"].includes(rental.status) && String(rental.id) !== params.excludeRentalId)
    return params.trailerIds.map((trailerId) => ({ trailerId, available: !conflicts.some((rental) => String(rental.trailer) === trailerId), conflict: conflicts[0] ? { rentalId: String(conflicts[0].id), rentalNumber: conflicts[0].rental_number, pickupDate: conflicts[0].pickup_date, scheduledReturnDate: conflicts[0].return_date } : undefined }))
  },
}

export const rentalLookups = {
  async clients(): Promise<ClientLite[]> { const { data } = await axiosClient.get<{ results: Array<{ id: number | string; name: string; email?: string; contact_phone?: string }> }>("/clients/"); return data.results.map((client) => ({ id: String(client.id), name: client.name, email: client.email, phone: client.contact_phone })) },
  async trailers(): Promise<TrailerLite[]> { const { data } = await axiosClient.get<{ results: Array<{ id: number | string; trailer_number: string; type?: string }> }>("/trailers/"); return data.results.map((trailer) => ({ id: String(trailer.id), name: trailer.trailer_number || `Trailer ${trailer.id}` })) },
  async drivers(): Promise<DriverLite[]> { return [] },
}