#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT=4175
URL="http://127.0.0.1:${PORT}/"

cd "$REPOSITORY_ROOT"

if curl --fail --silent --max-time 2 "${URL}api/config" >/dev/null; then
  open "$URL"
  exit 0
fi

printf 'Starting HMS Lab Tilt ECG Processing at %s\n' "$URL"
printf 'Keep this Terminal window open while reviewing recordings.\n\n'
exec node projects/tilt-ecg/processing-app/server.mjs --port "$PORT"
