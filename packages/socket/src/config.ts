import { config } from 'dotenv'
config()

export const WORKER_NUM = process.env.WORKER_NUM ?? 1
export const SOCKET_LISTEN = 3000

export const INTERNAL_API_URL = process.env.INTERNAL_API

export const redis = {
  options: {
    host: process.env.REDIS_HOST,
    enableOfflineQueue: false
  }
}
