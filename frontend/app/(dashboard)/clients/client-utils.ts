import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Client, StatementLine } from "./types-and-api-notes"

export function formatCurrency(value: number, currency: "USD" | "KES" = "KES"): string {
  const locale = currency === "USD" ? "en-US" : "en-KE"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function kes(value: number): string {
  return formatCurrency(value, "KES")
}

// ── Export ──────────────────────────────────────────────────────────────
export function exportClientsCSV(rows: Client[]) {
  const header = "Client ID,Name,Type,Status,Contact,Outstanding,Rating"
  const lines = rows.map((c) =>
    [
      c.code, `"${c.name}"`, c.client_type, c.status, c.contact_phone,
      c.outstanding_balance.toFixed(2), c.rating ?? "—",
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
      l.debit ? formatCurrency(l.debit, client.currency || "USD") : "—",
      l.credit ? formatCurrency(l.credit, client.currency || "USD") : "—",
      formatCurrency(l.runningBalance, client.currency || "USD"),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 110, 86] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error jspdf-autotable attaches lastAutoTable at runtime
  const y = (doc.lastAutoTable?.finalY ?? 96) + 24
  doc.setFontSize(11)
  doc.text(`Closing Balance: ${formatCurrency(client.outstanding_balance, client.currency || "USD")}`, 380, y)

  doc.save(`statement-${client.code}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
