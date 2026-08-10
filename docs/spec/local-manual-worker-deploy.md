# localからの明示的なWorker production deploy

## Overview

Cloudflare Workers Buildsのpush起動を通常deploy経路から外し、運用者がlocal worktreeから1Password経由でWranglerを実行したときだけ、Queue WorkerとEvent Gateway Workerをproductionへ反映する。Workers Buildsのbuild minutesとpushごとの意図しないproduction deployを避ける。

対象Workerは次の2つに限定する。

- `mzm-queue-worker`
- `mzm-event-gateway`

Cloud Runのbackend/authのGitHub Actions release経路は変更しない。

## Inputs & Outputs

入力は、運用者が選択したcleanなlocal worktreeと、1Passwordから一時注入されるWrangler認証環境変数である。

必須環境変数:

- `CLOUDFLARE_ACCOUNT_ID`: 対象Account `789787f7b7b778b108bb8ad86350db9d`
- `CLOUDFLARE_API_TOKEN`: 既存サービスtokenを1Password経由で一時注入する。repository、server常駐環境、command argument、logには保存しない

CLI入力:

```text
scripts/deploy-workers-manual.sh --branch BRANCH --commit SHA [--dry-run]
```

`--branch`と`--commit`は省略不可とする。実装は次の順序で検証する。

1. `--branch`は安全なGit branch名であり、detached HEADではないこと
2. `git status --porcelain --untracked-files=all`が空であること。ignored fileは許容する
3. 現在のbranchが`--branch`と一致し、`git rev-parse HEAD`が`--commit`と一致すること
4. `git ls-remote origin refs/heads/<branch>`の唯一のremote headが`--commit`と一致すること
5. localの対象config hashがowner-approved valueと一致すること
6. `CLOUDFLARE_ACCOUNT_ID`が期待Accountと一致し、`CLOUDFLARE_API_TOKEN`が存在すること

いずれかの検証失敗時はWranglerのupload/promotionを実行しない。

出力はsecretを含まない次のprovenanceと結果である。

- repository、branch、commit SHA
- Queue/Gatewayのversion tag
- deploy前の各active Version ID
- Queue→Gatewayのpromotion結果
- probe結果
- rollback結果（実施時）

## Tech Stack

- Bash strict mode
- Git for worktree/provenance validation
- `npm exec -w <workspace> -- wrangler versions upload`
- `npm exec -w <workspace> -- wrangler versions deploy`
- `npm exec -w <workspace> -- wrangler deployments status --json`
- `curl` read-only probes
- `hermes-secret-run` + 1Password env file for credential injection

Wrangler 4.107.0で`wrangler versions upload`と`wrangler versions deploy`の`--strict`、`--keep-vars`、`--tag`、`--message`、`--yes`、`--dry-run`を確認済み。アップロードとproduction promotionはVersions APIに統一し、`wrangler deploy`は使用しない。Wrangler直接deployはWorkers Buildsを経由しない。

## Interface

### Deploy command

```bash
hermes-secret-run \
  --env-file ~/dev/tmp/mzm-workers-builds-deploy.env \
  --workdir ~/dev/mzm/.worktree/dev \
  -- scripts/deploy-workers-manual.sh --branch main --commit <40-char-sha>
```

実deploy前に同じwrapperへ`--dry-run`相当のlocal validationを渡せるよう、script自身が`--dry-run`を提供する。dry-runではWranglerのupload/deploy mutationを行わず、Git、config hash、credential presence、remote status、probesの定義だけを検証する。

### Upload and promotion

1. Queue/Gateway configのowner-approved SHA-256を検証
2. target SHA、current HEAD、`origin/<branch>` headを再検証
3. Queue/Gatewayを`wrangler versions upload --strict --keep-vars --tag --message`でuploadする
4. 既存のmulti-Worker rollback契約を維持するため、uploadとpromotionを分離し、`wrangler versions deploy --version-tag ... --percentage 100 --message ... --yes`でpromoteする
5. Queueを100% promoteし、`queue.mzm.dev/internal/dlq/replay`の未認証GETが302であることを確認
6. promotion直前にtarget SHAとremote branch headを再検証
7. Gatewayを100% promote
8. auth root 200、api root 404、通常/encoded internal path 404を確認

### Rollback

- promotion前に両Workerのproduction active Versionをread-backし、各1件・100%・canonical UUIDであることを要求する
- Queue probe失敗、stale target、Gateway promotion失敗ではGatewayをpromoteせずQueueを直前Versionへrollbackする
- Gateway probe失敗ではGateway、Queueの順に直前Versionへrollbackする
- rollbackは各Workerについて成否を記録する。rollback自身が失敗しても別のVersionを推測・自動選択・再試行せず、失敗したWorker、維持されたVersion、既に戻ったVersion、実行したrollback commandを出力して停止する
- rollback失敗時はproductionを未解決のpartial stateとして扱い、運用者がactive Versionをread-backして、owner承認済みの直前Version IDを明示した手動rollbackを別operationとして実行する

