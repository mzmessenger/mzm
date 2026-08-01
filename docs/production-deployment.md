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

通常のWorker code deployはCloudflare Workers BuildsのGitHub App connectionを使う。GitHub App installation `40083580`（`cloudflare-workers-and-pages`、selected repositories）では`mzmessenger/mzm`だけを許可し、別repositoryを追加しない。Build projectには、account `789787f7b7b778b108bb8ad86350db9d`に対する`Workers Scripts: Edit`だけを持つ専用User API tokenを選択し、既定生成tokenを使わない。token値をrepository、GitHub Actions、Build variable、command引数、logへ出さない。

この権限はWorker名単位に限定できない。接続repositoryの任意branch codeは同一account内8 Workerへ作用できるため、2026-08-01にrepository ownerが残余リスクを明示承認した。secret/resource/route/domain/consumer trigger変更は通常deployから分離する。

Workers Builds APIで初期設定する場合だけ、`Workers Builds Configuration: Edit`と`Workers Scripts: Read`を持つ一時configurator tokenを別に作る。Build tokenと兼用せず、trigger/environment variablesのread-back後にrevokeする。Builds APIにはWorker名ではなくsystem-generated Worker tagを渡す。2026-08-01 read-back値はGateway `fb9569302ab44ec8bf193a588a09b6fd`、Queue `5342eaf857b24935a36e923fbfb3b811`。

read-only調査や復旧時の対話操作は、1Passwordからcredentialを注入する`hermes-secret-run`経由で実行する。

```sh
hermes-secret-run --env-file ~/dev/tmp/mzm-cloudflare-readonly.env \
  --workdir ~/dev/mzm/.worktree/dev -- npm exec -w packages/event-gateway-worker -- wrangler whoami
```

### Workers Builds project設定

単一のBuild projectを`mzm-event-gateway`へ接続し、repository内scriptからQueue/Gateway両Versionを扱う。これはCloudflare標準のWorkerごとのdeployではなく、両Workerの順序を管理する独自orchestrationである。

- repository: `mzmessenger/mzm`
- production branch: `main`
- non-production branch builds: enabled
- root directory: `/`
- repository connection UUID: `60f43460-5c1f-405c-88eb-87f6560616cd`
- Build token UUID: `e0ecf279-ee52-4895-b2c6-e33639e3a843`
- production trigger UUID: `6c2044d6-ae20-4b30-96b3-26188cf604bd`
- non-production trigger UUID: `b7bb3fc4-3d16-4411-854a-1b644441acfc`
- production deploy commandとnon-production deploy command: `bash scripts/deploy-workers-builds.sh`
- GitHub check: この単一Build projectだけを必須対象として扱う

Build command:

```sh
npm ci --ignore-scripts && \
npm run verify:workers-builds
```

`verify:workers-builds`はclean checkoutでも`mzm-shared`のexport先が存在するよう、最初に
`npm run build -w packages/shared`を実行してからQueue/Gatewayのlint/test/dry-run buildを実行する。

Build variables:

| name                               | value                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `SKIP_DEPENDENCY_INSTALL`          | `1`                                                                |
| `NODE_VERSION`                     | `24.18.0`                                                          |
| `CLOUDFLARE_ACCOUNT_ID`            | `789787f7b7b778b108bb8ad86350db9d`                                 |
| `EXPECTED_QUEUE_WRANGLER_SHA256`   | `35b4ecb20f912ebf17fc7e8b9c923a1bbd313ee66c6bca9723b49543e66347f0` |
| `EXPECTED_GATEWAY_WRANGLER_SHA256` | `689d8ca9f33db1600c0bc93cc486e75186334c244f8e0ad024b54f6be0e47246` |

Build watch paths:

```text
package.json
package-lock.json
scripts/deploy-workers-builds.sh
scripts/deploy-workers-builds.test.mjs
packages/shared/*
packages/shared/**
packages/queue-worker/*
packages/queue-worker/**
packages/event-gateway-worker/*
packages/event-gateway-worker/**
docs/production-deployment.md
docs/spec/workers-builds-any-branch-production.md
```

watch pathsは最適化でありsecurity boundaryではない。Cloudflareのbypass条件により対象外差分でもbuildが起動し得る。

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

接続repository内の任意branchへの対象path pushをproduction deploy承認として扱う。branch名、PR、review、merge状態は実行gateではない。fork側だけに存在するbranchは`origin` remote headを解決できないためfail-closedとなる。同一repository PRに関連する同一SHAの重複buildは再deployし得る。

`bash scripts/deploy-workers-builds.sh`は次をfail-closedで実行する。

1. Workers CI metadata、owner承認済みconfig SHA-256、local commit SHAを検証する。
2. PUBLIC Git remoteの同一branch headとBuild SHAを照合する。
3. Queue/GatewayのVersionを両方uploadする。片方でも失敗すればproduction trafficを変更しない。
4. branch headを再照合する。
5. Queueを100%へpromoteし、`queue.mzm.dev/internal/dlq/replay`の未認証GETがAccess HTTP 302となることを確認する。
6. Event Gatewayを100%へpromoteする。
7. `auth.mzm.dev/`のHTTP 200、`api.mzm.dev/`とraw/encoded `/internal`候補のHTTP 404を確認する。

Queue→Gatewayの順を固定する。Queue event envelopeとcallback contractはn−1互換を維持し、混在期間を許容できない変更はこのpipelineで直接deployしない。head照合後からpromoteまでのTOCTOUとbranch横断build raceは残るため、productionは「最後にpushされたcommit」ではなく「最後に成功したbuild」になり得る。

`mzm-queue-worker`と`mzm-event-gateway`は`workers_dev: false`、`preview_urls: false`とし、`workers.dev`やversion preview URLを公開経路として使わない。通常deployはroute、custom domain、Queue consumer、Queue/R2 resource、secretを変更しない。

### 検証

local gate:

```sh
npm ci --ignore-scripts
npm run verify:workers-builds
npm exec -w packages/queue-worker -- wrangler versions upload --dry-run
npm exec -w packages/event-gateway-worker -- wrangler versions upload --dry-run
```

resourceとVersion履歴のread-back:

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

Workers Builds historyでrepository、branch、commit SHA、Build ID、status、両WorkerのVersion tag/message、Queue→Gateway deployment messageを突合する。`workers.dev`とversion preview URLが無効であること、Queue/DLQ/R2 bindings、Queue consumers、public routes、custom domain、secret名が切替前後で維持されていることをAPI/Dashboardでread-backする。secret値は表示しない。

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

実rollbackは`--dry-run`を外し、`--message "rollback reason=<reason> source-build=<build-id>"`を付ける。timestamp、branch、commit SHA、Build ID、両Workerの変更前後Version ID、理由、operatorを`koh110/memo#1`へ記録する。
