import { INTERNAL_API_URL } from '../config'

jest.mock('./logger')

const request = jest.fn((_url, _options) => {
  return new Promise((resolve) => {
    resolve({
      statusCode: 200,
      body: {
        text: () => 'response text'
      }
    })
  })
})

jest.mock('undici', () => ({ request }))

import { requestSocketAPI } from './req'

test('requestSocketAPI', async () => {
  const user = 'user-id'
  const socket = 'socket-id'

  const message = 'message'

  await requestSocketAPI(message, user, socket)

  expect(request.mock.calls.length).toBe(1)
  const [url, options] = request.mock.calls[0]
  expect(url).toStrictEqual(INTERNAL_API_URL)
  expect(options.headers['x-user-id']).toStrictEqual(user)
  expect(options.headers['x-socket-id']).toStrictEqual(socket)
  expect(options.body).toStrictEqual(message)
})
