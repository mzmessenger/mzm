import { expect, test } from 'vitest'
import { socketIdempotencyKey } from './idempotency.js'

test('socketIdempotencyKey generates a UUID for a missing key', () => {
  expect(socketIdempotencyKey(undefined)).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
})

test('socketIdempotencyKey generates a UUID for a malformed key', () => {
  expect(socketIdempotencyKey('malformed')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
})

test('socketIdempotencyKey preserves a valid key', () => {
  const suppliedKey = 'a2b0d5c8-4473-4c36-8a9e-d08a52e4dbab'
  expect(socketIdempotencyKey(suppliedKey)).toBe(suppliedKey)
})
