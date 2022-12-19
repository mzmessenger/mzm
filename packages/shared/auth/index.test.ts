import { test, expect } from 'vitest'

import type { Request } from 'express'

import { parseAuthorizationHeader } from './index'

test('parseAuthorizationHeader', async () => {
  const req = {
    headers: {
      Authorization: 'Bearer accesstoken'
    }
  }

  const token = parseAuthorizationHeader(req as unknown as Request)
  expect(token).toStrictEqual('accesstoken')
})

test('parseAuthorizationHeader no header', async () => {
  const req = { headers: {} }

  const token = parseAuthorizationHeader(req as unknown as Request)
  expect(token).toStrictEqual(null)
})

test('parseAuthorizationHeader no bearer', async () => {
  const req = {
    headers: {
      Authorization: 'accesstoken'
    }
  }

  const token = parseAuthorizationHeader(req as unknown as Request)
  expect(token).toStrictEqual(null)
})
