"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, Download, FileText, Upload } from "lucide-react"
import { axiosClient } from "@/lib/api"
import { ThemeToggle } from "@/components/ui/theme-toggle"

type SigningRequest = {
  client_name: string
  rental_number?: string | null
  contract_pdf?: string | null
  inspection_pdf?: string | null
  contract_status: string
  inspection_status: string
  is_complete: boolean
}

export default function DocumentSigningPage() {
  const { token } = useParams<{ token: string }>()
  const [request, setRequest] = useState<SigningRequest | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [signatureName, setSignatureName] = useState("")
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [inspectionFile, setInspectionFile] = useState<File | null>(null)
  const contractInput = useRef<HTMLInputElement>(null)
  const inspectionInput = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const { data } = await axiosClient.get<SigningRequest>("/clients/review-documents/", { params: { token } })
      setRequest(data)
    } catch {
      setError("This signing link is invalid or is no longer available.")
    }
  }
  useEffect(() => { if (token) load() }, [token])

  async function submit(electronicallySigned: boolean) {
    setBusy(true); setError("")
    try {
      const data = new FormData()
      data.append("token", token)
      if (electronicallySigned) {
        if (!signatureName.trim()) throw new Error("Type your full name to sign electronically.")
        data.append("signed_contract", "true")
        data.append("signed_inspection", "true")
        data.append("signature_name", signatureName.trim())
      } else {
        if (!contractFile || !inspectionFile) throw new Error("Please upload both signed documents.")
        data.append("signed_contract_file", contractFile)
        data.append("signed_inspection_file", inspectionFile)
      }
      const response = await axiosClient.post<SigningRequest>("/clients/document-signing/", data, { headers: { "Content-Type": undefined } })
      setRequest(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not submit your documents. Please try again.")
    } finally { setBusy(false) }
  }

  if (error && !request) return <main className="min-h-screen grid place-items-center p-6 bg-background text-foreground"><p className="text-sm text-red-500">{error}</p></main>
  if (!request) return <main className="min-h-screen grid place-items-center p-6 bg-background text-foreground"><p className="text-sm text-muted-foreground">Loading your documents…</p></main>

  const completed = request.is_complete
  return (
    <main className="relative min-h-screen bg-background text-foreground p-5 sm:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-9 shadow-sm">
        <p className="text-sm font-semibold text-teal">TrailerOps</p>
        <h1 className="mt-2 text-2xl font-bold">Review & sign documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">Hello {request.client_name}. {request.rental_number ? `These documents relate to rental ${request.rental_number}.` : "Please review both documents before signing."}</p>

        <div className="mt-6 space-y-3">
          <DocumentLink label="Rental Contract" url={request.contract_pdf} status={request.contract_status} />
          <DocumentLink label="Pre-Rental Inspection Report" url={request.inspection_pdf} status={request.inspection_status} />
        </div>

        {completed ? (
          <div className="mt-6 flex gap-3 rounded-lg bg-teal-light p-4 text-sm text-teal"><CheckCircle2 className="h-5 w-5 shrink-0" />Your documents have been received. The rental team will verify them before checkout.</div>
        ) : (
          <>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            <div className="mt-6 rounded-xl border border-border p-4">
              <h2 className="font-semibold">Electronic signature</h2>
              <p className="mt-1 text-sm text-muted-foreground">By signing, you confirm that you reviewed and accept both documents.</p>
              <label className="mt-3 block text-sm font-medium">Type your full legal name
                <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Full name" className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-teal" />
              </label>
              <button disabled={busy} onClick={() => submit(true)} className="mt-4 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{busy ? "Submitting…" : "Accept & Sign Both Documents"}</button>
            </div>
            <div className="mt-4 rounded-xl border border-border p-4">
              <h2 className="font-semibold">Sign offline and upload</h2>
              <p className="mt-1 text-sm text-muted-foreground">Download both PDFs, sign them, then upload the signed copies.</p>
              <input ref={contractInput} onChange={(e) => setContractFile(e.target.files?.[0] || null)} type="file" accept="application/pdf,image/*" className="hidden" />
              <input ref={inspectionInput} onChange={(e) => setInspectionFile(e.target.files?.[0] || null)} type="file" accept="application/pdf,image/*" className="hidden" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => contractInput.current?.click()} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-background"><Upload className="mr-1 inline h-4 w-4" />{contractFile?.name || "Upload signed contract"}</button>
                <button onClick={() => inspectionInput.current?.click()} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-background"><Upload className="mr-1 inline h-4 w-4" />{inspectionFile?.name || "Upload signed inspection"}</button>
                <button disabled={busy || !contractFile || !inspectionFile} onClick={() => submit(false)} className="rounded-lg bg-blue px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">Submit uploads</button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function DocumentLink({ label, url, status }: { label: string; url?: string | null; status: string }) {
  const href = url?.startsWith("http") ? url : url ? `${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api").replace(/\/api$/, "")}${url}` : undefined
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
    <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-teal" /><div><p className="font-medium">{label}</p><p className="text-xs capitalize text-muted-foreground">Status: {status}</p></div></div>
    {href && <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline"><Download className="h-4 w-4" />View PDF</a>}
  </div>
}
