#!/usr/bin/env bash
set -euo pipefail

readonly QUEUE_CONFIG="packages/queue-worker/wrangler.jsonc"
readonly GATEWAY_CONFIG="packages/event-gateway-worker/wrangler.jsonc"

fatal() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_sha256() {
  local name="$1"
  local value="${!name:-}"
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || fatal "$name must be a lowercase SHA-256"
}

verify_config_hash() {
  local config="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum -- "$config")"
  actual="${actual%% *}"
  [[ "$actual" == "$expected" ]] || fatal "$config SHA-256 does not match the owner-approved value"
}

remote_branch_head() {
  local branch="$1"
  local output oid ref extra
  output="$(git ls-remote --heads origin "refs/heads/$branch")"
  read -r oid ref extra <<<"$output"
  [[ -n "${oid:-}" && -n "${ref:-}" && -z "${extra:-}" ]] || fatal "remote branch is missing or ambiguous: $branch"
  [[ "$oid" =~ ^[0-9a-f]{40}$ && "$ref" == "refs/heads/$branch" ]] || fatal "remote branch response is invalid: $branch"
  printf '%s\n' "$oid"
}

verify_current_branch_head() {
  local remote_sha
  remote_sha="$(remote_branch_head "$WORKERS_CI_BRANCH")"
  [[ "$remote_sha" == "$WORKERS_CI_COMMIT_SHA" ]] || fatal "remote branch head does not match build SHA"
}

[[ "${WORKERS_CI:-}" == "1" ]] || fatal "WORKERS_CI must be 1"
[[ "${WORKERS_CI_BUILD_UUID:-}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || fatal "WORKERS_CI_BUILD_UUID has an invalid format"
[[ "${WORKERS_CI_COMMIT_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fatal "WORKERS_CI_COMMIT_SHA must be a lowercase 40-character SHA"
[[ "${WORKERS_CI_BRANCH:-}" =~ ^[A-Za-z0-9._/-]+$ ]] || fatal "WORKERS_CI_BRANCH has an invalid format"
[[ "$WORKERS_CI_BRANCH" != -* && "$WORKERS_CI_BRANCH" != *..* && "$WORKERS_CI_BRANCH" != *//* ]] || fatal "WORKERS_CI_BRANCH is unsafe"

# A connected build pins Wrangler to the connected Worker. This pipeline intentionally
# orchestrates two explicitly hashed configs, so do not let that single-Worker identity
# override either config or reject the second Worker by tag.
unset WRANGLER_CI_OVERRIDE_NAME WRANGLER_CI_MATCH_TAG

require_sha256 EXPECTED_QUEUE_WRANGLER_SHA256
require_sha256 EXPECTED_GATEWAY_WRANGLER_SHA256
verify_config_hash "$QUEUE_CONFIG" "$EXPECTED_QUEUE_WRANGLER_SHA256"
verify_config_hash "$GATEWAY_CONFIG" "$EXPECTED_GATEWAY_WRANGLER_SHA256"

local_sha="$(git rev-parse HEAD)"
[[ "$local_sha" == "$WORKERS_CI_COMMIT_SHA" ]] || fatal "git HEAD does not match build SHA"
verify_current_branch_head

uuid_compact="${WORKERS_CI_BUILD_UUID//-/}"
version_tag="mzm-${WORKERS_CI_COMMIT_SHA:0:12}-${uuid_compact:0:12}"
deployment_message="source=mzmessenger/mzm branch=$WORKERS_CI_BRANCH commit=$WORKERS_CI_COMMIT_SHA build=$WORKERS_CI_BUILD_UUID"

upload_version() {
  local workspace="$1"
  npm exec -w "$workspace" -- wrangler versions upload \
    --strict \
    --keep-vars \
    --tag "$version_tag" \
    --message "$deployment_message"
}

promote_version() {
  local workspace="$1"
  npm exec -w "$workspace" -- wrangler versions deploy \
    --version-tag "$version_tag" \
    --percentage 100 \
    --message "$deployment_message" \
    --yes
}

current_version() {
  local workspace="$1"
  local status
  status="$(npm exec -w "$workspace" -- wrangler deployments status --json)"
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

rollback_version() {
  local workspace="$1"
  local version_id="$2"
  local reason="$3"
  npm exec -w "$workspace" -- wrangler versions deploy \
    --version-id "$version_id" \
    --percentage 100 \
    --message "rollback reason=$reason source-build=$WORKERS_CI_BUILD_UUID" \
    --yes
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

previous_queue_version="$(current_version packages/queue-worker)"
previous_gateway_version="$(current_version packages/event-gateway-worker)"

upload_version packages/queue-worker
upload_version packages/event-gateway-worker

# Check immediately before Queue promotion.
verify_current_branch_head

promote_version packages/queue-worker
if ! probe_status 302 https://queue.mzm.dev/internal/dlq/replay; then
  rollback_version packages/queue-worker "$previous_queue_version" queue-probe-failed
  fatal "Queue probe failed; rollback completed"
fi

# Queue probing can take long enough for the branch head to change.
if ! (verify_current_branch_head); then
  rollback_version packages/queue-worker "$previous_queue_version" stale-before-gateway
  fatal "branch became stale; Queue rollback completed"
fi
if ! promote_version packages/event-gateway-worker; then
  rollback_version packages/queue-worker "$previous_queue_version" gateway-promotion-failed
  fatal "Gateway promotion failed; Queue rollback completed"
fi

probe_gateway() {
  probe_status 200 https://auth.mzm.dev/ || return 1
  probe_status 404 https://api.mzm.dev/ || return 1
  probe_status 404 https://auth.mzm.dev/internal/outbox/v1/claim || return 1
  probe_status 404 https://auth.mzm.dev/%69nternal/outbox/v1/claim || return 1
  probe_status 404 https://api.mzm.dev/internal/outbox/v1/claim || return 1
  probe_status 404 https://api.mzm.dev/%69nternal/outbox/v1/claim || return 1
}

if ! probe_gateway; then
  rollback_version packages/event-gateway-worker "$previous_gateway_version" gateway-probe-failed
  rollback_version packages/queue-worker "$previous_queue_version" gateway-probe-failed
  fatal "Gateway probe failed; rollback completed"
fi

printf 'Deployment completed: tag=%s commit=%s build=%s\n' \
  "$version_tag" "$WORKERS_CI_COMMIT_SHA" "$WORKERS_CI_BUILD_UUID"
