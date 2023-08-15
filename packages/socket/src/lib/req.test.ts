/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect } from 'vitest'
import { request } from 'undici'
import { INTERNAL_API_URL } from '../config.js'

vi.mock('./logger.js')
vi.mock('../lib/token.js', () => {
  return {
    createInternalAccessToken: vi
      .fn()
      .mockResolvedValue('internal-access-token')
  }
})

vi.mock('undici', async () => {
  return {
    request: vi.fn((_url, _options) => {
      return new Promise((resolve) => {
        resolve({
          statusCode: 200,
          body: {
            text: () => 'response text'
          }
        })
      })
    })
  }
})

import { requestSocketAPI } from './req'

test('requestSocketAPI', async () => {
  const user = 'user-id'
  const socket = 'socket-id'

  const message = 'message'

  const requestMock = vi.mocked(request)

  await requestSocketAPI(message, user, socket)

  expect(requestMock.mock.calls.length).toBe(1)
  const [url, options] = requestMock.mock.calls[0]
  expect(url).toStrictEqual(INTERNAL_API_URL)
  expect((options!.headers! as any)['x-user-id']).toStrictEqual(user)
  expect((options!.headers! as any)['x-socket-id']).toStrictEqual(socket)
  expect((options!.headers! as any)['Authorization']).toStrictEqual(
    `Bearer internal-access-token`
  )
  expect(options?.body).toStrictEqual(message)
})
