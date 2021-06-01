const getLogConfig = function () {
  return {
    errorLogFile: './logs/load_data_error.log',
    logLevel: 'debug',
    maxLogsize: 10000000,
    keepFileExt: true,
  }
}

module.exports = getLogConfig
