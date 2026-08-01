import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const script = path.join(repoRoot, 'scripts', 'deploy-workers-builds.sh')
const buildUuid = '123e4567-e89b-12d3-a456-426614174000'
const buildSha = '1111111111111111111111111111111111111111'

function sha256(relativePath) {
  return createHash('sha256')
    .update(readFileSync(path.join(repoRoot, relativePath)))
    .digest('hex')
}

function baseCiEnv(overrides = {}) {
  return {
    ...process.env,
    WORKERS_CI: '1',
    WORKERS_CI_BUILD_UUID: buildUuid,
    WORKERS_CI_COMMIT_SHA: buildSha,
    WORKERS_CI_BRANCH: 'feature/workers-builds',
    EXPECTED_QUEUE_WRANGLER_SHA256: sha256(
      'packages/queue-worker/wrangler.jsonc'
    ),
    EXPECTED_GATEWAY_WRANGLER_SHA256: sha256(
      'packages/event-gateway-worker/wrangler.jsonc'
    ),
    ...overrides
  }
}

test('Workers CI outside execution is rejected before deployment', () => {
  let error
  try {
    execFileSync('bash', [script], {
      cwd: repoRoot,
      env: { ...process.env, WORKERS_CI: '' },
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  }

  assert.ok(error, 'deployment unexpectedly succeeded')
  assert.match(error.stderr, /WORKERS_CI must be 1/)
})

test('non-canonical Build UUID is rejected before deployment', () => {
  let error
  try {
    execFileSync('bash', [script], {
      cwd: repoRoot,
      env: baseCiEnv({ WORKERS_CI_BUILD_UUID: '----------------' }),
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  }

  assert.ok(error, 'deployment unexpectedly accepted an invalid Build UUID')
  assert.match(error.stderr, /WORKERS_CI_BUILD_UUID has an invalid format/)
})

test('stale branch build is rejected before upload', () => {
  const fakeBin = mkdtempSync(
    path.join(os.tmpdir(), 'mzm-workers-builds-test-')
  )
  const fakeGit = path.join(fakeBin, 'git')
  writeFileSync(
    fakeGit,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "rev-parse HEAD" ]]; then
  printf '%s\\n' '${buildSha}'
elif [[ "$1" == "ls-remote" ]]; then
  printf '%s\\trefs/heads/feature/workers-builds\\n' '2222222222222222222222222222222222222222'
else
  exit 64
fi
`
  )
  chmodSync(fakeGit, 0o755)

  let error
  try {
    execFileSync('bash', [script], {
      cwd: repoRoot,
      env: baseCiEnv({ PATH: `${fakeBin}:${process.env.PATH}` }),
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  } finally {
    rmSync(fakeBin, { recursive: true, force: true })
  }

  assert.ok(error, 'stale deployment unexpectedly succeeded')
  assert.match(error.stderr, /remote branch head does not match build SHA/)
})

function runFakeDeployment({
  queueProbeStatus = '302',
  gatewayRootStatus = '200',
  staleRemoteCall = '0',
  failGatewayPromotion = false
} = {}) {
  const fakeBin = mkdtempSync(
    path.join(os.tmpdir(), 'mzm-workers-builds-test-')
  )
  const logPath = path.join(fakeBin, 'commands.log')
  const writeExecutable = (name, content) => {
    const target = path.join(fakeBin, name)
    writeFileSync(target, content)
    chmodSync(target, 0o755)
  }

  writeExecutable(
    'git',
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "rev-parse HEAD" ]]; then
  printf '%s\\n' '${buildSha}'
elif [[ "$1" == "ls-remote" ]]; then
  printf 'git ls-remote\\n' >> "$TEST_LOG"
  count=0
  [[ ! -f "$TEST_GIT_CALLS" ]] || count="$(<"$TEST_GIT_CALLS")"
  count="$((count + 1))"
  printf '%s' "$count" > "$TEST_GIT_CALLS"
  oid='${buildSha}'
  [[ "$count" != "$STALE_REMOTE_CALL" ]] || oid='2222222222222222222222222222222222222222'
  printf '%s\\trefs/heads/feature/workers-builds\\n' "$oid"
else
  exit 64
fi
`
  )
  writeExecutable(
    'npm',
    `#!/usr/bin/env bash
set -euo pipefail
printf 'npm' >> "$TEST_LOG"
printf ' %q' "$@" >> "$TEST_LOG"
printf '\\n' >> "$TEST_LOG"
args=" $* "
if [[ "$args" == *" deployments status "* ]]; then
  if [[ "$args" == *" packages/queue-worker "* ]]; then
    printf '%s\\n' '{"versions":[{"version_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","percentage":100}]}'
  elif [[ "$args" == *" packages/event-gateway-worker "* ]]; then
    printf '%s\\n' '{"versions":[{"version_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","percentage":100}]}'
  else
    exit 65
  fi
elif [[ "$FAIL_GATEWAY_PROMOTION" == "1" && "$args" == *" packages/event-gateway-worker "* && "$args" == *" versions deploy "* ]]; then
  exit 66
fi
`
  )
  writeExecutable(
    'curl',
    `#!/usr/bin/env bash
set -euo pipefail
url="\${!#}"
printf 'curl %s\\n' "$url" >> "$TEST_LOG"
case "$url" in
  https://queue.mzm.dev/internal/dlq/replay) printf '${queueProbeStatus}' ;;
  https://auth.mzm.dev/) printf '${gatewayRootStatus}' ;;
  https://api.mzm.dev/|*/internal/outbox/v1/claim|*/%69nternal/outbox/v1/claim) printf '404' ;;
  *) printf '599' ;;
esac
`
  )

  let error
  try {
    execFileSync('bash', [script], {
      cwd: repoRoot,
      env: baseCiEnv({
        PATH: `${fakeBin}:${process.env.PATH}`,
        TEST_LOG: logPath,
        TEST_GIT_CALLS: path.join(fakeBin, 'git-calls'),
        STALE_REMOTE_CALL: staleRemoteCall,
        FAIL_GATEWAY_PROMOTION: failGatewayPromotion ? '1' : '0'
      }),
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } catch (caught) {
    error = caught
  } finally {
    const commands = readFileSync(logPath, 'utf8').trim().split('\n')
    rmSync(fakeBin, { recursive: true, force: true })
    return { commands, error }
  }
}

test('uploads both versions before ordered promotion and read-only probes', () => {
  const { commands, error } = runFakeDeployment()
  assert.ifError(error)
  assert.equal(commands.filter((line) => line === 'git ls-remote').length, 3)
  assert.match(commands[1], /queue-worker.*deployments status.*--json/)
  assert.match(commands[2], /event-gateway-worker.*deployments status.*--json/)
  assert.match(commands[3], /queue-worker.*versions upload/)
  assert.match(commands[4], /event-gateway-worker.*versions upload/)
  assert.equal(commands[5], 'git ls-remote')
  assert.match(commands[6], /queue-worker.*versions deploy/)
  assert.equal(commands[7], 'curl https://queue.mzm.dev/internal/dlq/replay')
  assert.equal(commands[8], 'git ls-remote')
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

test('rolls Queue back when the Queue production probe fails', () => {
  const { commands, error } = runFakeDeployment({ queueProbeStatus: '500' })
  assert.ok(
    error,
    'deployment unexpectedly succeeded after a failed Queue probe'
  )
  assert.match(error.stderr, /Queue probe failed; rollback completed/)
  assert.match(
    commands.at(-1),
    /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/
  )
  assert.equal(
    commands.some(
      (line) =>
        /event-gateway-worker.*versions deploy/.test(line) &&
        !/deployments status/.test(line)
    ),
    false
  )
})

test('rolls Queue back when the branch becomes stale before Gateway promotion', () => {
  const { commands, error } = runFakeDeployment({ staleRemoteCall: '3' })
  assert.ok(
    error,
    'stale deployment unexpectedly continued to Gateway promotion'
  )
  assert.match(error.stderr, /branch became stale; Queue rollback completed/)
  assert.match(
    commands.at(-1),
    /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/
  )
})

test('rolls Queue back when Gateway promotion fails', () => {
  const { commands, error } = runFakeDeployment({ failGatewayPromotion: true })
  assert.ok(
    error,
    'deployment unexpectedly succeeded after Gateway promotion failure'
  )
  assert.match(
    error.stderr,
    /Gateway promotion failed; Queue rollback completed/
  )
  assert.match(
    commands.at(-1),
    /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/
  )
})

test('rolls Gateway then Queue back when a Gateway probe fails', () => {
  const { commands, error } = runFakeDeployment({ gatewayRootStatus: '500' })
  assert.ok(
    error,
    'deployment unexpectedly succeeded after a failed Gateway probe'
  )
  assert.match(error.stderr, /Gateway probe failed; rollback completed/)
  assert.match(
    commands.at(-2),
    /event-gateway-worker.*versions deploy.*--version-id.*bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/
  )
  assert.match(
    commands.at(-1),
    /queue-worker.*versions deploy.*--version-id.*aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/
  )
})
