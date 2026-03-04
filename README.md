# Rainforest Eagle to MQTT bridge
This application supports the Rainforest Eagle 3 by connecting to its local API, polling meter values, and publishing that data through MQTT. That makes the meter data available to MQTT consumers such as Home Assistant and OpenEVSE. It is tested with Eagle 3 and should support Eagle-200 as well.

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

The repo includes `./build.sh`, which rebuilds the image when local source files change.

Example:

```bash
./build.sh
```

The repo also includes `./run.sh`, which calls `./build.sh` as needed and then starts the container.

Example:

```bash
MQTT_HOST=homeassistant.local \
EAGLE_HOST=eagle-00abcd.local \
EAGLE_USER=username \
EAGLE_PASS=password \
MQTT_USER=username \
MQTT_PASS=password \
./run.sh
```

### systemd user service installer

The repo also includes `./install-systemd-service.sh`, which:

* writes a per-user environment file under `~/.config/systemd/user`
* builds the Docker image with `./build.sh`
* installs a `systemd --user` unit that runs `./run.sh`
* enables automatic restart
* enables the service for your user session

Example:

```bash
MQTT_HOST=homeassistant.local \
EAGLE_HOST=eagle-00abcd.local \
EAGLE_USER=username \
EAGLE_PASS=password \
MQTT_USER=username \
MQTT_PASS=password \
./install-systemd-service.sh
```

For start-on-boot before login, your system must have user lingering enabled:

```bash
sudo loginctl enable-linger "$USER"
```

Without lingering, the service still auto-restarts, but only while your user `systemd` instance is running.

Useful commands:

```bash
systemctl --user status eagle-mqtt-bridge.service
journalctl --user -u eagle-mqtt-bridge.service -f
systemctl --user restart eagle-mqtt-bridge.service
```

To uninstall the user service:

```bash
./uninstall-systemd-service.sh
```

That uninstall script also stops and removes the `eagle-mqtt` Docker container by default.

### Plain Docker

```bash
docker run --name eagle-mqtt \
  -e MQTT_HOST=homeassistant.local \
  -e EAGLE_HOST=eagle-00abcd.local \
  -e EAGLE_USER=username \
  -e EAGLE_PASS=password \
  -e MQTT_USER=username \
  -e MQTT_PASS=password \
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
* `EAGLE_POLL_INTERVAL_MS=30000` - Poll interval for the Eagle local API in milliseconds.
* `EAGLE_RETRY_BASE_DELAY_MS=30000` - Compatibility setting. Failed polls continue at `EAGLE_POLL_INTERVAL_MS` until `EAGLE_FAILURES_BEFORE_OFFLINE` is reached.
* `EAGLE_RETRY_MAX_DELAY_MS=60000` - Delay between Eagle retry attempts after the bridge has marked the Eagle unavailable.
* `EAGLE_REQUEST_TIMEOUT_MS=10000` - Per-request timeout for Eagle API calls. Stuck requests are aborted and treated as poll failures.
* `AVAILABILITY_TIMEOUT_MS=300000` - Time without a successful poll before publishing `offline`.
* `EAGLE_FAILURES_BEFORE_OFFLINE=2` - Consecutive poll failures required before the bridge will publish `offline`.

Sample setup:

* `MQTT_HOST=homeassistant.local` assumes the Mosquitto broker add-on is running on the same Home Assistant host.

## MQTT topics

Availability:

* `MQTT_TOPIC/availability` - Eagle availability (`online` / `offline`)

Published meter values:

* `Power Demand` in watts: `MQTT_TOPIC/meter/demand`
* `Energy Imported from Grid` in kWh: `MQTT_TOPIC/meter/imported`
* `Energy Exported to Grid` in kWh: `MQTT_TOPIC/meter/exported`
