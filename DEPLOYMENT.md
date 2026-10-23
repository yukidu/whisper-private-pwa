# 私人 Whisper PWA｜部署與回復手冊（2026-10-23）

## 實際狀態

**尚未部署**。沒有可用的正式網站網址，也沒有 Production rollback 代碼。

## 建立安全、獨立的 GitHub 儲存庫

1. 由 `yukidu` 帳號開啟 https://github.com/new?name=whisper-private-pwa
2. Repository name：`whisper-private-pwa`
3. Visibility：**Public**；不要勾選產生 README、LICENSE 或 `.gitignore`，避免和這份原始碼衝突。
4. 建立後，回到 ChatGPT 提供網址：`https://github.com/yukidu/whisper-private-pwa`
5. AI 可使用已連接的 GitHub 工具，將此 ZIP 內所有原始碼寫入新儲存庫。

> ChatGPT 當前 GitHub 連接工具無「新增儲存庫」操作，授權不代表工具具備該能力，請勿將私有程式碼傳到現有公開倉庫。

## 正式上線前必須通過

1. GitHub Actions `npm run check` 成功。
2. GitHub Actions 真正取得 `whisper.cpp v1.9.5` 上游原始碼，用 Emscripten 編譯 `libmain.js` + `libmain.wasm` 成功，生成 dist artifact。
3. 在實際 Chromium、Safari、Android、iOS 各類裝置測試真正語音辨識、模型下載、離線使用、錄音、長檔、字幕、取消與重啟。
4. 使用瀏覽器 Network 觀察音檔確實未上傳到伺服器。
5. 建立獨立 Cloudflare Pages 專案（不影響其他 Starry App），從驗證過的 dist 發布到正式 Production。
6. 若私人用途必須限制他人登入，先啟用 Cloudflare Access，僅授權本人 Email；**Public GitHub 不等於 Public Website**。
7. 驗證正式網址 HTTPS、COOP、COEP、WASM MIME、PWA、模型載入、錄音和真實轉錄。

## 版本與回復

正式上線以 GitHub `main` SHA、Cloudflare Production deployment ID 為共同 checkpoint，部署成功後必須顯示一組可還原代碼，例如 `WPR-YYYYMMDD-<main-short-sha>`。請在紀錄中存其完整 SHA 和 Cloudflare 部署 ID；不得以本機 ZIP 或本機 git SHA 冒充正式版還原碼。

發生事故時，使用已驗證的上一版 SHA 建立回復 PR，重新通過自動測試並正式部署；或在 Cloudflare 控制台回復至上一個已驗證的部署。回復後再次驗證正式網址。