import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(repoRoot, 'scripts', 'deploy-workers-manual.sh')
const buildSha = '1111111111111111111111111111111111111111'
const branch = 'feature/workers-builds'
const args = ['--branch', branch, '--commit', buildSha]

function runFakeDeployment({
  queueProbeStatus = '302',
  gatewayRootStatus = '200',
  staleRemoteCall = '0',
  failGatewayPromotion = false,
  dirty = false,
  dryRun = false
} = {}) {
  const fakeBin = mkdtempSync(path.join(os.tmpdir(), 'mzm-workers-manual-test-'))
  const logPath = path.join(fakeBin, 'commands.log')
  const gitCallsPath = path.join(fakeBin, 'git-calls')
  const writeExecutable = (name, content) => {
    const target = path.join(fakeBin, name)
    writeFileSync(target, content)
    chmodSync(target, 0o755)
  }

  writeExecutable('git', `#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
  "symbolic-ref --quiet") printf '%s\\n' '${branch}' ;;
  "status --porcelain")
    if [[ "\${DIRTY:-0}" == 1 ]]; then printf '?? unsafe.txt\\n'; fi
    ;;
  "rev-parse HEAD") printf '%s\\n' '${buildSha}' ;;
  "ls-remote --heads")
    printf 'git ls-remote\\n' >> "$TEST_LOG"
    count=0
    [[ ! -f "$TEST_GIT_CALLS" ]] || count="$(<"$TEST_GIT_CALLS")"
    count="$((count + 1))"
    printf '%s' "$count" > "$TEST_GIT_CALLS"
    oid='${buildSha}'
    [[ "$count" != "${staleRemoteCall}" ]] || oid='2222222222222222222222222222222222222222'
    printf '%s\\trefs/heads/${branch}\\n' "$oid"
    ;;
  *) exit 64 ;;
esac
`)

  writeExecutable('npm', `#!/usr/bin/env bash
set -euo pipefail
printf 'npm' >> "$TEST_LOG"
printf ' %q' "$@" >> "$TEST_LOG"
printf '\\n' >> "$TEST_LOG"
args=" $* "
if [[ "$args" == *" deployments status --json "* ]]; then
  if [[ "$args" == *" packages/queue-worker "* ]]; then
    printf '%s\\n' '{"versions":[{"version_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","percentage":100}]}'
  elif [[ "$args" == *" packages/event-gateway-worker "* ]]; then
    printf '%s\\n' '{"versions":[{"version_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","percentage":100}]}'
  else
    exit 65
  fi
elif [[ "\${FAIL_GATEWAY_PROMOTION:-0}" == 1 && "$args" == *" packages/event-gateway-worker "* && "$args" == *" versions deploy "* && "$args" != *"--version-id"* ]]; then
  exit 66
fi
`)

  writeExecutable('curl', `#!/usr/bin/env bash
set -euo pipefail
url="\${!#}"
printf 'curl %s\\n' "$url" >> "$TEST_LOG"
case "$url" in
  https://queue.mzm.dev/internal/dlq/replay) printf '${queueProbeStatus}' ;;
  https://auth.mzm.dev/) printf '${gatewayRootStatus}' ;;
  https://api.mzm.dev/) printf '404' ;;
  */internal/outbox/v1/claim|*/%69nternal/outbox/v1/claim) printf '404' ;;
  *) printf '599' ;;
esac
`)

  let error
  try {
    execFileSync('bash', [script, ...args, ...(dryRun ? ['--dry-run'] : [])], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        TMPDIR: fakeBin,
        TEST_LOG: logPath,
        TEST_GIT_CALLS: gitCallsPath,
        CLOUDFLARE_ACCOUNT_ID: '789787f7b7b778b108bb8ad86350db9d',
        CLOUDFLARE_API_TOKEN: 'redacted-test-token',
        DIRTY: dirty ? '1' : '0',
        FAIL_GATEWAY_PROMOTION: failGatewayPromotion ? '1' : '0'
      },
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  }

  const commands = existsSync(logPath)
    ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean)
    : []
  rmSync(fakeBin, { recursive: true, force: true })
  return { commands, error, stderr: error?.stderr ?? '' }
}

