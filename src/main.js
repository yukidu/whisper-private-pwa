import { MODELS, DEFAULT_MODEL, getModel } from './models.js';
import { downloadModel } from './model-cache.js';
import { decodeAudio, startRecording } from './audio.js';
import { WhisperEngine } from './engine.js';
import { timestamp, toTXT, toSRT, toVTT } from './transcript.js';
import { readHistory, saveHistory, clearHistory } from './history.js';

const byId = id => document.getElementById(id);
const engine = new WhisperEngine();
const modelSelect = byId('model');
const state = {
  file: null, url: null, segments: [], selectedModel: DEFAULT_MODEL.id,
  stopRecording: null, downloading: null, modelPreparation: null, running: false, historyId: null,
  installPrompt: null
};
for (const m of MODELS) {
  const option = document.createElement('option');
  option.value = m.id;
  option.textContent = `${m.name} (${m.sizeMB} MB)`;
  option.selected = m.id === DEFAULT_MODEL.id;
  modelSelect.appendChild(option);
}
function setStatus(message, kind = '') {
  const el = byId('status');
  el.textContent = message;
  el.dataset.kind = kind;
}
function syncControls() {
  const busy = state.running || Boolean(state.modelPreparation);
  for (const id of ['run','pick-audio','record','model','custom-model','load-model']) byId(id).disabled = busy;
  byId('cancel').disabled = !busy;
}
function setBusy(isBusy) { state.running = isBusy; syncControls(); }
function fileSelected(file) {
  if (!file) return;
  state.file = file;
  state.historyId = null;
  state.segments = [];
  renderSegments();
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(file);
  byId('player').src = state.url;
  byId('player').hidden = false;
  byId('selected-file').textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  setStatus('音檔已選取。請確認模型後開始辨識。');
}
function renderSegments() {
  const container = byId('segments');
  container.replaceChildren();
  byId('segment-count').textContent = `${state.segments.length} 段`;
  if (!state.segments.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '辨識完成後，逐字稿會顯示在這裡。每一段文字都能直接編輯。';
    container.append(empty);
    return;
  }
  state.segments.forEach((seg, i) => {
    const row = document.createElement('div'); row.className = 'segment';
    const time = document.createElement('button');
    time.className = 'timecode'; time.type = 'button';
    time.textContent = timestamp(seg.start, '.').slice(0, 8);
    time.title = '播放到此處';
    time.addEventListener('click', () => {
      const player = byId('player'); player.currentTime = seg.start;
      player.play().catch(() => {});
    });
    const text = document.createElement('textarea');
    text.rows = 2; text.value = seg.text;
    text.setAttribute('aria-label', `第 ${i + 1} 段逐字稿`);
    text.addEventListener('input', () => { state.segments[i].text = text.value; });
    row.append(time, text);
    container.append(row);
  });
}
function updateProgress(percent, label) {
  byId('progress').hidden = false;
  byId('progress-bar').value = percent;
  byId('progress-label').textContent = label;
}
function showHistory() {
  const items = readHistory();
  const list = byId('history'); list.replaceChildren();
  if (!items.length) {
    const li=document.createElement('li'); li.textContent='尚無本機文字紀錄'; list.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button'); btn.type='button'; btn.className='history-item';
    btn.textContent = `${item.name} · ${new Date(item.createdAt).toLocaleString('zh-TW')}`;
    btn.addEventListener('click', () => {
      state.segments = item.segments.map(x=>({...x}));
      state.historyId = item.id;
      renderSegments();
      setStatus('已開啟本機紀錄。原始音檔不會儲存。');
    });
    li.append(btn); list.append(li);
  }
}
async function prepareModel() {
  if (state.modelPreparation) return state.modelPreparation;
  const selected = getModel(modelSelect.value);
  if (engine.loadedKey === selected.id) return;
  setStatus('正在準備模型（第一次需下載；之後會在這台裝置快取）…');
  const controller = new AbortController();
  state.downloading = controller;
  const job = (async () => {
    const bytes = await downloadModel(selected, controller.signal, p => updateProgress(p, `正在下載 ${selected.name}：${p}%`));
    if (controller.signal.aborted) throw new Error('已取消模型下載');
    await engine.loadModel(selected.id, bytes, txt => setStatus(txt));
  })();
  state.modelPreparation = job;
  syncControls();
  try { return await job; }
  catch (error) {
    if (controller.signal.aborted) throw new Error('已取消模型下載，原有模型不受影響');
    throw error;
  } finally {
    if (state.downloading === controller) state.downloading = null;
    if (state.modelPreparation === job) state.modelPreparation = null;
    syncControls();
  }
}
byId('pick-audio').addEventListener('change', event => fileSelected(event.target.files?.[0]));
modelSelect.addEventListener('change', () => {
  state.selectedModel = modelSelect.value;
  setStatus('模型已切換。按「準備模型」可先下載，方便離線使用。');
});
byId('load-model').addEventListener('click', async () => {
  try { await prepareModel(); updateProgress(100, '模型已準備完成'); }
  catch (error) { setStatus(error.message, 'error'); }
});
byId('custom-model').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 250 * 1024 * 1024) throw new Error('瀏覽器版本請使用 250 MB 以下的 ggml 模型');
    const data = new Uint8Array(await file.arrayBuffer());
    await engine.loadModel(`custom:${file.name}`, data, x => setStatus(x));
    setStatus(`已載入自選模型：${file.name}。請保持目前頁面開啟。`);
    byId('model').value = '';
  } catch (error) { setStatus(error.message, 'error'); }
});
byId('record').addEventListener('click', async () => {
  if (state.stopRecording) {
    state.stopRecording();
    state.stopRecording = null;
    byId('record').textContent = '開始錄音';
    return;
  }
  try {
    const stop = await startRecording(file => fileSelected(file), x=>setStatus(x), error=>setStatus(error.message, 'error'));
    state.stopRecording = stop;
    byId('record').textContent = '停止錄音';
  } catch (error) { setStatus(error.message, 'error'); }
});
byId('run').addEventListener('click', async () => {
  if (!state.file) { setStatus('請先匯入音訊或錄音', 'error'); return; }
  setBusy(true);
  state.segments = []; renderSegments();
  state.historyId = crypto.randomUUID();
  try {
    if (!engine.instance || (modelSelect.value && engine.loadedKey !== modelSelect.value)) await prepareModel();
    const pcm = await decodeAudio(state.file, txt => setStatus(txt));
    setStatus('本機語音辨識中，請保持此分頁開啟…');
    const { segments, cancelled } = await engine.transcribe(pcm, {
      language: byId('language').value,
      translate: byId('translate').checked,
      onProgress: (done,total) => updateProgress(Math.round(done/total*100), `辨識進度 ${done} / ${total} 段`),
      onSegments: s => { state.segments = s; renderSegments(); }
    });
    state.segments = segments; renderSegments();
    setStatus(cancelled ? `已停止，保留已完成的 ${segments.length} 段文字` : `辨識完成，共 ${segments.length} 段`, cancelled ? 'warning' : 'success');
    if (segments.length) {
      const saved = saveHistory({ id:state.historyId, name:state.file.name, createdAt:Date.now(), segments });
      if (!saved) setStatus('辨識完成，但瀏覽器空間不足，請立即匯出文字。', 'warning');
      showHistory();
    }
  } catch (error) { setStatus(error?.message || '辨識失敗', 'error'); }
  finally { setBusy(false); }
});
byId('cancel').addEventListener('click', () => {
  if (state.downloading) {
    state.downloading.abort();
    setStatus('正在取消模型下載…', 'warning');
  } else if (state.running) {
    engine.stop();
    setStatus('正在安全停止辨識…', 'warning');
  }
});
byId('save').addEventListener('click', () => {
  if (!state.segments.length) return setStatus('沒有可儲存的逐字稿', 'warning');
  const saved = saveHistory({id:state.historyId || crypto.randomUUID(), name:state.file?.name || '逐字稿', createdAt:Date.now(), segments:state.segments});
  if (saved) { showHistory(); setStatus('已儲存到此瀏覽器，不會上傳。', 'success'); }
  else setStatus('本機儲存失敗，請下載文字備份。', 'error');
});
for (const [id, format, mime, ext] of [
  ['txt',toTXT,'text/plain','txt'],['srt',toSRT,'application/x-subrip','srt'],['vtt',toVTT,'text/vtt','vtt']
]) {
  byId(`export-${id}`).addEventListener('click', () => {
    if (!state.segments.length) return setStatus('目前沒有可匯出的文字', 'warning');
    const data = '\ufeff' + format(state.segments);
    const blob = new Blob([data], {type:`${mime};charset=utf-8`});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;
    a.download = `${(state.file?.name || 'transcript').replace(/\.[^.]+$/,'')}.${ext}`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(url), 10000);
  });
}
byId('clear-history').addEventListener('click', () => {
  if (confirm('確定刪除這台裝置的所有逐字稿紀錄？此操作無法復原。')) {
    clearHistory(); showHistory(); setStatus('本機文字紀錄已清除');
  }
});
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); state.installPrompt=e; byId('install').hidden=false;
});
byId('install').addEventListener('click', async () => {
  if (state.installPrompt) { await state.installPrompt.prompt(); state.installPrompt=null; byId('install').hidden=true; }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
showHistory();
renderSegments();
if (!crossOriginIsolated) {
  setStatus('目前缺少本機辨識所需的網站安全設定，請由正式設定的 HTTPS 網址開啟。', 'warning');
}
