'use strict'
/**
 * Required Import routines
 */
const process = require('process')
const logger = require('./wvlibs/logging/logging')
const mainRoutine = require('./components/main')

/**
 ** Project includes
 */
const SurveyProcessor = require('./wvlibs/sm-survey')
const fs = require('fs')
const googleSheets = require('@wvcode/gsheet-wrapper')
const { convertToArrayOfArrays } = require('@wvcode/utils')

let gs = null
let isStarted = false

/**
 * Write a sheet into a Google Sheet
 * @param {*} spreadSheetName
 * @param {*} sheetName
 * @param {*} data
 */
async function writeToSheets(spreadSheetId, sheetName, data) {
  let convertedData = convertToArrayOfArrays(data, true)
  if (convertedData.length > 0) {
    let s = await gs.populateSheet(spreadSheetId, sheetName, {
      values: convertedData,
    })
  }
}

/**
 ** Main routine
 * The main routine of any script should have the following parameters
 * Parameters:
 * @param {*} cfg - the configuration information for the script - it is required
 * @param {*} log - the logger object to be used by the script - it is required
 * @param {*} params - the parameters sent via command line - it is optional
 * ! REMARKS:
 * ! This function should be async in order to be able to use await for certain libraries
 **/
async function execute(cfg, log, params) {
  let [client, dvs, saveMode] = params

  let runConfig = null

  // validating inputs
  try {
    runConfig = require(eval(cfg.configFilePath))
  } catch (e) {
    if (!client) {
      log.error(`We did not have received a valid client parameter.`)
    }
    if (!dvs) {
      log.error(
        `We did not have received a valid data visualization configuration (dvs) parameter.`
      )
    }
  }

  //execute the data load
  if (runConfig) {
    const sp = new SurveyProcessor(
      runConfig['survey_id'],
      runConfig['access_token']
    )

    let rawData = { ...cfg.dataStructure }

    log.info('Processing answers...')
    rawData.answers = await sp.buildAnswerData(runConfig)
    log.info('Processing respondents...')
    rawData.respondents = await sp.buildRespondentData()
    log.info('Processing questions...')
    rawData.questions = await sp.buildQuestionData()
    log.info('Processing collectors...')
    rawData.collectors = await sp.buildCollectorsData()

    if (runConfig.booleans.generate_padded_answers) {
      log.info('Processing padded answers...')
      rawData.padded_answers = await sp.buildPaddedAnswerData()
    }

    if (runConfig.booleans.generate_profiles) {
      log.info('Processing respondent profiles...')
      let rawProfiles = await sp.transposeQuestions(
        runConfig.config.respondent_profile_questions
      )
      rawData.profiles = await sp.breakdownMultipleAnswers(
        runConfig.config.profiles_multiple,
        rawProfiles
      )
    }

    if (runConfig.booleans.generate_openended) {
      log.info('Processing open ended answers...')
      rawData.open_ended = await sp.buildOpenEndedData()
    }

    if (runConfig.booleans.generate_quadrants) {
      log.info('Processing quadrants data...')
      for (var idx in runConfig.config.quadrant_files) {
        if (runConfig.config.quadrant_config[idx].is_expected_preferred) {
          rawData.quadrants.push(
            await sp.expectedPreferred(
              runConfig.config.quadrant_questions[idx],
              runConfig.config.quadrant_config[idx].use_topic,
              runConfig.config.quadrant_config[idx].use_score,
              runConfig.config.quadrant_headers[idx],
              runConfig.config.quadrant_futures
            )
          )
        } else {
          rawData.quadrants.push(
            await sp.transposeQuestions(
              runConfig.config.quadrant_questions[idx],
              runConfig.config.quadrant_config[idx].use_topic,
              runConfig.config.quadrant_config[idx].use_score
            )
          )
        }
      }
    }

    log.info('Saving data files...')
    if (saveMode.toLowerCase() == 'google') {
      log.info('Saving to google sheets...')
      gs = new googleSheets({
        credentialFile: './keys/credentials.json',
        tokenFile: './keys/token.json',
        scopes: cfg.scopes,
      })
      if (gs) {
        let spreadSheetId = await gs.spreadSheetExists(dvs)
        if (!spreadSheetId) {
          log.info(`Creating the spreadsheet ${dvs}...`)
          let sheet = await gs.createSpreadSheet(dvs)
          spreadSheetId = sheet.spreadsheetId
        }

        let sheetNames = Object.keys(runConfig.strings).map(item => {
          return item.replace('_file', '')
        })

        for (let idx in sheetNames) {
          let sheetNameExists = await gs.sheetExists(
            spreadSheetId,
            sheetNames[idx]
          )
          if (!sheetNameExists) {
            log.info(`Creating sheet ${sheetNames[idx]}...`)
            let sh1 = await gs.createSheet(spreadSheetId, sheetNames[idx], 10)
          }
        }

        for (let idx in sheetNames) {
          log.info(`Saving data to sheet ${sheetNames[idx]}...`)
          let ws = await writeToSheets(
            spreadSheetId,
            sheetNames[idx],
            rawData[sheetNames[idx]]
          )
        }

        log.info('Saving quadrants data...')
        for (let idx in rawData.quadrants) {
          let sheetNameExists = await gs.sheetExists(
            spreadSheetId,
            `quadrant${idx}`
          )
          if (!sheetNameExists) {
            log.info(`Creating sheet quadrant${idx}...`)
            let sh1 = await gs.createSheet(spreadSheetId, `quadrant${idx}`, 10)
          }
        }

        for (let idx in rawData.quadrants) {
          log.info(`Saving data to sheet quadrant${idx}...`)
          let ws = await writeToSheets(
            spreadSheetId,
            `quadrant${idx}`,
            rawData.quadrants[idx]
          )
        }
      } else {
        log.error(
          'Error initializing googlesheets access. Please check error logs.'
        )
      }
    } else if (saveMode.toLowerCase() == 'json') {
      log.info('Saving to single json file...')
      fs.writeFileSync(runConfig.single_json_file, JSON.stringify(rawData))
    } else {
      log.info('Saving to csv files...')
      Object.keys(runConfig.strings).forEach(key => {
        fs.writeFileSync(
          runConfig.strings[key].replace('{nickname}', dvs),
          JSON.stringify(rawData[key.replace('_file', '')])
        )
      })
    }
  } else {
    log.error(
      `The configuration file for ${dvs} was not found. Check your spelling and try again. `
    )
  }
}

/**
 * Start Point
 * This is the standard function to be called to start the script execution.
 * This will give you a script that already writes to stdout and log files, with rotating logs.
 *
 * Parameters:
 * 1st - the process object
 * 2nd - the logger object
 * 3rd - the callback function that will start the execution of your logic
 */
mainRoutine(process, logger(), execute)
