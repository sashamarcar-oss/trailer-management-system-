import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("invoices", "0002_initial"), ("trailers", "0002_initial")]

    operations = [
        migrations.AlterField(model_name="invoice", name="client", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="invoices", to="clients.client")),
        migrations.AddField(model_name="invoice", name="client_name", field=models.CharField(blank=True, max_length=200)),
        migrations.AddField(model_name="invoice", name="client_email", field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="invoice", name="client_phone", field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name="invoice", name="notes", field=models.TextField(blank=True)),
        migrations.AddField(model_name="invoice", name="terms", field=models.TextField(blank=True)),
        migrations.AddField(model_name="invoiceitem", name="trailer", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="invoice_items", to="trailers.trailer")),
    ]
