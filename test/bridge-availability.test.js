const assert = require('assert')
const EventEmitter = require('events')

class FakeMqttClient {
  constructor() {
    this.messages = []
    this.client = { end() {} }
  }

  connect() {}

  sendMessage(topic, message, retain) {
    this.messages.push({ topic, message, retain })
  }
}

class FakeEagleApiClient extends EventEmitter {
  constructor() {
    super()
    this.client = this
    FakeEagleApiClient.instances.push(this)
  }

  start() {}

  stop() {}
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

const bridge = startBridge({
  MQTT_HOST: 'broker.local',
  EAGLE_HOST: 'eagle.local',
  EAGLE_USER: 'user',
  EAGLE_PASS: 'pass',
})

const eagle = FakeEagleApiClient.instances[0]
const mqtt = bridge.mqtt

eagle.emit('poll')
eagle.emit('error', new Error('first failure'))
assert.deepStrictEqual(mqtt.messages, [
  { topic: 'availability', message: 'online', retain: true },
])

eagle.emit('error', new Error('second failure'))
assert.deepStrictEqual(mqtt.messages, [
  { topic: 'availability', message: 'online', retain: true },
  { topic: 'availability', message: 'offline', retain: true },
])

bridge.stop()

delete require.cache[bridgePath]
delete require.cache[mqttClientPath]
delete require.cache[eagleApiPath]

console.log('bridge availability tests passed')
