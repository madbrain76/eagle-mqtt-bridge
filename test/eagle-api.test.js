const assert = require('assert')
const {
  extractResponseEnvelope,
  extractDevice,
  isElectricMeter,
  mapDeviceQueryToMessage,
  parseDemandWatts,
  parseSummationValue,
  parseCurrencyValue,
  calculateRetryDelayMs,
  getRetryDelayMs,
  parseXml,
  normalizeEndpoint,
} = require('../eagle-api.js')

assert.strictEqual(parseDemandWatts('2.814 kW'), 2814)
assert.strictEqual(parseDemandWatts('-0.511 kW'), -511)
assert.strictEqual(parseDemandWatts('42 W'), 42)

assert.strictEqual(parseSummationValue('24447.440 kWh'), 24447.44)
assert.strictEqual(parseSummationValue('1440 Wh'), 1.44)

assert.strictEqual(parseCurrencyValue('0.072 $'), 0.072)
assert.strictEqual(normalizeEndpoint('eagle.local').toString(), 'http://eagle.local/cgi-bin/post_manager')
assert.strictEqual(normalizeEndpoint('https://eagle.local/custom').toString(), 'https://eagle.local/custom')
assert.strictEqual(calculateRetryDelayMs(1, 5000, 60000), 5000)
assert.strictEqual(calculateRetryDelayMs(2, 5000, 60000), 10000)
assert.strictEqual(calculateRetryDelayMs(5, 5000, 60000), 60000)
assert.strictEqual(getRetryDelayMs({
  consecutiveFailures: 1,
  pollIntervalMs: 30000,
  backoffAfterFailures: 2,
  retryMaxDelayMs: 60000,
}), 30000)
assert.strictEqual(getRetryDelayMs({
  consecutiveFailures: 2,
  pollIntervalMs: 30000,
  backoffAfterFailures: 2,
  retryMaxDelayMs: 60000,
}), 60000)
assert.strictEqual(getRetryDelayMs({
  consecutiveFailures: 4,
  pollIntervalMs: 30000,
  backoffAfterFailures: 2,
  retryMaxDelayMs: 60000,
}), 60000)

assert.deepStrictEqual(
  extractResponseEnvelope(parseXml('<Response><DeviceList><Device><DeviceType>Electric Meter</DeviceType></Device></DeviceList></Response>')),
  { DeviceList: { Device: { DeviceType: 'Electric Meter' } } }
)
assert.deepStrictEqual(
  extractResponseEnvelope(parseXml('<DeviceQuery><Device><ConnectionStatus>Connected</ConnectionStatus></Device></DeviceQuery>')),
  { DeviceQuery: { Device: { ConnectionStatus: 'Connected' } } }
)
assert.deepStrictEqual(
  extractResponseEnvelope(parseXml('<Device><ConnectionStatus>Connected</ConnectionStatus></Device>')),
  { Device: { ConnectionStatus: 'Connected' } }
)
assert.strictEqual(
  isElectricMeter({
    Name: 'Power Meter',
    ModelId: 'electric_meter',
    Protocol: 'Zigbee',
  }),
  true
)
assert.throws(
  () => extractResponseEnvelope(parseXml('<html><body>Login required</body></html>'), '<html><body>Login required</body></html>'),
  /unexpected root element html/
)
assert.deepStrictEqual(
  extractDevice({ Device: { ConnectionStatus: 'Connected' } }),
  { ConnectionStatus: 'Connected' }
)
assert.deepStrictEqual(
  extractDevice({ DeviceQuery: { Device: { ConnectionStatus: 'Connected' } } }),
  { ConnectionStatus: 'Connected' }
)

const mapped = mapDeviceQueryToMessage({
  DeviceDetails: {
    ConnectionStatus: 'Connected',
  },
  Components: {
    Component: {
      Variables: {
        Variable: [
          { Name: 'zigbee:InstantaneousDemand', Value: '2.814', Units: 'kW' },
          { Name: 'zigbee:CurrentSummationDelivered', Value: '24447.440', Units: 'kWh' },
          { Name: 'zigbee:CurrentSummationReceived', Value: '1.240', Units: 'kWh' },
          { Name: 'zigbee:Price', Value: '0.072', Units: '$' },
          { Name: 'zigbee:PriceRateLabel', Value: 'Tier 1', Units: '' },
        ],
      },
    },
  },
})

assert.deepStrictEqual(mapped, {
  'meter/demand': 2814,
  'meter/imported': 24447.44,
  'meter/exported': 1.24,
  'pricing/price': 0.072,
  'pricing/tier': 'Tier 1',
  'zigbee/status': 'Connected',
})

console.log('eagle-api parsing tests passed')
