import { logger } from './logger'
function parse() {
  const store = new Map<string, string>()

  try {
    const cookies = document.cookie.split('; ')

    for (const cookie of cookies) {
      const [key, value] = cookie.split('=')
      store.set(key, decodeURIComponent(value))
    }
  } catch (e) {
    logger.warn(e)
  }
  return store
}

export function get(key: string) {
  return parse().get(key)
}

export function set(
  key: string,
  value: string,
  options?: { expires?: number }
) {
  let write = `${key}=${encodeURIComponent(value)}`

  if (options.expires) {
    const expires = new Date()
    expires.setMilliseconds(expires.getMilliseconds() + options.expires)
    write += `; Expires=${expires.toUTCString()}`
  }
  if (window.location.protocol === 'https:') {
    write += `; Secure`
  }
  const domain = encodeURIComponent(location.hostname)
  write += `; Domain=${domain}; Path=/; Secure; SameSite=Strict`

  document.cookie = write
}

export function remove(key: string) {
  set(key, '', { expires: -1 })
}
