# Workers Buildsによる任意branchからのproduction deploy

- Status: Approved — account-wide credential blast radius and residual build race accepted by repository owner on 2026-08-01
- Target repository: `mzmessenger/mzm`
- Related PR: #312
- Progress record: `koh110/memo#1`
- Updated: 2026-08-01

## 目的

Cloudflare Workerの通常deployをCloudflare Workers Buildsへ移し、GitHub Actions、GitHub repository secret、deployごとの個人Cloudflare/GitHub loginを使わずに、`mzmessenger/mzm`の任意branchへのpushからproduction Workerを更新できるようにする。Workers Builds管理の専用user API tokenは使用する。

この仕様では、production branchだけでなくnon-production branchのpushもproduction deployである。branch名、PR、review、merge状態はproduction反映のgateにしない。repositoryへpushできる権限と、対象pathへのcommitがdeploy権限を意味する。

## Scope

### In scope

- `mzm-event-gateway`をGitHub repositoryへ接続した単一Workers Build pipeline
- Queue Worker、Event Gatewayのlint、test、dry-run build、production deploy
- 任意branch pushによる自動production deploy
- Queue Worker → Event Gatewayの直列deploy
- GitHub check runとCloudflare build logによる結果確認
- public preview URLと`workers.dev`経路の無効化
- commit SHAをWorker version annotationへ記録
- 部分反映時の検出とrollback runbook

### Out of scope

- GitHub ActionsからのWorker deploy
- Cloud Run backend/auth deploy
- secret rotation、Cloudflare resource bootstrap、IAM変更
- 2 Workerのatomic deploy
- branch protection、PR review、manual approvalによるproduction gate
- buildの全branch横断serializationを保証する独自lock service

## 現行状態と確認済み制約

| 項目                         | 確認結果 / source                                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production Worker            | `mzm-event-gateway`、`mzm-queue-worker`は稼働済み                                                                                                                                                                                                                    |
| 現行deployment source        | 2026-07-31時点で両WorkerともCloudflare API上は`wrangler`                                                                                                                                                                                                             |
| Workers Builds branch制御    | production branch pushはbuild command後にdeploy command、non-production branch buildを有効にすると全non-production branch pushでbuild command後にnon-production deploy commandを実行する: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/     |
| GitHub連携                   | GitHub check runを作成でき、1 repositoryに複数Workerを接続できる: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/                                                                                                         |
| preview URL                  | `wrangler deploy`または`wrangler versions upload`でversionが作成され、preview URLを有効化するとpublicになる: https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/                                                                        |
| repository build検証         | repository rootで`npm ci --ignore-scripts`、両Workerのlint/test/buildが成功。Queue 5 tests、Gateway 10 testsが成功                                                                                                                                                   |
| Workers Builds API read-back | 現行read-only tokenはWorkers script/deploymentを読めるが、Workers Builds trigger/build APIは403。Build設定の最終read-backにはGitHub checkとCloudflare dashboard/API権限追加のいずれかが必要                                                                          |
| Build image                  | 2026-07-30時点の既定はNode.js 24.18.0 / npm 10.9.2。minorは予告なく更新され得るため固定する: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/                                                                                                     |
| dependency install           | Workers Buildsはbuild command前に自動installする。`SKIP_DEPENDENCY_INSTALL=1`で停止し、build command内の`npm ci --ignore-scripts`だけを使う: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#skip-dependency-install                             |
| build watch paths bypass     | 変更fileが0件、3,000件以上、または20 commits以上のpushはpath matchingを迂回してbuildされる: https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/                                                                                                |
| account blast radius         | 同一Cloudflare accountには8 Worker（mzm 3件を含む）が存在する。既定生成tokenはWorkers Scripts/KV/R2 editと全zone Workers Routes editを持つ。専用tokenへ縮小してもWorkers Scripts editはWorker名単位にscopeできず、任意branch codeはaccount内8 Workerすべてを変更可能 |
| GitHub push主体              | 直接collaboratorは`Ajido`、`koh110`のadmin 2名。write deploy keyは0件。`main`/`dev`はbranch protectionなし                                                                                                                                                           |
| GitHub Actions token         | repository default workflow permissionsが`write`。既存Cloud Run deploy workflowはjob/workflow levelで`contents: read`と`id-token: write`を明示している                                                                                                               |

