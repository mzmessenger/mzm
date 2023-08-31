/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { beforeAll, vi, test, expect } from 'vitest'
import { createApiClient, createAuthApiClient } from './client.js'

vi.mock('../lib/auth', async () => {
  return {
    proxyRequest: vi.fn(),
    proxyRequestWithFormData: vi.fn()
  }
})

import { proxyRequest } from '../lib/auth'

beforeAll(() => {
  global.fetch = vi.fn()
})

test('createApiClient', async () => {
  vi.mocked(proxyRequest).mockReset()

  const res = await createApiClient(
    '/api/icon/rooms/:roomName',
    'DELETE',
    ({ toPath }) => {
      return {
        path: toPath({ roomName: 'room-name' })
      }
    },
    async (res) => {
      return { foo: 'bar' }
    }
  )

  expect(res.foo).toStrictEqual('bar')
  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/api/icon/rooms/room-name', {
    method: 'DELETE',
    headers: {}
  })
})

test('createAuthApiClient', async () => {
  vi.mocked(proxyRequest).mockReset()

  const res = await createAuthApiClient(
    '/auth/token',
    'POST',
    ({ toPath }) => {
      return {
        path: toPath()
      }
    },
    async (res) => {
      return { foo: 'bar' }
    }
  )

  expect(res.foo).toStrictEqual('bar')
  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/auth/token', {
    method: 'POST',
    headers: {}
  })
})
