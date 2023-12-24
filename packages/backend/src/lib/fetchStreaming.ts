import type { Response } from 'express'

const userMap = new Map<string, Set<Response>>()

export function addUserResponse(user: string, res: Response) {
  if (!userMap.has(user)) {
    userMap.set(user, new Set())
  }
  userMap.get(user)?.add(res)
}

export function closeUserResponse(user: string, res: Response) {
  const set = userMap.get(user)
  set?.delete(res)
  if (set?.size === 0) userMap.delete(user)
}

export function sendToUser(user: string, data: Buffer | Uint8Array) {
  const resSet = userMap.get(user)
  if (!resSet) {
    return
  }
  for (const res of resSet) {
    res.write(data)
    res.write(Buffer.from('\0'))
  }
}
