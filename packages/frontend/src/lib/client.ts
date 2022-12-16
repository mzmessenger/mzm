type FetchInit = Parameters<typeof fetch>[1]

type Options = { accessToken: string; headers?: FetchInit['headers'] } & (
  | {
      method?: 'GET'
    }
  | {
      method: 'POST' | 'PUT' | 'DELETE'
      accessToken: string
      body?: FetchInit['body']
    }
)

export const createClient = async <T>(
  url: string,
  options: Options,
  parser: (res: Awaited<ReturnType<typeof fetch>>) => Promise<T>
) => {
  const headers = new Headers({
    Authorization: `Bearer ${options.accessToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    ...options.headers
  })

  const method = options.method ?? 'GET'

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers
  })

  return await parser(res)
}