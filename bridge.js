const mqttclient = require('./mqtt-client.js')
const EagleApiClient = require('./eagle-api.js')
const logger = require('./logger.js')
const { isValidMqttHost } = require('./mqtt-host.js')

function startBridge(environment = process.env) {
  logger.info('Starting Eagle to MQTT Bridge.')

  const mqttHost = environment.MQTT_HOST
  const host = isValidMqttHost(mqttHost) ? mqttHost : null
  const eagleHost = environment.EAGLE_HOST
  const eagleUser = environment.EAGLE_USER
  const eaglePass = environment.EAGLE_PASS
  const eagleConfigured = Boolean(eagleHost && eagleUser && eaglePass)
  const availabilityTimeoutMs = parsePositiveInt(environment.AVAILABILITY_TIMEOUT_MS, 300000)
  const eaglePollIntervalMs = parsePositiveInt(environment.EAGLE_POLL_INTERVAL_MS, 15000)
  const eagleFailuresBeforeOffline = parsePositiveInt(environment.EAGLE_FAILURES_BEFORE_OFFLINE, 20)
  const discovery = parseBooleanEnv(environment.PUBLISH_HOME_ASSISTANT_MQTT, true)
  const topicRegex = new RegExp('^((?![#+]).)+$')

  if (!topicRegex.test(environment.MQTT_TOPIC) && environment.MQTT_TOPIC) {
    logger.warn('MQTT topic cannot contain "+" or "#" characters')
  }

  const topicBase = (environment.MQTT_TOPIC && topicRegex.test(environment.MQTT_TOPIC)) ? environment.MQTT_TOPIC : 'eagle'
  const username = environment.MQTT_USER
  const password = environment.MQTT_PASS

  if (!host) {
    throw new Error('MQTT_HOST must be a valid IPv4 address or hostname.')
  }

  if (!eagleConfigured) {
    throw new Error('EAGLE_HOST, EAGLE_USER, and EAGLE_PASS are required.')
  }

  const mqtt = new mqttclient(host, username, password, topicBase, discovery)
  const eagle = new EagleApiClient(eagleHost, eagleUser, eaglePass, {
    pollIntervalMs: eaglePollIntervalMs,
  })
  let availabilityTimeout
  let lastSuccessfulPollAt = null
  let consecutivePollErrors = 0
  let eagleAvailable = false

  function scheduleAvailabilityCheck() {
    if (availabilityTimeout) {
      clearTimeout(availabilityTimeout)
    }
    availabilityTimeout = setTimeout(checkAvailability, availabilityTimeoutMs)
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
    if (consecutivePollErrors >= eagleFailuresBeforeOffline) {
      checkAvailability()
    }
  }

  function checkAvailability() {
    const now = Date.now()
    const hasRecentSuccess = lastSuccessfulPollAt && (now - lastSuccessfulPollAt) < availabilityTimeoutMs

    if (hasRecentSuccess) {
      scheduleAvailabilityCheck()
      return
    }

    if (eagleAvailable && consecutivePollErrors >= eagleFailuresBeforeOffline) {
      logger.warn(
        'Publishing Eagle offline after '
        + consecutivePollErrors
        + ' consecutive poll errors and '
        + availabilityTimeoutMs
        + 'ms without success'
      )
      mqtt.sendMessage('availability', 'offline', true)
      eagleAvailable = false
    } else if (eagleAvailable) {
      scheduleAvailabilityCheck()
    }
  }

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

  scheduleAvailabilityCheck()
  mqtt.connect()
  eagle.start()

  return {
    mqtt,
    eagle,
    stop() {
      if (availabilityTimeout) {
        clearTimeout(availabilityTimeout)
        availabilityTimeout = null
      }

      if (typeof eagle.stop === 'function') {
        eagle.stop()
      }

      if (mqtt.client && typeof mqtt.client.end === 'function') {
        mqtt.client.end(true)
      }
    },
  }
}

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

if (require.main === module) {
  try {
    startBridge(process.env)
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}

module.exports = {
  startBridge,
  parsePositiveInt,
  parseBooleanEnv,
}
