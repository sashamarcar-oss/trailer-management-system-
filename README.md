<<<<<<< HEAD
# TrailerOps — Trailer Rental Management System

An enterprise-grade trailer rental, fleet, and finance management platform.
Teal-blue and white ERP theme throughout.

```
trailer-erp/
  frontend/   Next.js 14 (App Router) + TypeScript + Tailwind + ShadCN-style UI
  backend/    Django 5 + DRF + PostgreSQL + JWT + Celery
```

## Quick start

**Backend** (see `backend/README.md` for full details):
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set your Postgres/Redis credentials
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Frontend** (see `frontend/README.md` for full details):
```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
npm run dev
```

Open http://localhost:3000 — it redirects to `/dashboard`.

## What's working right now

- **Dashboard** — 11 KPI cards, revenue/expense trend, expense breakdown,
  trailer utilization, recent activity
- **Trailers** — fleet table + **"Add trailer"** dialog form (full spec fields:
  type, VIN, brand/model/year, capacity, status, yard, inspection/insurance dates)
- **Clients** — client table + **"Add client"** dialog form, with fields that
  adapt to Individual vs. Company (KRA PIN + business registration for
  companies; National ID/Passport for individuals), credit limit, payment terms
- **Expenses** — expense table + **"Record expense"** dialog form (category,
  vendor, amount, payment method, trailer/branch linkage)
- **Rentals, Quotations, Invoices, Reports** — lighter table views, ready to
  extend with their own forms the same way
- Dark/light mode toggle, collapsible sidebar, JWT-aware API client with
  automatic token refresh

Every "Add ___" / "Record ___" form is built with React Hook Form + Zod and
talks to `lib/api.ts`'s typed resource layer (`api.trailers`, `api.clients`,
`api.expenses`, ...). If the Django API isn't running, the same code
transparently falls back to in-memory mock data — so the UI is fully usable
standalone, and switches to live data the moment the backend is up with no
frontend code changes required.

## Verified before packaging
- Frontend: `tsc --noEmit` and `next build` both pass cleanly.
- Backend: `manage.py check`, `makemigrations`, `migrate`, and a dev-server
  boot all pass cleanly across all 8 Django apps with real relations resolved.

## Known gaps / next steps
- PDF generation (invoices, quotations, inspection reports) — `reportlab` is
  already in `requirements.txt`, not yet wired to an endpoint.
- QR code generation for trailers — `qrcode` is in `requirements.txt`, model
  field (`qr_code_uid`) exists, generation endpoint not yet built.
- Actual email/SMS sending for reminders — Celery tasks are scaffolded with
  the pieces (email backend config placeholders exist, tasks return counts only).
- File uploads (trailer images/documents, client documents, receipts) — model
  fields exist; frontend upload UI not yet built.
- Multi-branch switching UI, digital signature capture, barcode/QR scanning.
=======
# trailer-management-system-
A comprehensive fleet management and trailer operations ERP system for managing trailers, clients, rentals, quotations, invoices, expenses, and reports.
>>>>>>> 35011ac8b8e26f75e0759edf5f37aefc8a8ad7f1
