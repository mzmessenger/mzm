import { request } from 'undici'
import { INTERNAL_API_URL } from '../config'
import logger from './logger'

// todo: retry
export const requestSocketAPI = async (
  body: string,
  user: string,
  id: string
) => {
  const options: Parameters<typeof request>[1] = {
    headers: {
      'Content-type': 'application/json',
      'x-user-id': user,
      'x-socket-id': id
    },
    method: 'POST',
    body: body
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