## Architecture

```text
push to any branch
  │
  ▼
Cloudflare Workers Builds GitHub App
  │ build command
  ├─ npm ci --ignore-scripts
  └─ npm run verify:workers-builds
      ├─ shared build
      ├─ queue lint/test/dry-run build
      └─ gateway lint/test/dry-run build
  │ deploy command（production branch / non-production branchで同一）
  ├─ versions upload: mzm-queue-worker（未昇格）
  ├─ versions upload: mzm-event-gateway（未昇格）
  ├─ versions deploy: mzm-queue-worker 100%
  ├─ queue production probe
  ├─ versions deploy: mzm-event-gateway 100%
  └─ gateway production probe
```

`mzm-queue-worker`と`mzm-event-gateway`を独立したGitHub Build triggerへ接続しない。独立buildは同じcommit内でも実行順を保証できず、別branchのbuildが競合するためである。`mzm-event-gateway`側の単一repository connectionを起点に、repository内scriptが両WorkerのVersionを先にuploadしてから直列にproductionへpromoteする。これはCloudflareが公式に保証する複数Worker orchestrationではなく、単一Build containerのaccount-scoped credentialを使う独自orchestrationであり、GitHub checkも接続元projectの1件だけ生成される。

## Trigger contract

- Production branch: repository default branchの`main`
- Builds for non-production branches: enabled
- production deploy commandとnon-production branch deploy command: 同一script。Cloudflare上ではnon-production branchはpreview/non-production command経路だが、そのcommandがproduction Versionを100%へpromoteする非標準運用とする
- 対象: 接続repository内branchへのpush。tagは対象外。fork側だけに存在するbranchは`origin` remote headを解決できないためdeploy前にfail-closedとなる。同一repository PRに関連して同じbranch/SHAのbuildが重複起動した場合は、push buildと区別できるsystem variableがないため同じproduction orchestrationを再実行し得る
- build watch paths:
  - `packages/event-gateway-worker/*`
  - `packages/queue-worker/*`
  - `packages/shared/*`
  - root `package.json`
  - root `package-lock.json`
  - `scripts/deploy-workers-builds.sh`
- ignore pathsだけに一致するpushはbuildもdeployも開始しない
- ただし変更fileが0件、3,000件以上、または20 commits以上のpushではCloudflareがwatch pathsを迂回してbuildするため、対象外pathだけでもproduction deployが起動し得る

このcontractでは、未mergebranch、draft PRの接続repository内branch、実験branch、過去commitから作成したbranchへのpushも対象pathに一致すればproductionへ反映される。初回接続・権限・config deployはrepository ownerの明示承認を要する。通常code deployでは、admin 2名のいずれかが接続repositoryへpushした時点でそのcommitのproduction deployを承認したものと扱う。`docs/production-deployment.md`はこの区別へ更新する。Cloud Run backend/authのGitHub Actions＋WIF deployは継続し、廃止対象はWorker deploy workflowだけである。

## Build and deploy contract

repository rootをRoot directoryとして使用し、root lockfileとnpm workspacesを必ず利用する。

Build variablesは次を設定する。

- `SKIP_DEPENDENCY_INSTALL=1`: Cloudflareによるbuild command前の自動installを止める
- `NODE_VERSION=24.18.0`: repository CIと同じNode 24系を具体的なminorへ固定する
- `CLOUDFLARE_ACCOUNT_ID=789787f7b7b778b108bb8ad86350db9d`: Wranglerのaccount discoveryを不要にし、専用tokenをWorkers Scripts editだけへ縮小する
- `EXPECTED_QUEUE_WRANGLER_SHA256`: owner承認済みQueue Worker `wrangler.jsonc`のSHA-256
- `EXPECTED_GATEWAY_WRANGLER_SHA256`: owner承認済みEvent Gateway `wrangler.jsonc`のSHA-256

