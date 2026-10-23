import test from 'node:test';
import assert from 'node:assert/strict';
import { WhisperEngine } from '../src/engine.js';
const makeEngine = () => {
  const engine = new WhisperEngine();
  const jobs = [];
  let cancelCount = 0;
  engine.instance = 1;
  engine.module = {
    full_default(index, audio, language, threads, translate) {
      jobs.push({ index, size: audio.length, language, threads, translate });
      return 0;
    },
    poll_state() { return 2; },
    get_segments() { return [{ start: 3, end: 5, text: ' hello ' }]; },
    cancel_transcription() { cancelCount++; }
  };
  return {engine, jobs, cancelled: () => cancelCount};
};
test('browser bridge sends every chunk to the local engine and offsets segment timestamps', async () => {
  const { engine, jobs } = makeEngine();
  const progress = [];
  const result = await engine.transcribe(new Float32Array(55 * 16000), {
    language: 'zh', onProgress: (a,b) => progress.push([a,b])
  });
  assert.equal(result.cancelled, false);
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every(j => j.size <= 30 * 16000 && j.language === 'zh'));
  assert.equal(progress.at(-1)[0], progress.at(-1)[1]);
  assert.ok(result.segments.length >= 1);
  assert.ok(result.segments.every(s => s.start >= 0 && s.end <= 55));
});
test('browser bridge rejects concurrent recognition', async () => {
  const { engine } = makeEngine();
  engine.active = true;
  await assert.rejects(() => engine.transcribe(new Float32Array(16000)), /辨識已在進行中/);
});
test('stop signals native abort immediately', () => {
  const { engine, cancelled } = makeEngine();
  engine.stop();
  assert.equal(engine.cancelRequested, true);
  assert.equal(cancelled(), 1);
});
test('rejects truncated or non-ggml-size model without invoking native code', async () => {
  const { engine } = makeEngine();
  await assert.rejects(() => engine.loadModel('broken', new Uint8Array(100)), /完整/);
});
