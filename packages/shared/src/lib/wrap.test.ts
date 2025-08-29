/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect } from 'vitest'
import { response } from './wrap.js'

test('response (return object)', async () => {
  expect.assertions(4)

  const resolve = { success: 'success' }

  const json = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.json.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(resolve)
  })
  const res = { status: vi.fn().mockReturnThis(), json }

  await response(resolve)({} as any, res as any)
})

test.each([
  [
    'return object',
    { success: 'success' },
    { success: 'success' }
  ],
  ['return string', 'success', 'success'],
  ['return undefined', undefined, '']
])('response (%s)', async (_, returnValue, resValue) => {
  expect.assertions(4)


  const json = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.json.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(resValue)
  })

  const send = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(resValue)
  })
  const res = { status: vi.fn().mockReturnThis(), json, send }

  await response(returnValue)({} as any, res as any)
})
