import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Quotation, QuotationLineItem, QuotationStatus } from "./types-and-api-notes"

export const DEFAULT_VAT_PERCENT = 16
export const QUOTATION_STATUSES: QuotationStatus[] = [
  "Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired", "Converted",
]

export function kes(value: number): string {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Line item math ──────────────────────────────────────────────────────
export function lineItemAmount(item: Pick<QuotationLineItem, "quantity" | "rate">): number {
  return Number(item.quantity || 0) * Number(item.rate || 0)
}

export function computeTotals(
  lineItems: Pick<QuotationLineItem, "quantity" | "rate">[],
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

// ── Status helpers ───────────────────────────────────────────────────────
export function isExpiringSoon(quotation: Quotation, withinDays = 7): boolean {
  if (quotation.status === "Expired" || quotation.status === "Converted" || quotation.status === "Rejected") return false
  const expiry = new Date(quotation.expiryDate)
  if (isNaN(expiry.getTime())) return false
  const days = Math.floor((expiry.getTime() - Date.now()) / 86400000)
  return days >= 0 && days <= withinDays
}

export function isPastExpiry(quotation: Quotation): boolean {
  const expiry = new Date(quotation.expiryDate)
  if (isNaN(expiry.getTime())) return false
  return expiry.getTime() < Date.now() && !["Accepted", "Converted", "Rejected", "Expired"].includes(quotation.status)
}

export function canEdit(status: QuotationStatus): boolean {
  return status === "Draft"
}
export function canSend(status: QuotationStatus): boolean {
  return status === "Draft"
}
export function canMarkAcceptedRejected(status: QuotationStatus): boolean {
  return status === "Sent" || status === "Viewed"
}
export function canConvert(status: QuotationStatus): boolean {
  return status === "Accepted"
}
export function canDelete(status: QuotationStatus): boolean {
  return status === "Draft"
}

// ── CSV export (list) ───────────────────────────────────────────────────
export function exportQuotationsCSV(rows: Quotation[]) {
  const header = "Quotation #,Client,Issued,Expiry,Status,Subtotal,Discount,VAT,Total"
  const lines = rows.map((q) =>
    [
      q.quotationNumber,
      `"${q.clientName}"`,
      q.issueDate,
      q.expiryDate,
      q.status,
      q.subtotal.toFixed(2),
      q.discountAmount.toFixed(2),
      q.vatAmount.toFixed(2),
      q.total.toFixed(2),
    ].join(","),
  )
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ── PDF export (single quotation, client-facing document) ──────────────
export function exportQuotationPDF(quotation: Quotation) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  doc.setFontSize(18)
  doc.text("Quotation", 40, 44)
  doc.setFontSize(10)
  doc.text(quotation.quotationNumber, 40, 62)

  doc.setFontSize(10)
  doc.text(`Client: ${quotation.clientName}`, 340, 44)
  if (quotation.clientEmail) doc.text(`Email: ${quotation.clientEmail}`, 340, 58)
  doc.text(`Issued: ${quotation.issueDate}`, 340, 72)
  doc.text(`Valid until: ${quotation.expiryDate}`, 340, 86)

  autoTable(doc, {
    startY: 100,
    head: [["Description", "Qty", "Rate", "Unit", "Amount"]],
    body: quotation.lineItems.map((li) => [
      li.description,
      String(li.quantity),
      kes(li.rate),
      li.rateUnit,
      kes(li.amount),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 110, 86] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
  const afterTableY = (doc.lastAutoTable?.finalY ?? 100) + 20
  const totalsRows: [string, string][] = [
    ["Subtotal", kes(quotation.subtotal)],
    [`Discount (${quotation.discountPercent}%)`, `- ${kes(quotation.discountAmount)}`],
    [`VAT (${quotation.vatPercent}%)`, kes(quotation.vatAmount)],
    ["Total", kes(quotation.total)],
  ]
  let y = afterTableY
  totalsRows.forEach(([label, val], i) => {
    doc.setFontSize(i === totalsRows.length - 1 ? 12 : 10)
    doc.text(label, 380, y)
    doc.text(val, 500, y, { align: "right" })
    y += 18
  })

  if (quotation.notes) {
    doc.setFontSize(10)
    doc.text("Notes:", 40, y + 10)
    doc.text(doc.splitTextToSize(quotation.notes, 500), 40, y + 26)
    y += 50
  }
  if (quotation.terms) {
    doc.setFontSize(9)
    doc.text("Terms & Conditions:", 40, y + 20)
    doc.text(doc.splitTextToSize(quotation.terms, 500), 40, y + 34)
  }

  doc.save(`${quotation.quotationNumber}.pdf`)
}
