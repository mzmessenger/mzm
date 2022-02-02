import { config } from 'dotenv'
config()

export const WORKER_NUM = process.env.WORKER_NUM ?? 1

export const PORT: number = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000

export const INTERNAL_API_URL = process.env.INTERNAL_API

export const REDIS = {
  options: {
    host: process.env.REDIS_HOST,
    enableOfflineQueue: false
  }
}

export const AUTH_SERVER = process.env.AUTH_SERVER
