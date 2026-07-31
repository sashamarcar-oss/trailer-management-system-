from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

User = get_user_model()


@shared_task
def send_password_reset_email(user_id, uid, token):
    """Emails a password reset link to the user. The uid/token pair is validated
    by ResetPasswordView; the link points at the frontend reset page."""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
    subject = "Reset your TrailerOps password"
    message = (
        f"Hello {user.first_name or user.username},\n\n"
        "We received a request to reset your TrailerOps password. "
        "Use the link below to choose a new one:\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— TrailerOps"
    )

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
