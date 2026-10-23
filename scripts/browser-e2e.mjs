import { chromium } from 'playwright';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
const [modelPath, audioPath] = process.argv.slice(2);
if (!modelPath || !audioPath) throw new Error('Usage: node scripts/browser-e2e.mjs MODEL.bin SAMPLE.wav');
assert.ok((await stat(modelPath)).size > 1024 * 1024, 'missing test model');
assert.ok((await stat(audioPath)).size > 1000, 'missing test audio');
const root = resolve('dist');
const mime = { '.js':'application/javascript', '.wasm':'application/wasm', '.css':'text/css', '.svg':'image/svg+xml', '.html':'text/html', '.webmanifest':'application/manifest+json' };
const server = createServer(async (req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!(path === root || path.startsWith(root + sep))) {res.writeHead(403).end();return;}
  try {
    const data = await readFile(path);
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff'
    }).end(data);
  } catch {res.writeHead(404).end('missing');}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  const errors = [];
  const uploads = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('request', req => {
    if (['POST','PUT','PATCH'].includes(req.method()) || (req.url().startsWith('https://') && !req.url().includes('/ggml-'))) uploads.push(`${req.method()} ${req.url()}`);
  });
  await page.goto(origin, {waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'COOP/COEP isolation failed');
  await page.locator('#custom-model').setInputFiles(modelPath);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('模型已就緒') || document.getElementById('status').textContent.includes('已載入自選模型'), {timeout:120000});
  await page.locator('#pick-audio').setInputFiles(audioPath);
  await page.locator('#language').selectOption('en');
  await page.locator('#run').click();
  await page.waitForFunction(() => /辨識完成|辨識失敗|發生錯誤/.test(document.getElementById('status').textContent), {timeout:300000});
  const message = await page.locator('#status').innerText();
  assert.ok(message.includes('辨識完成'), `Real audio transcription failed: ${message}; browser errors: ${errors.join(' | ')}`);
  const transcript = await page.locator('.segment textarea').evaluateAll(nodes => nodes.map(el => el.value).join(' '));
  console.log('TRANSCRIPT:', transcript.slice(0,500));
  assert.match(transcript, /country|Americans|fellow/i, 'Expected coherent JFK sample transcription');
  assert.deepEqual(uploads, [], 'Audio or other data was uploaded');
  assert.deepEqual(errors, [], 'Browser JS errors');
  console.log('PASS: browser WASM loaded, real audio transcribed, and no upload requests occurred.');
} finally {await browser?.close();await new Promise(resolve => server.close(resolve));}
