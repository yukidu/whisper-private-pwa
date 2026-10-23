#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
UPSTREAM_REPO='https://github.com/ggml-org/whisper.cpp.git'
UPSTREAM_TAG='v1.9.5'
SOURCE='.vendor-source/whisper.cpp'
command -v git >/dev/null || { echo '缺少 git'; exit 1; }
command -v emcmake >/dev/null || { echo '需要 Emscripten SDK（emcmake）'; exit 1; }
command -v cmake >/dev/null || { echo '缺少 cmake'; exit 1; }
mkdir -p .vendor-source public/runtime
if [[ ! -d "$SOURCE/.git" ]]; then
  git clone --depth 1 --branch "$UPSTREAM_TAG" "$UPSTREAM_REPO" "$SOURCE"
fi
if [[ "$(git -C "$SOURCE" describe --tags --exact-match HEAD)" != "$UPSTREAM_TAG" ]]; then
  echo "原始碼不是 $UPSTREAM_TAG，拒絕編譯" >&2; exit 1
fi
printf 'Upstream: %s\n' "$(git -C "$SOURCE" rev-parse HEAD)" | tee public/runtime/upstream-version.txt
cp vendor/emscripten.cpp "$SOURCE/examples/whisper.wasm/emscripten.cpp"
emcmake cmake -S "$SOURCE" -B "$SOURCE/build-em" \
  -DCMAKE_BUILD_TYPE=Release \
  -DWHISPER_WASM_SINGLE_FILE=OFF \
  -DGGML_NATIVE=OFF \
  -DWHISPER_BUILD_TESTS=OFF
cmake --build "$SOURCE/build-em" --target libmain --parallel 2
for file in libmain.js libmain.wasm; do
  test -s "$SOURCE/build-em/bin/$file" || { echo "missing $file"; exit 1; }
  cp "$SOURCE/build-em/bin/$file" public/runtime/
done
for file in libmain.worker.js libmain.wasm.map; do
  if [[ -s "$SOURCE/build-em/bin/$file" ]]; then cp "$SOURCE/build-em/bin/$file" public/runtime/; fi
done
printf 'Created self-hosted assets:\n'; ls -lh public/runtime/libmain.*
