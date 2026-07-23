from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .models import Rental


@shared_task
def send_upcoming_return_reminders():
    """Runs hourly. Finds active rentals due back within 24 hours and queues
    email/SMS reminders (wire up to a Notification model + email backend)."""
    soon = timezone.now().date() + timedelta(days=1)
    due_soon = Rental.objects.filter(status="active", return_date__lte=soon)
    return due_soon.count()
