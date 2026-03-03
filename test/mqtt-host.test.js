const assert = require('assert')
const { isValidMqttHost } = require('../mqtt-host.js')

assert.strictEqual(isValidMqttHost('192.168.1.10'), true)
assert.strictEqual(isValidMqttHost('broker.example.com'), true)
assert.strictEqual(isValidMqttHost('garage-eagle3-wifi.localdomain'), true)
assert.strictEqual(isValidMqttHost('localhost'), true)

assert.strictEqual(isValidMqttHost(''), false)
assert.strictEqual(isValidMqttHost(undefined), false)
assert.strictEqual(isValidMqttHost('bad host name'), false)
assert.strictEqual(isValidMqttHost('-broken.example.com'), false)

console.log('mqtt-host validation tests passed')
