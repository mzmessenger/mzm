import bunyan from 'bunyan'

const logger = bunyan.createLogger({
  name: 'auth'
})

export default logger
