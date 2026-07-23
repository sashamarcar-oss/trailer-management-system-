# TrailerOps — Backend

Django 5 + Django REST Framework backend for the Trailer Rental Management System.
JWT authentication, RBAC, Celery background jobs, and a REST API for every module.

## Stack
- Django 5, Django REST Framework, PostgreSQL
- SimpleJWT (access + refresh tokens)
- django-filter (filtering/search/ordering on every list endpoint)
- Celery + Redis (reminders, expiry checks, scheduled jobs)
- drf-spectacular (OpenAPI schema + Swagger UI at `/api/docs/`)

## Getting started

```bash
python -m venv venv
source venv/bin/activate          # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env               # fill in DB / Redis / email credentials
createdb trailerops                # or let Postgres create it for you

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API root: http://localhost:8000/api/
Swagger docs: http://localhost:8000/api/docs/
Admin: http://localhost:8000/admin/

### Background jobs (optional but recommended)

```bash
celery -A config worker -l info
celery -A config beat -l info
```

Scheduled jobs (see `config/celery.py`):
- `send_upcoming_return_reminders` — hourly, flags rentals due back within 24h
- `send_overdue_payment_reminders` — hourly, flags invoices past due with a balance
- `check_insurance_and_license_expiry` — daily, flags trailers expiring within 14 days

These tasks currently return counts as a scaffold — wire them to a
`Notification` model + email/SMS backend to actually send reminders.

## App structure

```
apps/
  users/        Custom User, Role, Permission (RBAC), JWT auth endpoints
  core/         Branch, CompanySettings, AuditLog (+ audit logging middleware)
  clients/      Client, ClientDocument, ClientNote
  trailers/     Trailer, TrailerImage, TrailerDocument, MaintenanceRecord, DamageReport
  rentals/      Rental (with booking-conflict validation), RentalInspection
  quotations/   Quotation, QuotationItem (+ convert-to-rental action)
  invoices/     Invoice, InvoiceItem, Payment
  expenses/     Expense, ExpenseCategory, Vendor
```

## Roles (`apps/users/models.py::Role`)
`super_admin`, `administrator`, `accountant`, `operations_officer` — matching
the spec's four system roles. Fine-grained module permissions (e.g.
`manage_trailers`, `create_quotations`) live on the `Permission` model and are
attached to roles; check `User.has_permission(codename)` or the
`HasModulePermission` DRF permission class to gate a view by permission
rather than by role name.

## Auth endpoints (`/api/auth/`)
- `POST /login/` — returns `{ access, refresh, user }`
- `POST /refresh/` — refresh an access token
- `GET  /me/` — current user profile
- `POST /change-password/`
- `POST /forgot-password/` — issues a reset token (wire to email sending)
- `POST /reset-password/`

## What's scaffolded vs. what's a next step
Implemented: models, serializers, filtered/searchable/ordered ViewSets, RBAC
permission classes, JWT auth flow, audit logging middleware, rental
double-booking prevention, quotation → rental conversion stub, Celery task
scaffolding for reminders.

Next steps for a production rollout: PDF generation for invoices/quotations
(reportlab is in requirements.txt), QR code generation for trailers (qrcode
is included), actual email/SMS sending in the Celery tasks, and a
`Notification` model to back the frontend's notification bell.

## Validated
This scaffold has been verified end-to-end: `manage.py check`,
`makemigrations`, `migrate`, and a dev-server boot all pass cleanly against
every app (users, core, clients, trailers, rentals, quotations, invoices,
expenses) with real cross-app foreign keys resolved.
