# Cloudflare Queues direct producer + MongoDB transactional outbox

- Status: Approved; review contracts F-01..F-10 incorporated
- Target repository: `mzmessenger/mzm`
- Related PR: #312
- Progress record: `koh110/memo#1`
- Realtime follow-up: `koh110/memo#12`
- Updated: 2026-07-14

## Overview

### Goal

Redis Streams and Redis locks have been removed from the local development path, but the first replacement made Node backend/auth publish events through an HTTP producer Worker. That design is rejected: it exposes queue availability, timeout ambiguity, retry, and credential handling to Node request handlers, and it has no durable producer recovery.

Replace it with a producer-only Cloudflare Workers design:

1. Node backend/auth remain the systems that execute existing business logic and access MongoDB/Elasticsearch.
2. A Cloudflare gateway Worker is the only public entry point for event-producing mutations.
3. Node commits the business mutation, idempotency result, and outbox events in one MongoDB transaction.
4. The gateway Worker and a scheduled relay Worker publish claimed outbox events directly using the Cloudflare Queue binding (`env.EVENTS.sendBatch()`); Node never publishes to a Queue HTTP endpoint.
5. Cloudflare Queues provides at-least-once delivery to the existing backend/auth consumers. Consumers are made durable-idempotent.

### Users and intended behavior

- End users submit chat, vote, room, and account-removal mutations through the existing public API origins.
- A successful mutation returns only after its event batch has been accepted by Cloudflare Queues.
- If the database mutation committed but immediate Queue publication cannot be confirmed, the response is `503`. The client retries the **same** `Idempotency-Key`; the mutation is not re-applied. A scheduled relay also recovers the committed outbox independently of the client.
- Queue delivery to consumers is at-least-once. DB side effects are applied once per event ID. Realtime SSE clients de-duplicate received event IDs locally.

## Scope

### In scope

- Remove Node-to-Worker `POST /events` publishing and its shared producer secret/URL configuration.
- New gateway/relay Worker with a direct Cloudflare Queue producer binding.
- Transactional MongoDB outbox and idempotency-operation records.
- MongoDB replica set requirement in production, local Docker Compose, and CI test services.
- Gateway retry response contract, scheduled outbox recovery, Queue consumer retry/DLQ configuration, and durable consumer idempotency.
- Client-side de-duplication of realtime event IDs.
- Tests and observability required by this document.

### Out of scope

- Migrating all backend/auth business logic, Passport OAuth, MongoDB, or Elasticsearch to Workers.
- Replacing the process-local SSE connection map or providing durable notification replay. That remains `koh110/memo#12` (Durable Objects + WebSocket Hibernation).
- Automatic external notification for a DLQ or prolonged outbox relay failure. Operators initially inspect Cloudflare Dashboard and Worker/Queue logs.
- Exactly-once Queue transport. The supported contract is at-least-once transport plus idempotent effects.

## Existing system facts

- `packages/backend` and `packages/auth` are Node/Express services deployed to Google Cloud Run.
- `POST /api/socket` dispatches chat/room/vote mutations. One successful mutation can generate multiple `message`, `unread`, `reply`, and `vote` events.
- `DELETE /auth/user` generates `removeUser`.
- The frontend currently calls `https://api.mzm.dev` and `https://auth.mzm.dev` directly.
- The existing `packages/frontend` Cloudflare Worker is static asset delivery for `mzm.dev`; it is not an API gateway.
- Current queue consumer config has `max_retries: 5` but no DLQ. Without a DLQ, repeatedly failing messages can be discarded.
- Current local Docker Compose and CI MongoDB services are standalone; transactions require a replica set or sharded cluster.

## Technical investigation and verified constraints

