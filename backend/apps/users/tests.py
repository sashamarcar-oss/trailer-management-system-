from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model

from .serializers import LoginSerializer

User = get_user_model()


@override_settings(DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}})
class LoginSerializerTests(TestCase):
    def test_login_accepts_email_and_returns_user(self):
        user = User.objects.create_user(
            username="admin",
            email="admin@trailerops.co.ke",
            password="Password123!",
            first_name="System",
            last_name="Admin",
        )

        serializer = LoginSerializer(data={"email": "admin@trailerops.co.ke", "password": "Password123!"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["user"], user)
