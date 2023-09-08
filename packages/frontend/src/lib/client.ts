/* eslint-disable @typescript-eslint/ban-types */
import { apis, authApis } from 'mzm-shared/src/api/universal'
import { createClients, type Fetcher } from 'mzm-shared/src/api/client'
import { API_URL_BASE, AUTH_URL_BASE } from '../constants'
import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

export const fetcher: Fetcher = async <T>(options: Parameters<Fetcher>[0]) => {
  if (options.form) {
    const body = Array.from(options.form.entries()).map(([key, value]) => [
      key,
      value
    ]) as [string, string | Blob][]
    return (await proxyRequestWithFormData(options.url, { body })) as T
  }

  const init: Parameters<typeof proxyRequest>[1] = {
    method: options.method
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
