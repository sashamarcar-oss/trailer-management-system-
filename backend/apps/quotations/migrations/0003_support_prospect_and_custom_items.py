import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("quotations", "0002_initial")]

    operations = [
        migrations.AlterField(model_name="quotation", name="client", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="quotations", to="clients.client")),
        migrations.AddField(model_name="quotation", name="client_name", field=models.CharField(blank=True, max_length=200)),
        migrations.AddField(model_name="quotation", name="client_email", field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="quotation", name="client_phone", field=models.CharField(blank=True, max_length=30)),
        migrations.AlterField(model_name="quotationitem", name="trailer", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="quotation_items", to="trailers.trailer")),
        migrations.AddField(model_name="quotationitem", name="description", field=models.CharField(blank=True, max_length=255)),
    ]