| Decision / constraint | Verified source |
| --- | --- |
| A Queue producer is a Worker binding; the producer API exposes `send()` and `sendBatch()` | Cloudflare Queues JavaScript APIs: https://developers.cloudflare.com/queues/configuration/javascript-apis/ |
| `sendBatch()` supports up to 100 messages | Cloudflare Queues changelog / JavaScript API documentation: https://developers.cloudflare.com/queues/configuration/javascript-apis/ |
| `waitUntil()` publication errors are non-blocking and can be ignored; publish is therefore awaited in request/relay paths | Cloudflare Queues how-it-works: https://developers.cloudflare.com/queues/reference/how-queues-works/ |
| Consumer failures are retried and a configured DLQ receives messages at the retry limit | Cloudflare Queue retries and DLQ: https://developers.cloudflare.com/queues/configuration/batching-retries/ and https://developers.cloudflare.com/queues/configuration/dead-letter-queues/ |
| Worker `scheduled()` handlers are supported by Cron Triggers | Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/ |
| MongoDB multi-document transactions require a replica set or sharded cluster | MongoDB Transactions: https://www.mongodb.com/docs/manual/core/transactions/ and Node driver: https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/ |
| Existing backend/auth are Node services with native MongoDB clients | `packages/backend/src/server.ts`, `packages/auth/src/server.ts`, `packages/*/src/lib/db.ts` |

## Architecture

```text
browser
  │ mutation with Idempotency-Key
  ▼
Gateway Worker on api.mzm.dev / auth.mzm.dev
  │ authenticated proxy + gateway-secret
  ▼
Cloud Run backend/auth (Node)
  │ MongoDB transaction
  │  ├─ business documents
  │  ├─ operation result
  │  └─ outbox events (stable IDs)
  ▼
Gateway Worker claims operation outbox events
  │ await env.EVENTS.sendBatch(events)
  ▼
Cloudflare Queue mzm-events
  │ at-least-once, retry policy and DLQ
  ▼
Queue consumer Worker
  │ authenticated callbacks; throw on failure
  ▼
Cloud Run backend/auth consumers
  │ durable receipt / idempotent side effect
  ▼
MongoDB and existing SSE sender

Scheduled relay Worker (same Worker service)
  └─ periodically claims expired/pending outbox events, awaits sendBatch, then marks them dispatched
```

### Worker topology

Create `packages/event-gateway-worker` as a Workers workspace. It has:

- routes `api.mzm.dev/*` and `auth.mzm.dev/*`, replacing direct public access to the Cloud Run services; Cloud Run mutation endpoints reject every request without the gateway secret so public clients cannot bypass the outbox;
- service bindings/configuration values for `BACKEND_ORIGIN` and `AUTH_ORIGIN` (non-secret service URLs);
- `EVENTS: Queue<QueueEvent>` producer binding for `mzm-events`;
- a secret `GATEWAY_ORIGIN_SECRET` shared only with backend/auth;
- a `scheduled()` handler, configured every minute, for outbox recovery;
- no Queue HTTP ingress endpoint and no public `/events` route.

The Worker proxies all existing API/OAuth/SSE requests transparently. Every `POST /api/socket` requires a valid `Idempotency-Key`; the Worker does not inspect or buffer its raw request body to classify commands. It injects `X-MZM-Gateway-Authorization: Bearer <GATEWAY_ORIGIN_SECRET>` before forwarding, and Node selects the operation and performs its transaction after normal end-user authentication. Direct Queue publication happens only after the Node origin transaction succeeds.

The preceding client-supplied-key requirement is superseded: for every `POST /api/socket`, the gateway assigns a UUID `Idempotency-Key` when the request does not supply a valid one, without inspecting or buffering the raw request body. Node applies the same rule for direct origin requests.

Backend/auth reject event-producing mutation requests without the gateway secret. Existing end-user `Authorization`, Cookie, response, CORS, redirect, and streaming headers are forwarded unchanged except for the gateway internal header. The proxy must preserve every `Set-Cookie` header as an independent header (never coalesce them), preserve response status and `Location`, and preserve `Vary` and CORS/preflight behavior. SSE responses are streamed without buffering, transformation, or response-body inspection. The internal header is stripped from client-bound responses and is never accepted as an end-user credential.

For every proxied request, the Worker constructs the origin URL by replacing only the public origin with the configured Cloud Run origin and preserving the raw path and query. It sets `Host` to the origin host, adds `X-Forwarded-Host` and `X-Forwarded-Proto` from the public request, removes client-supplied `X-MZM-Gateway-*` headers, and streams the request body and abort signal without buffering. It forwards redirects unchanged; origins generate public URLs from `X-Forwarded-*`, not their private Cloud Run origin. `OPTIONS` is proxied unchanged, and affected origin CORS responses must include `Idempotency-Key` in `Access-Control-Allow-Headers`. OAuth callback, cross-origin mutation preflight, cookie multiplicity, and SSE streaming have proxy conformance tests.

