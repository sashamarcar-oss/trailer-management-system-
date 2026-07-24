from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("clients", "0003_initial")]

    operations = [
        migrations.AlterField(model_name="client", name="address", field=models.CharField(blank=True, max_length=255)),
        migrations.AlterField(model_name="client", name="city", field=models.CharField(blank=True, max_length=100)),
    ]
