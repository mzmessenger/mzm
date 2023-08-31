/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect } from 'vitest'

import { createErrorHandler } from './middleware.js'
import * as HttpErrors from '../lib/errors.js'

test('errorHandler (Internal Server Error)', async () => {
  expect.assertions(4)

  const error = new Error('error!')

  const send = vi.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(500)
    expect(arg).toEqual('Internal Server Error')
  })

  const res = { status: vi.fn().mockReturnThis(), send }

  const errorHandler = createErrorHandler({
    error: () => ({})
  })

  await errorHandler(error, {} as any, res as any, vi.fn() as any)
})

test.each([
  [new HttpErrors.BadRequest('BadRequest')],
  [new HttpErrors.Unauthorized('Unauthorized')],
  [new HttpErrors.Forbidden('Forbidden')],
  [new HttpErrors.NotFound('NotFound')]
])('errorHandler (%s)', async (error) => {
  expect.assertions(4)

  const send = vi.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(error.status)
    expect(arg).toEqual(error.toResponse())
  })

  const res = { status: vi.fn().mockReturnThis(), send }

  const errorHandler = createErrorHandler({
    error: () => ({})
  })

  await errorHandler(error, {} as any, res as any, vi.fn() as any)
})
