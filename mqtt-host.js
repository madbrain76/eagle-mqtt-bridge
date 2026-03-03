const ipv4Regex = new RegExp('^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$')
const hostnameRegex = new RegExp('^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$')

function isValidMqttHost(host) {
  return Boolean(host && (ipv4Regex.test(host) || hostnameRegex.test(host)))
}

module.exports = {
  isValidMqttHost,
}
