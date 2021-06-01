/**
 * Component: main.js
 * Description: Main skeleton function for cli scripts
 * Format: CJS
 * Author: Walter Ritzel
 */

const main = async function (proc, logger, callbackFunction) {
  const args = proc.argv
  try {
    logger.info(`Starting the script - ${args[1]}...`)
    logger.info('Command line parameters:')

    if (args.slice(2).length > 0) {
      args.slice(2).forEach(data => {
        logger.info(data)
      })
    } else {
      logger.info('No parameters found.')
    }

    try {
      const config = require('config')
      logger.info('Config file loaded...')

      await callbackFunction(config, logger, args.slice(2))
    } catch (e) {
      logger.error(e)
      logger.error('Config file not loaded...')
    }

    logger.info(`Finishing the script - ${args[1]}...`)
    logger.info(`Script execution time: ${proc.uptime()} seconds.`)
  } catch (e) {
    logger.error(e)
    logger.info(`The script ${args[1]}have finished with errors. Please check
    the file ${proc.pid}_error.log for more information on errors..`)
    logger.shutdown()
    proc.exit(1)
  }
}

module.exports = main
