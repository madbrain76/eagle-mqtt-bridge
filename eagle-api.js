const EventEmitter = require('events')
const http = require('http')
const https = require('https')
const logger = require('./logger.js')

const DEFAULT_POLL_INTERVAL_MS = 15000
const DEFAULT_PATH = '/cgi-bin/post_manager'

class EagleApiClient extends EventEmitter {
  constructor(host, username, password, options = {}) {
    super()

    this.endpoint = normalizeEndpoint(host)
    this.username = username
    this.password = password
    this.pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS
    this.meterMacId = null
    this.pollTimer = null
    this.stopped = false
  }

  start() {
    this.stopped = false
    this.poll()
  }

  stop() {
    this.stopped = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  async poll() {
    try {
      await this.pollOnce()
    } catch (err) {
      logger.error('Eagle API poll failed: ' + err.message)
      this.emit('error', err)
    } finally {
      if (!this.stopped) {
        this.pollTimer = setTimeout(() => this.poll(), this.pollIntervalMs)
      }
    }
  }

  async pollOnce() {
    if (!this.meterMacId) {
      const device = await this.fetchMeterDevice()
      this.meterMacId = device.HardwareAddress || device.DeviceMacId
      logger.info('Using Eagle meter device ' + this.meterMacId)
    }

    const response = await this.sendCommand(buildDeviceQueryCommand(this.meterMacId))
    const device = extractDevice(response)
    this.emit('poll')
    const message = mapDeviceQueryToMessage(device)

    if (Object.keys(message).length > 0) {
      logger.debug(message)
      this.emit('message', message)
    } else {
      logger.debug('Eagle API returned no publishable values')
    }
  }

  async fetchMeterDevice() {
    const response = await this.sendCommand('<Command><Name>device_list</Name></Command>')
    const devices = toArray(response.DeviceList && response.DeviceList.Device)
    const meter = devices.find((device) => isElectricMeter(device))

    if (!meter) {
      throw new Error('No electric meter found in Eagle device_list response')
    }

    return meter
  }

  async sendCommand(commandXml) {
    logger.debug('Sending Eagle API command: ' + commandXml)

    const requestOptions = {
      protocol: this.endpoint.protocol,
      hostname: this.endpoint.hostname,
      port: this.endpoint.port,
      path: this.endpoint.pathname + this.endpoint.search,
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(commandXml),
      },
    }

    const transport = this.endpoint.protocol === 'https:' ? https : http
    const body = await new Promise((resolve, reject) => {
      const req = transport.request(requestOptions, (res) => {
        let data = ''

        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('HTTP ' + res.statusCode + ' from Eagle API: ' + data.trim()))
            return
          }
          resolve(data)
        })
      })

      req.on('error', reject)
      req.write(commandXml)
      req.end()
    })

    logger.debug('Received Eagle API response: ' + body)
    const parsed = parseXml(body)
    const response = extractResponseEnvelope(parsed, body)

    const commandStatus = response.Command && response.Command.Status
    if (commandStatus && commandStatus !== '0') {
      throw new Error('Eagle API command failed with status ' + commandStatus)
    }

    return response
  }
}

function parseXml(xml) {
  const tokens = String(xml).match(/<[^>]+>|[^<]+/g) || []
  const stack = []
  let root = null

  for (const token of tokens) {
    if (token.startsWith('<?') || token.startsWith('<!')) {
      continue
    }

    if (token.startsWith('</')) {
      const node = stack.pop()
      if (!node) {
        continue
      }

      const value = collapseNode(node)
      if (stack.length === 0) {
        root = { [node.name]: value }
      } else {
        addChild(stack[stack.length - 1], node.name, value)
      }
      continue
    }

    if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>')
      const tagName = token.slice(1, selfClosing ? -2 : -1).trim().split(/\s+/)[0]
      const node = { name: tagName, children: {}, text: '' }

      if (selfClosing) {
        const value = collapseNode(node)
        if (stack.length === 0) {
          root = { [node.name]: value }
        } else {
          addChild(stack[stack.length - 1], node.name, value)
        }
      } else {
        stack.push(node)
      }
      continue
    }

    const text = token.trim()
    if (text && stack.length > 0) {
      stack[stack.length - 1].text += text
    }
  }

  return root
}

function extractResponseEnvelope(parsed, body) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Eagle API response: empty or unparsable body')
  }

  if (parsed.Response) {
    return parsed.Response
  }

  const rootName = Object.keys(parsed)[0]
  if (rootName && DIRECT_RESPONSE_ROOTS.has(rootName)) {
    return { [rootName]: parsed[rootName] }
  }

  throw new Error(
    'Invalid Eagle API response: unexpected root element '
    + (rootName || '<none>')
    + ' body='
    + summarizeBody(body)
  )
}

function summarizeBody(body) {
  return JSON.stringify(String(body).replace(/\s+/g, ' ').trim().slice(0, 160))
}

function addChild(node, key, value) {
  if (Object.prototype.hasOwnProperty.call(node.children, key)) {
    if (!Array.isArray(node.children[key])) {
      node.children[key] = [node.children[key]]
    }
    node.children[key].push(value)
    return
  }

  node.children[key] = value
}

