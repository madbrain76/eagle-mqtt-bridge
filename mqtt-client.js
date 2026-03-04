const mqtt = require('mqtt')
const logger = require('./logger.js')

class MqttClient {
  constructor(host, username, password, topic_base) {
    this.client = null
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
