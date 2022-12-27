import { vi, test, expect } from 'vitest'
vi.mock('mzm-shared/auth/index', async () => {
  const module = await vi.importActual<typeof import('mzm-shared/auth/index')>(
    'mzm-shared/auth/index'
  )
  return {
    ...module,
    verifyAccessToken: vi.fn()
  }
})
vi.mock('../lib/logger')

import { JsonWebTokenError } from 'jsonwebtoken'
import { NextFunction, Request, Response } from 'express'
import { HEADERS } from 'mzm-shared/auth/constants'
import { verifyAccessToken } from 'mzm-shared/auth/index'
import { errorHandler, checkAccessToken } from './index'
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

  await errorHandler(error, {}, res as unknown as Response, vi.fn())
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

  await errorHandler(error, {}, res as unknown as Response, vi.fn())
})

test('checkAccessToken (success)', async () => {
  expect.assertions(3)

  const req = {
    headers: {
      Authorization: 'Bearer accesstoken'
    }
  }

  const verifyAccessTokenMock = vi.mocked(verifyAccessToken)
  verifyAccessTokenMock.mockResolvedValueOnce({
    err: null,
    decoded: {
      user: {
        _id: 'aaa',
        twitterId: 'xxx-id',
        twitterUserName: 'xxx',
        githubUserName: 'yyy',
        githubId: 'yyy-id'
      }
    }
  })

  const next = vi.fn(() => {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    expect(verifyAccessTokenMock.mock.calls[0][0]).toStrictEqual('accesstoken')
    expect(req.headers[HEADERS.USER_ID]).toStrictEqual('aaa')
  })

  await checkAccessToken(req as unknown as Request, {} as Response, next)
})

test('checkAccessToken no header', async () => {
  expect.assertions(4)

  const req = { headers: {} }

  const mock = vi.mocked(verifyAccessToken)
  mock.mockResolvedValueOnce({
    err: new JsonWebTokenError('not valid token'),
    decoded: null
  })

  const send = vi.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(401)
    expect(arg).toEqual('no authorization header')
  })

  const res = { status: vi.fn().mockReturnThis(), send }

  await checkAccessToken(
    req as unknown as Request,
    res as unknown as Response,
    vi.fn() as unknown as NextFunction
  )
})

test('checkAccessToken verify token error', async () => {
  expect.assertions(4)

  const req = {
    headers: {
      Authorization: 'Bearer accesstoken'
    }
  }

  const mock = vi.mocked(verifyAccessToken)
  mock.mockResolvedValueOnce({
    err: new JsonWebTokenError('not valid token'),
    decoded: null
  })

  const send = vi.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(401)
    expect(arg).toEqual('not verify token')
  })

  const res = { status: vi.fn().mockReturnThis(), send }

  await checkAccessToken(
    req as unknown as Request,
    res as unknown as Response,
    vi.fn() as unknown as NextFunction
  )
})
