const idempotencyKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function socketIdempotencyKey(suppliedKey: unknown) {
  return typeof suppliedKey === 'string' && idempotencyKey.test(suppliedKey)
    ? suppliedKey
    : crypto.randomUUID()
}
