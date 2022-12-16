import { vi, test, expect } from 'vitest'
vi.mock('mzm-shared/auth')
vi.mock('../lib/logger')

import { NextFunction, Request, Response } from 'express'
import { HEADERS } from 'mzm-shared/auth/constants'
import { requestAuthServer } from 'mzm-shared/auth/index'
import { errorHandler, checkLogin } from './index'
import * as HttpErrors from '../lib/errors'

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

  await errorHandler(error, {}, res as any as Response, vi.fn())
})

test.each([
  [{ error: new HttpErrors.BadRequest('BadRequest') }],
  [{ error: new HttpErrors.Forbidden('Forbidden') }]
])('errorHandler (%s)', async ({ error }) => {
  expect.assertions(4)

  const send = vi.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(error.status)
    expect(arg).toEqual(error.toResponse())
  })

  const res = { status: vi.fn().mockReturnThis(), send }

  await errorHandler(error, {}, res as any as Response, vi.fn())
})

test('checkLogin (success)', async () => {
  expect.assertions(4)

  const req = { headers: {} }

  const mock = vi.mocked(requestAuthServer)
  mock.mockResolvedValueOnce({
    userId: 'aaa',
    twitterUserName: 'xxx',
    githubUserName: 'yyy'
  })

  const next = vi.fn(() => {
    expect('called').toEqual('called')
    expect(req.headers[HEADERS.USER_ID]).toEqual('aaa')
    expect(req.headers[HEADERS.TIWTTER_USER_NAME]).toEqual('xxx')
    expect(req.headers[HEADERS.GITHUB_USER_NAME]).toEqual('yyy')
  })

  await checkLogin(req as Request, {} as Response, next)
})

test.each([[null], [undefined], ['']])(
  'checkLogin send 401 (%s)',
  async (userId) => {
    expect.assertions(4)

    const req = { headers: {} }

    const mock = vi.mocked(requestAuthServer)
    mock.mockResolvedValueOnce({
      // @ts-expect-error
      userId: userId,
      twitterUserName: 'xxx',
      githubUserName: 'yyy'
    })

    const send = vi.fn(function (arg) {
      expect(this.status.mock.calls.length).toBe(1)
      expect(this.send.mock.calls.length).toBe(1)

      expect(this.status.mock.calls[0][0]).toEqual(401)
      expect(arg).toEqual('not login')
    })

    const res = { status: vi.fn().mockReturnThis(), send }

    await checkLogin(
      req as any as Request,
      res as any as Response,
      vi.fn() as any as NextFunction
    )
  }
)
