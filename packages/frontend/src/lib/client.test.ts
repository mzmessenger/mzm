/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { beforeAll, vi, test, expect } from 'vitest'
import { clients, authClients, fetcher } from './client.js'

vi.mock('../lib/auth', async () => {
  return {
    proxyRequest: vi.fn(),
    proxyRequestWithFormData: vi.fn()
  }
})

import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

beforeAll(() => {
  global.fetch = vi.fn()
})

test('clients', async () => {
  const requestMock = vi.mocked(proxyRequest).mockReset()

  requestMock.mockResolvedValue({
    ok: true,
    status: 200,
    body: undefined
  })

  const res = await clients['/api/rooms/:roomId/users']['GET'].client({
    fetcher,
    params: { roomId: 'room-id' },
    query: {}
  })

  expect(res.ok).toStrictEqual(true)
  expect(res.status).toStrictEqual(200)
  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/api/rooms/room-id/users', {
    method: 'GET'
  })
})

test('clients: FormData', async () => {
  const requestMock = vi.mocked(proxyRequestWithFormData).mockReset()

  requestMock.mockResolvedValue({
    ok: true,
    status: 200,
    body: undefined
  })

  const iconData = new Blob(['image'])
  const res = await clients['/api/icon/rooms/:roomName']['POST'].client({
    fetcher,
    params: { roomName: 'room-name' },
    form: { icon: iconData }
  })

  expect(res.ok).toStrictEqual(true)
  expect(res.status).toStrictEqual(200)
  expect(requestMock).toBeCalledTimes(1)
  expect(requestMock.mock.calls[0][0]).toStrictEqual(
    '/api/icon/rooms/room-name'
  )
  expect(requestMock.mock.calls[0][1].body[0][0]).toStrictEqual('icon')
})

test('authClients', async () => {
  const requestMock = vi.mocked(proxyRequest).mockReset()

  requestMock.mockResolvedValue({
    ok: true,
    status: 200,
    body: undefined
  })

  const res = await authClients['/auth/token']['POST'].client({
    fetcher
  })

  expect(res.ok).toStrictEqual(true)
  expect(res.status).toStrictEqual(200)
  expect(proxyRequest).toBeCalledTimes(1)
  expect(proxyRequest).toBeCalledWith('/auth/token', {
    method: 'POST'
  })
})
