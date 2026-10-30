#!/bin/sh
set -eu
cd "$(dirname "$0")"
case "$(uname -m)" in
  arm64) runtime="_toolchain/portable-node-macos-arm64/node" ;;
  x86_64) runtime="_toolchain/portable-node-macos-x64/node" ;;
  *) echo 'Unsupported Mac architecture'; exit 1 ;;
esac
if [ ! -x "$runtime" ]; then
  echo "Missing portable runtime: $runtime"
  exit 1
fi
exec "$runtime" scripts/launch-app.mjs
