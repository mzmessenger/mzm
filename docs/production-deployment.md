# Production deployment

この文書はOSS利用者向けの一般的なrelease方針である。以下のresource名、URL、Account ID、repository名、secret名、IAM principalはすべて利用者の環境へ置き換えるplaceholderとして扱う。実環境の値、内部URL、認証情報、組織固有の運用手順をrepositoryへ記録してはならない。

## 責任境界

- production cutover、認証設定変更、PR mergeはrepository ownerが承認する
- 通常deployは既存resourceと既存secret参照を再利用し、bootstrapやIAM変更を行わない
- 長期credentialやsecret値をrepository、command引数、workflow logへ出さない
- secret managerは組織が承認した製品・運用を使用する。OSSの通常利用に特定製品を要求しない

## Backend / auth runtime

### 認証

CI/CDからクラウドへdeployする場合は、長期service-account keyをrepositoryへ保存せず、利用するクラウドproviderが提供する短期OIDC federation等を優先する。provider、organization、repository、workflow、branchの制約は利用者の環境で最小権限に設定する。

公開文書へ次の情報を記録しない。

- service accountのemail
- repository ID / owner ID
- project ID
- organization内部のIAM構成
- secret resource名
- internal service URL

### Runtime secret

runtime secretは利用者が承認したsecret managerからruntimeへ参照させる。通常deploy workflowはsecret resource作成、version追加、IAM変更、runtime secret binding変更を行わない。

secret rotationは通常deployと分離する。

1. 承認済みsecret managerの正本を更新する
2. runtimeが参照するsecret versionを更新する
3. 関連するWorkerまたはserviceのsecretを更新する
4. 新revisionを作成し、Readyとsecret参照を確認する
5. positive/negative probeを行う
6. rollback期間後に旧versionを無効化する

secret resourceの新規作成やIAM復旧が必要な場合は、通常deployとは別のowner/admin operationとして扱う。

## Cloudflare Workers

### 認証と責任境界

local direct deployで使用するAPI tokenは、対象AccountのWrangler upload/promoteに必要な最小権限を持つものを、承認済みsecret managerまたは短命な環境変数注入機構から一時注入する。token値をrepository、CI、Build variable、command引数、logへ出さない。新規token発行やrotationは、このrunbookの通常deployには含めない。

Workers Buildsの設定変更・trigger停止はCloudflare ownerまたは権限を持つoperatorの別operationとして扱う。repositoryのscript/package変更だけではpush triggerは停止しない。Deploy HookやWorkers Builds API manual triggerを通常経路へ追加しない。

### Local manual deploy

Cloudflare Workersの通常releaseはWorkers Buildsを経由せず、operatorがlocal worktreeからVersions APIを使って明示的に実行する。GitHub Actions、server常駐token、Deploy Hook、Workers Builds API manual triggerは通常経路に使用しない。

実装と運用手順の正本は以下である。

- script: `scripts/deploy-workers-manual.sh`
- test: `scripts/deploy-workers-manual.test.mjs`
- 依存するWorkerがある場合は、先行Workerのpromote/probe後に後続Workerをpromoteする
- uploadは`wrangler versions upload`、promotionは`wrangler versions deploy`へ固定する

認証注入方法は環境依存である。以下はplaceholderを使った概念例である。

```sh
<SECRET_INJECTION_COMMAND> \
  --workdir <LOCAL_WORKTREE> \
  -- npm run deploy:workers-manual -- \
    --branch <BRANCH> \
    --commit <40-CHAR-COMMIT-SHA>
```

直接環境変数を使用する場合は、短命なsessionに限定し、shell history・process list・ログへ値を残さない。

```sh
CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID> \
CLOUDFLARE_API_TOKEN=<EPHEMERAL_TOKEN> \
./scripts/deploy-workers-manual.sh \
  --branch <BRANCH> \
  --commit <40-CHAR-COMMIT-SHA>
```

