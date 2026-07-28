import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("quotations", "0004_add_converted_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuotationResponseToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("action", models.CharField(choices=[("accept", "Accept"), ("reject", "Reject")], max_length=10)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "quotation",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="response_tokens",
                        to="quotations.quotation",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["token"], name="quotation_response_token_idx"),
                    models.Index(fields=["quotation", "action"], name="quotation_response_quotation_action_idx"),
                ]
            },
        ),
    ]
