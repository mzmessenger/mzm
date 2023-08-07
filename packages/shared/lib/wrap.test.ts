/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect } from 'vitest'
import { wrap } from './wrap'

test('wrap (return object)', async () => {
  expect.assertions(4)

  const resolve = { success: 'success' }

  const fn = async () => Promise.resolve(resolve)

  const json = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.json.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(resolve)
  })
  const res = { status: vi.fn().mockReturnThis(), json }

  await wrap(fn)({} as any, res as any, vi.fn() as any)
})

test.each([
  [
    'return object',
    Promise.resolve({ success: 'success' }),
    { success: 'success' }
  ],
  ['return string', Promise.resolve('success'), 'success'],
  ['return undefined', Promise.resolve(), '']
])('wrap (%s)', async (_, returnValue, response) => {
  expect.assertions(4)

  const fn = async () => returnValue

  const json = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.json.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(response)
  })

  const send = vi.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(response)
  })
  const res = { status: vi.fn().mockReturnThis(), json, send }

  await wrap(fn)({} as any, res as any, vi.fn() as any)
})

test('wrap error', async () => {
  expect.assertions(3)

  const error = new Error('error!')
  const fn = async () => Promise.reject(error)

  const status = vi.fn().mockReturnThis()
  const json = vi.fn()
  const res = { status, json }
  const next = vi.fn((arg) => {
    expect(status.mock.calls.length).toBe(0)
    expect(json.mock.calls.length).toBe(0)

    expect(arg).toEqual(error)
  })

  await wrap(fn)({} as any, res as any, next)
})
