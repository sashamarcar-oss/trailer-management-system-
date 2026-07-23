from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .models import Trailer


@shared_task
def check_insurance_and_license_expiry():
    """Runs daily. Flags trailers whose insurance or license expires within 14 days
    and queues a notification (see apps/core for the Notification model to add)."""
    soon = timezone.now().date() + timedelta(days=14)
    expiring = Trailer.objects.filter(insurance_expiry__lte=soon) | Trailer.objects.filter(license_expiry__lte=soon)
    return expiring.count()
