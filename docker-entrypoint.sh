#!/bin/sh
set -eu
mkdir -p /app/data
if [ ! -f /app/data/facilities.json ]; then
  cp /opt/played/facilities.json /app/data/facilities.json
fi
exec "$@"