secretなしでmutation前に拒否されることは、次で確認できる。token存在確認で停止するため、WranglerやCloudflare mutationは行わない。Wranglerの`--dry-run`を実行する場合は、承認済みの一時credentialを注入する。

```sh
npm run deploy:workers-manual -- \
  --branch <BRANCH> \
  --commit <40-CHAR-COMMIT-SHA> \
  --dry-run
```

### Scriptのfail-closed検証

- approved Account IDとtokenの存在
- detached HEADでないこと
- `git status --porcelain --untracked-files=all`が空であること
- current branch、local HEAD、`origin/<branch>` headが指定SHAと一致すること
- 各Workerのconfig hashがapproved valueと一致すること
- production active Versionが各Workerで1件かつ100%であること
- 定義されたread-only probeが期待statusを返すこと

probe失敗やpartial failureでは直前Versionへrollbackする。rollback自体に失敗した場合は自動で成功扱いにせず、Version IDを出力して手動復旧を要求する。

### Workers Builds停止の責任境界

repositoryのscript/package変更だけでは、Cloudflare側のWorkers Builds push trigger停止は完了しない。manual direct deployの実装・検証後、owner/operatorがDashboardまたは適切な管理APIでproduction/non-production triggerを停止または切断し、read-backを取得する。停止前にmanual pathをproductionへ実施してはならない。

## Worker deploy順序

production deployはpushではなく、operatorが`--branch`と`--commit`を明示してlocal manual scriptをkickした場合だけ実行する。scriptはclean worktree、local HEAD、`origin/<branch>` head、config hash、Account ID、production active Versionをfail-closedに検証する。

`scripts/deploy-workers-manual.sh`は、設定された依存順序に従って次を実行する。

1. 全WorkerのVersionをuploadする。片方でも失敗すればproduction trafficを変更しない
2. target branch/SHAを再照合する
3. 先行Workerを100%へpromoteし、read-only probeを確認する
4. 後続Workerを100%へpromoteする
5. 認証root、公開root、internal path拒否など、repositoryで定義したprobeを確認する

具体的なURLやstatus codeは利用者の環境で定義し、公開文書へ内部endpointを記録しない。probeは副作用のないGET等に限定し、replayやmutation endpointを自動deployで実行しない。

通常deployはroute、custom domain、Queue consumer、storage resource、secretを変更しない。workers.devやversion preview URLをproduction公開経路として利用するかどうかは、利用者の設定と公開方針に従う。

## Verification

local gateの例:

```sh
npm ci --ignore-scripts
npm run verify:workers-manual
npm run deploy:workers-manual -- \
  --branch <BRANCH> \
  --commit <40-CHAR-COMMIT-SHA> \
  --dry-run
```

production後は、各Workerについて次をread-backする。

- active Version IDとtraffic
- repository、branch、commitのannotation
- Queue、storage、binding、route、custom domainの設定維持
- 定義済みprobeのstatus

secret値は表示・保存しない。read-backに権限がない場合は、成功と推測せず、権限不足を明記する。

## Rollback

1. promotion前に各Workerの100% active Version IDをread-backする。split deploymentや不正なVersion IDならtrafficを変更せず停止する
2. 先行Workerのprobe失敗、後続Worker promote直前のstale branch検出、後続Worker promote失敗では、後続Workerをpromoteせず先行Workerを直前Versionへrollbackする
3. 後続Workerのprobe失敗では、後続Workerを先に、先行Workerを後に直前Versionへrollbackする
4. 自動rollbackが失敗した場合は対象Versionをread-backし、owner承認済みのVersion IDを指定した手動operationへ切り替える
5. rollback理由、source commit、変更前後のVersion ID、operatorを、利用者が承認した変更記録へ保存する。secret値は記録しない

この処理は複数Workerのatomic rollbackではない。promotion間に短時間のpartial stateが発生し得るため、依存関係と許容範囲をownerが承認する。
