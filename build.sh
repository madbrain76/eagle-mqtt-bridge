#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-eagle-mqtt}"
SOURCE_LABEL="io.eagle-mqtt.source-hash"

cd "${REPO_DIR}"

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
