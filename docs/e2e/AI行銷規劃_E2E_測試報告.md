# AI 行銷規劃 Demo｜Frontend E2E 測試報告

- 測試時間：2026-08-12T02:51:19
- 測試入口：`http://127.0.0.1:5174`
- 測試範圍：快速提問、AI 行銷規劃字卡、活動草稿詳情、帶入並修改活動條件、清除對話、API 錯誤呈現
- 驗收結果：**通過**

## 測試摘要

| Flow | 結果 |
| --- | --- |
| 首頁與輸入框 | PASS |
| AI 行銷規劃字卡 | PASS |
| 查看活動草稿 | PASS |
| 帶入並修改活動條件 | PASS |
| 清除對話 | PASS |
| API 錯誤訊息 | PASS |

## 流程截圖

### 1. 首頁：歡迎訊息、快速提問與輸入框

![01_initial](screenshots/01_initial.png)

### 2. AI 行銷規劃：活動字卡與操作按鈕

![02_marketing_plan](screenshots/02_marketing_plan.png)

### 3. 活動草稿詳情：顯示活動摘要與待確認狀態

![03_campaign_detail](screenshots/03_campaign_detail.png)

### 4. 調整活動條件：操作按鈕帶入輸入框，等待使用者補充

![04_adjustment_prefilled](screenshots/04_adjustment_prefilled.png)

### 5. 修改優惠後重新送出：取得新的活動規劃字卡

![05_adjustment_response](screenshots/05_adjustment_response.png)

### 6. 清除對話：回到初始狀態

![06_clear_conversation](screenshots/06_clear_conversation.png)

### 7. API 失敗：顯示可理解的錯誤訊息

![07_api_error](screenshots/07_api_error.png)

## 實際驗證資料

- CRM 草稿編號：`15`
- CRM 最新狀態：`draft`，客群 `18` 人，已發送 `0` 人，已使用 `0` 人
- 字卡內容：AI 行銷活動規劃；已依客群條件完成 CRM 預覽並建立活動草稿。；活動主題；沉睡會員蛋糕喚回活動；目標客群；一般挽留客；預估客群；18 人；優惠內容；9 折；建議通路；store；CRM 草稿；15
- Browser page errors：`0`
- Console errors：`0`
- Transient API console errors：`1`
- Console warnings：`0`
- Expected API console errors：`1`

## 測試命令

```bash
npm run e2e:marketing
```
