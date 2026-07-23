import { axiosClient } from "@/lib/api"
import type { Paginated, Quotation, QuotationPayload, QuotationStatus } from "./types-and-api-notes"

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
  items?: Array<{
    id: number | string
    trailer?: number | string
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
    const quantity = Number(lineItem.duration_days || 1)
    const rate = numberValue(lineItem.rate_per_day)
    return {
      id: String(lineItem.id),
      trailerId: lineItem.trailer == null ? null : String(lineItem.trailer),
      description: lineItem.trailer == null ? "Trailer rental" : `Trailer ${lineItem.trailer}`,
      quantity,
      rate,
      rateUnit: "day" as const,
      amount: numberValue(lineItem.subtotal) || quantity * rate,
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
    convertedRentalId: null,
    createdAt: "",
    updatedAt: "",
  }
}

function toBackendPayload(payload: QuotationPayload) {
  return {
    client: payload.clientId,
    expiry_date: payload.expiryDate,
    notes: payload.notes || "",
    terms: payload.terms || "",
    discount: 0,
    tax: 0,
    status: "draft",
    items: payload.lineItems.map((lineItem) => ({
      trailer: lineItem.trailerId,
      duration_days: lineItem.rateUnit === "week" ? lineItem.quantity * 7 : lineItem.rateUnit === "month" ? lineItem.quantity * 30 : lineItem.quantity,
      rate_per_day: lineItem.rate,
    })),
  }
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
      status: "draft",
      items: quotation.lineItems.map((lineItem) => ({
        trailer: lineItem.trailerId,
        duration_days: lineItem.quantity,
        rate_per_day: lineItem.rate,
      })),
    })
    return mapQuotation(data)
  },

  async send(id: string): Promise<Quotation> {
    return this.markStatus(id, "Sent")
  },

  async markStatus(id: string, status: QuotationStatus): Promise<Quotation> {
    const backendStatus = status === "Sent" ? "pending" : status.toLowerCase()
    const { data } = await axiosClient.patch<BackendQuotation>(`/quotations/${id}/`, { status: backendStatus })
    return mapQuotation(data)
  },

  async convert(id: string): Promise<{ rentalId?: string }> {
    const { data } = await axiosClient.post<{ rental_id?: string; rentalId?: string }>(`/quotations/${id}/convert_to_rental/`)
    return { rentalId: data.rentalId || data.rental_id }
  },

  async get(id: string): Promise<Quotation> {
    const { data } = await axiosClient.get<BackendQuotation>(`/quotations/${id}/`)
    return mapQuotation(data)
  },
}
