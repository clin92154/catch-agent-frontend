# AI Marketing Demo 服務啟動

## 服務組成

| 服務 | 預設位置 | 用途 |
| --- | --- | --- |
| Agent Backend | `http://127.0.0.1:8002` | Tool Calling、cards、reports、CRM Adapter |
| Agent Frontend | `http://127.0.0.1:5176` | AI 行銷顧問對話入口 |
| CRM Backend | `http://127.0.0.1:8011` | 活動草稿、優惠券、會員與成效 API |
| CRM Admin Frontend | `http://127.0.0.1:5175/aposo/` | 智慧行銷後台操作頁 |

## 首次設定

```bash
cd /Users/shihtengchang/Desktop/Project/CRM/catch-agent-frontend_crm_integrate
cp .env.demo.example .env.demo
npm run demo:check-env
```

啟動檢查會確認：

- 四個 worktree 都存在。
- Agent／CRM env 檔存在。
- CRM API 帳密已配置。
- CRM DB URL 是 PostgreSQL，且資料庫名稱包含 `dev`、`demo` 或 `test`。
- 不會使用 `stage`、`staging`、`prod` 或 `production` 資料庫。
- Agent 使用 `LLM_MODE=demo` 與 `CRM_ADAPTER_MODE=http`。

## 開關服務

```bash
npm run demo:up       # 啟動或接管已存在的健康服務
npm run demo:status   # 查看四端 health／入口狀態
npm run demo:logs     # 列出各服務 log 位置
npm run demo:down     # 只停止由本控制層啟動的服務
```

`demo:up` 會先檢查服務是否已在執行；若健康檢查成功則重用，不會重複啟動。`demo:down` 不會停止手動啟動或其他工作樹的服務。

## Demo 流程

1. 開啟 Agent 前端，輸入自然語言行銷問題。
2. Agent 透過 HTTP CRM Adapter 呼叫 CRM Backend。
3. CRM Backend 使用 `aposo_crm_agent_dev` 合成資料庫。
4. Agent 前端顯示 cards／reports／actions。
5. 開啟 CRM Admin Frontend 的「自動化行銷 → 智慧行銷」完成建立、發送與成效查詢。

## 目前預設安全邊界

- `DEMO_LLM_MODE=demo`：不呼叫 OpenAI／Gemini。
- `DEMO_CRM_DATABASE_URL`：只允許開發測試資料庫。
- CRM scheduler：啟動時固定關閉，避免 Demo 觸發排程。
- `.env.demo`、runtime PID 與 log 不納入 Git。
