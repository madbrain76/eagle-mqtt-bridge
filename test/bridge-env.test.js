const assert = require('assert')

function parsePositiveInt(rawValue, defaultValue) {
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

assert.strictEqual(parsePositiveInt('15000', 1), 15000)
assert.strictEqual(parsePositiveInt('120000', 1), 120000)
assert.strictEqual(parsePositiveInt(undefined, 42), 42)
assert.strictEqual(parsePositiveInt('', 42), 42)
assert.strictEqual(parsePositiveInt('0', 42), 42)
assert.strictEqual(parsePositiveInt('-1', 42), 42)
assert.strictEqual(parsePositiveInt('abc', 42), 42)

console.log('bridge env tests passed')
