/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
const infoKey = 'mzm:log:info' as const

export const StorageKeys = {
  info: infoKey
} as const

export const logger = {
  error: (...args: any[]) => {
    console.error(...args)
  },
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  log: (...args: any[]) => {
    console.log(...args)
  },
  info: (...args: any[]) => {
    const item = localStorage.getItem(infoKey)
    if (!item || item !== 'true') {
      return
    }
    console.info(...args)
  }
} as const
