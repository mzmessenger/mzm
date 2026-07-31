# Production deployment

## Responsibility boundary

- The repository owner approves production cutovers, OAuth callback changes, and PR merges.
- Automation provisions repeatable infrastructure, deploys revisions, and records command-backed verification.
- Long-lived credentials must not be added to repository files, command arguments, or workflow logs.

## Google Cloud authentication

GitHub Actions uses Workload Identity Federation (WIF) with service-account impersonation. The provider only accepts GitHub OIDC tokens when all of the following are true:

- repository ID is `448959755` (`mzmessenger/mzm`)
- repository owner ID is `52990312` (`mzmessenger`)
- ref is `refs/heads/dev`
- event is `workflow_dispatch`
- workflow is one of the two Cloud Run deployment workflows

Repository and owner numeric IDs are used instead of names to avoid trusting a deleted and recreated organization or repository with the same name.

### One-time bootstrap

The existing `Build and Deploy mzm-backend` workflow has a temporary `bootstrap-wif` operation. It uses the existing `GCP_SA_KEY` secret exactly once to create or update:

- the `github-actions` workload identity pool
- the `mzm-repository` OIDC provider
- the `github-mzm-deploy` deployment service account
- the `mzm` Artifact Registry Docker repository in `asia-northeast1`
- the minimum impersonation, Artifact Registry, Cloud Run, and runtime service-account bindings required by the deployment workflows

Dispatch `Build and Deploy mzm-backend` from the `dev` branch with operation `bootstrap-wif`. The bootstrap is temporarily embedded in a workflow that already exists on the default branch because GitHub does not expose a newly added `workflow_dispatch` file until that file exists on the default branch. If it fails with `PERMISSION_DENIED`, grant the bootstrap principal only the permission reported by Google Cloud and retry; do not broaden the runtime WIF principal condition.

The workflow prints four non-secret values. Store them as GitHub repository variables:

```sh
gh variable set GCP_PROJECT_ID --repo mzmessenger/mzm --body '<project-id>'
gh variable set GCP_WIF_PROVIDER --repo mzmessenger/mzm --body 'projects/<number>/locations/global/workloadIdentityPools/github-actions/providers/mzm-repository'
gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo mzmessenger/mzm --body 'github-mzm-deploy@<project-id>.iam.gserviceaccount.com'
gh variable set GCP_ARTIFACT_REGISTRY --repo mzmessenger/mzm --body 'asia-northeast1-docker.pkg.dev/<project-id>/mzm'
```

### Migration completion

1. Dispatch one Cloud Run deployment workflow from `dev` and confirm its `Authenticate to Google Cloud with WIF` step succeeds.
2. Confirm the deployed revision and service URL before changing production traffic.
3. Remove the legacy key from GitHub:

```sh
gh secret delete GCP_SA_KEY --repo mzmessenger/mzm
```

4. Disable or delete the corresponding Google Cloud service-account key.
5. Remove the `bootstrap-wif` input and job from `.github/workflows/deploy-cloudrun-backend.yml` after migration so the key-based path cannot be reused.

Do not delete `GCP_SA_KEY` before a real WIF token exchange succeeds. Do not deploy the new application revisions until required production environment variables and secrets are present.

## Cloudflare authentication

Cloudflare commands run through `hermes-secret-run` with the token read from 1Password. The token value must never be copied into repository files or process arguments. Read-only verification:

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler whoami
```

The following production resources were created and read back before any Worker or public route was deployed:

- Queue `mzm-events`
- Queue `mzm-events-dlq`
- R2 bucket `mzm-events-dlq-archive`

At creation time both Queues had zero producers and zero consumers, so they did not affect application traffic. The `mzm-event-gateway` and `mzm-queue-worker` scripts still did not exist.

Verification commands:

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler queues list
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler r2 bucket list
```
