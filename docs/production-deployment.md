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
- ref: 任意のbranch（tagは不可）
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
  --ref <deploy-branch>
```

auth:

```sh
gh workflow run deploy-cloudrun-auth.yml \
  --repo mzmessenger/mzm \
  --ref <deploy-branch>
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

### 認証と責任境界

Cloud RunのGitHub Actions＋WIFは継続する。廃止するのはCloudflare Worker deploy用のGitHub Actions credentialだけである。

local direct deployで使用する既存API tokenは、account `789787f7b7b778b108bb8ad86350db9d`のWrangler upload/promoteに必要な最小権限を持つものを1Passwordから一時注入する。token値をrepository、GitHub Actions、Build variable、command引数、logへ出さない。新規token発行やrotationは行わない。

Workers Buildsの設定変更・trigger停止が必要な場合はCloudflare ownerの別operationとして扱い、manual deploy tokenへWorkers Builds Configuration権限を追加しない。

read-only調査や復旧時の対話操作は、1Passwordからcredentialを注入する`hermes-secret-run`経由で実行する。

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/event-gateway-worker -- wrangler whoami
```

### local manual deploy

Cloudflare Workersの通常releaseはWorkers Buildsを経由せず、operatorがlocal worktreeからVersions APIを使って明示的に実行する。GitHub Actions、server常駐token、Deploy Hook、Workers Builds API manual triggerは通常経路に使用しない。

実装と運用手順の正本は以下である。

- script: `scripts/deploy-workers-manual.sh`
- test: `scripts/deploy-workers-manual.test.mjs`
- spec: `docs/spec/local-manual-worker-deploy.md`
- Queue → Event Gatewayの順でuploadし、Queue promote/probe後にGatewayをpromoteする
- uploadは`wrangler versions upload`、promotionは`wrangler versions deploy`へ固定する

production deployは、対象branchと40文字SHAを明示し、1Passwordからlocal実行時だけtokenを注入する。

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-workers-builds-deploy.env \
  --workdir ~/dev/mzm/.worktree/dev \
  -- npm run deploy:workers-manual -- \
    --branch main \
    --commit <40-character-commit-sha>
```

secretなしの検証は次で実行できる。これはtoken検証前に停止するためCloudflare mutationを行わない。

```sh
npm run deploy:workers-manual -- \
  --branch main \
  --commit <40-character-commit-sha> \
  --dry-run
```

scriptは次をfail-closedで検証する。

- approved Account IDとtokenの存在
- detached HEADでないこと
- `git status --porcelain --untracked-files=all`が空であること
- current branch、local HEAD、`origin/<branch>` headが指定SHAと一致すること
- Queue/Gateway Wrangler configのowner-approved SHA-256
- production active Versionが各Workerで1件かつ100%であること
- Queue probe、Gateway/Auth/API probe、通常およびpercent-encoded `/internal`拒否probe

probe失敗やpartial failureでは直前Versionへrollbackする。rollback自体に失敗した場合は自動で成功扱いにせず、Version IDを出力して手動復旧を要求する。

### Workers Builds停止の責任境界

repositoryのscript/package変更だけでは、Cloudflare側のWorkers Builds push trigger停止は完了しない。manual direct deployの実装・検証後、Cloudflare ownerがDashboardまたは適切な既存管理経路でproduction/non-production triggerを停止し、read-backを取得する。Deploy Hookは作成しない。停止前にmanual pathをproductionへ実施してはならない。

### 認証

read-only調査とmanual deployは、1Passwordからcredentialを一時注入する`hermes-secret-run`経由で実行する。token値をrepository、GitHub Actions、Build variable、command引数、logへ出さない。新規tokenの発行・rotationは行わず、既存tokenの権限変更が必要な場合は実行前に別途確認する。



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

production deployはpushではなく、operatorが`--branch`と`--commit`を明示してlocal manual scriptをkickした場合だけ実行する。scriptはclean worktree、local HEAD、`origin/<branch>` head、config hash、Account ID、production active Versionをfail-closedに検証する。

`scripts/deploy-workers-manual.sh`は次を実行する。

1. Queue/GatewayのVersionを両方uploadする。片方でも失敗すればproduction trafficを変更しない。
2. target branch/SHAを再照合する。
3. Queueを100%へpromoteし、`queue.mzm.dev/internal/dlq/replay`の未認証GETがAccess HTTP 302となることを確認する。
4. Event Gatewayを100%へpromoteする。
5. `auth.mzm.dev/`のHTTP 200、`api.mzm.dev/`とraw/encoded `/internal`候補のHTTP 404を確認する。

Queue→Gatewayの順を固定する。Queue event envelopeとcallback contractはn−1互換を維持し、混在期間を許容できない変更はこのpipelineで直接deployしない。head照合後からpromoteまでのraceは残るため、promotion直前にもtargetを再検証する。

`mzm-queue-worker`と`mzm-event-gateway`は`workers_dev: false`、`preview_urls: false`とし、`workers.dev`やversion preview URLを公開経路として使わない。通常deployはroute、custom domain、Queue consumer、Queue/R2 resource、secretを変更しない。

### 検証

local gate:

```sh
npm ci --ignore-scripts
npm run verify:workers-manual
npm run deploy:workers-manual -- --branch <branch> --commit <40-character-commit-sha> --dry-run
```

resourceとVersion履歴のread-backは、1Password経由のread-only credentialで行う。

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/queue-worker -- wrangler queues list

hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/queue-worker -- wrangler r2 bucket list

hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/queue-worker -- wrangler versions list

hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/event-gateway-worker -- wrangler versions list
```

manual direct deployのVersion tag/messageと、Queue→Gatewayの実行順を突合する。`workers.dev`とversion preview URLが無効であること、Queue/DLQ/R2 bindings、Queue consumers、public routes、custom domain、secret名が切替前後で維持されていることをAPI/Dashboardでread-backする。secret値は表示しない。

自動deployは副作用のないprobeだけを行う。service token付きDLQ replayはcallback処理を起こし得るため、自動deployでは実行しない。運用者がreplayを実行する場合は別の明示的なoperationとしてbacklog/DLQ件数とcallback結果を確認する。

Access applicationやcustom domainの変更直後は伝播待ちが発生し得るため、単発probeではなくread-backと再probeで最終状態を確認する。

### Rollback

1. 自動deployはpromotion前に両Workerの100% active Version IDをread-backする。split deploymentや不正なVersion IDならproduction trafficを変更せず停止する。
2. Queue probe失敗、Gateway promote直前のstale branch検出、Gateway promote失敗では、GatewayをpromoteせずQueueを直前Versionへ自動rollbackする。
3. Gateway probe失敗ではGatewayを先に、Queueを後に直前Versionへ自動rollbackする。
4. 自動rollbackが失敗した場合、または手動rollbackが必要な場合は対象Versionをread-backし、次の非破壊dry-runを行う。

```sh
npm exec -w packages/event-gateway-worker -- wrangler versions deploy \
  --version-id <gateway-version-id> --percentage 100 --dry-run --yes
npm exec -w packages/queue-worker -- wrangler versions deploy \
  --version-id <queue-version-id> --percentage 100 --dry-run --yes
```

実rollbackは`--dry-run`を外し、`--message "rollback reason=<reason> source-commit=<commit-sha>"`を付ける。timestamp、branch、commit SHA、両Workerの変更前後Version ID、理由、operatorを`koh110/memo#1`へ記録する。
