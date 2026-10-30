#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec _toolchain/portable-node-macos-arm64/node --test app/test/*.test.mjs
