const mqtt = require('mqtt')
const logger = require('./logger.js')
const hadiscovery = require('./hadiscovery.js')

const DEPRECATED_RETAINED_TOPICS = [
  'bridge/status',
  'zigbee/status',
]

class MqttClient {
  constructor(host, username, password, topic_base, discovery) {
    this.client = null
    this.discovery = discovery
    this.topic_base = topic_base
    this.host = 'mqtt://' + host
    if (username && password) {
      this.username = username
      this.password = password
    } else {
      logger.warn('Missing or incomplete credentials provided for MQTT connection.')
      logger.warn('Will attempt unauthenticated connection.')
    }
  }

  connect() {
    var connectOptions = {}
    if (this.username && this.password) {
      connectOptions.username = this.username
      connectOptions.password = this.password
    }

    logger.info("Connecting to " + this.host)
    this.client = mqtt.connect(this.host, connectOptions)

    this.client.on('error', (err) => {
      logger.error('MQTT Error: ' + err.message)
    })

    this.client.on('connect', () => {
      logger.info('MQTT client connected')
      logger.info('Publishing to topic base: ' + this.topic_base)
      for (const topic of DEPRECATED_RETAINED_TOPICS) {
        this.client.publish(this.topic_base + '/' + topic, '', {retain: true})
      }
      if (this.discovery) {
        logger.info('Publishing HA Discovery messages')
        hadiscovery.buildDiscovery(this.topic_base)
        for (var key in hadiscovery.messageset) {
          this.client.publish(key, hadiscovery.messageset[key], {retain: true})
        }
      }
    })

    this.client.on('close', () => {
      logger.info('MQTT client connection closed')
    })
  }

  sendMessage(topic, message, flag=false) {
      const fullTopic = this.topic_base + '/' + topic
      const payload = message.toString()
      logger.debug('Publishing MQTT message to ' + fullTopic + ': ' + payload)
      this.client.publish(fullTopic, payload, {retain: flag})
  }

}

module.exports = MqttClient
