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
const googleSheets = require('@wvcode/gsheet-wrapper')
const fs = require('fs')
const SurveyApi = require('@wvcode/sm-wrapper')
const { convertToArrayOfArrays } = require('@wvcode/utils')

let gs = null
let isStarted = false

/**
 * Return all the main configuration sheets for processing
 * @param {*} sheetId
 * @param {*} rangeNames
 * @returns an array with the selected sheets
 */
async function getGSheets(sheetId, rangeNames, log) {
  let sheets = []
  if (isStarted) {
    for (var idx in rangeNames) {
      log.info(`Downloading information from sheet: ${rangeNames[idx]}...`)
      let data = await gs.getSheet(sheetId, rangeNames[idx])
      sheets.push({ id: idx, data: data })
    }
  }
  return sheets
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
  gs = new googleSheets({
    credentialFile: './keys/credentials.json',
    tokenFile: './keys/token.json',
    scopes: cfg.scopes,
  })
  isStarted = gs ? true : fale

  let sm = new SurveyApi(cfg.access_token)

  let needUpdate = false

  let sheets = []
  if (isStarted) {
    // return the configuration sheets from the _Survey spreadsheet
    sheets = await getGSheets(cfg.surveySheetId, cfg.dataRanges, log)

    let surveyList = await sm.getSurveys()

    let newSurveys = []
    // should be empty if you dont want to exclude any survey
    let excludeFilter = [] //['305440674']
    let storedSurveyKeys = sheets[0].data.map(item => {
      return !excludeFilter.includes(item['Survey ID'])
        ? item['Survey ID']
        : null
    })

    surveyList.forEach(survey => {
      if (!storedSurveyKeys.includes(survey.id)) {
        newSurveys.push({
          'Survey ID': survey.id,
          'Survey Title': survey.title,
          'Survey Key': `${survey.id}#${survey.title}`,
        })
      }
    })

    if (newSurveys.length > 0) {
      log.info(
        `There is(are) ${newSurveys.length} survey(s) to be processed...`
      )
      let newQuestions = []
      for (var idx in newSurveys) {
        let survey = await sm.getSurvey(newSurveys[idx]['Survey ID'])
        // let survey = JSON.parse(fs.readFileSync('data.json'))

        let questionNumber = 1
        survey.pages.forEach(page => {
          page.questions.forEach(question => {
            if (question.family != 'presentation') {
              newQuestions.push({
                'Survey Key': `${survey.id}#${survey.title}`,
                'Question Key': `${page.id}#${question.id}#Question_${questionNumber}`,
                'Question Title': question.title,
                'Question Type': question.family,
              })
              questionNumber++
            }
          })
        })
      }

      let newData = [newSurveys, newQuestions]
      for (var idx in newData) {
        log.info(`Saving ${cfg.updateRanges[idx]}...`)
        await gs.updateSheet(
          cfg.surveySheetId,
          cfg.updateRanges[idx],
          convertToArrayOfArrays(sheets[idx].data.concat(newData[idx]))
        )
      }
    }
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
