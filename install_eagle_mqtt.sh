#!/bin/bash

set -euo pipefail

DEV_BASE_URL="${DEV_BASE_URL:-http://higgs:8000/eagle-mqtt-bridge}"
INTEGRATION_URL="${DEV_BASE_URL%/}/custom_components/rainforest_eagle"
HA_CONFIG_DIR="${HA_CONFIG_DIR:-/config}"
CUSTOM_COMPONENTS_DIR="$HA_CONFIG_DIR/custom_components"
INSTALL_DIR="$CUSTOM_COMPONENTS_DIR/rainforest_eagle"
TRANSLATIONS_DIR="$INSTALL_DIR/translations"

FILES=(
    "__init__.py"
    "config_flow.py"
    "const.py"
    "coordinator.py"
    "data.py"
    "diagnostics.py"
    "manifest.json"
    "mqtt.py"
    "sensor.py"
    "strings.json"
)

TRANSLATION_FILES=(
    "en.json"
)

if [[ ! -d "$HA_CONFIG_DIR" ]]; then
    echo "ERROR: Home Assistant config directory not found: $HA_CONFIG_DIR"
    echo "Set HA_CONFIG_DIR to your Home Assistant config path and run again."
    exit 1
fi

echo "Installing rainforest_eagle into Home Assistant..."
echo "Source: $INTEGRATION_URL"
echo "Target: $INSTALL_DIR"

if ! curl -fsSLI "$INTEGRATION_URL/manifest.json" >/dev/null; then
    echo "ERROR: Cannot reach $INTEGRATION_URL"
    echo "Set DEV_BASE_URL if your dev server root is different."
    exit 1
fi

mkdir -p "$CUSTOM_COMPONENTS_DIR"

if [[ -d "$INSTALL_DIR" ]]; then
    echo "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
fi

mkdir -p "$TRANSLATIONS_DIR"

echo "Downloading integration files..."
for file in "${FILES[@]}"; do
    curl -fsSL \
        "$INTEGRATION_URL/$file" \
        -o "$INSTALL_DIR/$file"
done

echo "Downloading translation files..."
for file in "${TRANSLATION_FILES[@]}"; do
    curl -fsSL \
        "$INTEGRATION_URL/translations/$file" \
        -o "$TRANSLATIONS_DIR/$file"
done

echo "Clearing Python cache from installed files..."
find "$INSTALL_DIR" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "$INSTALL_DIR" -type f -name "*.pyc" -delete

echo
echo "Installation complete."
echo "Integration installed to: $INSTALL_DIR"
echo
echo "Next steps:"
echo "1. Restart Home Assistant."
echo "2. Open Settings -> Devices & services -> Add Integration."
echo "3. Search for Rainforest Eagle."
echo "4. Enter the Rainforest Eagle host, cloud ID, and install code."
echo "5. Optionally enable 'Publish to MQTT' and choose the MQTT topic base."
echo "6. If 'Publish to MQTT' is enabled, make sure the Home Assistant MQTT integration is already configured."

if command -v ha >/dev/null 2>&1; then
    echo
    echo "Restarting Home Assistant Core..."
    ha core restart
    echo "Restart command sent: ha core restart"
else
    echo
    echo "'ha' CLI not found. Restart Home Assistant manually."
fi
