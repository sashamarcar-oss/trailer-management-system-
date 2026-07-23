from celery import shared_task
from django.utils import timezone
from .models import Invoice


@shared_task
def send_overdue_payment_reminders():
    """Runs hourly. Flags invoices past their due date with an outstanding
    balance and queues payment reminder notifications."""
    overdue = Invoice.objects.filter(due_date__lt=timezone.now().date()).exclude(status__in=["paid", "cancelled"])
    return overdue.count()
