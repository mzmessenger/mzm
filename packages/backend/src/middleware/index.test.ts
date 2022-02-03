jest.mock('mzm-shared/auth')
jest.mock('../lib/logger')

import { Request, Response } from 'express'
import { HEADERS, requestAuthServer } from 'mzm-shared/auth'
import { errorHandler, checkLogin } from './index'
import * as HttpErrors from '../lib/errors'

test('errorHandler (Internal Server Error)', (cb) => {
  expect.assertions(4)

  const error = new Error('error!')

  const send = jest.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(500)
    expect(arg).toEqual('Internal Server Error')

    cb()
  })

  const res = { status: jest.fn().mockReturnThis(), send }

  errorHandler(error, {}, res as any as Response, jest.fn())
})

test.each([
  [{ error: new HttpErrors.BadRequest('BadRequest') }],
  [{ error: new HttpErrors.Forbidden('Forbidden') }]
])('errorHandler (%s)', ({ error }) => {
  expect.assertions(4)

  const send = jest.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(error.status)
    expect(arg).toEqual(error.toResponse())
  })

  const res = { status: jest.fn().mockReturnThis(), send }

  errorHandler(error, {}, res as any as Response, jest.fn())
})

test('checkLogin (success)', (cb) => {
  expect.assertions(2)

  const req = { headers: {} }

  const mock = jest.mocked(requestAuthServer)
  mock.mockResolvedValueOnce({
    userId: 'aaa',
    twitterUserName: 'xxx'
  })

  const next = jest.fn(() => {
    expect('called').toEqual('called')
    expect(req.headers[HEADERS.USER_ID]).toEqual('aaa')
    cb()
  })

  checkLogin(req as Request, {} as Response, next)
})

test.each([[null], [undefined], ['']])('checkLogin send 401 (%s)', (userId) => {
  expect.assertions(4)

  const req = { headers: {} }

  const mock = jest.mocked(requestAuthServer)
  mock.mockResolvedValueOnce({
    userId: userId,
    twitterUserName: 'xxx'
  })

  const send = jest.fn(function (arg) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.send.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(401)
    expect(arg).toEqual('not login')
  })

  const res = { status: jest.fn().mockReturnThis(), send }

  checkLogin(req as any as Request, res as any as Response, jest.fn())
})