### Event-producing operations

| Origin route | Operation selection | Queue event types |
| --- | --- | --- |
| `POST /api/socket` | commands that mutate messages, likes, message state, room state, reads, sorting, descriptions, or vote answers | `message`, `unread`, `reply`, `vote` as applicable |
| `DELETE /auth/user` | authenticated account deletion | `removeUser` |

Read-only socket commands, static assets, OAuth redirects, icon reads, and SSE `GET /api/socket` are proxied without an idempotency operation/outbox entry.

The Node application, not the gateway, determines the exact events. This prevents the gateway from inferring event payloads from HTTP responses and supports one operation producing multiple recipient-specific events.

## Data model

All records below are in the same MongoDB database as the business mutation. Names can be prefixed using the existing collection-name convention.

### `idempotency_operations`

```ts
type IdempotencyOperation = {
  _id: ObjectId
  subject: string // authenticated user ID; service-specific stable subject
  route: string // canonical route plus operation command
  idempotencyKey: string
  requestHash: string // SHA-256 of canonical request method, route, subject, and body
  response: {
    status: number
    contentType: string | null
    body: unknown
    location: string | null
    setCookies: string[] // preserved in original order
  }
  outboxEventIds: string[]
  createdAt: Date
  expiresAt: Date
}
```

Indexes:

- unique `{ subject: 1, route: 1, idempotencyKey: 1 }`;
- TTL `{ expiresAt: 1 }`.

Retention is **30 days**. A retry with the same `(subject, route, key)` and the same request hash returns the persisted response and event IDs. A different request hash returns `409 idempotency key reuse conflict`. A malformed or missing key is replaced with a generated UUID before the business mutation begins.

The idempotency guarantee is limited to this 30-day retention window. Clients must not reuse an idempotency key after the operation reaches a terminal result or after its 30-day window expires.

### `queue_outbox`

```ts
type OutboxEvent = {
  _id: string // stable Queue event ID: `${operationId}:${eventIndex}`
  operationId: ObjectId
  destination: 'backend' | 'auth' // consumer routing metadata
  type: QueueEventType
  payload: QueueEventPayload[QueueEventType]
  createdAt: Date
  status: 'pending' | 'leased' | 'dispatched'
  attempts: number // producer publication attempts, not Queue consumer retries
  lease?: { owner: string; expiresAt: Date }
  publishedAt?: Date
  lastError?: { message: string; at: Date }
  dispatchedExpiresAt?: Date // set only after dispatched; 30-day cleanup retention
}
```

Indexes:

- unique `_id`;
- `{ status: 1, 'lease.expiresAt': 1, createdAt: 1 }` for claim scanning;
- `{ operationId: 1, status: 1 }`;
- TTL `{ dispatchedExpiresAt: 1 }`.

Only `dispatched` rows receive `dispatchedExpiresAt = publishedAt + 30 days`. Pending/leased rows have no TTL field and are never automatically deleted: a long-running producer failure remains visible and recoverable. `dispatched` does not mean exactly-once transport; it means the Worker received successful resolution from `sendBatch()`. A crash after Queue acceptance and before this mark may result in a later duplicate send. Stable event IDs make this safe.

### `queue_consumer_receipts`

```ts
type QueueConsumerReceipt = {
  _id: string // `${consumerName}:${eventId}`
  consumerName: 'backend' | 'auth'
  eventId: string
  processedAt: Date
}
```

Indexes: unique `_id`; no TTL. Receipts are retained for the service lifetime so an authorized manual DLQ re-drive cannot repeat a DB business side effect after an arbitrary delay.

For any DB-mutating event, the consumer inserts its receipt and applies the side effect in a MongoDB transaction. A duplicate-key receipt means the side effect has already been applied and returns HTTP 204. Existing bounded `processedEventIds` arrays are removed as the authoritative idempotency mechanism.

