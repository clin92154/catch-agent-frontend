# AI Marketing Demo 服務啟動

## 服務組成

| 服務 | 預設位置 | 用途 |
| --- | --- | --- |
| Agent Backend | `http://127.0.0.1:8002` | Tool Calling、cards、reports、CRM Adapter |
| Agent Frontend | `http://127.0.0.1:5176` | AI 行銷顧問對話入口 |
| CRM Backend（HTTP 整合模式） | `http://127.0.0.1:8012` | 活動草稿、優惠券、會員與成效 API |
| CRM Admin Frontend（HTTP 整合模式） | `http://127.0.0.1:5175/aposo/` | 智慧行銷後台操作頁 |

預設 Demo 模式只啟動 Agent Backend 與 Agent Frontend，CRM 資料由 Agent 內建的可重現示範情境提供。

## 首次設定

```bash
cd /Users/shihtengchang/Desktop/Project/CRM/catch-agent-frontend_crm_integrate
cp .env.demo.example .env.demo
npm run demo:check-env
```

啟動檢查會確認：

- Agent worktree 與 env 檔存在。
- `DEMO_CRM_MODE=fake` 時不要求 CRM worktree、帳密或資料庫。
- `DEMO_CRM_MODE=http` 時才檢查隔離 CRM worktree、帳密與開發資料庫。
- 外部 LLM 必須明確設定允許與 API Key。

## 開關服務

```bash
npm run demo:up       # 啟動或接管已存在的健康服務
npm run demo:status   # 查看目前模式下的服務狀態
npm run demo:logs     # 列出各服務 log 位置
npm run demo:down     # 只停止由本控制層啟動的服務
```

`demo:up` 會先檢查服務是否已在執行；若健康檢查成功則重用，不會重複啟動。`demo:down` 不會停止手動啟動或其他工作樹的服務。

## Demo 流程

1. 開啟 Agent 前端，輸入自然語言行銷問題。
2. `fake` 模式由 Demo Adapter 回傳固定會員、商品、活動與研究資料；`http` 模式才透過 CRM Adapter 呼叫 CRM Backend。
3. Demo 模式不連線正式 CRM，也不直接存取 CRM 資料庫。
4. Agent 前端顯示 cards／reports／actions；查詢階段不寫入 CRM。
5. 使用者按「建立活動草稿」並確認，Agent 才呼叫 CRM 建立草稿。
6. Demo 模式再按「發送優惠券」並確認，Agent 模擬發送；`crm_only` 模式則要求 CRM 後台確認發送。

## 目前預設安全邊界

- `DEMO_LLM_MODE=demo`：不呼叫 OpenAI／Gemini。
- `DEMO_CRM_MODE=fake`：不啟動 CRM 8012／5175，不連線 CRM 資料庫。
- `AGENT_CAMPAIGN_SEND_MODE=demo`：允許本地 Agent 前台測試發送按鈕；正式／預設使用 `crm_only`。
- `DEMO_CRM_DATABASE_URL`：僅 HTTP 整合模式使用，且只允許開發測試資料庫。
- CRM scheduler：啟動時固定關閉，避免 Demo 觸發排程。
- `.env.demo`、runtime PID 與 log 不納入 Git。
