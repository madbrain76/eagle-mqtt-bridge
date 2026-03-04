#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_SCRIPT="${REPO_DIR}/build.sh"
IMAGE_NAME="${IMAGE_NAME:-eagle-mqtt}"
CONTAINER_NAME="${CONTAINER_NAME:-eagle-mqtt}"
MQTT_TOPIC="${MQTT_TOPIC:-eagle}"
LOG_LEVEL="${LOG_LEVEL:-info}"

if [[ ! -x "${BUILD_SCRIPT}" ]]; then
  echo "Expected executable build script at ${BUILD_SCRIPT}"
  exit 1
fi

if [[ -z "${MQTT_HOST:-}" ]]; then
  echo "MQTT_HOST is required."
  echo "Example: MQTT_HOST=garage-eagle3-wifi.localdomain ./run.sh"
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

"${BUILD_SCRIPT}"

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
  ${EAGLE_POLL_INTERVAL_MS:+-e EAGLE_POLL_INTERVAL_MS="$EAGLE_POLL_INTERVAL_MS"} \
  ${AVAILABILITY_TIMEOUT_MS:+-e AVAILABILITY_TIMEOUT_MS="$AVAILABILITY_TIMEOUT_MS"} \
  ${EAGLE_FAILURES_BEFORE_OFFLINE:+-e EAGLE_FAILURES_BEFORE_OFFLINE="$EAGLE_FAILURES_BEFORE_OFFLINE"} \
  ${MQTT_USER:+-e MQTT_USER="$MQTT_USER"} \
  ${MQTT_PASS:+-e MQTT_PASS="$MQTT_PASS"} \
  "$IMAGE_NAME"
