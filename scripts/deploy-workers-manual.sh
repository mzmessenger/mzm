#!/usr/bin/env bash
set -euo pipefail

readonly QUEUE_CONFIG="packages/queue-worker/wrangler.jsonc"
readonly GATEWAY_CONFIG="packages/event-gateway-worker/wrangler.jsonc"
readonly EXPECTED_ACCOUNT_ID="789787f7b7b778b108bb8ad86350db9d"
readonly EXPECTED_QUEUE_WRANGLER_SHA256="35b4ecb20f912ebf17fc7e8b9c923a1bbd313ee66c6bca9723b49543e66347f0"
readonly EXPECTED_GATEWAY_WRANGLER_SHA256="689d8ca9f33db1600c0bc93cc486e75186334c244f8e0ad024b54f6be0e47246"
readonly LOCK_PATH="${TMPDIR:-/tmp}/mzm-worker-manual-deploy.lock"

fatal() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: scripts/deploy-workers-manual.sh --branch BRANCH --commit SHA [--dry-run]
EOF
  exit 64
}

branch=''
target_sha=''
dry_run=0
while (($# > 0)); do
  case "$1" in
    --branch)
      (($# >= 2)) || usage
      branch="$2"
      shift 2
      ;;
    --commit)
      (($# >= 2)) || usage
      target_sha="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --help|-h)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

[[ -n "$branch" && -n "$target_sha" ]] || usage
[[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || fatal 'branch has an invalid format'
[[ "$branch" != -* && "$branch" != *..* && "$branch" != *//* ]] || fatal 'branch is unsafe'
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || fatal 'commit must be a lowercase 40-character SHA'
[[ "${CLOUDFLARE_ACCOUNT_ID:-}" == "$EXPECTED_ACCOUNT_ID" ]] || fatal 'CLOUDFLARE_ACCOUNT_ID does not target the approved account'
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || fatal 'CLOUDFLARE_API_TOKEN is required; inject it through hermes-secret-run'

exec 9>"$LOCK_PATH"
flock -n 9 || fatal 'another manual Worker deployment is already running'

verify_config_hash() {
  local config="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum -- "$config")"
  actual="${actual%% *}"
  [[ "$actual" == "$expected" ]] || fatal "$config SHA-256 does not match the owner-approved value"
}

remote_branch_head() {
  local output oid ref extra
  output="$(git ls-remote --heads origin "refs/heads/$branch")"
  read -r oid ref extra <<<"$output"
  [[ -n "${oid:-}" && -n "${ref:-}" && -z "${extra:-}" ]] || fatal "remote branch is missing or ambiguous: $branch"
  [[ "$oid" =~ ^[0-9a-f]{40}$ && "$ref" == "refs/heads/$branch" ]] || fatal "remote branch response is invalid: $branch"
  printf '%s\n' "$oid"
}

verify_target() {
  local current_branch local_sha remote_sha status
  current_branch="$(git symbolic-ref --quiet --short HEAD)" || fatal 'detached HEAD is not deployable'
  [[ "$current_branch" == "$branch" ]] || fatal "current branch does not match --branch: $current_branch"
  status="$(git status --porcelain --untracked-files=all)"
  [[ -z "$status" ]] || fatal 'worktree is dirty or contains untracked files'
  local_sha="$(git rev-parse HEAD)"
  [[ "$local_sha" == "$target_sha" ]] || fatal 'git HEAD does not match --commit'
  remote_sha="$(remote_branch_head)"
  [[ "$remote_sha" == "$target_sha" ]] || fatal 'origin branch head does not match --commit'
}

verify_config_hash "$QUEUE_CONFIG" "$EXPECTED_QUEUE_WRANGLER_SHA256"
verify_config_hash "$GATEWAY_CONFIG" "$EXPECTED_GATEWAY_WRANGLER_SHA256"
verify_target

version_tag="mzm-${target_sha:0:12}-manual-$(date -u +%Y%m%dT%H%M%SZ)"
deployment_message="source=mzmessenger/mzm branch=$branch commit=$target_sha deploy=local-manual"

wrangler() {
  local workspace="$1"
  shift
  npm exec -w "$workspace" -- wrangler "$@"
}

current_version() {
  local workspace="$1"
  local status
  status="$(wrangler "$workspace" deployments status --json)"
  STATUS_JSON="$status" node -e '
const status = JSON.parse(process.env.STATUS_JSON)
const versions = status?.versions
if (
  !Array.isArray(versions) ||
  versions.length !== 1 ||
  versions[0]?.percentage !== 100 ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    versions[0]?.version_id ?? ""
  )
) {
  process.stderr.write("ERROR: production must have exactly one valid Version at 100% before deployment\\n")
  process.exit(1)
}
process.stdout.write(versions[0].version_id)
'
}

upload_version() {
  local workspace="$1"
  wrangler "$workspace" versions upload \
    --strict \
    --keep-vars \
    --tag "$version_tag" \
    --message "$deployment_message"
}

upload_version_dry_run() {
  local workspace="$1"
  wrangler "$workspace" versions upload \
    --dry-run \
    --strict \
    --keep-vars \
    --tag "$version_tag" \
    --message "$deployment_message"
}

promote_version() {
  local workspace="$1"
  wrangler "$workspace" versions deploy \
    --version-tag "$version_tag" \
    --percentage 100 \
    --message "$deployment_message" \
    --yes
}

rollback_version() {
  local workspace="$1"
  local version_id="$2"
  local reason="$3"
  wrangler "$workspace" versions deploy \
    --version-id "$version_id" \
    --percentage 100 \
    --message "rollback reason=$reason source-commit=$target_sha" \
    --yes
}

rollback_workers() {
  local reason="$1"
  shift
  local failed=0 workspace version_id
  while (($# > 0)); do
    workspace="$1"
    version_id="$2"
    shift 2
    if ! rollback_version "$workspace" "$version_id" "$reason"; then
      printf 'ERROR: rollback failed workspace=%s version=%s reason=%s\n' "$workspace" "$version_id" "$reason" >&2
      failed=1
    fi
  done
  return "$failed"
}

probe_status() {
  local expected="$1"
  local url="$2"
  local actual
  if ! actual="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 "$url")"; then
    printf 'ERROR: probe request failed: %s\n' "$url" >&2
    return 1
  fi
  if [[ "$actual" != "$expected" ]]; then
    printf 'ERROR: probe returned HTTP %s, expected %s: %s\n' "$actual" "$expected" "$url" >&2
    return 1
  fi
}

probe_gateway() {
  probe_status 200 https://auth.mzm.dev/ || return 1
  probe_status 404 https://api.mzm.dev/ || return 1
  probe_status 404 https://auth.mzm.dev/internal/outbox/v1/claim || return 1
  probe_status 404 https://auth.mzm.dev/%69nternal/outbox/v1/claim || return 1
  probe_status 404 https://api.mzm.dev/internal/outbox/v1/claim || return 1
  probe_status 404 https://api.mzm.dev/%69nternal/outbox/v1/claim || return 1
}

if ((dry_run)); then
  upload_version_dry_run packages/queue-worker
  upload_version_dry_run packages/event-gateway-worker
  printf 'Dry-run completed: branch=%s commit=%s tag=%s\n' "$branch" "$target_sha" "$version_tag"
  exit 0
fi

previous_queue_version="$(current_version packages/queue-worker)"
previous_gateway_version="$(current_version packages/event-gateway-worker)"

upload_version packages/queue-worker
upload_version packages/event-gateway-worker

# Re-check the selected immutable target immediately before the first promotion.
verify_target

promote_version packages/queue-worker
if ! probe_status 302 https://queue.mzm.dev/internal/dlq/replay; then
  if rollback_workers queue-probe-failed packages/queue-worker "$previous_queue_version"; then
    fatal 'Queue probe failed; rollback completed'
  fi
  fatal 'Queue probe failed; rollback is incomplete; manual intervention required'
fi

# Queue probing can take long enough for the selected branch head to change.
if ! verify_target; then
  if rollback_workers stale-before-gateway packages/queue-worker "$previous_queue_version"; then
    fatal 'target became stale; Queue rollback completed'
  fi
  fatal 'target became stale; Queue rollback is incomplete; manual intervention required'
fi

if ! promote_version packages/event-gateway-worker; then
  if rollback_workers gateway-promotion-failed \
    packages/event-gateway-worker "$previous_gateway_version" \
    packages/queue-worker "$previous_queue_version"; then
    fatal 'Gateway promotion failed; Gateway and Queue rollback completed'
  fi
  fatal 'Gateway promotion failed; rollback is incomplete; manual intervention required'
fi

if ! probe_gateway; then
  if rollback_workers gateway-probe-failed \
    packages/event-gateway-worker "$previous_gateway_version" \
    packages/queue-worker "$previous_queue_version"; then
    fatal 'Gateway probe failed; Gateway and Queue rollback completed'
  fi
  fatal 'Gateway probe failed; rollback is incomplete; manual intervention required'
fi

printf 'Deployment completed: branch=%s commit=%s tag=%s\n' "$branch" "$target_sha" "$version_tag"
