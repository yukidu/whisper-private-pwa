#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp index.html app.css sw.js manifest.webmanifest _headers LICENSE dist/
VERSION="${GITHUB_SHA:-local-$(date -u +%Y%m%d%H%M%S)}"
sed -i "s/__APP_VERSION__/${VERSION}/g" dist/sw.js
cp -R src dist/
cp -R public/icons dist/
mkdir -p dist/runtime
for file in public/runtime/*; do
  [[ -f "$file" && "$file" != *README.md ]] && cp "$file" dist/runtime/ || true
done
if [[ ! -s dist/runtime/libmain.js || ! -s dist/runtime/libmain.wasm ]]; then
  echo 'ERROR: No built whisper.cpp runtime; dist is NOT production-ready.' >&2
  rm -rf dist
  exit 1
fi
echo "Static PWA assembled in dist/"
