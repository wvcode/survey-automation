const SurveyApi = require('@wvcode/sm-wrapper')
const _ = require('lodash')

class SurveyProccessor {
  #PUNCTUATION = ['.', ',', ':', '-', '?', '!', '%']
  #CONTRACTIONS = {
    "ain't": 'am not',
    "aren't": 'are not',
    "can't": 'cannot',
    "can't've": 'cannot have',
    "'cause": 'because',
    "could've": 'could have',
    "couldn't": 'could not',
    "couldn't've": 'could not have',
    "didn't": 'did not',
    "doesn't": 'does not',
    "don't": 'do not',
    "hadn't": 'had not',
    "hadn't've": 'had not have',
    "hasn't": 'has not',
    "haven't": 'have not',
    "he'd": 'he would',
    "he'd've": 'he would have',
    "he'll": 'he will',
    "he'll've": 'he will have',
    "he's": 'he is',
    "how'd": 'how did',
    "how'd'y": 'how do you',
    "how'll": 'how will',
    "how's": 'how is',
    "I'd": 'I would',
    "I'd've": 'I would have',
    "I'll": 'I will',
    "I'll've": 'I will have',
    "I'm": 'I am',
    "I've": 'I have',
    "isn't": 'is not',
    "it'd": 'it would',
    "it'd've": 'it would have',
    "it'll": 'it will',
    "it'll've": 'it will have',
    "it's": 'it is',
    "let's": 'let us',
    "ma'am": 'madam',
    "mayn't": 'may not',
    "might've": 'might have',
    "mightn't": 'might not',
    "mightn't've": 'might not have',
    "must've": 'must have',
    "mustn't": 'must not',
    "mustn't've": 'must not have',
    "needn't": 'need not',
    "needn't've": 'need not have',
    "o'clock": 'of the clock',
    "oughtn't": 'ought not',
    "oughtn't've": 'ought not have',
    "shan't": 'shall not',
    "sha'n't": 'shall not',
    "shan't've": 'shall not have',
    "she'd": 'she would',
    "she'd've": 'she would have',
    "she'll": 'she will',
    "she'll've": 'she will have',
    "she's": 'she is',
    "should've": 'should have',
    "shouldn't": 'should not',
    "shouldn't've": 'should not have',
    "so've": 'so have',
    "so's": 'so is',
    "that'd": 'that would',
    "that'd've": 'that would have',
    "that's": 'that is',
    "there'd": 'there would',
    "there'd've": 'there would have',
    "there's": 'there is',
    "they'd": 'they would',
    "they'd've": 'they would have',
    "they'll": 'they will',
    "they'll've": 'they will have',
    "they're": 'they are',
    "they've": 'they have',
    "to've": 'to have',
    "wasn't": 'was not',
    "we'd": 'we would',
    "we'd've": 'we would have',
    "we'll": 'we will',
    "we'll've": 'we will have',
    "we're": 'we are',
    "we've": 'we have',
    "weren't": 'were not',
    "what'll": 'what will',
    "what'll've": 'what will have',
    "what're": 'what are',
    "what's": 'what is',
    "what've": 'what have',
    "when's": 'when is',
    "when've": 'when have',
    "where'd": 'where did',
    "where's": 'where is',
    "where've": 'where have',
    "who'll": 'who will',
    "who'll've": 'who will have',
    "who's": 'who is',
    "who've": 'who have',
    "why's": 'why is',
    "why've": 'why have',
    "will've": 'will have',
    "won't": 'will not',
    "won't've": 'will not have',
    "would've": 'would have',
    "wouldn't": 'would not',
    "wouldn't've": 'would not have',
    "y'all": 'you all',
    "y'all'd": 'you all would',
    "y'all'd've": 'you all would have',
    "y'all're": 'you all are',
    "y'all've": 'you all have',
    "you'd": 'you would',
    "you'd've": 'you would have',
    "you'll": 'you will',
    "you'll've": 'you will have',
    "you're": 'you are',
    "you've": 'you have',
  }

  #api = null
  #survey_id = null
  #questions = null
  #respondents = null
  #answers = null
  #open_ended = null
  #collectors = null
  #questionList = null

  /**
   *
   * @param {*} survey_id
   * @param {*} access_token
   * @param {*} proxy
   */
  constructor(survey_id, access_token, proxy = null) {
    this.#survey_id = survey_id
    this.#api = new SurveyApi(access_token, proxy)
  }

  returnScore(value) {
    let returnValue = 0
    const regex = /^([-+]*[\s]*[0-9]+)/
    const matches = regex.exec(value)
    if (matches) {
      returnValue = matches[0].trim().replace(' ', '')
    }
    return returnValue
  }

  decontract(phrase) {
    let decPhrase = phrase
    Object.keys(this.#CONTRACTIONS).forEach(key => {
      decPhrase = decPhrase.replace(key, this.#CONTRACTIONS[key])
    })
    return decPhrase
  }

  cleanHTML(rec) {
    const tagRe = /<[^>]+>/gim
    Object.entries(rec).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        rec[key] = value.replace(tagRe, '').trim()
      }
    })
    return rec
  }

  returnTopics(questionId) {
    let topics = []
    this.#answers.forEach(question => {
      if (question.question_id == questionId) {
        if (question.topic != '' && !topics.includes(question.topic)) {
          topics.push(question.topic)
        }
      }
    })
    return topics
  }

  async createQuestionTypeList() {
    const questionData = await this.#api.getSurvey(this.#survey_id)
    let questions = {}
    questionData.pages.forEach(page => {
      page.questions.forEach(question => {
        if (!['presentation'].includes(question.family)) {
          questions[question.id] = {
            family: question.family,
            subtype: _.has(question, 'subtype')
              ? question.subtype
              : question.family,
            choices: {},
          }
          if (['multiple_choice', 'single_choice'].includes(question.family)) {
            question.answers.choices.forEach(choice => {
              questions[question.id].choices[choice.id] = choice.text
            })
          } else {
            if (question.family == 'matrix') {
              question.answers.rows.forEach(row => {
                let rowId = row.id
                questions[question.id].choices[rowId] = {
                  text: row.text,
                  data: {},
                }
                question.answers.choices.forEach(choice => {
                  questions[question.id].choices[rowId]['data'][choice.id] =
                    choice.text
                })
              })
            } else {
              if (
                question.family == 'open_ended' &&
                _.has(question, 'subtype') &&
                ['multi', 'numerical'].includes(question.subtype)
              ) {
                question.answers.rows.forEach(row => {
                  let rowId = row.id
                  questions[question.id].choices[rowId] = {
                    text: row.text,
                    data: {},
                  }
                })
              }
            }
          }
        }
      })
    })
    return questions
  }

  async buildQuestionData() {
    this.#questions = []
    const questionData = await this.#api.getSurvey(this.#survey_id)
    let questionLabel = 1
    questionData.pages.forEach(page => {
      let pageId = page.id
      page.questions.forEach(question => {
        if (!['presentation'].includes(question.family)) {
          const record = {
            survey_id: this.#survey_id,
            page_id: pageId,
            question_id: question.id,
            question_label: `Question ${questionLabel}`,
            question_heading: question.headings[0].heading,
            question_type: question.family,
            question_subtype: _.has(question, 'subtype')
              ? question.subtype
              : question.family,
          }
          this.#questions.push(this.cleanHTML(record))
          questionLabel += 1
        }
      })
    })
    return this.#questions
  }

  async buildRespondentData() {
    this.#respondents = []
    const respondentList = await this.#api.getSurveyData(this.#survey_id)
    respondentList.forEach(respondent => {
      const record = {
        survey_id: this.#survey_id,
        respondent_id: respondent.id,
        duration_seconds: respondent.total_time,
        start_date: respondent.date_created,
        end_date: respondent.date_modified,
        ip_address: respondent.ip_address,
        collector_id: respondent.collector_id,
        status: respondent.response_status,
      }
      this.#respondents.push(record)
    })
    return this.#respondents
  }

  async buildCollectorsData() {
    this.#collectors = []
    const collectorList = await this.#api.getCollectorDetails(this.#survey_id)
    collectorList.forEach(item => {
      const record = {
        survey_id: this.#survey_id,
        collector_id: item.id,
        name: item.name,
      }
      this.#collectors.push(record)
    })
    return this.#collectors
  }

  async buildAnswerData(cfg) {
    this.#answers = []
    this.#questionList = await this.createQuestionTypeList()
    const rawData = await this.#api.getSurveyData(this.#survey_id)
    rawData.forEach(answer => {
      const responseId = answer.id
      answer.pages.forEach(page => {
        const pageId = page.id
        page.questions.forEach(question => {
          const questionId = question.id
          if (
            !['presentation'].includes(this.#questionList[questionId].family)
          ) {
            Object.entries(question.answers).forEach(([idx, item]) => {
              let record = {
                survey_id: this.#survey_id,
                page_id: pageId,
                respondent_id: responseId,
                question_id: questionId,
                question_type: this.#questionList[questionId].family,
                answer: null,
                topic: null,
                score: '',
              }
              if (this.#questionList[questionId].family == 'open_ended') {
                record.answer = item.text
                if (this.#questionList[questionId].subtype == 'numerical') {
                  record.score = eval(item.text)
                }
                if (this.#questionList[questionId].subtype == 'multi') {
                  record.score = item.text
                }
                if (_.has(item, 'row_id')) {
                  if (this.#questionList[questionId].choices.length > 0) {
                    record.topic = this.#questionList[questionId].choices[
                      item.row_id
                    ].text.replace('\xa0', ' ')
                  } else {
                    if (idx == 0) {
                      record.topic = 'X'
                    } else {
                      record.topic = 'Y'
                    }
                  }
                } else {
                  record.topic = 'Open Ended'
                }
              } else {
                if (
                  ['multiple_choice', 'single_choice'].includes(
                    this.#questionList[questionId].family
                  )
                ) {
                  if (_.has(item, 'choice_id')) {
                    record.answer =
                      this.#questionList[questionId].choices[item.choice_id]
                    record.score = this.returnScore(
                      this.#questionList[questionId].choices[item.choice_id]
                    )
                  } else {
                    record.answer = item.text
                    record.topic = 'Open Ended'
                  }
                } else {
                  if (this.#questionList[questionId].family == 'matrix') {
                    if (_.has(item, 'row_id')) {
                      record.topic = this.#questionList[questionId].choices[
                        item.row_id
                      ].text?.replace('\xa0', ' ')
                      record.answer =
                        this.#questionList[questionId].choices[item.row_id][
                          'data'
                        ][item.choice_id]
                      record.score = this.returnScore(
                        this.#questionList[questionId].choices[item.row_id][
                          'data'
                        ][item.choice_id]
                      )
                    } else {
                      record.topic = 'Open Ended'
                      record.answer = item.text
                      record.question_type = 'open_ended'
                    }
                  }
                }
              }
              this.#answers.push(this.cleanHTML(record))
            })
            this.#answers.forEach(item => {
              if (_.has(cfg.config.quadrant_replacements, item.question_id)) {
                try {
                  item.score =
                    cfg.config.quadrant_replacements[item.question_id][
                      item.answer
                    ]
                } catch (e) {
                  item.score = 0
                }
              }
            })
          }
        })
      })
    })
    return this.#answers
  }

  async transposeQuestions(keyData, useTopic = false, useScore = false) {
    let rawData = {}
    let qstLookup = {}
    this.#questions.forEach(item => {
      if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id)
      ) {
        qstLookup[item.question_id] = item.question_label
      }
    })
    this.#answers.forEach(item => {
      if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id) &&
        item.question_type != 'open_ended' &&
        item.topic != 'Open Ended'
      ) {
        if (!Object.keys(rawData).includes(item.respondent_id)) {
          rawData[item.respondent_id] = {}
          if (!useTopic) {
            Object.keys(qstLookup).forEach(key => {
              rawData[item.respondent_id][qstLookup[key]] = '--'
            })
          }
        }
        if (useTopic) {
          if (!Object.keys(rawData[item.respondent_id]).includes(item.topic)) {
            rawData[item.respondent_id][item.topic] = {}
            Object.keys(qstLookup).forEach(key => {
              if (useTopic) {
                rawData[item.respondent_id][item.topic][qstLookup[key]] = '--'
              } else {
                rawData[item.respondent_id][qstLookup[key]] = '--'
              }
            })
          }
        }
        if (useScore) {
          if (useTopic) {
            rawData[item.respondent_id][item.topic][
              qstLookup[item.question_id]
            ] = item.score
          } else {
            rawData[item.respondent_id][qstLookup[item.question_id]] =
              item.score
          }
        } else {
          if (useTopic) {
            if (item.topic != 'Open Ended') {
              rawData[item.respondent_id][item.topic][
                qstLookup[item.question_id]
              ] = item.answer || ''
            } else {
              rawData[item.respondent_id]['Other'][
                qstLookup[item.question_id]
              ] = ''
            }
          } else {
            if (item.topic != 'Open Ended') {
              if (rawData[item.respondent_id][qstLookup[item.question_id]]) {
                if (
                  rawData[item.respondent_id][qstLookup[item.question_id]]
                    ?.length == 0
                ) {
                  rawData[item.respondent_id][qstLookup[item.question_id]] =
                    item.answer
                } else {
                  if (
                    rawData[item.respondent_id][qstLookup[item.question_id]] !=
                    '--'
                  ) {
                    rawData[item.respondent_id][qstLookup[item.question_id]] +=
                      '#' + item.answer
                  } else {
                    rawData[item.respondent_id][qstLookup[item.question_id]] =
                      item.answer
                  }
                }
              } else {
                rawData[item.respondent_id][qstLookup[item.question_id]] =
                  item.answer || ''
              }
            } else {
              rawData[item.respondent_id][qstLookup[item.question_id]] = 'Other'
            }
          }
        }
      } else if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id) &&
        item.question_type == 'open_ended' &&
        item.topic != 'Open Ended'
      ) {
        if (!Object.keys(rawData).includes(item.respondent_id)) {
          rawData[item.respondent_id] = {}
          if (!useTopic) {
            Object.keys(qstLookup).forEach(key => {
              rawData[item.respondent_id][qstLookup[key]] = ''
            })
          }
        }
        if (useTopic) {
          if (!Object.keys(rawData[item.respondent_id]).includes(item.topic)) {
            rawData[item.respondent_id][item.topic] = {}
            Object.keys(qstLookup).forEach(key => {
              if (useTopic) {
                rawData[item.respondent_id][item.topic][qstLookup[key]] = ''
              } else {
                rawData[item.respondent_id][qstLookup[key]] = ''
              }
            })
          }
        }
        if (useScore) {
          if (useTopic) {
            rawData[item.respondent_id][item.topic][
              qstLookup[item.question_id]
            ] = item.score
          } else {
            rawData[item.respondent_id][qstLookup[item.question_id]] =
              item.score
          }
        } else {
          if (useTopic) {
            if (item.topic != 'Open Ended') {
              rawData[item.respondent_id][item.topic][
                qstLookup[item.question_id]
              ] = item.answer || ''
            } else {
              rawData[item.respondent_id]['Other'][
                qstLookup[item.question_id]
              ] = item.answer || ''
            }
          } else {
            if (item.topic != 'Open Ended') {
              rawData[item.respondent_id][qstLookup[item.question_id]] =
                item.answer || ''
            } else {
              rawData[item.respondent_id][qstLookup[item.question_id]] = 'Other'
            }
          }
        }
      } else if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id) &&
        item.question_type != 'open_ended' &&
        item.topic == 'Open Ended'
      ) {
        if (!Object.keys(rawData).includes(item.respondent_id)) {
          rawData[item.respondent_id] = {}
          // if (!useTopic) {
          //   Object.keys(qstLookup).forEach(key => {
          //     rawData[item.respondent_id][qstLookup[key]] = ''
          //   })
          // }
        }
        rawData[item.respondent_id][qstLookup[item.question_id] || 'garbage'] =
          'Other'
      } else {
        if (!Object.keys(rawData).includes(item.respondent_id)) {
          rawData[item.respondent_id] = {}
          if (!useTopic) {
            Object.keys(qstLookup).forEach(key => {
              rawData[item.respondent_id][qstLookup[key]] = ''
            })
          }
        }
        rawData[item.respondent_id][qstLookup[item.question_id] || 'garbage'] =
          item.answer || ''
      }
    })

    let returnValue = []
    Object.keys(rawData).forEach(key => {
      if (useTopic) {
        Object.keys(rawData[key]).forEach(keyTopic => {
          if (keyTopic != 'garbage') {
            let cpItem = rawData[key][keyTopic]
            if (typeof cpItem !== 'string') {
              Object.keys(cpItem).forEach(key =>
                key == 'garbage' ? delete cpItem[key] : {}
              )
              if (Object.keys(cpItem).length > 0) {
                cpItem['topic'] = keyTopic
                cpItem['respondent_id'] = key
                cpItem['survey_id'] = this.#survey_id
                returnValue.push(cpItem)
              }
            } else {
              console.log('error')
            }
          }
        })
      } else {
        let cpItem = rawData[key]
        Object.keys(cpItem).forEach(key =>
          key == 'garbage' ? delete cpItem[key] : {}
        )
        if (Object.keys(cpItem).length > 0) {
          cpItem['respondent_id'] = key
          cpItem['survey_id'] = this.#survey_id
          returnValue.push(cpItem)
        }
      }
    })

    return returnValue
  }

  async expectedPreferred(keyData, useTopic, useScore, headers, futures) {
    let rawData = {}
    let qstLookup = {}
    this.#questions.forEach(item => {
      if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id)
      ) {
        qstLookup[item.question_id] = item.question_label
      }
    })

    this.#answers.forEach(item => {
      if (
        Object.keys(keyData).includes(item.page_id) &&
        keyData[item.page_id].includes(item.question_id)
      ) {
        if (!Object.keys(rawData).includes(item.respondent_id)) {
          rawData[item.respondent_id] = {}
        }

        if (useScore) {
          rawData[item.respondent_id][
            qstLookup[item.question_id] + item.topic
          ] = item.score
        } else {
          rawData[item.respondent_id][
            qstLookup[item.question_id] + item.topic
          ] = item.answer
        }
      }
    })
    let returnValue = []
    Object.keys(rawData).forEach(key => {
      if (useTopic) {
        futures.forEach(future => {
          let cpItem = {}
          headers.forEach(item => {
            if (!Object.keys(cpItem).includes(item)) {
              cpItem[item] = '0'
            }
          })
          Object.keys(rawData[key]).forEach(item => {
            cpItem[item] = rawData[key][item]
          })
          cpItem['topic'] = future
          cpItem['respondent_id'] = key
          cpItem['survey_id'] = this.#survey_id
          returnValue.push(cpItem)
        })
        // let cpItem2 = {}
        // headers.forEach(item => {
        //     if (!Object.keys(cpItem2).includes(item)) {
        //         cpItem2[item] = '0'
        //     }
        // })
        // Object.keys(rawData[key]).forEach(item => {
        //     cpItem2[item] = rawData[key][item]
        // })
        // cpItem2['topic'] = 'Preferred'
        // cpItem2['respondent_id'] = key
        // cpItem2['survey_id'] = this.#survey_id
        // returnValue.push(cpItem2)
      } else {
        let cpItem = {}
        headers.forEach(item => {
          if (!Object.keys(cpItem).includes(item)) {
            cpItem[item] = '0'
          }
        })
        Object.keys(rawData[key]).forEach(item => {
          cpItem[item] = rawData[key][item]
        })
        cpItem['respondent_id'] = key
        cpItem['survey_id'] = this.#survey_id
        returnValue.push(cpItem)
      }
    })
    return returnValue
  }

  async buildOpenEndedData() {
    let answers = []
    this.#answers.forEach(line => {
      if (line.question_type == 'open_ended') {
        let d_line = this.decontract(line.answer.toLowerCase())
        let results = d_line.split(' ')
        results.forEach(word => {
          const data = {
            survey_id: this.#survey_id,
            page_id: line.page_id,
            respondent_id: line.respondent_id,
            question_id: line.question_id,
            question_type: line.question_type,
            answer: word,
          }
          answers.push(data)
        })
      }
    })
    this.#open_ended = answers
    return answers
  }

  async buildSAOpenEndedData() {
    let answers = []
    this.#answers.forEach(line => {
      if (line.question_type == 'open_ended') {
        let d_line = this.decontract(line.answer.lower())
        let results = d_line.split(' ')
        results.forEach(word => {
          const data = {
            survey_id: this.#survey_id,
            page_id: line.page_id,
            respondent_id: line.respondent_id,
            question_id: line.question_id,
            question_type: line.question_type,
            answer: word,
            polarity: 0,
            subjectivity: 0,
          }
          answers.push(data)
        })
      }
    })
    return answers
  }

  async buildPaddedAnswerData() {
    let answers = []
    let lineCount = 0
    this.#questions.forEach(line => {
      if (line.question_type == 'matrix') {
        const topics = this.returnTopics(line.question_id)
        this.#respondents.forEach(resp => {
          if (topics.length <= 0) {
            let data = {
              survey_id: this.#survey_id,
              page_id: line.page_id,
              respondent_id: resp.respondent_id,
              question_id: line.question_id,
              question_type: line.question_type,
              answer: 0,
              topic: '',
              score: 0,
            }
            answers.push(data)
          } else {
            for (let tpc in topics) {
              let data = {
                survey_id: this.#survey_id,
                page_id: line.page_id,
                respondent_id: resp.respondent_id,
                question_id: line.question_id,
                question_type: line.question_type,
                answer: 0,
                topic: topics[tpc],
                score: 0,
              }
              answers.push(data)
            }
          }
        })
      }
    })
    return answers
  }

  async breakdownMultipleAnswers(questions, rawData) {
    let returnData = []
    let midData = []
    Object.entries(questions).forEach(([idx, item]) => {
      rawData.forEach(row => {
        let values = row[item].split('#')
        Object.entries(values).forEach(([cnt, val]) => {
          let record = _.cloneDeep(row)
          record[item] = val
          record['cnt'] = parseInt(cnt) + 1
          returnData.push(record)
        })
      })
      rawData = _.cloneDeep(returnData)
      returnData = []
    })
    return rawData
  }
}

module.exports = SurveyProccessor