Cloudflareが注入する`WORKERS_CI_BUILD_UUID`、`WORKERS_CI_COMMIT_SHA`、`WORKERS_CI_BRANCH`を使用する。ただしsystem environment variablesは設定でoverride可能なため、deploy scriptは`WORKERS_CI=1`、UUID/SHA形式に加えて`git rev-parse HEAD`とcommit SHAの一致を検証する。Dashboardのdeploy command自体でも、repository scriptを呼ぶ前に両Wrangler configのSHA-256をBuild variablesと照合する。

Workers Buildsはbuild commandとdeploy commandを同じcredential付きBuild環境で実行し、権限分離機能を提供しない。`npm ci --ignore-scripts`はdependency install lifecycleだけを止める。続く`npm run lint/test/build`はbranch-controlled codeを実行し、専用Cloudflare tokenの持出しや権限内API操作を防ぐ境界にはならない。

Build commandは次をfail-fastで実行する。

```sh
npm ci --ignore-scripts && \
npm run verify:workers-builds
```

`verify:workers-builds`はWorkers orchestration testsに続けて`mzm-shared`をbuildし、
その後にQueue/Gatewayのlint/test/dry-run buildを実行する。sharedのpackage exportsは`dist`を参照するため、
clean checkoutでQueue/Gatewayを検証する前にshared buildを省略してはならない。

production/non-production deploy commandはrepository管理の単一shell scriptを呼ぶ。scriptは次を満たす。

1. `set -euo pipefail`で実行する。
2. Cloudflareが提供する`WORKERS_CI_COMMIT_SHA`、`WORKERS_CI_BRANCH`、`WORKERS_CI_BUILD_UUID`を検証し、空・形式不正・`git rev-parse HEAD`とのSHA不一致ならdeployしない。
3. PUBLIC repositoryの`git ls-remote origin refs/heads/$WORKERS_CI_BRANCH`を取得し、remote branch headがBuild SHAと不一致またはbranchが削除済みならstale buildとしてdeployしない。この照合は最初のupload前、Queue promote直前、Gateway promote直前の3回行う。Queue promote後の照合でstaleを検出した場合は直前のQueue Versionへ自動rollbackする。
4. SHAとBuild UUIDから安全な長さ・文字種の一意なversion tagを作る。
5. Queue WorkerとEvent Gatewayの順に`wrangler versions upload --strict --keep-vars --tag ... --message ...`を実行する。この時点ではproduction trafficを変更しない。
6. 両Version upload成功後、Queue Workerを`wrangler versions deploy --version-tag ... --percentage 100 --yes`でproductionへpromoteする。
7. `https://queue.mzm.dev/internal/dlq/replay`へcredentialなしのGETを行い、Cloudflare AccessのHTTP 302を確認する。service-token付きreplayはcallback処理を起こし得るため自動buildでは実行しない。
8. Queue probe成功後、Event Gatewayを同じtagで100%へpromoteする。
9. `https://auth.mzm.dev/`のHTTP 200、`https://api.mzm.dev/`のHTTP 404、両hostの`/internal/outbox/v1/claim`と`/%69nternal/outbox/v1/claim`のHTTP 404を確認する。いずれもGETのみで、書込みmutationやQueue投入を行わない。
10. promote前に両Workerの100% active Version IDをread-backする。Queue probe、Gateway直前のstale照合、Gateway promoteの失敗時はQueueを直前Versionへ戻し、Gateway probe失敗時はGateway→Queueの順で直前Versionへ自動rollbackする。rollback失敗を含むいずれかの失敗はnon-zero exitし、GitHub checkをfailureにする。

通常pipelineはVersion upload/promotionだけを扱う。Versionはbundled code、bindings、compatibility settingsを含むが、route/domain/cron等のtriggerとR2/Queue自体のstateは含まない。通常pipelineではWrangler configのSHA-256一致を必須にして、binding/compatibilityの意図しない変更をfail-closedする。route、custom domain、Queue consumer trigger、resource作成・削除、secret、承認済みWrangler config自体の変更はowner承認付きの別config deployとして扱い、必要な権限を自動追加したり通常`wrangler deploy`へfallbackしたりしない。`--strict`はremoteとの競合防止に使うが、policy gateの代替とはしない。

