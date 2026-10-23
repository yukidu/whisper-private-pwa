import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, getModel } from '../src/models.js';
test('models are multilingual, quantized and downloaded only from pinned provider', () => {
  assert.equal(MODELS.length, 3);
  for (const m of MODELS) {
    assert.match(m.file, /^ggml-(tiny|base|small)-q5_1\.bin$/);
    assert.equal(new URL(m.url).hostname, 'huggingface.co');
  }
  assert.equal(getModel('unknown'), MODELS[1]);
});
