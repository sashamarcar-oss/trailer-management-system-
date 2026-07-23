/**
 * ASSUMPTIONS — read this first
 * ──────────────────────────────
 * Same approach as quotations/invoices: built against the shapes below since
 * I don't have your real `@/types` or `@/lib/api`. Reconcile field names
 * with your actual backend — the compiler will flag every mismatch.
 *
 * Confirmed with you:
 *   - a rental CAN include multiple trailers (RentalTrailerLine[])
 *   - availability checking against overlapping dates is required
 *   - security deposits are tracked (held / returned / forfeited)
 *   - delivery can be either client self-collection OR company-driven,
 *     decided per rental (`deliveryRequired` flag + optional driver)
 *
 * Lifecycle: Draft → Reserved → Active → Returned, with Cancelled and
 * Overdue (derived, not stored) as side states. "Agreement" from your
 * subtitle is treated as a generated PDF snapshot at the Reserved→Active
 * transition, not a separate stored entity — adjust if you model it
 * differently.
 */

// ── Add/merge into @/types ──────────────────────────────────────────────

export type RentalStatus = "Draft" | "Reserved" | "Active" | "Returned" | "Cancelled"
// "Overdue" is derived (Active + past scheduledReturnDate), not a stored status —
// see isOverdue() in rental-utils.ts. Store the real status as one of the above.

export type RateUnit = "day" | "week" | "month" | "flat"

export interface RentalTrailerLine {
  id: string
  trailerId: string
  trailerName: string          // e.g. "Flatbed 40ft - KAB 123X"
  rate: number
  rateUnit: RateUnit
  quantity: number              // usually 1, but supports e.g. "2x same trailer type"
}

export interface DriverLite {
  id: string
  name: string
  phone?: string
}

export interface InspectionRecord {
  id: string
  type: "checkout" | "return"
  odometerOrHours?: number
  fuelLevel?: "Empty" | "1/4" | "1/2" | "3/4" | "Full"
  conditionNotes: string
  damageNoted: boolean
  damageNotes?: string
  photoUrls?: string[]          // assume upload happens elsewhere, URLs stored here
  inspectedBy?: string
  inspectedAt: string            // ISO
}

export interface Rental {
  id: string
  rentalNumber: string           // e.g. "RNT-2026-0088"
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string

  quotationId?: string | null    // link back to source quotation, if any
  invoiceId?: string | null      // link forward to generated invoice, if any

  trailers: RentalTrailerLine[]

  pickupDate: string             // ISO, scheduled
  scheduledReturnDate: string    // ISO
  actualReturnDate?: string | null // ISO, set when marked Returned

  pickupLocation?: string
  returnLocation?: string
  deliveryRequired: boolean
  driverId?: string | null
  driverName?: string | null

  status: RentalStatus

  subtotal: number                // sum of (rate * duration * quantity) across trailers
  total: number                    // subtotal after any discount — kept simple, no VAT here (invoice handles VAT)

  depositAmount: number
  depositReturned: number
  depositForfeited: number
  depositNotes?: string

  checkoutInspection?: InspectionRecord | null
  returnInspection?: InspectionRecord | null

  notes?: string
  terms?: string

  createdAt: string
  updatedAt: string
}

export interface RentalPayload {
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string
  quotationId?: string | null
  trailers: Omit<RentalTrailerLine, "id">[]
  pickupDate: string
  scheduledReturnDate: string
  pickupLocation?: string
  returnLocation?: string
  deliveryRequired: boolean
  driverId?: string | null
  depositAmount: number
  notes?: string
  terms?: string
}

export interface ActivatePayload {
  checkoutInspection: Omit<InspectionRecord, "id" | "type" | "inspectedAt">
}

export interface ReturnPayload {
  actualReturnDate: string
  depositReturned: number
  depositForfeited: number
  depositNotes?: string
  returnInspection: Omit<InspectionRecord, "id" | "type" | "inspectedAt">
}

export interface AvailabilityCheckResult {
  trailerId: string
  available: boolean
  conflict?: { rentalId: string; rentalNumber: string; pickupDate: string; scheduledReturnDate: string }
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ClientLite {
  id: string
  name: string
  email?: string
  phone?: string
}

export interface TrailerLite {
  id: string
  name: string
  defaultRate?: number
  defaultRateUnit?: RateUnit
}

// ── Add/merge into @/lib/api (api.rentals) ──────────────────────────────
//
// api.rentals.list(params?: { search?: string; status?: string; trailerId?: string; from?: string; to?: string; overdueOnly?: boolean; page?: number })
//   => Promise<Paginated<Rental>>
// api.rentals.get(id: string) => Promise<Rental>
// api.rentals.create(payload: RentalPayload) => Promise<Rental>              // creates as "Draft" or "Reserved"
// api.rentals.update(id: string, payload: RentalPayload) => Promise<Rental>  // only while Draft/Reserved
// api.rentals.delete(id: string) => Promise<void>                            // only while Draft
// api.rentals.cancel(id: string, reason?: string) => Promise<Rental>
// api.rentals.activate(id: string, payload: ActivatePayload) => Promise<Rental>   // Reserved -> Active, records checkout inspection
// api.rentals.markReturned(id: string, payload: ReturnPayload) => Promise<Rental> // Active -> Returned, records return inspection + deposit resolution
// api.rentals.checkAvailability(params: { trailerIds: string[]; pickupDate: string; returnDate: string; excludeRentalId?: string })
//   => Promise<AvailabilityCheckResult[]>
// api.rentals.fromQuotation(quotationId: string) => Promise<Rental>          // pre-fills trailers/client/dates from an accepted quotation
//
// api.clients.list() => Promise<Paginated<ClientLite>>
// api.trailers.list() => Promise<Paginated<TrailerLite>>
// api.drivers.list() => Promise<Paginated<DriverLite>>
//
// Availability checking is the one endpoint I'd treat as non-optional to
// build first — everything else degrades gracefully if missing, but
// double-booking prevention needs real backend logic (a client-side-only
// check can't see rentals created by other users concurrently).
