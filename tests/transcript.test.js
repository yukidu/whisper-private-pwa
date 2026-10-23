import test from 'node:test';
import assert from 'node:assert/strict';
import { timestamp, toTXT, toSRT, toVTT, createWindows, mergeWindowSegments } from '../src/transcript.js';
test('timestamps support hours and milliseconds', () => {
  assert.equal(timestamp(3661.234), '01:01:01,234');
  assert.equal(timestamp(1.005,'.'), '00:00:01.005');
  assert.throws(() => timestamp(-1), RangeError);
});
test('subtitles honor edits and export compatible syntax', () => {
  const segments = [{start:0,end:1.2,text:' 你好 '},{start:2,end:3,text:' 世界 '}];
  assert.equal(toTXT(segments), '你好\n世界');
  assert.match(toSRT(segments), /1\n00:00:00,000 --> 00:00:01,200\n你好/);
  assert.match(toVTT(segments), /^WEBVTT\n\n00:00:00\.000 --> 00:00:01\.200/);
});
test('long files are divided and cover the whole duration', () => {
  const windows = createWindows(301); assert.equal(windows.length, 12);
  assert.equal(windows[0].audioStart, 0);
  assert.equal(windows.at(-1).logicalEnd, 301);
  for (let i=1;i<windows.length;i++) {
    assert.equal(windows[i].logicalStart, windows[i-1].logicalEnd);
    assert.ok(windows[i].audioStart < windows[i].logicalStart);
  }
});
test('overlap chooses one owning window by segment midpoint', () => {
  const w1 = {logicalStart:0,logicalEnd:26,audioStart:0,audioEnd:27};
  const w2 = {logicalStart:26,logicalEnd:52,audioStart:25,audioEnd:53};
  const a = mergeWindowSegments(w1,[{start:25.5,end:26.7,text:'一句'}]);
  const b = mergeWindowSegments(w2,[{start:.5,end:1.7,text:'一句'}]);
  assert.equal(a.length, 0); assert.equal(b.length, 1);
  assert.ok(Math.abs(b[0].start - 25.5) < .001);
});
