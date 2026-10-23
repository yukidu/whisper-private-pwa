# Whisper 私人逐字稿（Web App + PWA）

**目前狀態：程式原始碼與單元測試階段；尚未驗證 Whisper WASM 的完整編譯、真實語音辨識、手機瀏覽器相容性或 Cloudflare Production。不得標成已正式上線。**

## 用途

完全在裝置的瀏覽器中執行官方 `ggml-org/whisper.cpp` / ggml 語音辨識：
- 繁體中文操作介面；語音模型支援中文及多種語言（**Whisper 模型輸出中文可能是簡體字，不保證繁體**）。
- 錄音、匯入瀏覽器可解碼音訊 / 部分影片格式、模型切換、模型下載後離線使用。
- 26 秒邏輯切片、前後 1 秒重疊、音訊完整處理（60 分鐘上限），可停止辨識。
- 逐字稿時間碼、逐段編輯、TXT/SRT/VTT 匯出、純文字本機紀錄（不保存音檔）。
- PWA 安裝、網站與 runtime 快取（第一次需網路下載模型與語音核心）。
- 不需要會員、不需要 D1/R2/KV、不具備錄音上傳 API。模型下載來源為 Hugging Face；第三方會收到下載模型時的網路請求，但**不會收到音檔**。

## 原始碼及授權

- 上游：<https://github.com/ggml-org/whisper.cpp>
- 穩定版固定 `v1.9.5`（2026-10-23 規劃檢查）
- `scripts/build-wasm.sh` 從官方 Tag 下載完整 whisper.cpp 原始碼（包括 ggml），覆蓋 **僅供瀏覽器的橋接檔** `examples/whisper.wasm/emscripten.cpp`，使用 Emscripten 建立本 App 專用的 WASM。其餘核心不修改。
- whisper.cpp MIT 授權和版權聲明：<https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE>。
- 包含官方原始碼或分發 WASM 時，**必須連同發行物保留**上游 LICENSE。建置流程會完整使用官方倉庫的 LICENSE；自訂 App `LICENSE` 保留同樣條款及歸屬。
- 模型檔本身請遵守模型提供者的授權條款；未預載模型權重進成品。

## 在已安裝 Git + CMake + Emscripten SDK 的電腦建置

```bash
npm run check
bash scripts/build-wasm.sh
bash scripts/assemble.sh
npm run serve
```

本機開啟 <http://localhost:4173/>。瀏覽器 SharedArrayBuffer 需要 COOP/COEP；本機測試伺服器有提供。手機實測須 HTTPS。

`npm run check` 只驗證 Node 單元測試與 JS 語法；**不能取代真實語音測試**。

## 建立個人 GitHub / Cloudflare（尚待完成）

1. 在 GitHub 使用已建立的公開儲存庫 `yukidu/whisper-private-pwa`，並將整份檔案上傳（不含生成的 `dist` 與 `.vendor-source`）。不要加入到任何現有繁星 App 的程式庫。
2. GitHub Actions 在 PR/main 執行測試、從官方 Tag 重建 WASM、輸出 `whisper-private-pwa-dist`。
3. 先將 Action artifact 下載做真正的 Chrome／Safari／Android／iOS、本機上傳、斷線、MP3／M4A、長檔、逐字稿與安裝測試。不要在驗證前啟動 Production 自動部署。
4. 建立獨立 Cloudflare Pages 專案，以產物 `dist/` 發布，或驗收後才設定 CI/CD 部署。`_headers` 必須成功套用以支援多執行緒 WASM。**公開網站不需要登入；若希望未來限制訪客，須另外設定 Cloudflare Access。**
5. 驗收正式網址前，不可宣稱 Production 完成，亦不可編造網址。正式部署成功後，需記錄版本識別碼（commit SHA）與上一個已驗收版本，才可提供回復代碼。

## 必做驗收

- [ ] Emscripten `3.1.74` + whisper.cpp `v1.9.5` 編譯成功；WASM 啟動成功
- [ ] 中文模型能對示範 WAV/MP3 實際辨識，詞句正確率可接受
- [ ] 3 分鐘以上音檔完整處理，不在 120 秒處截斷
- [ ] 取消辨識與重新啟動不會崩潰
- [ ] 手機 Safari、Chrome 錄音與格式相容
- [ ] 下載模型後，在無網路時可以辨識（PWA & SW）
- [ ] 開發者工具 Network 不存在錄音/音檔 upload request
- [ ] 生產網址 HTTPS、COOP／COEP、WASM、型態 MIME 及 Service Worker 一切正常
- [ ] Cloudflare Production、GitHub main、CI 與正式網址一致
- [ ] 記下部署 commit SHA，保存可回復的前版 SHA（rollback 代碼）

## 已知限制

- Browser 的 `decodeAudioData` 依裝置而有不同解碼支援：部分 MP4/手機錄音格式無法解碼，需要先轉為 MP3 / WAV。
- 目前一次完整解碼上限 60 分鐘、600 MB；超過上限須先分割，低記憶體手機即使未超過上限仍可能不足。此處不是無限長音檔串流架構。
- IndexedDB 模型快取與 LocalStorage 文字紀錄可被瀏覽器清理，須自行匯出重要文字。
- Whisper 較大的模型可能在低記憶體手機無法載入；不建議使用超過 small 的模型。
- 原生 Whisper 不保證繁體中文書寫、語者分離或多語翻譯。此版本未提供語者分離。
- 若模型下載的第三方來源被瀏覽器的跨來源安全政策阻擋，改用本機匯入 `.bin` 模型。
- PWA 離線安裝及錄音在 iOS / Safari 上可能有平台限制，需要實機驗證。辨識較長錄音時請保持 App 位於前景；作業系統可隨時清理背景執行。

## 程式結構

```
src/              UI 邏輯、本機語音、Whisper 核心封裝、模型快取、字幕、文字紀錄
vendor/           自家 Emscripten 介面（不修改官方辨識引擎）
scripts/          上游下載、可重複編譯、成品打包、本機測試伺服器
tests/            字幕與長錄音分段自動測試
public/runtime/   編譯後輸出，原始碼版本不預放未驗證二進位檔
.github/workflows GitHub Actions CI 設定
```

## 2026-10-23 後續增強

- 模型下載與模型初始化採單一作業鎖，取消鍵可停止下載，不會同時建立兩個模型工作。
- Whisper 對超出音檔尾端的時間碼進行裁切，避免字幕結束時間超過原始檔案。
- 新增 `tests/engine.test.js` 及 `tests/deployment.test.js`，測試 JS 對 WASM 的工作流程、取消、長檔分段及部署保護措施。
- GitHub 建立、Cloudflare Production 及 rollback 規則請見 `DEPLOYMENT.md`。