`message` is an SSE-only event and has no durable business side effect. Its queue consumer may emit it repeatedly; clients de-duplicate by queue event ID while connected.

### Queue wire envelope

Every Queue message is JSON serialized UTF-8 in this exact versioned envelope. Cloudflare transport message IDs are not used as application IDs.

```ts
type QueueWireEvent =
  | { version: 1; eventId: string; operationId: string; destination: 'backend'; type: 'message'; payload: { eventId: string; data: ToClientType }; ordering: { key: `message:${string}`; revision: number }; createdAt: string }
  | { version: 1; eventId: string; operationId: string; destination: 'backend'; type: 'unread'; payload: { roomId: string; messageId: string }; ordering: { key: `room:${string}`; revision: number }; createdAt: string }
  | { version: 1; eventId: string; operationId: string; destination: 'backend'; type: 'reply'; payload: { roomId: string; userId: string }; ordering: { key: `enter:${string}:${string}`; revision: number }; createdAt: string }
  | { version: 1; eventId: string; operationId: string; destination: 'backend'; type: 'vote'; payload: { messageId: string }; ordering: { key: `message:${string}`; revision: number }; createdAt: string }
  | { version: 1; eventId: string; operationId: string; destination: 'auth'; type: 'removeUser'; payload: { userId: string }; ordering: { key: `user:${string}`; revision: number }; createdAt: string }
```

Producer, Queue consumer, callback, and DLQ re-drive validate this schema at runtime before use. The serialized envelope must be at most **120 KiB UTF-8**, below Cloudflare's 128 KiB message limit. The Node transaction deterministically serializes the envelope and rejects the request with `422 queue event too large` before any business mutation when this bound is exceeded.

## Mutation, retry, and outbox protocol

### Client input

For every event-producing mutation, the frontend creates a UUID `Idempotency-Key` before the first request and retains it until a terminal response. It forwards the same key for retry after network failure or HTTP 503.

Example:

```http
POST /api/socket HTTP/1.1
Idempotency-Key: 5d7d5065-6fe1-4c6f-9a41-0cde889b04da
Authorization: Bearer <user-token>
Content-Type: application/json

{"cmd":"MESSAGE_SEND","room":"general","message":"hello"}
```

### Node origin transaction

For a first-seen key, Node computes a deterministic request hash from the UTF-8 canonical JSON object `{ method, normalizedPath, sortedQuery, subject, command, body }`; event-producing routes may not use effect-bearing headers outside this object. It then performs the following in one `withTransaction()` call:

1. authenticate/authorize and validate the operation;
2. reject before mutation if it would create more than **1,000** outbox events or any serialized wire envelope exceeds 120 KiB;
3. apply all business-document mutations;
4. construct all resulting Queue events with stable IDs;
5. insert `queue_outbox` records with `status: pending`;
6. persist the normal HTTP response payload and allowed replay headers in `idempotency_operations`.

The persisted replay headers are an allowlist of `Location` and an ordered array of `Set-Cookie` values. Event-producing routes must not rely on any other mutable response header. Node returns those headers, the normal response, and `X-MZM-Operation-Id`; it does not call a Queue publisher.

The unique idempotency index is the concurrency arbiter. If a first-seen transaction encounters a duplicate-key/write-conflict outcome, Node retries the transaction or loads the winning record, compares the request hash, and returns the stored response or 409 deterministically; it must never turn this expected race into 500.

For an already-completed key with the same request hash, Node returns the persisted normal response and the same operation ID without re-executing the mutation. For a conflicting hash, it returns 409. For `DELETE /auth/user`, Node verifies the signed token and gateway secret, looks up the matching idempotency record by its signed subject before requiring the deleted account to exist, and can therefore return the stored deletion response/retry publication without cross-subject access.

### Immediate gateway delivery

After a successful Node origin response, the gateway calls its authenticated internal outbox claim endpoint with the operation ID. The endpoint atomically leases pending or expired events for the operation and returns at most 100 events per batch. The gateway drains the operation in ascending event-index order, repeating claim/send/ack until no undispatched event remains. A mutation with more than 100 outbox events is therefore a multi-batch operation; HTTP success is not returned until every batch has been acknowledged. After an empty claim, it calls an operation-state endpoint returning exact `pending`, `leased`, and `dispatched` counts. It returns success only if `pending === 0 && leased === 0`; if another owner has a lease, it retries state/claim only until a five-second deadline and then returns 503. The gateway:

