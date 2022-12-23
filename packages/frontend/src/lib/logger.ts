export const logger = {
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args)
  },
  warn: (...args) => {
    // eslint-disable-next-line no-console
    console.warn(...args)
  },
  log: (...args) => {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}
