import { request } from 'undici'
import { HEADERS } from 'mzm-shared/auth/constants'
import { INTERNAL_API_URL } from '../config.js'
import { logger } from './logger.js'
import { createInternalAccessToken } from '../lib/token.js'

// todo: retry
export const requestSocketAPI = async (
  body: string,
  user: string,
  id: string
) => {
  const token = await createInternalAccessToken()
  const options: Parameters<typeof request>[1] = {
    headers: {
      'Content-type': 'application/json',
      [HEADERS.USER_ID]: user,
      'x-socket-id': id,
      Authorization: `Bearer ${token}`
    },
    method: 'POST',
    body: body,
    bodyTimeout: 1000 * 60 * 5,
    headersTimeout: 1000 * 60 * 5
  }

  const res = await request(INTERNAL_API_URL, options)

  const resBody = res.statusCode === 200 ? await res.body.text() : null

  logger.info(
    '[post:response]',
    INTERNAL_API_URL,
    body,
    res.statusCode,
    resBody
  )

  return { body: resBody }
}
