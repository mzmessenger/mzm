# 本番デプロイ

## 責任境界

- 本番cutover、OAuth callback変更、PR mergeはrepository ownerが承認する。
- 通常deployは既存resourceと既存secret参照を再利用し、bootstrapやIAM変更を行わない。
- 長期credentialやsecret値をrepository、command引数、workflow logへ出さない。
- secretの正本は1Passwordとし、GitHub Actions Secretsを恒久的な中継storeとして使わない。

## Google Cloud

### 認証

GitHub Actionsはservice-account JSON keyではなく、GitHub OIDCとWorkload Identity Federation（WIF）で`github-mzm-deploy@mzmessenger.iam.gserviceaccount.com`をimpersonateする。

WIF providerは次のclaimへ限定する。

- repository ID: `448959755`（`mzmessenger/mzm`）
- repository owner ID: `52990312`（`mzmessenger`）
- ref: `refs/heads/dev`
- event: `workflow_dispatch`
- workflow: backend/authのCloud Run deploy workflow

Repository Variables:

- `GCP_PROJECT_ID`
- `GCP_WIF_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY`

WIF、deploy service account、Artifact Registry、Cloud Run services、runtime IAMは構築済みである。一回限りのbootstrap scriptとworkflow operationは残さない。再構築が必要になった場合は、現在のresourceとIAMをread-backしてから別の明示的な復旧手順として実施する。

### Cloud Run deploy

backend:

```sh
gh workflow run deploy-cloudrun-backend.yml \
  --repo mzmessenger/mzm \
  --ref dev
```

auth:

```sh
gh workflow run deploy-cloudrun-auth.yml \
  --repo mzmessenger/mzm \
  --ref dev
```

各workflowはWIF認証、container build、entrypoint/runtime検証、Artifact Registry push、Cloud Run deployを行う。deploy後はworkflow run、Cloud Run Ready revision、traffic、公開endpointをread-backする。

### Internal secrets

Cloud Runは次のSecret Manager resourceを`latest`で参照する。

- `mzm-gateway-origin-secret` → `GATEWAY_ORIGIN_SECRET`
- `mzm-queue-callback-secret` → `QUEUE_CALLBACK_SECRET`

runtime service accountには対象secret単位の`roles/secretmanager.secretAccessor`だけを付与する。通常deploy workflowはsecret resource作成、version追加、IAM変更、Cloud Run secret binding変更を行わない。

rotationは通常deployと分離し、次の順で明示的に実施する。

1. 1Password上の正本を更新する。
2. 既存Secret Manager resourceへ新versionを追加する。
3. Cloudflare Worker側の対応するsecretを更新する。
4. Cloud Runの新revisionを作成し、Readyとsecret参照を確認する。
5. internal callbackとgatewayのpositive/negative probeを行う。
6. rollback期間後に旧versionを無効化する。

secret resourceの新規作成やIAM復旧が必要な場合はrotationとして扱わず、owner/admin identityによる復旧作業として分離する。deploy service accountへ`roles/secretmanager.admin`を恒久付与しない。

## Cloudflare

### 認証

Cloudflare操作は1Passwordからcredentialを注入する`hermes-secret-run`経由で実行する。token値をrepository fileやcommand引数へ展開しない。

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler whoami
```

### 本番resource

- Event Gateway Worker: `mzm-event-gateway`
- Queue Worker: `mzm-queue-worker`
- Queue Worker custom domain: `queue.mzm.dev`
- Queue: `mzm-events`
- DLQ: `mzm-events-dlq`
- R2 archive: `mzm-events-dlq-archive`
- public routes: `api.mzm.dev/*`、`auth.mzm.dev/*`
- Access-protected endpoint: `queue.mzm.dev/internal/dlq/replay`

`mzm-queue-worker`は`workers_dev: false`とし、`workers.dev`を公開経路として使わない。

### Worker deploy順序

1. Queue WorkerのQueue/DLQ/R2 bindings、Worker secrets、Access application/policiesをread-backする。
2. Queue Workerを先にdeployし、service token付き空replay requestと未認証拒否を確認する。
3. Event GatewayのCloud Run origins、Queue producer binding、Worker secretをread-backする。
4. repository-owner承認後にEvent Gatewayをdeployする。
5. OAuth、CORS、SSE、idempotent mutation、Queue delivery、backlog、DLQを確認する。

Event Gateway deployは`api.mzm.dev/*`と`auth.mzm.dev/*`のproduction trafficへ直接影響する。設定不足を発見する目的でdeployしない。

### 検証

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler queues list

hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npx wrangler r2 bucket list
```

Queue WorkerのAccess確認では、次をすべて確認する。

- protected-resource metadataが対象pathを保護済みと返す。
- 既存service token付きの空replay requestがAccessとWorker内JWT検証を通る。
- 未認証requestがAccessで拒否される。
- 旧`workers.dev` endpointが利用できない。

Access applicationやcustom domainの変更直後は伝播待ちが発生し得るため、単発probeではなくread-backと再probeで最終状態を確認する。
