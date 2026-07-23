import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Rental, RentalStatus, RentalTrailerLine } from "./types-and-api-notes"

export const RENTAL_STATUSES: RentalStatus[] = ["Draft", "Reserved", "Active", "Returned", "Cancelled"]

export function kes(value: number): string {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Duration & pricing ────────────────────────────────────────────────────
// Converts a pickup→return span into a count of billing units for a given rateUnit.
export function durationInUnits(pickupDate: string, returnDate: string, unit: RentalTrailerLine["rateUnit"]): number {
  if (unit === "flat") return 1
  const start = new Date(pickupDate)
  const end = new Date(returnDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  if (unit === "day") return days
  if (unit === "week") return Math.ceil(days / 7)
  return Math.ceil(days / 30) // month
}

export function lineTotal(
  line: Pick<RentalTrailerLine, "rate" | "rateUnit" | "quantity">,
  pickupDate: string,
  returnDate: string,
): number {
  const units = durationInUnits(pickupDate, returnDate, line.rateUnit)
  return Number(line.rate || 0) * units * Number(line.quantity || 1)
}

export function computeRentalTotal(
  lines: Pick<RentalTrailerLine, "rate" | "rateUnit" | "quantity">[],
  pickupDate: string,
  returnDate: string,
): number {
  return lines.reduce((sum, l) => sum + lineTotal(l, pickupDate, returnDate), 0)
}

// ── Overdue (derived, not stored) ────────────────────────────────────────
export function isOverdue(rental: Rental): boolean {
  if (rental.status !== "Active") return false
  const due = new Date(rental.scheduledReturnDate)
  if (isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

export function daysOverdue(rental: Rental): number {
  if (!isOverdue(rental)) return 0
  const due = new Date(rental.scheduledReturnDate)
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000))
}

export function displayStatus(rental: Rental): RentalStatus | "Overdue" {
  return isOverdue(rental) ? "Overdue" : rental.status
}

// ── Status/action gating ─────────────────────────────────────────────────
export function canEdit(status: RentalStatus): boolean {
  return status === "Draft" || status === "Reserved"
}
export function canDelete(status: RentalStatus): boolean {
  return status === "Draft"
}
export function canActivate(status: RentalStatus): boolean {
  return status === "Reserved"
}
export function canMarkReturned(status: RentalStatus): boolean {
  return status === "Active"
}
export function canCancel(status: RentalStatus): boolean {
  return status === "Draft" || status === "Reserved"
}

export function depositBalance(rental: Rental): number {
  return rental.depositAmount - rental.depositReturned - rental.depositForfeited
}

// ── CSV export ────────────────────────────────────────────────────────────
export function exportRentalsCSV(rows: Rental[]) {
  const header = "Rental #,Client,Trailers,Pickup,Scheduled Return,Actual Return,Status,Total,Deposit Held,Deposit Balance"
  const lines = rows.map((r) =>
    [
      r.rentalNumber,
      `"${r.clientName}"`,
      `"${r.trailers.map((t) => t.trailerName).join("; ")}"`,
      r.pickupDate,
      r.scheduledReturnDate,
      r.actualReturnDate || "—",
      displayStatus(r),
      r.total.toFixed(2),
      r.depositAmount.toFixed(2),
      depositBalance(r).toFixed(2),
    ].join(","),
  )
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `rentals-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ── Agreement PDF (client-facing document generated at checkout) ────────
export function exportRentalAgreementPDF(rental: Rental) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  doc.setFontSize(18)
  doc.text("Rental Agreement", 40, 44)
  doc.setFontSize(10)
  doc.text(rental.rentalNumber, 40, 62)

  doc.text(`Client: ${rental.clientName}`, 340, 44)
  if (rental.clientEmail) doc.text(`Email: ${rental.clientEmail}`, 340, 58)
  if (rental.clientPhone) doc.text(`Phone: ${rental.clientPhone}`, 340, 72)

  doc.text(`Pickup: ${rental.pickupDate}${rental.pickupLocation ? " · " + rental.pickupLocation : ""}`, 40, 90)
  doc.text(`Scheduled return: ${rental.scheduledReturnDate}${rental.returnLocation ? " · " + rental.returnLocation : ""}`, 40, 104)
  if (rental.deliveryRequired) {
    doc.text(`Delivery arranged${rental.driverName ? " — driver: " + rental.driverName : ""}`, 40, 118)
  }

  autoTable(doc, {
    startY: 134,
    head: [["Trailer", "Qty", "Rate", "Unit"]],
    body: rental.trailers.map((t) => [t.trailerName, String(t.quantity), kes(t.rate), t.rateUnit]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 110, 86] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
  let y = (doc.lastAutoTable?.finalY ?? 134) + 24
  doc.setFontSize(11)
  doc.text(`Rental Total: ${kes(rental.total)}`, 380, y)
  y += 18
  doc.setFontSize(10)
  doc.text(`Security Deposit Held: ${kes(rental.depositAmount)}`, 380, y)
  y += 30

  if (rental.terms) {
    doc.setFontSize(9)
    doc.text("Terms & Conditions:", 40, y)
    doc.text(doc.splitTextToSize(rental.terms, 500), 40, y + 14)
    y += 60
  }

  doc.setFontSize(9)
  doc.text("Client signature: _______________________        Date: ______________", 40, y + 30)

  doc.save(`${rental.rentalNumber}-agreement.pdf`)
}
