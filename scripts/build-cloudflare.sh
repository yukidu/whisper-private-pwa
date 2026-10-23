#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Pin the compiler to the same Emscripten release used by GitHub CI.
EMSDK_VERSION=3.1.74
if ! command -v emcmake >/dev/null 2>&1; then
  mkdir -p .build-tools
  if [[ ! -d .build-tools/emsdk/.git ]]; then
    git clone --depth 1 https://github.com/emscripten-core/emsdk.git .build-tools/emsdk
  fi
  .build-tools/emsdk/emsdk install "$EMSDK_VERSION"
  .build-tools/emsdk/emsdk activate "$EMSDK_VERSION"
  source .build-tools/emsdk/emsdk_env.sh
fi
npm run check
bash scripts/build-wasm.sh
bash scripts/assemble.sh
