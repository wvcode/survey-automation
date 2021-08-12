'use strict'
/**
 * Required Import routines
 */
const process = require('process')
const logger = require('./wvlibs/logging/logging')
const mainRoutine = require('./components/main')
const fs = require('fs')

/**
 ** Project includes
 */
const googleSheets = require('@wvcode/gsheet-wrapper')

let gs = null
let isStarted = false

/**
 * Return all the main configuration sheets for processing
 * @param {*} sheetId
 * @param {*} rangeNames
 * @returns an array with the selected sheets
 */
async function getGSheets(sheetId, rangeNames) {
  let sheets = []
  if (isStarted) {
    for (var idx in rangeNames) {
      let data = await gs.getSheet(sheetId, rangeNames[idx])
      sheets.push(data)
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
  const [client, dvs] = params
  gs = new googleSheets({
    credentialFile: './keys/credentials.json',
    tokenFile: './keys/token.json',
    scopes: cfg.scopes,
  })
  isStarted = gs ? true : false
  let needUpdate = false
  let sheets = []
  if (isStarted) {
    // return the configuration sheets from the _Survey spreadsheet
    sheets = await getGSheets(cfg.surveySheetId, cfg.configRanges)
    // load the configuration template object
    const template = require('./config/config_template.json')

    let updateData = []

    // loop on all configured surveys
    sheets[0].forEach(survey => {
      // if it is marked for generating the configuration
      if (survey.Status == 'Generate Configuration') {
        let currentConfig = { ...template } //copying the object

        let nickName = survey['Survey Alias']
        let surveyId = survey.Survey.split('#')[0]

        //setting the string key configuration
        Object.keys(currentConfig.strings).forEach(key => {
          currentConfig.strings[key] = currentConfig.strings[key].replace(
            '{nickname}',
            nickName
          )
        })

        //setting the booleans key configuration
        currentConfig.single_json_file = currentConfig.single_json_file.replace(
          '{nickname}',
          nickName
        )
        currentConfig.survey_id = surveyId
        currentConfig.access_token = cfg.access_token

        currentConfig.booleans.generate_quadrants =
          survey['Have Quadrants?'] == 'X'
        currentConfig.booleans.generate_openended =
          survey['Have Open Ended?'] == 'X'
        currentConfig.booleans.generate_profiles =
          survey['Have User Profile?'] == 'X'
        currentConfig.booleans.generate_sa =
          survey['Apply Sentiment Analysis?'] == 'X'
        currentConfig.booleans.generate_padded_answers =
          survey['Have Padded Answers?'] == 'X'
        currentConfig.booleans.is_network_map = survey['Is Network Map?'] == 'X'

        //setting the field configuration section
        sheets[1].forEach(field => {
          let [surveyTargetId, surveyTargetName] = field.Survey.split('#')
          let [pageId, questionId, questionLabel] = field.Question.split('#')

          if (surveyTargetId == surveyId) {
            currentConfig.config.profiles_header.push(questionLabel)
            if (
              !Object.keys(
                currentConfig.config.respondent_profile_questions
              ).includes(pageId)
            )
              currentConfig.config.respondent_profile_questions[pageId] = []

            currentConfig.config.respondent_profile_questions[pageId].push(
              questionId
            )
          }
        })

        //setting the quadrant configuration
        let quadrants = {}
        sheets[2].forEach(field => {
          let [surveyTargetId, surveyTargetName] = field.Survey.split('#')

          if (surveyTargetId == surveyId) {
            let [pageId, questionId, questionLabel] = field.Question.split('#')
            let quadrantKey = field['Quadrant ID']

            if (!Object.keys(quadrants).includes(quadrantKey))
              quadrants[quadrantKey] = {
                headers: ['survey_id', 'respondent_id', 'topic'],
                fields: {},
                use_topic: true,
                file: `../Dropbox/Tableau Dashboards/data/${nickName}_quadrants_data_${quadrantKey}.csv`,
              }

            if (!Object.keys(quadrants[quadrantKey].fields).includes(pageId))
              quadrants[quadrantKey].fields[pageId] = []

            quadrants[quadrantKey].fields[pageId].push(questionId)
            quadrants[quadrantKey].headers.push(questionLabel)
          }
        })

        Object.keys(quadrants).forEach(key => {
          currentConfig.config.quadrant_files.push(quadrants[key].file)
          currentConfig.config.quadrant_headers.push(quadrants[key].headers)
          currentConfig.config.quadrant_questions.push(quadrants[key].fields)
          currentConfig.config.quadrant_config.push({
            use_topic: quadrants[key].use_topic,
            use_score: true,
            is_expected_preferred: false,
          })
        })

        fs.writeFileSync(
          `${cfg.configurationFolder}/${client}/${nickName}.json`,
          JSON.stringify(currentConfig)
        )

        survey.Status = 'Draft'
        let needUpdate = true
      }
      updateData.push([survey.Status])
    })
    if (needUpdate) {
      await gs.updateSheet(
        cfg.surveySheetId,
        'Survey Main Configuration!B2:B',
        updateData
      )
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
