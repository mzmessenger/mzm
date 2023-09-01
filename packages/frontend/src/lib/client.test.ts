/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { beforeAll, vi, test, expect } from 'vitest'
import { clients, authClients } from './client.js'

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

test('clients', async () => {
  vi.mocked(proxyRequest).mockReset()

  const res = await clients['/api/rooms/:roomId/users']['GET']({
    params: { roomId: 'room-id' },
    query: {}
  })

  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/api/rooms/room-id/users', {
    method: 'GET'
  })
})

test('authClients', async () => {
  vi.mocked(proxyRequest).mockReset()

  const res = await authClients['/auth/token']['POST']({})

  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/auth/token', {
    method: 'POST'
  })
})