secret値をbuild environment variableとして追加しない。通常deployはsecretの作成・更新を行わず、既存Worker secret/bindingを保持する。初回切替時に必要なbinding名とsecret名をAPI/Dashboardでread-backし、欠落時はbuild内でbootstrapせずowner承認付き復旧へ停止する。値自体はread-backもlog出力もしない。

## Public ingress policy

- `mzm-queue-worker`: `workers_dev: false`、`preview_urls: false`
- `mzm-event-gateway`: `workers_dev: false`、`preview_urls: false`
- production public ingress:
  - `api.mzm.dev/*`
  - `auth.mzm.dev/*`
  - `queue.mzm.dev/internal/dlq/replay`（Cloudflare Access保護）
- branch別preview endpointは提供しない。

## Concurrency and ordering

単一build内ではQueue → Gatewayを保証する。ただしCloudflare Workers Buildsの別build間に全branch共通lockはないため、次を保証しない。

- push Aの後にpush Bが発生したとき、Bが最後にproductionへ残ること
- 同一branchの連続pushがcommit順に完了すること
- 別branch build間のQueue/Gateway deploy phaseが交差しないこと

したがって、productionは「最後にpushされたcommit」ではなく「各Workerについて最後にdeployが成功したbuild」の内容になる。異なるbuildのQueueとGatewayがproductionで混在する可能性がある。remote branch head照合は明らかなstale buildを止めるが、照合後からpromoteまでのTOCTOU raceとbranch横断順序は止めない。

Worker間contract変更は後方互換にし、Queue wire envelope version `n`についてproducerは`n-1` consumerが処理可能なeventだけを生成し、consumerは`n-1` producerの未処理eventを処理できなければならない。rollback先も未処理Queue内のenvelopeを消費できるVersionに限定する。この双方向互換を満たせない変更は本pipelineでdeployせず、別の移行仕様とowner承認を必要とする。

上記はユーザーが選択した任意branch自動production deployに残る重大な残余リスクであり、独自lock/dispatcher、GitHub Actions concurrency、manual gateへのscope拡大は本仕様で自動決定しない。

## Failure matrix

| Failure                               | Result                                  | Required response                                                                       |
| ------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| install/lint/test/build failure       | deploy前に停止                          | GitHub check failure。production変更なし                                                |
| Queue/Gateway Version upload failure  | promote前に停止                         | GitHub check failure。production変更なし。未昇格Versionは削除不要だがmetadataで識別する |
| Queue promote failure                 | Gatewayをpromoteしない                  | 原因修正後に同じcommitを再build、または既知の良いcommitをpush                           |
| Queue promote成功、Queue probe失敗    | GatewayをpromoteせずQueueを自動rollback | rollback結果を履歴で確認し、原因修正後に再build                                         |
| Queue成功、Gateway前stale/promote失敗 | GatewayをpromoteせずQueueを自動rollback | rollback結果とremote headを確認し、意図するcommitを再build                              |
| 両promote成功、Gateway probe失敗      | Gateway→Queueの順で自動rollback         | 両rollback結果を履歴で確認し、原因修正後に再build                                       |
| older buildがlater buildより後に完了  | production regression                   | deployment metadataでSHA/buildを特定し、意図するcommitを再push/rebuild                  |
| GitHub App/Build outage               | deployされない                          | productionは直前versionを維持。復旧後に再build                                          |
| secret/binding不足                    | deploy/probe failure                    | build内でbootstrap・rotationしない。既存設定をread-backして別復旧                       |

## Rollback

