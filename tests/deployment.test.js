import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('distribution requires a real locally compiled Whisper WebAssembly runtime', () => {
  const assemble = read('scripts/assemble.sh');
  assert.match(assemble, /dist\/runtime\/libmain\.wasm/);
  assert.match(assemble, /dist\/runtime\/libmain\.js/);
  assert.match(assemble, /No built whisper\.cpp runtime/);
});
test('browser isolation headers and self-hosted worker policy are specified', () => {
  const headers = read('_headers');
  assert.match(headers, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(headers, /Cross-Origin-Embedder-Policy: require-corp/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /microphone=\(self\)/);
});
test('model fetch is restricted to model downloads and no audio uploading API exists', () => {
  const model = read('src/model-cache.js');
  const audio = read('src/audio.js');
  const main = read('src/main.js');
  assert.match(model, /fetch\(model\.url/);
  assert.match(model, /credentials: 'omit'/);
  assert.doesNotMatch(audio + main, /\b(fetch\(|XMLHttpRequest\(|sendBeacon\()/);
});
test('CI is pinned to one upstream release and does not auto-deploy before actual speech checks', () => {
  const build = read('scripts/build-wasm.sh');
  const workflow = read('.github/workflows/build.yml');
  assert.match(build, /UPSTREAM_TAG='v1\.9\.5'/);
  assert.match(build, /git clone --depth 1 --branch/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /upload-artifact@v4/);
  assert.doesNotMatch(workflow, /wrangler.*deploy|cloudflare\/pages-action/);
});
