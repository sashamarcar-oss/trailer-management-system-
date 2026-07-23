import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("trailerops")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "send-return-reminders": {
        "task": "apps.rentals.tasks.send_upcoming_return_reminders",
        "schedule": 3600.0,
    },
    "send-payment-reminders": {
        "task": "apps.invoices.tasks.send_overdue_payment_reminders",
        "schedule": 3600.0,
    },
    "check-document-expiry": {
        "task": "apps.trailers.tasks.check_insurance_and_license_expiry",
        "schedule": 86400.0,
    },
}