- 自動deployはpromotion前に各Workerの100% active Version IDを取得し、部分反映時はそのVersionへ自動rollbackする。split deploymentや不正なVersion IDならpromotion前に停止する。
- 自動rollbackが失敗した場合はCloudflare deployment/version履歴から各Workerの直前の正常version IDを特定する。
- Event Gatewayを先にrollbackして公開入口を既知の良いcontractへ戻し、その後必要に応じてQueue Workerをrollbackする。
- rollback後にread-only public probe、Queue backlog/DLQ、Worker logsを確認する。
- rollbackでsecret rotation、binding変更、Queue/R2削除を行わない。
- rollbackしたtimestamp、branch、commit SHA、Build ID、両Workerの変更前後version ID、理由、operatorは`koh110/memo#1`へ記録する。

## Security

- GitHub Appのrepository accessは`mzmessenger/mzm`だけに限定する。
- repository default workflow permissionsを`read`へ変更し、書込みが必要なGitHub Actions workflowだけjob/workflow levelで最小権限を明示する。
- GitHub/Cloudflareの接続とuser token選択には一回限りの対話loginが必要である。通常push/deploy時にはloginを要求しない。
- Workers Buildsの既定自動生成tokenは使用しない。既定tokenはAccount Settings read、Workers Scripts/KV/R2 edit、全zoneのWorkers Routes editを持ち、任意branch codeに対して過大である。
- 既存2 Workerのdeployに必要な最小permissionだけを持つ専用user API tokenを別途作成してBuild設定へ選択する。CloudflareがWorker script単位のtoken scopeを提供しない場合、Workers Scripts editは同一accountの全8 Workerへ及ぶ残余リスクとしてownerが明示承認するまで接続しない。
- 専用tokenが既存Queue/R2 bindingを参照するだけのdeployにQueue/R2 editを必要としないことを実deploy前に確認する。必要だった場合は権限を自動追加せず再承認する。
- Workers Buildsのbuild tokenをrepository secretやlocal fileへコピーしない。
- fork PRからproduction deployしない。
- public preview URLとworkers.dev endpointを無効化する。
- build logへenvironment dump、Wrangler secret、request authorization headerを出さない。
- arbitrary branch codeがbuild token権限で実行され、credentialの持出しやtoken権限内の任意API操作も技術的には可能である。repositoryへpush可能な主体は、2 Workerのproduction deployだけでなく専用tokenの全権限を持つものとして扱う。
- dependency lifecycle scriptによるbuild環境内code executionを避けるため`npm ci --ignore-scripts`を使う。依存packageがinstall scriptを必須とする変更は明示review対象とする。

## Observability and traceability

各deploymentから最低限次を追跡できること。

- repository
- branch
- commit SHA
- Cloudflare Build ID
- Worker version/deployment ID
- deploy timestamp
- GitHub check conclusion
- Queue/Gateway probe result

GitHub checkとCloudflare build logがcommit単位の一次証跡であり、両WorkerのVersion tag/messageとdeployment messageにもbranch、SHA、build IDを含める。

## Acceptance criteria

1. production branchを`main`、non-production branch buildsをenabledに設定する。
2. production/non-production deploy commandが同じrepository scriptを呼ぶ。
3. feature branchの対象pathへのpushでWorkers Buildが開始し、Queue → Gatewayの順でproduction deployされる。
4. build前のlint/test/dry-run buildが失敗した場合、どちらのWorkerも更新されない。
5. Queue deploy/probeが失敗した場合、Gateway deployは開始されない。
6. 両Workerのdeployment metadataからtrigger branch、commit SHA、Build IDを追跡できる。
7. `api.mzm.dev`、`auth.mzm.dev`、Access保護されたqueue endpointのproduction probeが成功する。
8. `workers.dev`とversioned preview URLが両Workerで利用できない。
9. GitHub Actions workflow、GitHub repository secret、local fileにCloudflare deploy tokenを置かず、Workers Builds設定で選択した専用最小権限tokenだけを通常deployに使用する。
10. CloudflareまたはGitHubへの個人loginなしにpushだけで通常code deployが完了する。
11. route、custom domain、Queue consumer trigger、resource、secret、script-level setting変更は通常pipelineから拒否され、owner承認付きconfig deployへ分離される。
12. Cloudflare履歴から直前の互換version IDをread-backし、`wrangler versions deploy --version-id <ID> --percentage 100 --dry-run --yes`がproduction mutationなしで成功する。実rollback試験は別のowner明示承認を要する。
13. `docs/production-deployment.md`が新しいWorkers Builds運用、Cloud Run Actions継続、残余リスク、実行コマンドへ更新される。
14. account内8 Workerへのcredential blast radius、branch-controlled codeによるtoken利用、build間raceをownerが明示承認している。

