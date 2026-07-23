import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Client, StatementLine } from "./types-and-api-notes"

export function kes(value: number): string {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Credit control ─────────────────────────────────────────────────────────
export function availableCredit(client: Client): number {
  return client.credit_limit - client.outstanding_balance
}

export function isOverLimit(client: Client): boolean {
  return client.outstanding_balance > client.credit_limit
}

export function creditUtilizationPercent(client: Client): number {
  if (client.credit_limit <= 0) return client.outstanding_balance > 0 ? 100 : 0
  return Math.min(100, Math.round((client.outstanding_balance / client.credit_limit) * 100))
}

/**
 * Reusable "warn but allow override" check. Call this from the rental and
 * invoice creation forms before submit — if it returns non-null, show the
 * message in a dismissible/acknowledgeable warning banner rather than a
 * hard block.
 *
 * `additionalAmount` is the value of the document being created (e.g. a
 * new invoice's total) so the check reflects the balance *after* this
 * transaction, not just the client's current state.
 */
export function checkCreditWarning(client: Client, additionalAmount = 0): { message: string; projectedBalance: number } | null {
  if (client.status === "Inactive") {
    return { message: `${client.name} is marked Inactive.`, projectedBalance: client.outstanding_balance }
  }
  const projected = client.outstanding_balance + additionalAmount
  if (projected > client.credit_limit) {
    const over = projected - client.credit_limit
    return {
      message: `This would put ${client.name} ${kes(over)} over their ${kes(client.credit_limit)} credit limit (projected balance: ${kes(projected)}).`,
      projectedBalance: projected,
    }
  }
  return null
}

// ── Export ──────────────────────────────────────────────────────────────
export function exportClientsCSV(rows: Client[]) {
  const header = "Client ID,Name,Type,Status,Contact,Outstanding,Credit Limit,Available Credit,Rating"
  const lines = rows.map((c) =>
    [
      c.code, `"${c.name}"`, c.client_type, c.status, c.contact_phone,
      c.outstanding_balance.toFixed(2), c.credit_limit.toFixed(2), availableCredit(c).toFixed(2), c.rating ?? "—",
    ].join(","),
  )
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

export function exportClientStatementPDF(client: Client, lines: StatementLine[], periodLabel: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  doc.setFontSize(18)
  doc.text("Client Statement", 40, 44)
  doc.setFontSize(10)
  doc.text(`${client.name} (${client.code})`, 40, 62)
  doc.text(`Period: ${periodLabel}`, 40, 76)

  doc.text(`Contact: ${client.contact_phone}`, 340, 44)
  if (client.contact_email) doc.text(`Email: ${client.contact_email}`, 340, 58)

  autoTable(doc, {
    startY: 96,
    head: [["Date", "Type", "Reference", "Debit", "Credit", "Balance"]],
    body: lines.map((l) => [
      l.date, l.type, l.reference,
      l.debit ? kes(l.debit) : "—",
      l.credit ? kes(l.credit) : "—",
      kes(l.runningBalance),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 110, 86] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
  const y = (doc.lastAutoTable?.finalY ?? 96) + 24
  doc.setFontSize(11)
  doc.text(`Closing Balance: ${kes(client.outstanding_balance)}`, 380, y)

  doc.save(`statement-${client.code}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
