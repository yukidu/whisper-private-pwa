import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SECONDS, SAMPLE_RATE, windowSamples } from '../src/audio.js';
import { createWindows } from '../src/transcript.js';
test('engine always receives <=30sec 16kHz audio windows', () => {
  const seconds = 141.234;
  const pcm = new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
  for (const w of createWindows(seconds)) {
    const clip = windowSamples(pcm, w);
    assert.ok(clip.length <= 30 * SAMPLE_RATE);
  }
  assert.equal(MAX_SECONDS, 3600);
});
