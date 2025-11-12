# models.py
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


class DatasetAnalysis(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    dataset_file = models.FileField(upload_to='datasets/')

    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # ---------- ANALYSIS RESULTS ----------
    quality_score = models.FloatField(default=0.0)
    anomaly_count = models.IntegerField(default=0)
    bias_score = models.FloatField(default=100.0)

    critical_anomalies = models.IntegerField(default=0)
    moderate_anomalies = models.IntegerField(default=0)
    anomaly_examples = models.JSONField(default=list)

    validity_score = models.FloatField(null=True, blank=True)
    validity_issues = models.IntegerField(default=0)
    missing_values_pct = models.FloatField(default=0.0)
    duplicate_count = models.IntegerField(default=0)

    rows_count = models.IntegerField(default=0)
    columns_count = models.IntegerField(default=0)
    dataset_size = models.CharField(max_length=100, blank=True, default='')

    error_message = models.TextField(blank=True)
    processing_time = models.CharField(max_length=20, blank=True)

    # ---------- FILECOIN ----------
    dataset_cid = models.CharField(max_length=100, blank=True)
    analysis_cid = models.CharField(max_length=100, blank=True)
    verification_url = models.URLField(blank=True)

    # ---------- JSON BUNDLES ----------
    full_analysis = models.JSONField(default=dict)
    key_insights = models.JSONField(default=dict, blank=True)
    visualization_data = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Analysis #{self.id} - {self.status}"