1. calls `await env.EVENTS.sendBatch(events)`;
2. calls the internal outbox acknowledge endpoint to mark the claimed IDs `dispatched`;
3. returns the original Node response only after both steps succeed.

If any `sendBatch()` rejects, the Worker does **not** use `waitUntil()`, does not acknowledge the failed lease, stops draining later batches, and returns `503 queue publication pending` with `Retry-After: 1`. The original response body is not exposed as success. The client retries the same key. Earlier successfully acknowledged batches may already be visible to consumers; the stable event IDs make the next drain safe.

If queue acceptance succeeds but acknowledgement fails, the gateway returns 503. The lease eventually expires and a retry/relay may resend the same stable IDs; consumer and client de-duplication make that safe.

### Scheduled relay

The same gateway Worker runs every minute through `scheduled()`.

1. It calls internal Node `POST /internal/outbox/claim` with a cryptographically random relay owner ID.
2. Node atomically leases up to 100 pending or expired events for two minutes.
3. Worker awaits `sendBatch()`.
4. On success it acknowledges every event ID; on failure it records `lastError`, increments `attempts`, and leaves/relinquishes the lease for future recovery.

No event is discarded because the producer attempt count is high. A non-dispatched outbox event remains recoverable until its 30-day TTL; an operator uses the internal outbox query/repair endpoint and logs to diagnose a persistent fault.

Claiming is a compare-and-set operation, never a query followed by an unconstrained update. Each row may transition to `leased` only when it is `pending` or its existing lease has expired, and the update writes the caller's owner ID and expiry atomically (for example, `findOneAndUpdate` with that predicate inside the Node transaction). Acknowledge/relinquish updates match both event ID and current lease owner; an owner that lost/expired its lease cannot acknowledge another publisher's lease. Lease races can create duplicate Queue sends only at a crash/expiry boundary, and stable event IDs make the resulting delivery safe.

### Queue consumer retry and DLQ

`mzm-events` consumer configuration:

```jsonc
{
  "queues": {
    "consumers": [
      {
        "queue": "mzm-events",
        "max_batch_size": 10,
        "max_batch_timeout": 1,
        "max_retries": 5,
        "dead_letter_queue": "mzm-events-dlq"
      }
    ]
  }
}
```

The consumer processes messages one by one. It validates `QueueWireEvent`, then calls `POST /internal/queue/events` on the backend for `destination: backend`; `removeUser` additionally calls `POST /internal/queue/remove-user` on auth first. Every callback has `Content-Type: application/json`, the exact wire envelope body, and `Authorization: Bearer <QUEUE_CALLBACK_SECRET>`. The consumer uses a 10-second abort timeout and treats only 204 as success. Any timeout, schema failure, network failure, or non-204 response throws so Cloudflare Queues retries according to its delivery policy. It must not catch and turn a failure into an acknowledgement. Node validates the secret, method, envelope version, route/type/destination combination, and runtime payload schema before beginning its receipt transaction; unauthenticated or malformed callbacks return 401/400 without mutation.

`removeUser` requires both auth and backend processing; the auth callback runs first. A failure in either callback leaves the Queue message unacknowledged. Durable receipt records make a replay safe.

The DLQ is retained for manual investigation and re-drive. Cloudflare Queue retention is configured to its supported maximum **14 days**. A DLQ consumer archives the unchanged validated `QueueWireEvent` with its first-seen timestamp and audit metadata in MongoDB for the same 14-day window, then acknowledges the DLQ message; this prevents platform retention from making the documented recovery window ambiguous. Initial monitoring is Cloudflare Queue Dashboard metrics and Worker logs; no Discord/email alert automation is part of this change. An operator may replay an unexpired archived message only through authenticated `POST /internal/dlq/replay` on the gateway Worker, protected by Cloudflare Access service-token policy; the endpoint writes an audit log containing the event ID/operator/reason and sends that exact envelope through `env.EVENTS.send()`. Older archive records are inspection-only and expire. The procedure and an unauthorized/invalid/replay-preserves-eventId test are documented.

