const assert = require('assert')
const { buildDiscovery, messageset } = require('../hadiscovery.js')

buildDiscovery('eagle')

const demand = JSON.parse(messageset['homeassistant/sensor/rfeagle_power_demand/config'])
const delivered = JSON.parse(messageset['homeassistant/sensor/rfeagle_energy_imported_from_grid/config'])
const received = JSON.parse(messageset['homeassistant/sensor/rfeagle_energy_exported_to_grid/config'])

assert.strictEqual(demand.availability_topic, 'eagle/availability')
assert.ok(!('via_device' in demand.device))
assert.strictEqual(demand.state_class, 'measurement')

assert.strictEqual(delivered.state_class, 'total_increasing')
assert.strictEqual(received.state_topic, 'eagle/meter/exported')
assert.deepStrictEqual(Object.keys(messageset).sort(), [
  'homeassistant/sensor/rfeagle_energy_exported_to_grid/config',
  'homeassistant/sensor/rfeagle_energy_imported_from_grid/config',
  'homeassistant/sensor/rfeagle_power_demand/config',
])

buildDiscovery('garage/eagle')

const regeneratedDemand = JSON.parse(messageset['homeassistant/sensor/rfeagle_power_demand/config'])
assert.strictEqual(regeneratedDemand.state_topic, 'garage/eagle/meter/demand')

console.log('ha discovery tests passed')
