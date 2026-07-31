#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?PROJECT_ID is required}"

REGION="${REGION:-asia-northeast1}"
POOL_ID="${POOL_ID:-github-actions}"
PROVIDER_ID="${PROVIDER_ID:-mzm-repository}"
DEPLOY_SERVICE_ACCOUNT_ID="${DEPLOY_SERVICE_ACCOUNT_ID:-github-mzm-deploy}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-mzm}"
GITHUB_REPOSITORY_ID="448959755"
GITHUB_REPOSITORY_OWNER_ID="52990312"
GITHUB_REPOSITORY="mzmessenger/mzm"
DEPLOY_WORKFLOW_REFS="assertion.workflow_ref == '${GITHUB_REPOSITORY}/.github/workflows/deploy-cloudrun-backend.yml@refs/heads/dev' || assertion.workflow_ref == '${GITHUB_REPOSITORY}/.github/workflows/deploy-cloudrun-auth.yml@refs/heads/dev'"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
DEPLOY_SERVICE_ACCOUNT="${DEPLOY_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_ID}"
ARTIFACT_REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}"

required_services=(
  artifactregistry.googleapis.com
  iamcredentials.googleapis.com
  run.googleapis.com
  sts.googleapis.com
)
for service in "${required_services[@]}"; do
  if gcloud services list \
    --enabled \
    --project="${PROJECT_ID}" \
    --filter="config.name=${service}" \
    --format='value(config.name)' | grep -Fxq "${service}"; then
    continue
  fi
  gcloud services enable "${service}" --project="${PROJECT_ID}"
done

if ! gcloud iam service-accounts describe "${DEPLOY_SERVICE_ACCOUNT}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${DEPLOY_SERVICE_ACCOUNT_ID}" \
    --project="${PROJECT_ID}" \
    --display-name="GitHub Actions MZM deploy"
fi

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="MZM production container images"
fi

if ! gcloud iam workload-identity-pools describe "${POOL_ID}" --location=global --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --location=global \
    --project="${PROJECT_ID}" \
    --display-name="GitHub Actions"
fi

ATTRIBUTE_MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.event_name=assertion.event_name,attribute.workflow_ref=assertion.workflow_ref"
ATTRIBUTE_CONDITION="assertion.repository_id == '${GITHUB_REPOSITORY_ID}' && assertion.repository_owner_id == '${GITHUB_REPOSITORY_OWNER_ID}' && assertion.ref == 'refs/heads/dev' && assertion.event_name == 'workflow_dispatch' && (${DEPLOY_WORKFLOW_REFS})"

if gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" --workload-identity-pool="${POOL_ID}" --location=global --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "${PROVIDER_ID}" \
    --workload-identity-pool="${POOL_ID}" \
    --location=global \
    --project="${PROJECT_ID}" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${ATTRIBUTE_MAPPING}" \
    --attribute-condition="${ATTRIBUTE_CONDITION}"
else
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --workload-identity-pool="${POOL_ID}" \
    --location=global \
    --project="${PROJECT_ID}" \
    --display-name="mzmessenger/mzm deploy workflows" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${ATTRIBUTE_MAPPING}" \
    --attribute-condition="${ATTRIBUTE_CONDITION}"
fi

WIF_PRINCIPAL="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${WIF_PRINCIPAL}" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --role="roles/run.admin" \
  --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT}" \
  --condition=None >/dev/null

gcloud artifacts repositories add-iam-policy-binding "${ARTIFACT_REPOSITORY}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --role="roles/artifactregistry.writer" \
  --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT}" \
  --condition=None >/dev/null

runtime_accounts=()
for service in mzm-backend mzm-auth; do
  runtime_account="$(gcloud run services describe "${service}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -z "${runtime_account}" ]]; then
    runtime_account="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  fi
  if [[ ! " ${runtime_accounts[*]-} " =~ " ${runtime_account} " ]]; then
    runtime_accounts+=("${runtime_account}")
    gcloud iam service-accounts add-iam-policy-binding "${runtime_account}" \
      --project="${PROJECT_ID}" \
      --role="roles/iam.serviceAccountUser" \
      --member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT}" \
      --condition=None >/dev/null
  fi
done

printf '%s\n' \
  "GCP_PROJECT_ID=${PROJECT_ID}" \
  "GCP_WIF_PROVIDER=${PROVIDER_RESOURCE}" \
  "GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SERVICE_ACCOUNT}" \
  "GCP_ARTIFACT_REGISTRY=${ARTIFACT_REGISTRY}"
