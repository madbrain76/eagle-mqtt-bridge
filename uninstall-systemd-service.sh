#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-eagle-mqtt-bridge}"
CONTAINER_NAME="${CONTAINER_NAME:-eagle-mqtt}"
USER_SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="${USER_SYSTEMD_DIR}/${SERVICE_NAME}.service"
ENV_FILE="${USER_SYSTEMD_DIR}/${SERVICE_NAME}.env"

if systemctl --user list-unit-files "${SERVICE_NAME}.service" --no-legend 2>/dev/null | grep -Fq "${SERVICE_NAME}.service"; then
  systemctl --user disable --now "${SERVICE_NAME}.service"
else
  echo "Service ${SERVICE_NAME}.service is not installed in user systemd."
fi

rm -f "${SERVICE_FILE}" "${ENV_FILE}"

systemctl --user daemon-reload

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  docker rm -f "${CONTAINER_NAME}"
  echo "Removed Docker container: ${CONTAINER_NAME}"
else
  echo "Docker container ${CONTAINER_NAME} was not present."
fi

echo "Removed ${SERVICE_NAME}.service"
echo "Removed environment file: ${ENV_FILE}"
