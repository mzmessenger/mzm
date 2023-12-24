/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
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
    console.info(...args)
  }
}