## Security and authorization

- `Idempotency-Key` is an opaque UUID and is scoped by authenticated subject and canonical route. It is not an authorization token.
- The gateway has a secret injected by `wrangler secret`; backend/auth receive the same secret through their deployment secret mechanism. The callback consumer uses a separate `QUEUE_CALLBACK_SECRET`; manual DLQ re-drive is protected by Cloudflare Access service-token policy. None are committed to `wrangler.jsonc`, `.env.sample`, logs, response headers, or test snapshots.
- Node event-producing mutation routes reject requests missing/invalid `X-MZM-Gateway-Authorization` before side effects. End-user identity/authorization remains checked by existing Node middleware.
- Worker-to-Node internal outbox claim, acknowledge, and inspection routes require `GATEWAY_ORIGIN_SECRET`; consumer callbacks require `QUEUE_CALLBACK_SECRET`; each rejects arbitrary event bodies.
- Internal endpoints validate operation IDs, event IDs, lease owner IDs, and Queue event runtime schema before acting.
- Cloud Run origin URLs are configuration values, while the shared gateway secret is a secret. The Worker forwards only necessary request headers and strips internal headers from client responses.

## Client realtime de-duplication

Queue `message` payloads are extended with the stable Queue event ID before the backend SSE consumer writes them. The frontend stores received IDs in per-subject IndexedDB for **35 days**, including across reconnects, and ignores a duplicate before applying it to visible state. The 35-day horizon exceeds the 30-day authorized DLQ re-drive window; producer duplicate sends occur only before an outbox event reaches `dispatched` and therefore fall within it. A timestamp index prunes older IDs. On reconnect, existing REST/socket state reads remain authoritative; this design does not promise offline replay.

## Local development and CI

- Replace standalone `mongo` and `mongo-test` containers with single-node replica sets.
- Container startup initializes the replica set exactly once and waits for primary election before backend/auth tests or local services start.
- Test Mongo URIs include `replicaSet=rs0`.
- CI Mongo service is configured/initialized as a replica set before `npm test`.
- Backend/auth startup runs a migration verification that creates and verifies the unique idempotency/outbox/receipt and required TTL indexes before accepting mutation or consumer traffic. Missing, non-unique, or mismatched indexes cause startup failure; tests cover that fail-closed path.
- Redis is absent from Compose, CI, source packages, and environment samples.
- Local gateway Worker starts with local Queue bindings and local non-secret test vars; secrets are supplied through command arguments/environment, not committed configuration.

## Error handling matrix

| Failure | Required behavior |
| --- | --- |
| Missing/malformed `Idempotency-Key` on event-producing mutation | Node/gateway returns 400; no business mutation/outbox record |
| Same key, same authenticated subject/route/body | Return persisted result; do not reapply mutation; retry direct publication |
| Same key, different canonical request | 409; no additional side effects |
| Node transaction fails/aborts | Return origin error; no business mutation, operation, or outbox event persists |
| Node commits, gateway cannot claim/send/ack | 503 + `Retry-After: 1`; stable outbox remains for retry and relay |
| Gateway crashes after Queue accepts but before ack | Lease expiry causes duplicate publish; consumer/client de-duplication handles it |
| Relay sends fail repeatedly | Keep outbox pending/lease-expired with error metadata indefinitely; inspect via logs/internal endpoint; no automatic discard |
| Queue event reaches DLQ | Preserve for manual inspection; authenticated re-drive preserves event ID for 30 days after DLQ arrival |
| Duplicate DB-mutating event | Unique consumer receipt makes callback return success without repeating side effect |
| Duplicate SSE `message` | Client ignores stable event ID |
| Worker secret invalid/missing | Return 401/403; no outbox claim/ack/callback mutation |

## Non-functional requirements

