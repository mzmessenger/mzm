import { expect, test } from 'vitest'
import {
  emptyOutboxState,
  foldOutboxState,
  isClaimedOutboxEvent,
  isOutboxStatus,
  OUTBOX_STATUSES
} from './outbox.js'

function claimedOutboxEventFixture(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    _id: '0123456789abcdef01234567:0',
    status: 'leased',
    attempts: 1,
    version: 1,
    eventId: '0123456789abcdef01234567:0',
    operationId: '0123456789abcdef01234567',
    eventIndex: 0,
    destination: 'backend',
    type: 'message',
    payload: {},
    ordering: { key: 'message:abc', revision: 1 },
    createdAt: '2026-07-14T00:00:00.000Z',
    ...overrides
  }
}

test('an empty state counts every known status as zero', () => {
  expect(emptyOutboxState()).toStrictEqual({
    pending: 0,
    leased: 0,
    dispatched: 0
  })
  expect(Object.keys(emptyOutboxState()).sort()).toStrictEqual(
    [...OUTBOX_STATUSES].sort()
  )
})

test('folding keeps statuses missing from the rows at zero', () => {
  expect(foldOutboxState([{ _id: 'leased', count: 3 }])).toStrictEqual({
    pending: 0,
    leased: 3,
    dispatched: 0
  })
})

test('folding drops rows whose status is not part of the protocol', () => {
  expect(
    foldOutboxState([
      { _id: 'pending', count: 1 },
      { _id: 'unknown', count: 9 },
      { _id: null, count: 9 },
      { _id: 'dispatched', count: 2 }
    ])
  ).toStrictEqual({ pending: 1, leased: 0, dispatched: 2 })
})

test('isOutboxStatus accepts every protocol status and nothing else', () => {
  for (const status of OUTBOX_STATUSES) {
    expect(isOutboxStatus(status)).toBe(true)
  }
  expect(isOutboxStatus('published')).toBe(false)
  expect(isOutboxStatus(undefined)).toBe(false)
})

test('isClaimedOutboxEvent accepts a fully populated claim row', () => {
  expect(isClaimedOutboxEvent(claimedOutboxEventFixture())).toBe(true)
})

test('isClaimedOutboxEvent rejects a row missing status', () => {
  const { status: _status, ...rest } = claimedOutboxEventFixture()
  void _status
  expect(isClaimedOutboxEvent(rest)).toBe(false)
})

test('isClaimedOutboxEvent rejects a row with an unknown status', () => {
  expect(
    isClaimedOutboxEvent(claimedOutboxEventFixture({ status: 'published' }))
  ).toBe(false)
})

test('isClaimedOutboxEvent rejects a row with a non-string operationId', () => {
  expect(
    isClaimedOutboxEvent(claimedOutboxEventFixture({ operationId: 123 }))
  ).toBe(false)
})

test('isClaimedOutboxEvent rejects a row missing operationId', () => {
  const { operationId: _operationId, ...rest } = claimedOutboxEventFixture()
  void _operationId
  expect(isClaimedOutboxEvent(rest)).toBe(false)
})

test('isClaimedOutboxEvent rejects a row with a non-number attempts', () => {
  expect(
    isClaimedOutboxEvent(claimedOutboxEventFixture({ attempts: '1' }))
  ).toBe(false)
})
