export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.error(...args)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.warn(...args)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}