function collapseNode(node) {
  const childKeys = Object.keys(node.children)
  if (childKeys.length === 0) {
    return node.text
  }

  return node.children
}

function normalizeEndpoint(host) {
  const rawHost = host && host.trim()
  const endpoint = rawHost && rawHost.includes('://') ? rawHost : 'http://' + rawHost
  const url = new URL(endpoint)

  if (!url.pathname || url.pathname === '/') {
    url.pathname = DEFAULT_PATH
  }

  return url
}

function buildDeviceQueryCommand(meterMacId) {
  return [
    '<Command>',
    '<Name>device_query</Name>',
    '<DeviceDetails>',
    '<HardwareAddress>' + meterMacId + '</HardwareAddress>',
    '</DeviceDetails>',
    '<Components>',
    '<All>Y</All>',
    '</Components>',
    '</Command>',
  ].join('')
}

function isElectricMeter(device) {
  if (!device) {
    return false
  }

  const modelId = String(device.ModelId || '').trim().toLowerCase()
  return modelId === 'electric_meter'
}

function extractDevice(response) {
  if (response && response.Device) {
    return response.Device
  }

  if (response && response.DeviceQuery && response.DeviceQuery.Device) {
    return response.DeviceQuery.Device
  }

  throw new Error('DeviceQuery response missing Device payload')
}

function mapDeviceQueryToMessage(device) {
  const message = {}
  const variables = flattenVariables(device)
  const details = device && device.DeviceDetails ? device.DeviceDetails : device
  const connectionStatus = getValue(details, 'ConnectionStatus') || getValue(details, 'Status')

  setNumeric(message, 'meter/demand', parseDemandWatts(getValue(variables, 'zigbee:InstantaneousDemand')))
  setNumeric(message, 'meter/imported', parseSummationValue(getValue(variables, 'zigbee:CurrentSummationDelivered')))
  setNumeric(message, 'meter/exported', parseSummationValue(getValue(variables, 'zigbee:CurrentSummationReceived')))
  setNumeric(message, 'pricing/price', parseCurrencyValue(getValue(variables, 'zigbee:Price')))

  const tier = getValue(variables, 'zigbee:Tier')
    || getValue(variables, 'zigbee:RateLabel')
    || getValue(variables, 'zigbee:PriceTier')
    || getValue(variables, 'zigbee:PriceRateLabel')
  if (tier) {
    message['pricing/tier'] = tier
  }

  if (connectionStatus) {
    message['zigbee/status'] = connectionStatus
  }

  return message
}

function flattenVariables(device) {
  const components = toArray(device.Components && device.Components.Component)
  const variables = {}

  for (const component of components) {
    for (const variable of toArray(component.Variables && component.Variables.Variable)) {
      if (!variable || !variable.Name) {
        continue
      }
      variables[variable.Name] = normalizeVariableValue(variable)
    }
  }

  return variables
}

function normalizeVariableValue(variable) {
  const value = variable.Value
  const units = String(variable.Units || '').trim()

  if (value === undefined || value === null || value === '') {
    return ''
  }

  if (!units) {
    return value
  }

  return String(value).trim() + ' ' + units
}

function parseDemandWatts(value) {
  const measurement = parseMeasurement(value)
  if (!measurement) {
    return null
  }

  if (measurement.unit === 'mw') {
    return Math.trunc(measurement.value * 1000000)
  }
  if (measurement.unit === 'kw') {
    return Math.trunc(measurement.value * 1000)
  }

  return Math.trunc(measurement.value)
}

function parseSummationValue(value) {
  const measurement = parseMeasurement(value)
  if (!measurement) {
    return null
  }

  if (measurement.unit === 'mwh') {
    return measurement.value * 1000
  }
  if (measurement.unit === 'kwh') {
    return measurement.value
  }
  if (measurement.unit === 'wh') {
    return measurement.value / 1000
  }

  return measurement.value
}

function parseCurrencyValue(value) {
  const measurement = parseMeasurement(value)
  return measurement ? measurement.value : null
}

function parseMeasurement(value) {
  if (!value) {
    return null
  }

  const match = String(value).trim().match(/(-?\d+(?:\.\d+)?)(?:\s*([A-Za-z$/]+))?/)
  if (!match) {
    return null
  }

  return {
    value: Number.parseFloat(match[1]),
    unit: (match[2] || '').toLowerCase(),
  }
}

function getValue(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null
}

function setNumeric(message, topic, value) {
  if (Number.isFinite(value)) {
    message[topic] = value
  }
}

function toArray(value) {
  if (value === undefined || value === null) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

const DIRECT_RESPONSE_ROOTS = new Set(['DeviceList', 'DeviceQuery', 'Device', 'Command'])

module.exports = EagleApiClient
module.exports.extractResponseEnvelope = extractResponseEnvelope
module.exports.extractDevice = extractDevice
module.exports.mapDeviceQueryToMessage = mapDeviceQueryToMessage
module.exports.parseDemandWatts = parseDemandWatts
module.exports.parseSummationValue = parseSummationValue
module.exports.parseCurrencyValue = parseCurrencyValue
module.exports.parseXml = parseXml
module.exports.isElectricMeter = isElectricMeter
module.exports.normalizeEndpoint = normalizeEndpoint
