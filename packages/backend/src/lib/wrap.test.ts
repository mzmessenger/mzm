import { Request, Response } from 'express'
import { wrap } from './wrap'

test('wrap success', (cb) => {
  expect.assertions(4)

  const resolve = { success: 'success' }

  const fn = async () => Promise.resolve(resolve)

  const json = jest.fn(function (...args) {
    expect(this.status.mock.calls.length).toBe(1)
    expect(this.json.mock.calls.length).toBe(1)

    expect(this.status.mock.calls[0][0]).toEqual(200)
    expect(args[0]).toEqual(resolve)

    cb()
  })
  const res = { status: jest.fn().mockReturnThis(), json }

  wrap(fn)({} as Request, res as any as Response, jest.fn())
})

test('wrap error', (cb) => {
  expect.assertions(3)

  const error = new Error('error!')
  const fn = async () => Promise.reject(error)

  const status = jest.fn().mockReturnThis()
  const json = jest.fn()
  const res = { status, json }
  const next = jest.fn((arg) => {
    expect(status.mock.calls.length).toBe(0)
    expect(json.mock.calls.length).toBe(0)

    expect(arg).toEqual(error)

    cb()
  })

  wrap(fn)({} as Request, res as any as Response, next)
})
