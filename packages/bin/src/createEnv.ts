import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'

export async function createEnv(user: string, password: string) {
  const root = path.resolve(import.meta.dirname, '../../../')
  const backendDir = path.join(root, 'packages/backend')
  const authDir = path.join(root, 'packages/auth')
  await Promise.all([
    createEnvToDir(backendDir, user, password),
    createEnvToDir(authDir, user, password)  
  ])
}

async function createEnvToDir(dir: string, user: string, password: string) {
  const envStr = await readFile(path.join(dir, '.env.sample'), { encoding: 'utf-8' })
  const envBase = parseEnv(envStr) as Record<string, string>
  const env = {
    ...envBase,
    MONGODB_URI: envBase.MONGODB_URI
      .replace('[user]', user)
      .replace('[password]', password)
  }
  const str = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n')
  await writeFile(path.join(dir, '.env'), str)
}
