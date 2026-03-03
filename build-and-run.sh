#!/usr/bin/env bash

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-eagle-mqtt}"
CONTAINER_NAME="${CONTAINER_NAME:-eagle-mqtt}"
SOURCE_LABEL="io.eagle-mqtt.source-hash"
MQTT_TOPIC="${MQTT_TOPIC:-eagle}"
LOG_LEVEL="${LOG_LEVEL:-info}"
PUBLISH_HOME_ASSISTANT_MQTT="${PUBLISH_HOME_ASSISTANT_MQTT:-true}"

if [[ -z "${MQTT_HOST:-}" ]]; then
  echo "MQTT_HOST is required."
  echo "Example: MQTT_HOST=garage-eagle3-wifi.localdomain ./build-and-run.sh"
  exit 1
fi

if [[ -z "${EAGLE_HOST:-}" ]]; then
  echo "EAGLE_HOST is required."
  exit 1
fi

if [[ -z "${EAGLE_USER:-}" ]]; then
  echo "EAGLE_USER is required."
  exit 1
fi

if [[ -z "${EAGLE_PASS:-}" ]]; then
  echo "EAGLE_PASS is required."
  exit 1
fi

if [[ -n "${MQTT_USER:-}" && -z "${MQTT_PASS:-}" ]]; then
  echo "MQTT_PASS is required when MQTT_USER is set."
  exit 1
fi

if [[ -z "${MQTT_USER:-}" && -n "${MQTT_PASS:-}" ]]; then
  echo "MQTT_USER is required when MQTT_PASS is set."
  exit 1
fi

source_hash="$(
  {
    find . -maxdepth 1 -type f \( -name 'Dockerfile' -o -name '*.js' -o -name 'package.json' -o -name 'package-lock.json' \) -print0 |
      sort -z |
      xargs -0 sha256sum
  } | sha256sum | awk '{print $1}'
)"

image_hash="$(docker image inspect "$IMAGE_NAME" --format "{{ index .Config.Labels \"$SOURCE_LABEL\" }}" 2>/dev/null || true)"

if [[ "$source_hash" != "$image_hash" ]]; then
  docker build --build-arg SOURCE_HASH="$source_hash" -t "$IMAGE_NAME" .
else
  echo "Image $IMAGE_NAME is up to date; skipping rebuild."
fi

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run \
  --name "$CONTAINER_NAME" \
  -e MQTT_HOST="$MQTT_HOST" \
  -e EAGLE_HOST="$EAGLE_HOST" \
  -e EAGLE_USER="$EAGLE_USER" \
  -e EAGLE_PASS="$EAGLE_PASS" \
  -e MQTT_TOPIC="$MQTT_TOPIC" \
  -e LOG_LEVEL="$LOG_LEVEL" \
  -e PUBLISH_HOME_ASSISTANT_MQTT="$PUBLISH_HOME_ASSISTANT_MQTT" \
  ${MQTT_USER:+-e MQTT_USER="$MQTT_USER"} \
  ${MQTT_PASS:+-e MQTT_PASS="$MQTT_PASS"} \
  "$IMAGE_NAME"