## Verification plan

1. repository scriptをlocalで実行し、両Workerのlint/test/dry-run buildを確認する。
2. Wrangler configをschema検証し、`workers_dev: false`と`preview_urls: false`を確認する。
3. Workers Builds設定後、検証branchでWorker対象pathへ無害な変更をpushする。
4. GitHub checkとCloudflare build logからbranch/SHA/Build IDを照合する。
5. Cloudflare deployment APIから両Workerのversion/deploymentをread-backし、metadataとdeploy順を照合する。
6. production endpointをread-only probeする。
7. workers.dev/version previewが到達不能であることをprobeする。
8. 別branchで連続buildを発火させる破壊的な競合試験はproductionでは行わない。残余リスクとして文書化する。

## Adversarial Review

2026-08-01に同等モデル3系統で、Cloudflare仕様、security/reliability、既存requirements整合性を独立reviewした。

### 採用したBlocking/Important指摘

- Workers Builds内ではbuildとdeployのcredentialを分離できず、`npm run *`を含む任意branch codeがaccount-scoped tokenへ到達できる。
- Workers Scripts editはWorker名単位にscopeできず、専用tokenでも同一accountの8 Workerがblast radiusになる。
- build間に全branch共通lockがなく、古いbuildやQueue/Gateway phaseの交差を完全には防げない。remote branch headをupload前・Queue promote前・Gateway promote前に照合するが、各照合後のTOCTOU raceは残る。
- Queue wireはproducer/consumer双方の`n-1`互換を必須とし、非互換変更を通常pipelineから除外する。
- probeを具体的な副作用なしGET path/statusへ固定し、認証付きDLQ replayを除外する。
- 初回設定/config変更のowner承認と、通常pushをdeploy承認とみなす運用を区別する。
- Cloud RunのGitHub Actions＋WIFは継続し、Worker deployだけをWorkers Buildsへ移す。
- secretは既存名のread-backだけを行い、通常buildで作成・更新しない。
- rollbackの非破壊検証は直前互換Versionのread-backとcommand組立までとし、実rollback試験は別承認にする。
- 単一Git接続から2 Workerを更新する処理はCloudflare標準のmulti-Worker保証ではなく、repository scriptによる独自orchestrationと明記する。

### 不採用または修正して採用した指摘

- 「non-production branchからproduction deployは不可能」は不採用。Cloudflareはnon-production用command経路を分けるが、そのcommandにproduction Version promotionを行うWrangler commandを設定できる。ただし公式の標準的なpreview運用ではないため、非標準運用として明記した。
- 「WorkerごとにGit接続する」は不採用。個別接続ではQueue→Gateway順序を保証できないため、1接続・1 check・独自orchestrationを選ぶ。
- watch pathsは接続projectのBuild起動条件であり、2 Worker個別判定ではない。公式例に合わせ`*`形式へ直し、path matching bypass条件を明記した。
- 専用`/healthz`追加はscopeを増やすため不採用。既存GETの実測statusをallowlist化し、副作用を起こす認証付きreplayを行わない。

### 未解決Blocking

以下はWorkers Builds上の任意branch production deployという選択自体に内在し、repository scriptだけではfail-closedにできない。

1. 任意branch codeが専用user API tokenを読み出し、同一accountの8 Workerへ任意のWorkers Scripts操作を行える。
2. branch横断serializationがなく、同一branchでもhead照合後のTOCTOU raceが残る。
3. Cloudflare標準のproduction/non-production分離を意図的に迂回するため、UI/checkの「preview」表現と実際のproduction mutationが一致しない。

これらをownerが明示承認するか、production branch限定または権限分離可能な外部CIへ設計変更するまで実装・接続・production deployを開始しない。
