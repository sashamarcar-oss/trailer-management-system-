import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "./types-and-api-notes"

export const DEFAULT_VAT_PERCENT = 16
export const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Void"]

export function kes(value: number): string {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function lineItemAmount(item: Pick<InvoiceLineItem, "quantity" | "rate">): number {
  return Number(item.quantity || 0) * Number(item.rate || 0)
}

export function computeTotals(
  lineItems: Pick<InvoiceLineItem, "quantity" | "rate">[],
  discountPercent: number,
  vatPercent: number,
) {
  const subtotal = lineItems.reduce((sum, li) => sum + lineItemAmount(li), 0)
  const discountAmount = subtotal * (Number(discountPercent || 0) / 100)
  const taxable = subtotal - discountAmount
  const vatAmount = taxable * (Number(vatPercent || 0) / 100)
  const total = taxable + vatAmount
  return { subtotal, discountAmount, vatAmount, total }
}

// ── Aging / overdue ──────────────────────────────────────────────────────
export function daysOverdue(invoice: Invoice): number {
  if (invoice.status === "Paid" || invoice.status === "Void") return 0
  const due = new Date(invoice.dueDate)
  if (isNaN(due.getTime())) return 0
  const days = Math.floor((Date.now() - due.getTime()) / 86400000)
  return Math.max(days, 0)
}

export function isOverdue(invoice: Invoice): boolean {
  return daysOverdue(invoice) > 0 && invoice.balance > 0
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+"

export function agingBucket(invoice: Invoice): AgingBucket {
  const d = daysOverdue(invoice)
  if (invoice.balance <= 0) return "current"
  if (d === 0) return "current"
  if (d <= 30) return "1-30"
  if (d <= 60) return "31-60"
  if (d <= 90) return "61-90"
  return "90+"
}

export function computeAgingSummary(invoices: Invoice[]) {
  const buckets: Record<AgingBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }
  invoices.forEach((inv) => {
    if (inv.balance <= 0 || inv.status === "Void") return
    buckets[agingBucket(inv)] += inv.balance
  })
  return buckets
}

// ── Status/action gating ─────────────────────────────────────────────────
export function canEdit(status: InvoiceStatus): boolean {
  return status === "Draft"
}
export function canDelete(status: InvoiceStatus): boolean {
  return status === "Draft"
}
export function canSend(status: InvoiceStatus): boolean {
  return status === "Draft"
}
export function canRecordPayment(invoice: Invoice): boolean {
  return invoice.status !== "Void" && invoice.status !== "Draft" && invoice.balance > 0
}
export function canVoid(status: InvoiceStatus): boolean {
  return status !== "Void" && status !== "Paid"
}
export function canRemind(invoice: Invoice): boolean {
  return isOverdue(invoice)
}

// ── CSV export (list, for accounting reconciliation) ────────────────────
export function exportInvoicesCSV(rows: Invoice[]) {
  const header = "Invoice #,Client,Date,Due,Status,Total,Paid,Balance,Days Overdue"
  const lines = rows.map((inv) =>
    [
      inv.invoiceNumber,
      `"${inv.clientName}"`,
      inv.date,
      inv.dueDate,
      inv.status,
      inv.total.toFixed(2),
      inv.amountPaid.toFixed(2),
      inv.balance.toFixed(2),
      String(daysOverdue(inv)),
    ].join(","),
  )
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ── PDF export (single invoice, client-facing document) ─────────────────
export function exportInvoicePDF(invoice: Invoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  doc.setFontSize(18)
  doc.text("Invoice", 40, 44)
  doc.setFontSize(10)
  doc.text(invoice.invoiceNumber, 40, 62)

  doc.setFontSize(10)
  doc.text(`Client: ${invoice.clientName}`, 340, 44)
  if (invoice.clientEmail) doc.text(`Email: ${invoice.clientEmail}`, 340, 58)
  doc.text(`Date: ${invoice.date}`, 340, 72)
  doc.text(`Due: ${invoice.dueDate}`, 340, 86)

  autoTable(doc, {
    startY: 100,
    head: [["Description", "Qty", "Rate", "Unit", "Amount"]],
    body: invoice.lineItems.map((li) => [li.description, String(li.quantity), kes(li.rate), li.rateUnit, kes(li.amount)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 110, 86] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
  let y = (doc.lastAutoTable?.finalY ?? 100) + 20
  const totalsRows: [string, string][] = [
    ["Subtotal", kes(invoice.subtotal)],
    [`Discount (${invoice.discountPercent}%)`, `- ${kes(invoice.discountAmount)}`],
    [`VAT (${invoice.vatPercent}%)`, kes(invoice.vatAmount)],
    ["Total", kes(invoice.total)],
    ["Amount Paid", `- ${kes(invoice.amountPaid)}`],
    ["Balance Due", kes(invoice.balance)],
  ]
  totalsRows.forEach(([label, val], i) => {
    const last = i === totalsRows.length - 1
    doc.setFontSize(last ? 12 : 10)
    doc.text(label, 380, y)
    doc.text(val, 500, y, { align: "right" })
    y += 18
  })

  if (invoice.payments.length > 0) {
    y += 10
    autoTable(doc, {
      startY: y,
      head: [["Payment Date", "Method", "Reference", "Amount"]],
      body: invoice.payments.map((p) => [p.paidAt, p.method, p.reference || "—", kes(p.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 110, 86] },
      margin: { left: 40, right: 40 },
    })
    // @ts-expect-error runtime property
    y = (doc.lastAutoTable?.finalY ?? y) + 20
  }

  if (invoice.notes) {
    doc.setFontSize(10)
    doc.text("Notes:", 40, y + 10)
    doc.text(doc.splitTextToSize(invoice.notes, 500), 40, y + 26)
    y += 50
  }
  if (invoice.terms) {
    doc.setFontSize(9)
    doc.text("Terms & Conditions:", 40, y + 20)
    doc.text(doc.splitTextToSize(invoice.terms, 500), 40, y + 34)
  }

  doc.save(`${invoice.invoiceNumber}.pdf`)
}
