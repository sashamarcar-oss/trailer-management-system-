import { axiosClient } from "@/lib/api"
import type { Invoice, InvoicePayload, Paginated, Payment, PaymentPayload } from "./types-and-api-notes"

type BackendInvoice = {
  id: number | string
  invoice_number: string
  client: number | string
  client_name?: string
  invoice_date: string
  due_date: string
  status: string
  items?: Array<{ id: number | string; trailer?: number | string | null; description?: string; quantity: number; unit_price: number | string; subtotal?: number | string }>
  payments?: Array<Record<string, unknown>>
  tax?: number | string
  discount?: number | string
  vat?: number | string
  total?: number | string
  amount_paid?: number | string
  balance?: number | string
  notes?: string
  terms?: string
  created_at?: string
}

const numberValue = (value: number | string | undefined) => Number(value || 0)

function normalizeStatus(status: string): Invoice["status"] {
  const normalized = status.toLowerCase()
  if (normalized === "pending") return "Sent"
  if (normalized === "partially_paid") return "Partially Paid"
  if (normalized === "cancelled") return "Void"
  if (normalized === "paid") return "Paid"
  if (normalized === "overdue") return "Overdue"
  return "Draft"
}

function mapInvoice(item: BackendInvoice): Invoice {
  const lineItems = (item.items || []).map((lineItem) => ({
    id: String(lineItem.id),
    trailerId: lineItem.trailer == null ? null : String(lineItem.trailer),
    description: lineItem.description || "Invoice item",
    quantity: Number(lineItem.quantity || 1),
    rate: numberValue(lineItem.unit_price),
    rateUnit: "flat" as const,
    amount: numberValue(lineItem.subtotal) || Number(lineItem.quantity || 1) * numberValue(lineItem.unit_price),
  }))
  const subtotal = lineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0)
  const discountAmount = numberValue(item.discount)
  const vatAmount = numberValue(item.tax) + numberValue(item.vat)
  const total = numberValue(item.total) || subtotal - discountAmount + vatAmount
  const amountPaid = numberValue(item.amount_paid)

  return {
    id: String(item.id), invoiceNumber: item.invoice_number, clientId: String(item.client),
    clientName: item.client_name || `Client ${item.client}`, date: item.invoice_date, dueDate: item.due_date,
    status: normalizeStatus(item.status), lineItems, subtotal,
    discountPercent: subtotal ? (discountAmount / subtotal) * 100 : 0, discountAmount,
    vatPercent: subtotal - discountAmount ? (vatAmount / (subtotal - discountAmount)) * 100 : 0, vatAmount,
    total, amountPaid, balance: numberValue(item.balance) || total - amountPaid,
    payments: (item.payments || []) as unknown as Payment[], notes: item.notes, terms: item.terms,
    createdAt: item.created_at || "", updatedAt: item.created_at || "",
  }
}

function toBackendPayload(payload: InvoicePayload) {
  return {
    client: payload.clientId, due_date: payload.dueDate, discount: 0, tax: 0, vat: 0, status: "draft",
    items: payload.lineItems.map((lineItem) => ({ trailer: lineItem.trailerId, description: lineItem.description, quantity: lineItem.quantity, unit_price: lineItem.rate })),
  }
}

export const invoiceApi = {
  async list(params: { search?: string; status?: string; from?: string; to?: string; overdueOnly?: boolean; page?: number }): Promise<Paginated<Invoice>> {
    const { data } = await axiosClient.get<{ count: number; next: string | null; previous: string | null; results: BackendInvoice[] }>("/invoices/", {
      params: { search: params.search, status: params.status?.toLowerCase().replace(" ", "_"), due_date__gte: params.from, due_date__lte: params.to, page: params.page },
    })
    let results = data.results.map(mapInvoice)
    if (params.overdueOnly) results = results.filter((invoice) => invoice.status === "Overdue" || (invoice.balance > 0 && new Date(invoice.dueDate) < new Date()))
    return { ...data, results }
  },
  async retrieve(id: string): Promise<Invoice> {
    const { data } = await axiosClient.get<BackendInvoice>(`/invoices/${id}/`)
    return mapInvoice(data)
  },
  async create(payload: InvoicePayload): Promise<Invoice> {
    const { data } = await axiosClient.post<BackendInvoice>("/invoices/", toBackendPayload(payload))
    return mapInvoice(data)
  },
  async update(id: string, payload: InvoicePayload): Promise<Invoice> {
    const { data } = await axiosClient.patch<BackendInvoice>(`/invoices/${id}/`, toBackendPayload(payload))
    return mapInvoice(data)
  },
  async delete(id: string): Promise<void> { await axiosClient.delete(`/invoices/${id}/`) },
  async send(id: string): Promise<Invoice> { return this.updateStatus(id, "pending") },
  async sendReminder(id: string): Promise<void> { await axiosClient.post(`/invoices/${id}/send_reminder/`) },
  async void(id: string, reason?: string): Promise<Invoice> {
    const { data } = await axiosClient.patch<BackendInvoice>(`/invoices/${id}/`, { status: "cancelled", notes: reason || "" })
    return mapInvoice(data)
  },
  async updateStatus(id: string, status: string): Promise<Invoice> {
    const { data } = await axiosClient.patch<BackendInvoice>(`/invoices/${id}/`, { status })
    return mapInvoice(data)
  },
}

export const paymentApi = {
  async record(invoiceId: string, payload: PaymentPayload): Promise<{ invoice: Invoice; payment: Payment }> {
    const { data } = await axiosClient.post<Record<string, unknown>>("/payments/", { invoice: invoiceId, amount: payload.amount, method: payload.method.toLowerCase().replace("-", "_"), reference_number: payload.reference || "" })
    return { invoice: await invoiceApi.retrieve(invoiceId), payment: data as unknown as Payment }
  },
}