- Queue payloads remain below Cloudflare Queues limits: each serialized envelope is at most 120 KiB UTF-8 and immediate/relay sends use batches of at most 100 messages.
- A synchronous mutation creates at most 1,000 events; exceeding the count or size limit is rejected with 422 before its transaction begins.
- The gateway awaits `sendBatch()`; it must not use `waitUntil()` for the operation that determines HTTP success.
- Lease duration is two minutes and scheduled relay interval is one minute, so a crashed publisher becomes reclaimable without overlapping a healthy lease.
- No request path may synchronously call a Queue HTTP producer endpoint.
- All new Node code follows repository rules: no new `class`, no new `forEach`, no unnecessary type assertions, and top-level `test` style rather than `describe`.

## Required implementation changes

1. Add MongoDB transaction/outbox/idempotency modules and collection/index initialization to backend and auth.
2. Refactor event-producing backend/auth handlers to accept an operation transaction context and append outbox events instead of accepting an `EventPublisher`.
3. Remove `createHttpEventPublisher`, `QUEUE_URL`, `/events`, and producer shared-secret configuration from Node and `queue-worker`.
4. Create `packages/event-gateway-worker` with gateway proxy, outbox claim/ack interaction, Queue binding, and scheduled relay.
5. Restrict event-producing Node routes to requests authenticated by the gateway secret.
6. Keep/refactor the Queue consumer Worker to dispatch callbacks and throw on callback failure; configure DLQ.
7. Replace bounded consumer `processedEventIds` arrays with transactionally inserted receipt records for DB-mutating consumers.
8. Add stable Queue event IDs to SSE payloads and client de-duplication.
9. Convert local Docker Compose and CI Mongo test setup to replica sets.
10. Remove stale `packages/socket` start/build/deploy references separately as the independent local startup repair; it is not part of this queue design.

## Acceptance criteria

1. No Node backend/auth package contains a Queue HTTP publisher, `QUEUE_URL`, or a Node-side `POST /events` call.
2. Event-producing browser mutations pass through gateway Worker routes and carry a required `Idempotency-Key`.
3. The first mutation creates business state, one idempotency operation, and all expected outbox events atomically in a Mongo transaction.
4. Repeating the same request/key returns the stored result and does not duplicate business state or outbox rows; a changed request/key returns 409.
5. If immediate `sendBatch()` fails after the Node transaction commits, the gateway returns 503 and the persisted outbox is later published by retry or scheduled relay.
6. A simulated crash between successful `sendBatch()` and outbox acknowledgement causes safe duplicate delivery, not loss.
7. Consumer callback failure is retried by Queues and after five failures arrives in `mzm-events-dlq` rather than being discarded.
8. DB-mutating consumers apply an event once even when the Queue delivers it repeatedly.
9. A repeated SSE message event does not create duplicate client-visible state while the client session is connected.
10. A deterministic local harness covers: immediate `sendBatch()` rejection returning 503, same-key retry returning the persisted result, a crash/lease-expiry duplicate send with one DB side effect, and a consumer callback failing five times before the event reaches the DLQ.
11. `docker compose config --quiet`, local replica-set initialization, all workspace builds/lint/tests, and queue worker/gateway tests pass without Redis.
12. Production startup/deployment fails fast if replica-set transaction support or required gateway secret configuration is unavailable.
13. Cloudflare Queue Dashboard/logs expose a documented operational path to inspect DLQ and pending/failed outbox events.

## Assumptions approved during drilldown

- Producer implementation: gateway/relay Worker directly calls Queue binding; Node does not publish through HTTP.
- MongoDB replica-set transactions are mandatory in production, local development, and CI.
- If DB commit succeeds but immediate Queue publication is not confirmed, return 503 and retry using the same idempotency key.
- Client de-duplicates realtime event IDs; durable replay stays out of scope.
- DLQ and relay failures initially use Cloudflare Dashboard/log monitoring, without automated external notifications.

## Adversarial Review

### Resolved review contracts

The following are normative safe defaults adopted for findings F-01 through F-10. They supersede any earlier ambiguous wording in this document.

