from __future__ import annotations

import datetime
import uuid

import boto3
from botocore.client import Config
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Check S3/MinIO connectivity with a simple put/get/delete cycle."

    def handle(self, *args, **options):
        if not getattr(settings, "MINIO_ENABLED", False):
            self.stdout.write(self.style.WARNING("MINIO_ENABLED is false. Skipping check."))
            return

        endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
        access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
        secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
        region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")

        if not endpoint or not bucket or not access_key or not secret_key:
            self.stdout.write(self.style.ERROR("Missing S3 settings. Check MINIO_* environment variables."))
            return

        self.stdout.write(f"Endpoint: {endpoint}")
        self.stdout.write(f"Bucket: {bucket}")
        self.stdout.write(f"Region: {region}")

        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            verify=getattr(settings, "AWS_S3_VERIFY", True),
        )

        key = f"healthcheck/{datetime.date.today().isoformat()}-{uuid.uuid4().hex}.txt"
        payload = b"minio healthcheck"

        try:
            buckets = s3.list_buckets().get("Buckets", [])
            self.stdout.write(self.style.SUCCESS(f"Buckets: {[b['Name'] for b in buckets]}"))
            s3.head_bucket(Bucket=bucket)
            s3.put_object(Bucket=bucket, Key=key, Body=payload)
            obj = s3.get_object(Bucket=bucket, Key=key)
            body = obj["Body"].read()
            if body != payload:
                raise RuntimeError("Uploaded object content mismatch.")
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"MinIO check failed: {exc}"))
            return

        self.stdout.write(self.style.SUCCESS("MinIO check passed."))
