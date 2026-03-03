# Rainforest Eagle to MQTT bridge
This application supports the Rainforest Eagle 3 by connecting to its local API, polling meter values, and publishing that data through MQTT. That makes the meter data available both to Home Assistant and to other MQTT consumers, such as OpenEVSE. It is tested with Eagle 3 and should support Eagle-200 as well.  

[Home Assistant](https://www.home-assistant.io) users get MQTT discovery by default, so the Eagle sensors are created automatically.

## Purpose

Rainforest Eagle devices expose useful utility meter data locally, but many other systems work better with MQTT than with the Eagle local API directly. This project bridges that gap by polling the Eagle and republishing the relevant values as stable MQTT topics that can be consumed by Home Assistant and other external systems.

## How it works

The bridge uses the Eagle local API directly:

1. `device_list` discovers the electric meter on the Eagle.
2. `device_query` polls the meter through the Eagle local API.
3. Selected values are published to MQTT under `MQTT_TOPIC`.

There is no listener mode and no configuration on the Eagle to push data to this bridge.
The examples use plain HTTP for the Eagle local API because TLS is effectively unusable by default on the Eagle due to its self-signed certificate.

## Running the bridge

### Docker helper script

The repo includes `./build-and-run.sh`, which rebuilds the image when local source files change and then starts the container.

Example:

```bash
MQTT_HOST=homeassistant.local \
EAGLE_HOST=eagle-00abcd.local \
EAGLE_USER=username \
EAGLE_PASS=password \
MQTT_USER=username \
MQTT_PASS=password \
PUBLISH_HOME_ASSISTANT_MQTT=true \
./build-and-run.sh
```

### Plain Docker

```bash
docker run --name eagle-mqtt \
  -e MQTT_HOST=homeassistant.local \
  -e EAGLE_HOST=eagle-00abcd.local \
  -e EAGLE_USER=username \
  -e EAGLE_PASS=password \
  -e MQTT_USER=username \
  -e MQTT_PASS=password \
  -e PUBLISH_HOME_ASSISTANT_MQTT=true \
  eagle-mqtt
```

## Environment variables

Application settings:

* **MQTT_HOST=homeassistant.local - REQUIRED - Hostname or IP address of your MQTT broker.**
* **EAGLE_HOST=eagle-00abcd.local - REQUIRED - Hostname, IP address, or full URL for the local Eagle API.**
* **EAGLE_USER=username - REQUIRED - Eagle local API username.**
* **EAGLE_PASS=password - REQUIRED - Eagle local API password.**
* `MQTT_TOPIC=eagle` - Base MQTT topic for published messages.
* `MQTT_USER=username` - MQTT username if authentication is required.
* `MQTT_PASS=password` - MQTT password if authentication is required.
* `LOG_LEVEL=info` - Log level. Supported values: `error`, `warn`, `info`, `debug`.
* `PUBLISH_HOME_ASSISTANT_MQTT=true` - Set to `false` to disable publishing Home Assistant MQTT discovery topics.
* `EAGLE_POLL_INTERVAL_MS=15000` - Poll interval for the Eagle local API in milliseconds.
* `AVAILABILITY_TIMEOUT_MS=300000` - Time without a successful poll before publishing `offline`.
* `EAGLE_FAILURES_BEFORE_OFFLINE=20` - Consecutive poll failures required before the bridge will publish `offline`.

Sample setup:

* `MQTT_HOST=homeassistant.local` assumes the Mosquitto broker add-on is running on the same Home Assistant host.

## MQTT topics

Availability:

* `MQTT_TOPIC/availability` - Eagle availability (`online` / `offline`)
* `MQTT_TOPIC/bridge/status` - Bridge process availability (`online` / `offline`, retained)

Published meter values:

* `Power Demand` in watts: `MQTT_TOPIC/meter/demand`
* `Energy Imported from Grid` in kWh: `MQTT_TOPIC/meter/imported`
* `Energy Exported to Grid` in kWh: `MQTT_TOPIC/meter/exported`

Home Assistant discovery currently publishes only these three Eagle sensors:

* `Power Demand`: `homeassistant/sensor/rfeagle_power_demand/config`
* `Energy Imported from Grid`: `homeassistant/sensor/rfeagle_energy_imported_from_grid/config`
* `Energy Exported to Grid`: `homeassistant/sensor/rfeagle_energy_exported_to_grid/config`
