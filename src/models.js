const BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
export const MODELS = Object.freeze([
  { id: 'tiny-q5_1', name: '輕量・速度優先', file: 'ggml-tiny-q5_1.bin', sizeMB: 31 },
  { id: 'base-q5_1', name: '標準・建議使用', file: 'ggml-base-q5_1.bin', sizeMB: 57 },
  { id: 'small-q5_1', name: '高精準・高記憶體', file: 'ggml-small-q5_1.bin', sizeMB: 182 }
].map(m => Object.freeze({ ...m, url: BASE + m.file })));
export const DEFAULT_MODEL = MODELS[1];
export function getModel(id) { return MODELS.find(m => m.id === id) || DEFAULT_MODEL; }
