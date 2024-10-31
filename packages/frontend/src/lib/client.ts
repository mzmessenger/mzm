import type { ClientToSocketType } from 'mzm-shared/src/type/socket'
import { apis, authApis } from 'mzm-shared/src/api/universal'
import { createClients, type Fetcher } from 'mzm-shared/src/api/client'
import { API_URL_BASE, AUTH_URL_BASE } from '../constants'
import { proxyRequest } from '../lib/auth'

export const fetcher: Fetcher = async <T>(options: Parameters<Fetcher>[0]) => {
  const init: Parameters<typeof proxyRequest>[1] = {
    method: options.method
  }

  if (options.headers) {
    init.headers = options.headers
  }

  if (options.form) {
    const form = {} as { [key: string]: string | Blob }
    for (const [key, value] of options.form.entries()) {
      form[key] = value
    }
    init.form = form
  }

  if (options.body) {
    init.body =
      typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
  }

  const res = await proxyRequest(options.url, init)
  return res as T
}

export const clients = createClients(apis, API_URL_BASE)
export const authClients = createClients(authApis, AUTH_URL_BASE)

export async function sendSocket(message: ClientToSocketType) {
  return await clients['/api/socket']['POST'].client({
    fetcher,
    body: message
  })
}
