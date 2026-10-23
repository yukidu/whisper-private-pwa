const DB_NAME = 'whisper-private-v1';
const STORE = 'models';
function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('此瀏覽器不支援本機模型儲存'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact(mode, callback) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = callback(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export const readModel = key => transact('readonly', os => os.get(key));
export const saveModel = (key, data) => transact('readwrite', os => os.put(data, key));
export const removeModel = key => transact('readwrite', os => os.delete(key));
/** File bytes stay in the browser. Only AI models are fetched from outside. */
export async function downloadModel(model, signal, progress) {
  const cached = await readModel(model.id);
  if (cached) { progress?.(100); return new Uint8Array(cached); }
  const response = await fetch(model.url, { signal, credentials: 'omit', mode: 'cors' });
  if (!response.ok || !response.body) throw new Error('模型下載失敗，請稍後再試，或自行匯入模型檔');
  const total = Number(response.headers.get('content-length')) || model.sizeMB * 1024 * 1024;
  const reader = response.body.getReader();
  const pieces = [];
  let received = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      pieces.push(value); received += value.byteLength;
      if (received > 500 * 1024 * 1024) throw new Error('模型檔案異常過大');
      progress?.(Math.min(99, Math.round(received / total * 100)));
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(received);
  let at = 0;
  for (const p of pieces) { bytes.set(p, at); at += p.length; }
  if (bytes.byteLength < 1024 * 1024) throw new Error('模型檔案內容異常');
  try { await saveModel(model.id, bytes.buffer); }
  catch { /* Storage quota exhaustion does not discard downloaded model. */ }
  progress?.(100);
  return bytes;
}