| Finding | Contract |
| --- | --- |
| F-01 | Every `POST /api/socket` receives a syntactically valid UUID `Idempotency-Key`, including read-only commands. The gateway replaces a missing or malformed header with a generated UUID and never reads, clones, parses, buffers, or otherwise consumes the request body. Node applies the same rule for direct origin requests. Node may skip creating an operation for a read-only command after it has streamed and validated the body. |
| F-02 | Internal outbox APIs are versioned under `/internal/outbox/v1/`: `claim`, `ack`, `release`, and `state`. Each request is authenticated with the gateway secret and has a runtime-validated body. `claim` takes `owner`, optional `operationId`, and `limit`; `ack` and `release` take an exact `owner` and an ordered list of `{ eventId, eventIndex }`; `state` takes `operationId`. |
| F-03 | Claim, acknowledge, and release are strict compare-and-set operations. A claim changes one row only if it is pending or its lease is expired; acknowledge/release changes one row only if its owner, lease expiry, status, and `eventIndex` still match. A batch response is successful only when every requested row changed. Otherwise it returns `409` with no partial acknowledgement/release. |
| F-04 | A Queue `sendBatch()` call contains at most 100 messages and at most 256 KiB of UTF-8 serialized envelopes in total. The gateway chunks an already ordered claim at both limits; an oversized single envelope is released with an error and causes publication to fail. |
| F-05 | The production queue and DLQ use the maximum supported 14-day retention. The DLQ consumer archives the validated original envelope, first-seen time, queue metadata, and archive expiry in Mongo for 14 days. Replay is allowed only before expiry, writes an immutable audit record, and sends precisely the archived envelope (including `eventId`) through the primary queue. Cloudflare Access protects the re-drive endpoint with a service-token application policy requiring both `CF-Access-Client-Id` and `CF-Access-Client-Secret`; the Worker trusts Access only after Cloudflare has enforced that policy and records the Access identity header for audit. |
| F-06 | Each outbox document stores a non-negative `eventIndex`, unique with `operationId`, and a positive aggregate `ordering.revision`. The transaction allocates a strictly increasing revision for each `ordering.key` from an aggregate-revision document in the same Mongo transaction. Claims sort by `operationId`, then `eventIndex`; for one operation the response is always contiguous ascending event indexes. Consumers reject a stale revision and persist the accepted revision with their receipt transaction. |
| F-07 | Gateway immediate publication has a 5-second total deadline and a 2-second deadline for each internal claim/ack/release/state request and Queue send. The relay has a 10-second total deadline and the same 2-second per-attempt deadline. Callback requests have a 10-second deadline. Deadline expiry is a failed attempt and never an acknowledgement. |
| F-08 | Startup probes transaction support before serving traffic: it starts a session, executes a no-op transaction that writes and deletes a probe document, and fails closed unless the server is a writable replica-set primary. The Compose services and CI services start `mongod --replSet rs0`, run `rs.initiate()` exactly once, and wait for primary election; all test URIs include `replicaSet=rs0`. |
| F-09 | Every gateway publish, relay, callback failure, lease conflict, DLQ archive, and replay audit event emits one structured JSON log with `event`, `eventId`/`operationId` when available, `owner`, `attempt`, `durationMs`, and a safe error code. The runbook documents query, inspect, release, replay, and escalation steps; payloads, credentials, cookies, authorization headers, and secrets are never logged. |
| F-10 | The frontend treats a queue event ID as the stable SSE identity. It stores per-subject IDs with timestamps in IndexedDB for 35 days, checks/deduplicates before applying state, prunes expired IDs, and clears the subject store on logout/startup subject change. Backend socket startup also removes closed SSE connections before broadcasting, so repeated delivery cannot retain dead sockets. |

### Operational runbook

1. Inspect structured `outbox_publish_failed`, `outbox_lease_conflict`, and `dlq_archived` logs by operation/event ID and inspect `/internal/outbox/v1/state` with the gateway credential.
2. Do not edit an outbox document manually. Release only the exact owner/event-index lease through `/internal/outbox/v1/release`; the scheduled relay will retry it.
3. For a poison message, inspect its 14-day archive record. Re-drive only through the Cloudflare Access service-token protected endpoint with a ticket reason. Verify that the replay audit record preserves the original event ID.
4. Escalate a persistent relay failure with the operation ID, event IDs, safe error code, and Cloudflare Queue dashboard metrics. Never include payloads or secrets.
