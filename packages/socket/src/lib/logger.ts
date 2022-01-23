import bunyan from 'bunyan'

const logger = bunyan.createLogger({
  name: 'socket'
})

export default logger
