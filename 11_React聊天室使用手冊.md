# CATCH React 聊天室使用手冊

## 1. 功能

`frontend/` 是簡易 React／Vite 聊天介面，直接呼叫既有 `POST /api/v1/agent/query`。

- 支援自然語言提問與多輪畫面呈現；後端每次 Request 仍獨立分析，不保存 Memory。
- 顯示 `reply.text` 與 1～10 的 `reply.confidence`。
- 將 `reply.cards` 依 `type` 安全渲染為營收、排行、異常、Context 與商品來源圖卡；不使用 `dangerouslySetInnerHTML`。
- 將 `reply.files` 顯示為可下載文件卡片。
- 將 `reply.charts` 顯示為圖表，並提供開啟連結。
- 每則 AI 回覆的文字、圖卡、檔案與圖表使用獨立區塊，不塞入同一個訊息泡泡。
- API 錯誤顯示為紅色訊息，不顯示後端 stack trace。
- 圖卡依 UI/UX 範例使用固定品牌配色：白底、灰框、橘紅重點數字；異常／建議行動圖卡固定使用淺橘背景，不依數值狀態切換整張卡的顏色。
- 白色 Sidebar 的快速提問使用下拉分類，分成 AI 營運診斷與 AI 智慧叫貨，涵蓋 UC-01～06。
- 不新增 Tool、RAG、MCP 或前端狀態管理框架。

## 2. 前置需求

- Node.js 20。
- npm 10。
- 或 Docker Desktop／Docker Compose。
- FastAPI、PostgreSQL 與 Gemini 設定已依 `docs/08_開發手冊.md` 完成。

## 3. Docker 執行（建議）

在 Repository 根目錄執行：

```powershell
docker compose up --build -d
docker compose ps
```

開啟：


| 功能           | URL                            |
| ---------------- | -------------------------------- |
| React 聊天室   | `http://localhost:5173`        |
| Swagger        | `http://localhost:8001/docs`   |
| FastAPI Health | `http://localhost:8001/health` |

前端 container 透過 Vite proxy 的 `http://app:8000` 連接 FastAPI；瀏覽器不需要直接跨網域呼叫 container service name。

停止服務：

```powershell
docker compose down
```

查看 Log：

```powershell
docker compose logs -f frontend
docker compose logs -f app
```

修改前端後需要完整重建 image 時：

```powershell
docker compose up --build -d frontend
```

## 4. Local 執行

先確認 FastAPI 已在 `http://localhost:8001` 執行，再開啟另一個 PowerShell：

```powershell
cd frontend
npm install
npm run dev
```

開啟 `http://localhost:5173`。Vite 預設將 `/api`、`/artifacts` 與 `/health` 代理至 `http://localhost:8001`，因此不需要修改 FastAPI CORS。

正式檢查前端能否編譯：

```powershell
cd frontend
npm run build
```

Build 結果位於 `frontend/dist/`，不提交 Git。

## 5. 環境變數

前端可使用：

```env
VITE_API_BASE_URL=
VITE_PROXY_TARGET=http://localhost:8001
```

- `VITE_API_BASE_URL` 留空時使用同源 `/api`，建議搭配 Vite proxy。
- Local Vite 的 `VITE_PROXY_TARGET` 預設為 `http://localhost:8001`。
- Docker Compose 會覆寫為 `http://app:8000`。
- `FRONTEND_HOST_PORT` 可在 Repository 根目錄 `.env` 覆寫宿主機 port，預設 `5173`。

## 6. 手動操作

1. 開啟 `http://localhost:5173`。
2. 點選左側快速問題，或自行輸入問題。
3. 按 Enter 或「送出」。Shift + Enter 可換行。
4. 等待紫色載入訊息消失。
5. 確認文字回覆出現在 AI 訊息框。
6. 確認 `cards` 顯示營收參考、門市排行、異常項目與 Context；UC-01 有商品資料時另顯示銷量及 `line_amount` 圖卡。
7. 若 API 回傳 `files`，點擊藍色文件卡片下載或開啟。
8. UC-01 營收異常預設顯示營收比較圖，並可點擊「開啟」。

建議測試：

```text
中壢門市 2026/07/13 到 07/19 有沒有營收異常？
中壢門市屬於哪個商圈？
請分析中壢門市 2026/07/13 到 07/19 的營收異常，並畫比較圖。
```

## 7. 文件下載契約

前端依既有 Agent Response 顯示文件：

```json
{
  "reply": {
    "text": "分析完成。",
    "confidence": 9,
    "cards": [],
    "files": [
      {
        "name": "營收報告.xlsx",
        "type": "xlsx",
        "url": "/artifacts/reports/revenue.xlsx",
        "description": "門市營收分析結果"
      }
    ],
    "charts": []
  }
}
```

未要求 CSV／Excel 時 `files=[]`；使用者明確要求報表時可直接下載。`cards` 是資料 JSON。文字只解析 `catch-highlight`、`catch-positive`、`catch-negative`、`catch-warning`、`catch-info`、`catch-ai` 六種 span class，其餘標籤維持純文字；不使用 `dangerouslySetInnerHTML`。信心度 1～3 時只顯示參考問法。

## 8. 常見問題

### 畫面顯示「自然語言服務目前無法使用」

確認 Repository 根目錄 `.env` 已設定 `GEMINI_API_KEY`，再重建 App：

```powershell
docker compose up -d --force-recreate app
```

### 前端無法連線 API

```powershell
docker compose ps
docker compose logs --tail 100 frontend
docker compose logs --tail 100 app
```

Local 模式需確認 FastAPI 使用 `8001`；Docker 模式需確認 frontend 的 `VITE_PROXY_TARGET=http://app:8000`。

### 5173 Port 已被占用

在根目錄 `.env` 設定：

```env
FRONTEND_HOST_PORT=5174
```

重建後改開啟 `http://localhost:5174`。
