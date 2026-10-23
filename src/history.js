const KEY = 'whisper-private-transcripts-v1';
const MAX_RECORDS = 25;
export function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter(x => x && Array.isArray(x.segments)) : [];
  } catch { return []; }
}
export function saveHistory(item) {
  try {
    const next = [item, ...readHistory().filter(x => x.id !== item.id)].slice(0, MAX_RECORDS);
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}
export function clearHistory() { localStorage.removeItem(KEY); }