test('requires explicit branch and commit', () => {
  let error
  try {
    execFileSync('bash', [script], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' })
  } catch (caught) {
    error = caught
  }
  assert.ok(error)
  assert.equal(error.status, 64)
})

test('rejects missing token before invoking Wrangler', () => {
  let error
  try {
    execFileSync('bash', [script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: '789787f7b7b778b108bb8ad86350db9d', CLOUDFLARE_API_TOKEN: '' },
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  }
  assert.ok(error)
  assert.match(error.stderr, /CLOUDFLARE_API_TOKEN is required/)
})

test('rejects dirty worktree before invoking Wrangler', () => {
  const { error, commands } = runFakeDeployment({ dirty: true })
  assert.ok(error)
  assert.match(error.stderr, /worktree is dirty/)
  assert.deepEqual(commands, [])
})

test('dry-run uploads only and never promotes traffic', () => {
  const { commands, error, stderr } = runFakeDeployment({ dryRun: true })
  assert.equal(error, undefined, stderr)
  assert.equal(commands.filter((line) => line.includes('versions deploy')).length, 0)
  assert.equal(commands.filter((line) => line.includes('--dry-run')).length, 2)
  assert.match(commands[0], /ls-remote/)
  assert.match(commands[1], /queue-worker.*versions upload.*--dry-run/)
  assert.match(commands[2], /event-gateway-worker.*versions upload.*--dry-run/)
})

test('uploads both versions before ordered promotion and probes', () => {
  const { error, commands, stderr } = runFakeDeployment()
  assert.equal(error, undefined, stderr)
  assert.equal(commands.filter((line) => line.includes('ls-remote')).length, 3)
  assert.match(commands[0], /ls-remote/)
  assert.match(commands[1], /queue-worker.*deployments status/)
  assert.match(commands[2], /event-gateway-worker.*deployments status/)
  assert.match(commands[3], /queue-worker.*versions upload/)
  assert.match(commands[4], /event-gateway-worker.*versions upload/)
  assert.match(commands[5], /ls-remote/)
  assert.match(commands[6], /queue-worker.*versions deploy/)
  assert.equal(commands[7], 'curl https://queue.mzm.dev/internal/dlq/replay')
  assert.match(commands[8], /ls-remote/)
  assert.match(commands[9], /event-gateway-worker.*versions deploy/)
  assert.deepEqual(commands.slice(10), [
    'curl https://auth.mzm.dev/',
    'curl https://api.mzm.dev/',
    'curl https://auth.mzm.dev/internal/outbox/v1/claim',
    'curl https://auth.mzm.dev/%69nternal/outbox/v1/claim',
    'curl https://api.mzm.dev/internal/outbox/v1/claim',
    'curl https://api.mzm.dev/%69nternal/outbox/v1/claim'
  ])
})

test('rolls Queue back when the Queue probe fails', () => {
  const { commands, error } = runFakeDeployment({ queueProbeStatus: '500' })
  assert.ok(error)
  assert.match(error.stderr, /Queue probe failed; rollback completed/)
  assert.match(commands.at(-1), /versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)
})

test('rolls Gateway and Queue back when Gateway promotion fails', () => {
  const { commands, error } = runFakeDeployment({ failGatewayPromotion: true })
  assert.ok(error)
  assert.match(error.stderr, /Gateway promotion failed; Gateway and Queue rollback completed/)
  assert.match(commands.at(-2), /event-gateway-worker.*versions deploy.*--version-id.*bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/)
  assert.match(commands.at(-1), /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)
})

test('rolls Gateway then Queue back when a Gateway probe fails', () => {
  const { commands, error, stderr } = runFakeDeployment({ gatewayRootStatus: '500' })
  assert.ok(error, `${stderr}\n${commands.join('\\n')}`)
  assert.match(error.stderr, /Gateway probe failed; Gateway and Queue rollback completed/)
  assert.match(commands.at(-2), /event-gateway-worker.*versions deploy.*--version-id.*bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/)
  assert.match(commands.at(-1), /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)
})
