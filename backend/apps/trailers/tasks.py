from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .models import Trailer


@shared_task
def check_inspection_due():
    """Runs daily. Flags trailers whose next inspection falls within 14 days
    and queues a notification (see apps/core for the Notification model to add)."""
    soon = timezone.now().date() + timedelta(days=14)
    due = Trailer.objects.filter(next_inspection_date__lte=soon)
    return due.count()