## Error Handling and Security

- 認証環境変数の値は出力しない。存在確認のみ行う
- account IDが期待値と一致しなければ拒否
- tokenが未設定、またはWrangler identity/account read-backが不一致ならmutation前に拒否
- config hash不一致、dirty/untracked worktree、branch/SHA mismatch、remote head driftはmutation前または各promotion直前に拒否
- `--force`、任意Worker名、任意config path、任意percentageは受け付けない
- probeは副作用のないHTTP requestのみ。DLQ replayは実行しない
- deployはlocal operatorが明示的に起動する。server、GitHub Actions、Workers Buildsから自動実行しない
- これはQueue/Gatewayのatomic deployではない。Queue promotion後Gateway promotion前の障害はrollbackで回復するが、短時間の混在状態は残る

## Non-functional Requirements

- 1回の明示kickでQueue→Gatewayを順序付きでdeployする
- 同一worktreeで並行deployを許可しない。trusted local worktreeにatomic lockを置く
- 既存secret、routes、bindings、consumers、custom domainsをdeploy commandで削除しない
- Build minutesを消費しない
- deploy command引数・stdout・stderr・artifact・GitHub文面へtoken値を出さない

## Out of Scope

- Workers Builds project/triggerのCloudflare Dashboard設定削除・解約（ownerがread-back後に別操作で行う）
- Cloud Run backend/authのrelease変更
- 新規API token発行、token rotation
- Deploy Hook導入
- 自動cron、GitHub Actions、server常駐deploy daemon
- productionでの実rollback試験

## Acceptance Criteria

- [ ] pushだけでlocal manual deploy scriptは起動しない
- [ ] Workers Buildsのpush起動停止はrepository変更だけでは完了しないことがdocsに明記され、Cloudflare ownerがBuild projectのproduction/non-production triggerを停止または切断し、Dashboard/APIでpush停止をread-backする別operator gateが定義される
- [ ] local manual scriptがclean worktree、branch、commit、account、config hashをfail-closed検証する
- [ ] `--dry-run`とsecretなしテストでmutationが起きないことを確認できる
- [ ] uploadは`wrangler versions upload`、promotionは`wrangler versions deploy`に統一される
- [ ] Queue→Gatewayのordered upload/promotionと全probeが実装される
- [ ] Queue probe、Gateway promotion、Gateway probeの各失敗で規定rollbackを行う
- [ ] rollback失敗時はpartial stateと手動復旧対象を明示して停止する
- [ ] shell syntax、unit/integration fake-command tests、lint、buildが成功する
- [ ] 1Password経由の実行手順がrunbookにあり、token値を保存・表示しない
- [ ] Workers Builds固有のmetadata、Build UUID、Build token設定をrepositoryの通常deploy scriptから除去する。Cloudflare Dashboard側のproject/trigger削除は別operator gateとする
- [ ] 実production deployはownerの明示kickなしに実行しない

## Assumptions

- 現在のWorker config hashとproduction probe URLは既存runbookの値を正とする
- 既存tokenはWrangler直接deployに必要なWorkers Scripts editおよびQueueのR2 read権限を持つ。実deploy前に`wrangler whoami`と対象deploy capabilityをread-backする
- Workers Builds trigger/projectの削除またはpush無効化は、このrepository変更とは別のCloudflare owner/configuration操作として実施し、read-backする

## Adversarial Review

Round 1: independent reviewer `gpt-5.4-mini`, target revision 2026-08-10 initial draft.

- Verdict: failed
- Blocking: B1 (local input contract conflicted with CI-only implementation assumptions), B2 (mixed `wrangler deploy` and Versions API)
- Major: M1 (push-trigger disablement requires Cloudflare-side operator gate), M2 (rollback failure state/manual recovery incomplete), M3 (dirty/branch/SHA validation boundary ambiguous)
- Resolution: local CLI now requires explicit `--branch` and `--commit`; upload/promotion are fixed to `wrangler versions upload`/`wrangler versions deploy`; Cloudflare trigger disablement is a separate owner operation with Dashboard/API read-back; rollback failure is an unresolved partial state with explicit manual recovery; validation order and ignored-file policy are explicit.

Round 2: independent closure reviewer `gpt-5.4-mini`, target revision after Round 1 resolution.

- Verdict: failed
- Major: M1 (Upload and promotion section still contained one stale `wrangler deploy` command, conflicting with Versions API contract)
- Resolution: Upload and promotion now explicitly use only `wrangler versions upload` and `wrangler versions deploy`.

Round 3: independent final closure reviewer `gpt-5.4-mini`, target revision after Round 2 resolution.

- Verdict: passed
- Blocking: 0
- Major: 0
- Summary: Versions APIへの統一、branch/SHAの明示、dirty/untrackedのfail-closed、Cloudflare側push停止の責任境界、partial rollbackの扱いが整合していることを確認。
