/**
 * Library: logging.js
 * Description: logging library for standard scripts
 * Format: CJS
 */

const createLogger = function () {
  const log4js = require('log4js')
  const config = require('./log-config')
  const cfg = config()

  log4js.configure({
    appenders: {
      errorFileAppender: {
        type: 'file',
        filename: cfg.errorLogFile,
        maxLogSize: cfg.maxLogsize,
        keepFileExt: cfg.keepFileExt,
        backups: 3,
        compress: true,
      },
      out: { type: 'stdout' },
      'just-errors': {
        type: 'logLevelFilter',
        appender: 'errorFileAppender',
        level: 'error',
      },
    },
    categories: {
      default: { appenders: ['just-errors', 'out'], level: cfg.logLevel },
    },
  })

  let logger = log4js.getLogger()
  logger.level = cfg.logLevel

  return logger
}

module.exports = createLogger
