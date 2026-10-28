#!/bin/sh
set -eu
mkdir -p /app/data
# A mounted volume hides the image's data/ seed files. Copy each missing JSON
# from the bake path so Book/Call and the facility seed still work on first boot.
for name in facilities.json reach.json reach-trouble.json rankings.json; do
  if [ ! -f "/app/data/$name" ] && [ -f "/opt/played/$name" ]; then
    cp "/opt/played/$name" "/app/data/$name"
  fi
done
exec "$@"
