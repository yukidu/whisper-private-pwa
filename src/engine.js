import { createWindows, mergeWindowSegments } from './transcript.js';
import { SAMPLE_RATE, windowSamples } from './audio.js';
/** Browser bridge to pinned official whisper.cpp WebAssembly core. */
export class WhisperEngine {
  module = null;
  instance = 0;
  loadedKey = null;
  active = false;
  cancelRequested = false;
  async ready() {
    if (this.module) return this.module;
    if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      throw new Error('本機語音核心需要網站提供跨來源隔離安全設定（COOP／COEP）；請使用有正確設定的 HTTPS 網站');
    }
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('語音核心啟動逾時')), 90000);
      window.Module = {
        locateFile: path => `/runtime/${path}`,
        print: () => {}, printErr: () => {},
        onRuntimeInitialized: () => { clearTimeout(timer); this.module = window.Module; resolve(this.module); },
        onAbort: why => { clearTimeout(timer); reject(new Error(`語音核心無法啟動：${why}`)); }
      };
      const script = document.createElement('script');
      script.src = '/runtime/libmain.js';
      script.async = true;
      script.onerror = () => { clearTimeout(timer); reject(new Error('找不到語音核心，請檢查部署檔案')); };
      document.head.appendChild(script);
    });
  }
  async loadModel(key, bytes, onStatus) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1024 * 1024) throw new Error('請提供完整的 ggml Whisper 模型');
    if (this.active) throw new Error('辨識期間不可切換模型');
    const m = await this.ready();
    if (this.instance) { m.free(this.instance); this.instance = 0; }
    this.loadedKey = null;
    try { m.FS_unlink('/model.bin'); } catch { /* initial file */ }
    onStatus?.('正在將模型載入本機記憶體…');
    m.FS_createDataFile('/', 'model.bin', bytes, true, true);
    const instance = m.init('/model.bin');
    if (!instance) throw new Error('無法讀取這個模型；請使用官方 ggml Whisper 模型');
    this.instance = instance;
    this.loadedKey = key;
    onStatus?.('模型已就緒，現在可離線辨識');
  }
  stop() {
    this.cancelRequested = true;
    try { this.module?.cancel_transcription(); } catch { /* no job */ }
  }
  async transcribe(pcm, { language = 'auto', translate = false, onProgress, onSegments } = {}) {
    if (!this.instance) throw new Error('請先載入 Whisper 模型');
    if (this.active) throw new Error('語音辨識已在進行中');
    if (!(pcm instanceof Float32Array) || !pcm.length) throw new Error('音訊資料無效');
    this.active = true;
    this.cancelRequested = false;
    const segments = [];
    const windows = createWindows(pcm.length / SAMPLE_RATE);
    try {
      for (const [i, w] of windows.entries()) {
        if (this.cancelRequested) break;
        onProgress?.(i, windows.length);
        const chunk = windowSamples(pcm, w);
        const threads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
        const response = this.module.full_default(this.instance, chunk, language, threads, translate);
        if (response !== 0) throw new Error(`無法開始辨識（代碼 ${response}）`);
        let state = 1;
        while (state === 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
          if (this.cancelRequested) this.module.cancel_transcription();
          state = this.module.poll_state();
        }
        if (state === -2 && this.cancelRequested) break;
        if (state !== 2) throw new Error(`語音辨識發生錯誤（代碼 ${state}）`);
        const raw = this.module.get_segments();
        segments.push(...mergeWindowSegments(w, Array.from(raw)));
        onSegments?.([...segments]);
      }
      onProgress?.(windows.length, windows.length);
      return { segments, cancelled: this.cancelRequested };
    } finally { this.active = false; }
  }
}
