#!/bin/zsh

set -eu

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "$0")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIRECTORY}/../.." && pwd)"
APPLICATION_URL="http://127.0.0.1:4174/"

cd "${REPOSITORY_ROOT}"

if curl --fail --silent --max-time 2 "${APPLICATION_URL}api/state" >/dev/null 2>&1; then
  echo "HMS Lab Tilt ECG is already running."
  echo "Opening ${APPLICATION_URL}"
  open "${APPLICATION_URL}"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 22.13 or later, then double-click this launcher again."
  echo
  read -r "?Press Return to close."
  exit 1
fi

echo "Starting HMS Lab Tilt ECG..."
echo "Application: ${APPLICATION_URL}"
echo
echo "Keep this Terminal window open during acquisition."
echo "Closing it or pressing Control-C stops the local server."
echo

exec node projects/tilt-ecg/app/server.mjs --port 4174
