/** @typedef {{start:number,end:number,text:string}} Segment */
export function timestamp(seconds, separator = ',') {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid timestamp');
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(milli).padStart(3, '0')}`;
}
export function toTXT(segments) {
  return segments.map(s => s.text.trim()).filter(Boolean).join('\n');
}
export function toSRT(segments) {
  return segments.filter(s => s.text.trim()).map((s, i) =>
    `${i + 1}\n${timestamp(s.start)} --> ${timestamp(Math.max(s.start + .01, s.end))}\n${s.text.trim()}\n`
  ).join('\n');
}
export function toVTT(segments) {
  return 'WEBVTT\n\n' + segments.filter(s => s.text.trim()).map(s =>
    `${timestamp(s.start, '.')} --> ${timestamp(Math.max(s.start + .01, s.end), '.')}\n${s.text.trim()}\n`
  ).join('\n');
}
export function normalizedSegments(segments) {
  return segments.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && typeof s.text === 'string')
    .map(s => ({ start: Math.max(0, s.start), end: Math.max(s.start, s.end), text: s.text.trim() }))
    .sort((a, b) => a.start - b.start);
}
export function createWindows(duration, sliceSeconds = 26, overlapSeconds = 1) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (sliceSeconds <= 0 || overlapSeconds < 0) throw new RangeError('Invalid window');
  const windows = [];
  for (let logicalStart = 0; logicalStart < duration; logicalStart += sliceSeconds) {
    const logicalEnd = Math.min(logicalStart + sliceSeconds, duration);
    windows.push({
      logicalStart, logicalEnd,
      audioStart: Math.max(0, logicalStart - overlapSeconds),
      audioEnd: Math.min(duration, logicalEnd + overlapSeconds)
    });
  }
  return windows;
}
export function mergeWindowSegments(w, segments) {
  return normalizedSegments(segments).map(s => ({
    start: Math.min(w.audioEnd, Math.max(w.audioStart, s.start + w.audioStart)),
    end: Math.min(w.audioEnd, Math.max(w.audioStart, s.end + w.audioStart)),
    text: s.text
  })).filter(s => s.text && s.end > s.start).filter(s => {
    const midpoint = (s.start + s.end) / 2;
    return midpoint >= w.logicalStart && (midpoint < w.logicalEnd || Math.abs(midpoint - w.logicalEnd) < 1e-6 && w.logicalEnd === w.audioEnd);
  });
}
