"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type DetailField = { label: string; value?: React.ReactNode }

export function DetailsDialog({ open, onOpenChange, title, description, fields }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; fields: DetailField[]
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader><dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{fields.filter((field) => field.value !== undefined && field.value !== "").map((field) => <div key={field.label} className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words text-sm text-foreground">{field.value}</dd></div>)}</dl></DialogContent></Dialog>
}
