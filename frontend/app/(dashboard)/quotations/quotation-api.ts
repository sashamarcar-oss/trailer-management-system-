import { axiosClient } from "@/lib/api"
import type { Paginated, Quotation, QuotationPayload, QuotationStatus } from "./types-and-api-notes"
import { durationInUnits } from "../rentals/rental-utils"

type BackendQuotation = {
  id: number | string
  quotation_number: string
  client: number | string
  client_name?: string
  issue_date: string
  expiry_date: string
  status: string
  value?: number | string
  tax?: number | string
  discount?: number | string
  terms?: string
  notes?: string
  converted_rental_id?: number | string | null
  items?: Array<{
    id: number | string
      trailer?: number | string
      description?: string
    duration_days: number
    rate_per_day: number | string
    subtotal?: number | string
  }>
}

function numberValue(value: number | string | undefined): number {
  return Number(value || 0)
}

function normalizeStatus(status: string): QuotationStatus {
  const normalized = status.toLowerCase()
  if (normalized === "pending") return "Sent"
  if (normalized === "accepted") return "Accepted"
  if (normalized === "rejected") return "Rejected"
  if (normalized === "expired") return "Expired"
  if (normalized === "converted") return "Converted"
  return normalized === "viewed" ? "Viewed" : normalized === "sent" ? "Sent" : "Draft"
}

function mapQuotation(item: BackendQuotation): Quotation {
  const lineItems = (item.items || []).map((lineItem) => {
    // NOTE: `duration_days` / `rate_per_day` are just the backend's generic field
    // names — for trailer rentals we store them as months / rate-per-month directly
    // (no unit conversion), so subtotal (duration * rate) is always exact.
    const quantity = Math.max(1, Number(lineItem.duration_days || 1))
    const rate = numberValue(lineItem.rate_per_day)
    const total = numberValue(lineItem.subtotal) || quantity * rate
    const isRental = lineItem.trailer != null
    return {
      id: String(lineItem.id),
      trailerId: lineItem.trailer == null ? null : String(lineItem.trailer),
      description: lineItem.description || (lineItem.trailer == null ? "Trailer rental" : `Trailer ${lineItem.trailer}`),
      quantity,
      rate,
      rateUnit: isRental ? "month" as const : "flat" as const,
      amount: total,
    }
  })
  const subtotal = lineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0)
  const discountAmount = numberValue(item.discount)
  const vatAmount = numberValue(item.tax)
  const total = numberValue(item.value) || subtotal - discountAmount + vatAmount

  return {
    id: String(item.id),
    quotationNumber: item.quotation_number,
    clientId: String(item.client),
    clientName: item.client_name || `Client ${item.client}`,
    issueDate: item.issue_date,
    expiryDate: item.expiry_date,
    status: normalizeStatus(item.status),
    lineItems,
    subtotal,
    discountPercent: subtotal ? (discountAmount / subtotal) * 100 : 0,
    discountAmount,
    vatPercent: subtotal - discountAmount ? (vatAmount / (subtotal - discountAmount)) * 100 : 0,
    vatAmount,
    total,
    value: total,
    notes: item.notes,
    terms: item.terms,
    convertedRentalId: item.converted_rental_id == null ? null : String(item.converted_rental_id),
    createdAt: "",
    updatedAt: "",
  }
}

function toBackendPayload(payload: QuotationPayload) {
  const items = payload.lineItems.map((lineItem) => {
    const months = durationInUnits(payload.startDate || "", payload.endDate || "", lineItem.rateUnit)
    return {
      trailer: lineItem.trailerId,
      description: lineItem.description,
      duration_days: lineItem.quantity * months,
      rate_per_day: Number(lineItem.rate),
    }
  })

  const subtotal = items.reduce((sum, it) => sum + it.duration_days * it.rate_per_day, 0)
  const discountPercent = Number(payload.discountPercent || 0)
  const discountAmount = subtotal * (discountPercent / 100)

  return {
    client: payload.clientId || null,
    client_name: payload.clientName,
    client_email: payload.clientEmail || "",
    client_phone: payload.clientPhone || "",
    expiry_date: payload.expiryDate,
    notes: payload.notes || "",
    terms: payload.terms || "",
    discount: round2(discountAmount),
    tax: 0,
    status: "draft",
    items,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export const quotationApi = {
  async list(params: { search?: string; status?: string; from?: string; to?: string; page?: number }): Promise<Paginated<Quotation>> {
    const { data } = await axiosClient.get<{ count: number; next: string | null; previous: string | null; results: BackendQuotation[] }>("/quotations/", {
      params: {
        search: params.search,
        status: params.status?.toLowerCase(),
        expiry_date__gte: params.from,
        expiry_date__lte: params.to,
        page: params.page,
      },
    })
    return { ...data, results: data.results.map(mapQuotation) }
  },

  async create(payload: QuotationPayload): Promise<Quotation> {
    const { data } = await axiosClient.post<BackendQuotation>("/quotations/", toBackendPayload(payload))
    return mapQuotation(data)
  },

  async update(id: string, payload: QuotationPayload): Promise<Quotation> {
    const { data } = await axiosClient.patch<BackendQuotation>(`/quotations/${id}/`, toBackendPayload(payload))
    return mapQuotation(data)
  },

  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/quotations/${id}/`)
  },

  async duplicate(id: string): Promise<Quotation> {
    const quotation = await this.get(id)
    const { data } = await axiosClient.post<BackendQuotation>("/quotations/", {
      client: quotation.clientId,
      expiry_date: quotation.expiryDate,
      notes: quotation.notes || "",
      terms: quotation.terms || "",
      discount: round2(quotation.discountAmount),
      tax: 0,
      status: "draft",
      items: quotation.lineItems.map((lineItem) => ({
        trailer: lineItem.trailerId,
        duration_days: lineItem.quantity,
        rate_per_day: Number(lineItem.rate),
      })),
    })
    return mapQuotation(data)
  },

  async send(id: string): Promise<Quotation> {
    const { data } = await axiosClient.post<BackendQuotation>(`/quotations/${id}/send/`)
    return mapQuotation(data)
  },

  async markStatus(id: string, status: QuotationStatus): Promise<Quotation> {
    const backendStatus = status === "Sent" ? "pending" : status.toLowerCase()
    const { data } = await axiosClient.patch<BackendQuotation>(`/quotations/${id}/`, { status: backendStatus })
    return mapQuotation(data)
  },

  async convertToInvoice(id: string): Promise<{ invoiceId?: string; invoiceNumber?: string }> {
    const { data } = await axiosClient.post<Record<string, unknown>>(`/quotations/${id}/convert_to_invoice/`)
    return {
      invoiceId: data?.id == null ? undefined : String(data.id),
      invoiceNumber: typeof data?.invoice_number === "string" ? data.invoice_number : undefined,
    }
  },

  async get(id: string): Promise<Quotation> {
    const { data } = await axiosClient.get<BackendQuotation>(`/quotations/${id}/`)
    return mapQuotation(data)
  },

  async convert(id: string): Promise<{ invoiceId?: string; invoiceNumber?: string }> {
    return this.convertToInvoice(id)
  },
}