const mqttclient = require('./mqtt-client.js')
const EagleApiClient = require('./eagle-api.js')
const logger = require('./logger.js')
const { isValidMqttHost } = require('./mqtt-host.js')

logger.info('Starting Eagle to MQTT Bridge.')

const mqttHost = process.env.MQTT_HOST
const host = isValidMqttHost(mqttHost) ? mqttHost : null
const eagleHost = process.env.EAGLE_HOST
const eagleUser = process.env.EAGLE_USER
const eaglePass = process.env.EAGLE_PASS
const eagleConfigured = Boolean(eagleHost && eagleUser && eaglePass)
let mqtt
let eagle
const AVAILABILITY_TIMEOUT_MS = parsePositiveInt(process.env.AVAILABILITY_TIMEOUT_MS, 300000)
const EAGLE_POLL_INTERVAL_MS = parsePositiveInt(process.env.EAGLE_POLL_INTERVAL_MS, 15000)
const EAGLE_FAILURES_BEFORE_OFFLINE = parsePositiveInt(process.env.EAGLE_FAILURES_BEFORE_OFFLINE, 20)

const discovery = parseBooleanEnv(process.env.PUBLISH_HOME_ASSISTANT_MQTT, true)

const topicRegex = new RegExp('^((?![#+]).)+$')
if (!topicRegex.test(process.env.MQTT_TOPIC) && process.env.MQTT_TOPIC) {
  logger.warn('MQTT topic cannot contain "+" or "#" characters')
}
const topic_base = (process.env.MQTT_TOPIC && topicRegex.test(process.env.MQTT_TOPIC)) ? process.env.MQTT_TOPIC : 'eagle'

const username = process.env.MQTT_USER
const password = process.env.MQTT_PASS

if (!host) {
  logger.error('MQTT_HOST must be a valid IPv4 address or hostname.')
  process.exit()
} else if (!eagleConfigured) {
  logger.error('EAGLE_HOST, EAGLE_USER, and EAGLE_PASS are required.')
  process.exit()
} else {
  mqtt = new mqttclient(host, username, password, topic_base, discovery)
  mqtt.connect()
  eagle = new EagleApiClient(eagleHost, eagleUser, eaglePass, {
    pollIntervalMs: EAGLE_POLL_INTERVAL_MS,
  })
  eagle.start()
}

let availabilityTimeout
let lastSuccessfulPollAt = null
let consecutivePollErrors = 0
let eagleAvailable = false

function scheduleAvailabilityCheck() {
  if (availabilityTimeout) {
    clearTimeout(availabilityTimeout)
  }
  availabilityTimeout = setTimeout(checkAvailability, AVAILABILITY_TIMEOUT_MS)
}

function markEagleOnline() {
  lastSuccessfulPollAt = Date.now()
  consecutivePollErrors = 0
  scheduleAvailabilityCheck()
  if (!eagleAvailable) {
    mqtt.sendMessage('availability', 'online', true)
    eagleAvailable = true
  }
}

function markEaglePollError() {
  consecutivePollErrors += 1
  logger.warn('Eagle poll error count: ' + consecutivePollErrors)
  if (consecutivePollErrors >= EAGLE_FAILURES_BEFORE_OFFLINE) {
    checkAvailability()
  }
}

function checkAvailability() {
  const now = Date.now()
  const hasRecentSuccess = lastSuccessfulPollAt && (now - lastSuccessfulPollAt) < AVAILABILITY_TIMEOUT_MS

  if (hasRecentSuccess) {
    scheduleAvailabilityCheck()
    return
  }

  if (eagleAvailable && consecutivePollErrors >= EAGLE_FAILURES_BEFORE_OFFLINE) {
    logger.warn(
      'Publishing Eagle offline after '
      + consecutivePollErrors
      + ' consecutive poll errors and '
      + AVAILABILITY_TIMEOUT_MS
      + 'ms without success'
    )
    mqtt.sendMessage('availability', 'offline', true)
    eagleAvailable = false
  } else if (eagleAvailable) {
    scheduleAvailabilityCheck()
  }
}

scheduleAvailabilityCheck()

eagle.on('poll', () => {
  markEagleOnline()
})

eagle.on('message', (message) => {
  Object.keys(message).forEach(function(key) {
    mqtt.sendMessage(key, message[key], true)
  })
})

eagle.on('error', () => {
  markEaglePollError()
})

function parsePositiveInt(rawValue, defaultValue) {
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

function parseBooleanEnv(rawValue, defaultValue) {
  if (rawValue === undefined) {
    return defaultValue
  }

  return /^true$/i.test(rawValue)
}
