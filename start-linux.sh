#!/bin/sh
set -eu
cd "$(dirname "$0")"
runtime="_toolchain/portable-node-linux-$(uname -m)/bin/node"
if [ ! -x "$runtime" ]; then
  echo "Place a portable Linux Node 22+ distribution at $(dirname "$(dirname "$runtime")")"
  exit 1
fi
exec "$runtime" app/server.mjs
