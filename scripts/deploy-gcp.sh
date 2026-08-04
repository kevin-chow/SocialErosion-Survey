#!/usr/bin/env bash
# Deploy the survey app to Cloud Run and attach a Cloud SQL instance.
#
# Required env vars:
#   GCP_PROJECT          — GCP project id
#   GCP_REGION           — e.g. us-east1
#   CLOUD_SQL_INSTANCE   — instance name only (not connection name)
#   DATABASE_URL         — postgres URL; for Cloud Run use Unix socket form:
#     postgresql://USER:PASSWORD@/vignette_survey?host=/cloudsql/PROJECT:REGION:INSTANCE
#
# Optional:
#   ARTIFACT_REPO=vignette-survey
#   SERVICE_NAME=vignette-survey

set -euo pipefail

: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${CLOUD_SQL_INSTANCE:?Set CLOUD_SQL_INSTANCE}"
: "${DATABASE_URL:?Set DATABASE_URL}"

ARTIFACT_REPO="${ARTIFACT_REPO:-vignette-survey}"
SERVICE_NAME="${SERVICE_NAME:-vignette-survey}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${ARTIFACT_REPO}/${SERVICE_NAME}:$(git rev-parse --short HEAD)"
CONNECTION_NAME="${GCP_PROJECT}:${GCP_REGION}:${CLOUD_SQL_INSTANCE}"

gcloud config set project "${GCP_PROJECT}"

gcloud artifacts repositories describe "${ARTIFACT_REPO}" \
  --location="${GCP_REGION}" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "${ARTIFACT_REPO}" \
       --repository-format=docker \
       --location="${GCP_REGION}" \
       --description="Vignette survey container images"

gcloud builds submit --tag "${IMAGE}" .

gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${GCP_REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --add-cloudsql-instances="${CONNECTION_NAME}" \
  --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
  --max-instances=10

gcloud run services describe "${SERVICE_NAME}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)'
