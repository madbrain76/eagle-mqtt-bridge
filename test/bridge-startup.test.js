const assert = require('assert')
const EventEmitter = require('events')

class FakeMqttClient {
  connect() {}
  sendMessage() {}
}

class FakeEagleApiClient extends EventEmitter {
  constructor(host, username, password, options) {
    super()
    this.options = options
    FakeEagleApiClient.instances.push(this)
  }

  start() {
    this.emit('error', new Error('startup failure'))
  }
}

FakeEagleApiClient.instances = []

const bridgePath = require.resolve('../bridge.js')
const mqttClientPath = require.resolve('../mqtt-client.js')
const eagleApiPath = require.resolve('../eagle-api.js')

require.cache[mqttClientPath] = {
  id: mqttClientPath,
  filename: mqttClientPath,
  loaded: true,
  exports: FakeMqttClient,
}

require.cache[eagleApiPath] = {
  id: eagleApiPath,
  filename: eagleApiPath,
  loaded: true,
  exports: FakeEagleApiClient,
}

const { startBridge } = require(bridgePath)

let bridge

assert.doesNotThrow(() => {
  bridge = startBridge({
    MQTT_HOST: 'broker.local',
    EAGLE_HOST: 'eagle.local',
    EAGLE_USER: 'user',
    EAGLE_PASS: 'pass',
    EAGLE_POLL_INTERVAL_MS: '15000',
    EAGLE_RETRY_BASE_DELAY_MS: '45000',
    EAGLE_RETRY_MAX_DELAY_MS: '180000',
    EAGLE_REQUEST_TIMEOUT_MS: '8000',
  })
})

assert.deepStrictEqual(FakeEagleApiClient.instances[0].options, {
  pollIntervalMs: 15000,
  retryBaseDelayMs: 45000,
  retryMaxDelayMs: 180000,
  requestTimeoutMs: 8000,
  backoffAfterFailures: 2,
})

bridge.stop()

delete require.cache[bridgePath]
delete require.cache[mqttClientPath]
delete require.cache[eagleApiPath]

console.log('bridge startup tests passed')
