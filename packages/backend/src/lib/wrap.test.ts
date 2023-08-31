/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { Request } from 'express'
import { Readable } from 'node:stream'
import { test, expect } from 'vitest'
import { createHandler, createStreamHandler } from './wrap.js'

test('createHandler', async () => {
  const route = createHandler('/api/user/@me', 'PUT', ({ path, method }) => {
    return { path, method }
  })(async (req, context) => {
    return { context }
  })

  expect(route.path).toStrictEqual('/api/user/@me')
  expect(route.method).toStrictEqual('put')
  const res = await route.handler({} as Request)
  expect(res.context.path).toStrictEqual('/api/user/@me')
  expect(res.context.method).toStrictEqual('PUT')
})

test('createStreamHandler', async () => {
  const route = createStreamHandler(
    '/api/stream',
    'GET',
    ({ path, method }) => {
      return { path, method }
    }
  )(async (req, context) => {
    return {
      headers: { path: context.path },
      stream: new Readable()
    }
  })

  expect(route.path).toStrictEqual('/api/stream')
  expect(route.method).toStrictEqual('get')
})
