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
# Cloudflare Pages build image may omit CMake; install a pinned official binary.
if ! command -v cmake >/dev/null 2>&1; then
  CMAKE_VERSION=3.31.12
  mkdir -p .build-tools/cmake
  curl -fLSs --retry 3 \
    "https://github.com/Kitware/CMake/releases/download/v${CMAKE_VERSION}/cmake-${CMAKE_VERSION}-linux-x86_64.tar.gz" \
    -o .build-tools/cmake.tar.gz
  tar -xzf .build-tools/cmake.tar.gz -C .build-tools/cmake --strip-components=1
  export PATH="$PWD/.build-tools/cmake/bin:$PATH"
fi
cmake --version
npm run check
bash scripts/build-wasm.sh
bash scripts/assemble.sh
