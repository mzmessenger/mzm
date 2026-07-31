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

### One-time bootstrap (completed 2026-07-31)

The bootstrap was executed once from an exact reviewed commit with the owner account, then the temporary path was removed. It created or updated:

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

### Migration completion status

The real GitHub OIDC exchange, service-account impersonation, Artifact Registry push, and Cloud Run deployments have completed. The legacy GitHub secret and temporary bootstrap path were removed. The deployed services are:

- backend revision `mzm-backend-00056-x8s`, traffic 100%
- auth revision `mzm-auth-00077-wzn`, traffic 100%

The remaining credential cleanup is to list and disable/delete the corresponding Google Cloud service-account key with an owner account. Deleting the GitHub secret alone does not revoke the key at Google Cloud.

Historical cleanup command for the now-removed GitHub secret:

```sh
gh secret delete GCP_SA_KEY --repo mzmessenger/mzm
```

Do not deploy another application revision unless required production environment variables and secrets are present.

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

Both Queues currently have zero producers and zero consumers. The `mzm-event-gateway` and `mzm-queue-worker` scripts have not been deployed, so the public API route has not been cut over.

Verification commands:

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler queues list
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler r2 bucket list
```

### Worker cutover gate

The production Wrangler configuration contains the verified Cloud Run origins. Before any Worker deployment, all of the following are required:

1. Create a Cloudflare Access application for the queue Worker's `/internal/dlq/replay` endpoint and record its audience.
2. Configure `CF_ACCESS_AUD` and `QUEUE_CALLBACK_SECRET` for `mzm-queue-worker` as Worker secrets.
3. Configure `GATEWAY_ORIGIN_SECRET` for `mzm-event-gateway` as a Worker secret.
4. Confirm the two shared secret values match the corresponding Cloud Run environment variables without printing either value.
5. Deploy and verify `mzm-queue-worker` first. Its Queue consumer bindings may become active, but no event producer exists yet.
6. Obtain repository-owner approval for the public cutover.
7. Deploy `mzm-event-gateway`, which installs routes for `api.mzm.dev/*` and `auth.mzm.dev/*` and begins intercepting production traffic.
8. Verify OAuth redirects/cookies, CORS preflight, SSE streaming, one idempotent mutation, Queue delivery, and an empty outbox/DLQ state.

Do not deploy the gateway merely to discover missing configuration: its route declaration is the production traffic cutover.
