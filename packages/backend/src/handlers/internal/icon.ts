import { promisify } from 'util'
import crypto from 'crypto'
const randomBytes = promisify(crypto.randomBytes)

export const isValidMimetype = (mimetype: string) => {
  return mimetype === 'image/png' || mimetype === 'image/jpeg'
}

export const createVersion = async () => {
  const version = (await randomBytes(12)).toString('hex')
  return version
}
