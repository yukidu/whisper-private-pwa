export const SAMPLE_RATE = 16000;
export const MAX_SECONDS = 60 * 60;
export const MAX_FILE_BYTES = 600 * 1024 * 1024;

/** Decoder availability varies by browser. Decoding never uploads the input. */
export async function decodeAudio(file, onProgress = () => {}) {
  if (!file || !file.size) throw new Error('請先選擇音檔');
  if (file.size > MAX_FILE_BYTES) throw new Error('檔案超過 600 MB；手機瀏覽器不適合一次處理這麼大的檔案');
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    onProgress('正在讀取音檔…');
    const raw = await file.arrayBuffer();
    let decoded;
    try { decoded = await audioContext.decodeAudioData(raw); }
    catch { throw new Error('此裝置無法解碼這種音訊或影片，請轉成 MP3、M4A 或 WAV 再試'); }
    if (decoded.duration > MAX_SECONDS) throw new Error('目前支援最長 60 分鐘的音檔，請先分割');
    if (!decoded.duration) throw new Error('音檔沒有可辨識的聲音');
    onProgress('正在轉換為辨識格式…');
    const sampleCount = Math.ceil(decoded.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, sampleCount, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally { await audioContext.close(); }
}

export function windowSamples(pcm, window) {
  const start = Math.max(0, Math.floor(window.audioStart * SAMPLE_RATE));
  const end = Math.min(pcm.length, Math.ceil(window.audioEnd * SAMPLE_RATE));
  return pcm.subarray(start, end);
}

export async function startRecording(onReady, onStatus, onError) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('此裝置無法使用瀏覽器錄音');
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  const chunks = [];
  let finished = false;
  const recorder = new MediaRecorder(stream);
  let stopped = false;
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onerror = event => onError?.(new Error(event.error?.message || '錄音發生錯誤'));
  recorder.onstop = () => {
    stream.getTracks().forEach(track => track.stop());
    if (finished) return;
    finished = true;
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    onReady(new File([blob], `recording-${Date.now()}.${extension}`, { type: blob.type }));
  };
  try { recorder.start(1000); }
  catch (e) { stream.getTracks().forEach(track => track.stop()); throw e; }
  onStatus('錄音中，聲音不會上傳');
  return () => { if (!stopped && recorder.state !== 'inactive') { stopped = true; recorder.stop(); } };
}
