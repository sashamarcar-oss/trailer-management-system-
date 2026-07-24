from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("quotations", "0003_support_prospect_and_custom_items")]

    operations = [
        migrations.AlterField(
            model_name="quotation",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"), ("pending", "Pending"), ("accepted", "Accepted"),
                    ("converted", "Converted"), ("rejected", "Rejected"), ("expired", "Expired"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
    ]
