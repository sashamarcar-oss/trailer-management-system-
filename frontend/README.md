# TrailerOps — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS + ShadCN-style components frontend
for the Trailer Rental Management System.

## Stack
- Next.js 14 (App Router), TypeScript
- Tailwind CSS + Radix primitives (ShadCN-style components in `components/ui`)
- React Hook Form + Zod for validated forms
- TanStack Query for server state, Axios for HTTP
- Recharts for dashboard charts
- Sonner for toast notifications

## Getting started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL to your Django API
npm run dev
```

App runs at http://localhost:3000 and redirects to `/dashboard`.

## Structure

```
app/
  (dashboard)/        route group with shared sidebar + topbar layout
    dashboard/         KPIs, charts, activity feed
    trailers/          fleet table + "Add trailer" form
    clients/           client table + "Add client" form
    rentals/           rental lifecycle table
    quotations/        quotation table
    invoices/          invoice table
    expenses/          expense table + "Record expense" form
    reports/           report export list
  login/               JWT login page
components/
  layout/              Sidebar, Topbar
  ui/                  Button, Input, Dialog, Select, Badge, Card (ShadCN-style)
  modules/             Feature-specific forms (trailer-form, client-form, expense-form)
lib/
  api.ts               Axios instance with JWT interceptor + refresh
  validations/         Zod schemas per module
  mock-data.ts         In-memory demo data (used until the API is wired up)
types/                 Shared TypeScript types
```

## Forms

`Add trailer`, `Add client`, and `Record expense` each open a validated dialog form
(React Hook Form + Zod) and, on submit:
1. attempt `POST` to the Django API (`/api/trailers/`, `/api/clients/`, `/api/expenses/`),
2. optimistically update the on-screen table regardless, so the UI works standalone
   even before the backend is running.

Wire these to `@tanstack/react-query` mutations once the backend is live for
proper cache invalidation, loading and error states.

## Notes
- Auth is JWT-based; `lib/api.ts` auto-attaches the access token and refreshes
  on 401 using the refresh token in `localStorage`.
- Theme is teal-blue and white, with a dark mode toggle in the topbar
  (CSS variables in `app/globals.css`).
- Tables here are intentionally lightweight; swap in `@tanstack/react-table`
  for sorting, pagination, and column visibility as the next step.
