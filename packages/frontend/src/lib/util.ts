export const isReplied = (account: string, message: string) => {
  return new RegExp(`([\\s]+|^)@${account}(?:[^a-z]|$)`).test(message)
}

export const getRoomName = (pathname: string) => {
  const res = pathname.match(/\/rooms\/(.+)/) || ''
  return res[1] ? decodeURIComponent(res[1]) : ''
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))
