# AI 行銷顧問 Agent｜四情境 E2E 測試報告

- 測試時間：2026-08-13T13:56:45
- 測試入口：`http://127.0.0.1:5176`
- CRM Demo 模式：由 Agent backend 的 CRM Adapter 提供可重現測試資料
- 驗證內容：AI 行銷洞察、AI 會員分析、AI 行銷活動建議、AI 行銷成效分析

## 結果

| 情境 | 結果 |
| --- | --- |
| AI 行銷洞察 | PASS |
| AI 會員分析 | PASS |
| AI 行銷活動建議 | PASS |
| AI 行銷成效分析 | PASS |

## 逐情境對話紀錄

## AI 行銷洞察

### 步驟 1｜使用者輸入與 API 請求

- 對話輸入：`分析本週營收、Top 5 商品、門市與通路異常。`
- API：`POST /api/v1/agent/query`

```json
{
  "message": "分析本週營收、Top 5 商品、門市與通路異常。",
  "timezone": "Asia/Taipei",
  "context": {
    "store_codes": []
  }
}
```

### 步驟 2｜Agent API 回傳

- resolved tool：`analyze_marketing_insights`
- resolved task：`marketing_insights`
- 回覆文字：CRM 已提供營收、商品與通路資料；毛利與同期異常需由 CRM 報表資料補足。
- 信心度：`10/10`

```json
{
  "resolved_intent": {
    "task": "marketing_insights",
    "tool": {
      "tool": "analyze_marketing_insights"
    }
  },
  "reply": {
    "text": "CRM 已提供營收、商品與通路資料；毛利與同期異常需由 CRM 報表資料補足。",
    "confidence": 10,
    "cards": [
      {
        "type": "marketing_insight",
        "title": "AI 行銷洞察",
        "description": "分析期間：2026-08-01～2026-08-07",
        "items": [
          {
            "label": "Top 1 商品",
            "value": "客製生日蛋糕",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "主要成長通路",
            "value": "pos",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "異常門市",
            "value": "目前無重大異常",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "高營收低毛利",
            "value": "CRM 未提供毛利資料",
            "unit": null,
            "change_pct": null,
            "status": "unavailable"
          }
        ]
      },
      {
        "type": "anomaly_list",
        "title": "商品與通路異常",
        "description": null,
        "items": [
          {
            "label": "異常項目",
            "value": "目前沒有可辨識異常",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_report",
        "label": "查看完整洞察報告",
        "payload": {
          "report_id": "crm-insight-2026-08-01-2026-08-07"
        }
      },
      {
        "type": "continue_chat",
        "label": "規劃改善活動",
        "payload": {
          "message": "根據剛才的洞察規劃一個改善活動"
        }
      }
    ],
    "reports": [
      {
        "report_id": "crm-insight-2026-08-01-2026-08-07",
        "title": "AI 行銷洞察詳細報告",
        "summary": "CRM 已提供營收、商品與通路資料；毛利與同期異常需由 CRM 報表資料補足。",
        "section_titles": [
          "Top 商品",
          "通路比較",
          "改善建議"
        ]
      }
    ]
  }
}
```

### 步驟 3｜觸發字卡

#### `marketing_insight`｜AI 行銷洞察

分析期間：2026-08-01～2026-08-07

| 欄位 | 回傳值 | 狀態 |
| --- | --- | --- |
| Top 1 商品 | 客製生日蛋糕 | normal |
| 主要成長通路 | pos | normal |
| 異常門市 | 目前無重大異常 | normal |
| 高營收低毛利 | CRM 未提供毛利資料 | unavailable |

#### `anomaly_list`｜商品與通路異常

無額外說明

| 欄位 | 回傳值 | 狀態 |
| --- | --- | --- |
| 異常項目 | 目前沒有可辨識異常 | normal |

### 步驟 4｜可操作按鈕

| 按鈕文字 | action type | payload |
| --- | --- | --- |
| 查看完整洞察報告 | `open_report` | `{"report_id": "crm-insight-2026-08-01-2026-08-07"}` |
| 規劃改善活動 | `continue_chat` | `{"message": "根據剛才的洞察規劃一個改善活動"}` |

### 步驟 5｜按鈕後續畫面

- 點擊按鈕：`查看完整洞察報告`
- 報告標題：AI 行銷洞察詳細報告
- 報告摘要：CRM 已提供營收、商品與通路資料；毛利與同期異常需由 CRM 報表資料補足。

| 報告區塊 | 欄位 | 資料筆數 | 前 5 筆資料 |
| --- | --- | ---: | --- |
| Top 商品 | 商品、營收、銷量、變化 | 5 | 客製生日蛋糕／61,200 元／26／資料不可用；巧克力蛋糕／40,240 元／26／資料不可用；午茶組合／38,024 元／40／資料不可用；經典原味蛋糕／36,780 元／32／資料不可用；草莓鮮奶油蛋糕／17,460 元／10／資料不可用 |
| 通路比較 | 通路、營收、訂單、變化 | 3 | pos／121,796 元／33／資料不可用；cyberbiz／50,223 元／14／資料不可用；oddle／36,054 元／11／資料不可用 |
| 改善建議 | 建議 | 2 | 檢視商品毛利資料；對下滑通路安排活動測試 |

- 對應截圖：`advisor_screenshots/01_insights_card.png`
- 後續畫面截圖：`advisor_screenshots/01_insights_report.png`

## AI 會員分析

### 步驟 1｜使用者輸入與 API 請求

- 對話輸入：`找出最近最可能購買、即將流失及值得優先經營的會員。`
- API：`POST /api/v1/agent/query`

```json
{
  "message": "找出最近最可能購買、即將流失及值得優先經營的會員。",
  "timezone": "Asia/Taipei",
  "context": {
    "store_codes": []
  }
}
```

### 步驟 2｜Agent API 回傳

- resolved tool：`analyze_member_segments`
- resolved task：`member_analysis`
- 回覆文字：CRM RFM 資料已完成會員分群篩選。
- 信心度：`10/10`

```json
{
  "resolved_intent": {
    "task": "member_analysis",
    "tool": {
      "tool": "analyze_member_segments"
    }
  },
  "reply": {
    "text": "CRM RFM 資料已完成會員分群篩選。",
    "confidence": 10,
    "cards": [
      {
        "type": "member_analysis",
        "title": "AI 會員分析",
        "description": "已從 CRM RFM 資料找出 churn_risk 對象。",
        "items": [
          {
            "label": "分析類型",
            "value": "流失風險",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "符合會員",
            "value": "0 人",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "優先對象",
            "value": "資料不可用",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "主要分群",
            "value": "資料不可用",
            "unit": null,
            "change_pct": null,
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_report",
        "label": "查看會員分析報告",
        "payload": {
          "report_id": "crm-member-churn_risk"
        }
      },
      {
        "type": "continue_chat",
        "label": "建立會員活動",
        "payload": {
          "message": "根據這份會員名單建立行銷活動"
        }
      }
    ],
    "reports": [
      {
        "report_id": "crm-member-churn_risk",
        "title": "AI 會員分析詳細報告",
        "summary": "CRM RFM 資料已完成會員分群篩選。",
        "section_titles": [
          "優先會員名單（已隱藏個資）",
          "經營建議"
        ]
      }
    ]
  }
}
```

### 步驟 3｜觸發字卡

#### `member_analysis`｜AI 會員分析

已從 CRM RFM 資料找出 churn_risk 對象。

| 欄位 | 回傳值 | 狀態 |
| --- | --- | --- |
| 分析類型 | 流失風險 | info |
| 符合會員 | 0 人 | normal |
| 優先對象 | 資料不可用 | info |
| 主要分群 | 資料不可用 | info |

### 步驟 4｜可操作按鈕

| 按鈕文字 | action type | payload |
| --- | --- | --- |
| 查看會員分析報告 | `open_report` | `{"report_id": "crm-member-churn_risk"}` |
| 建立會員活動 | `continue_chat` | `{"message": "根據這份會員名單建立行銷活動"}` |

### 步驟 5｜按鈕後續畫面

- 點擊按鈕：`查看會員分析報告`
- 報告標題：AI 會員分析詳細報告
- 報告摘要：CRM RFM 資料已完成會員分群篩選。

| 報告區塊 | 欄位 | 資料筆數 | 前 5 筆資料 |
| --- | --- | ---: | --- |
| 優先會員名單（已隱藏個資） | 會員識別碼、分群、最近消費、消費頻率、累積消費、購買機率 | 0 | 無資料 |
| 經營建議 | 建議 | 2 | 依分群建立優惠活動；持續追蹤分群變化 |

- 對應截圖：`advisor_screenshots/02_members_card.png`
- 後續畫面截圖：`advisor_screenshots/02_members_report.png`

## AI 行銷活動建議

### 步驟 1｜使用者輸入與 API 請求

- 對話輸入：`規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠，並建立 CRM 活動草稿。`
- API：`POST /api/v1/agent/query`

```json
{
  "message": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠，並建立 CRM 活動草稿。",
  "timezone": "Asia/Taipei",
  "context": {
    "store_codes": []
  }
}
```

### 步驟 2｜Agent API 回傳

- resolved tool：`create_marketing_campaign`
- resolved task：`marketing_campaign_plan`
- 回覆文字：已完成「沉睡會員蛋糕喚回活動」活動規劃，預估 21 位會員符合條件，CRM 草稿編號為 34。
- 信心度：`10/10`

```json
{
  "resolved_intent": {
    "task": "marketing_campaign_plan",
    "tool": {
      "tool": "create_marketing_campaign"
    }
  },
  "reply": {
    "text": "已完成「沉睡會員蛋糕喚回活動」活動規劃，預估 21 位會員符合條件，CRM 草稿編號為 34。",
    "confidence": 10,
    "cards": [
      {
        "type": "marketing_plan",
        "title": "AI 行銷活動規劃",
        "description": "已依客群條件完成 CRM 預覽並建立活動草稿。",
        "items": [
          {
            "label": "活動主題",
            "value": "沉睡會員蛋糕喚回活動",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "目標客群",
            "value": "一般挽留客",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "預估客群",
            "value": "21 人",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "優惠內容",
            "value": "9 折",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "建議通路",
            "value": "store",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "CRM 草稿",
            "value": "34",
            "unit": null,
            "change_pct": null,
            "status": "normal"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_campaign",
        "label": "查看活動草稿",
        "payload": {
          "campaign_id": "34"
        }
      },
      {
        "type": "continue_chat",
        "label": "調整活動條件",
        "payload": {
          "message": "請調整這個活動規劃"
        }
      }
    ],
    "reports": []
  }
}
```

### 步驟 3｜觸發字卡

#### `marketing_plan`｜AI 行銷活動規劃

已依客群條件完成 CRM 預覽並建立活動草稿。

| 欄位 | 回傳值 | 狀態 |
| --- | --- | --- |
| 活動主題 | 沉睡會員蛋糕喚回活動 | info |
| 目標客群 | 一般挽留客 | info |
| 預估客群 | 21 人 | normal |
| 優惠內容 | 9 折 | info |
| 建議通路 | store | info |
| CRM 草稿 | 34 | normal |

### 步驟 4｜可操作按鈕

| 按鈕文字 | action type | payload |
| --- | --- | --- |
| 查看活動草稿 | `open_campaign` | `{"campaign_id": "34"}` |
| 調整活動條件 | `continue_chat` | `{"message": "請調整這個活動規劃"}` |

### 步驟 5｜按鈕後續畫面

- 點擊按鈕：`查看活動草稿`
- 詳情標題：活動草稿詳情

| CRM 活動欄位 | 回傳值 |
| --- | --- |
| 活動主題 | 沉睡會員蛋糕喚回活動 |
| 目標客群 | 一般挽留客 |
| 預估客群 | 21 人 |
| 優惠內容 | 9 折 |
| 建議通路 | store |
| 活動草稿編號 | 34 |
| 目前狀態 | 待確認 |
| 已發送優惠 | 0 人 |
| 已使用優惠 | 0 人 |
| 狀態訊息 | 待確認：目前尚未發送優惠或啟動活動。 |

- 對應截圖：`advisor_screenshots/03_campaign_plan_card.png`
- 後續畫面截圖：`advisor_screenshots/03_campaign_plan_detail.png`

## AI 行銷成效分析

### 步驟 1｜使用者輸入與 API 請求

- 對話輸入：`分析活動 34 是否成功，以及下一次怎麼改善。`
- API：`POST /api/v1/agent/query`

```json
{
  "message": "分析活動 34 是否成功，以及下一次怎麼改善。",
  "timezone": "Asia/Taipei",
  "context": {
    "store_codes": []
  }
}
```

### 步驟 2｜Agent API 回傳

- resolved tool：`analyze_campaign_performance`
- resolved task：`campaign_performance`
- 回覆文字：活動尚未執行，待建立發券與核銷資料後分析。
- 信心度：`10/10`

```json
{
  "resolved_intent": {
    "task": "campaign_performance",
    "tool": {
      "tool": "analyze_campaign_performance"
    }
  },
  "reply": {
    "text": "活動尚未執行，待建立發券與核銷資料後分析。",
    "confidence": 10,
    "cards": [
      {
        "type": "campaign_performance",
        "title": "AI 行銷成效分析",
        "description": "活動 34：活動尚未執行，待建立發券與核銷資料後分析。",
        "items": [
          {
            "label": "活動狀態",
            "value": "draft",
            "unit": null,
            "change_pct": null,
            "status": "info"
          },
          {
            "label": "核銷率",
            "value": "0.0%",
            "unit": null,
            "change_pct": null,
            "status": "anomaly"
          },
          {
            "label": "活動營收",
            "value": "0 元",
            "unit": "營收",
            "change_pct": null,
            "status": "normal"
          },
          {
            "label": "30 天回購",
            "value": "0.0%",
            "unit": null,
            "change_pct": null,
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_report",
        "label": "查看完整成效報告",
        "payload": {
          "report_id": "crm-campaign-performance-34"
        }
      }
    ],
    "reports": [
      {
        "report_id": "crm-campaign-performance-34",
        "title": "AI 行銷成效詳細報告",
        "summary": "活動尚未執行，待建立發券與核銷資料後分析。",
        "section_titles": [
          "活動 KPI",
          "改善建議"
        ]
      }
    ]
  }
}
```

### 步驟 3｜觸發字卡

#### `campaign_performance`｜AI 行銷成效分析

活動 34：活動尚未執行，待建立發券與核銷資料後分析。

| 欄位 | 回傳值 | 狀態 |
| --- | --- | --- |
| 活動狀態 | draft | info |
| 核銷率 | 0.0% | anomaly |
| 活動營收 | 0 元營收 | normal |
| 30 天回購 | 0.0% | info |

### 步驟 4｜可操作按鈕

| 按鈕文字 | action type | payload |
| --- | --- | --- |
| 查看完整成效報告 | `open_report` | `{"report_id": "crm-campaign-performance-34"}` |

### 步驟 5｜按鈕後續畫面

- 點擊按鈕：`查看完整成效報告`
- 報告標題：AI 行銷成效詳細報告
- 報告摘要：活動尚未執行，待建立發券與核銷資料後分析。

| 報告區塊 | 欄位 | 資料筆數 | 前 5 筆資料 |
| --- | --- | ---: | --- |
| 活動 KPI | 指標、數值 | 8 | 活動狀態／draft；目標客群／21 人；已發送／0 人；已使用／0 人；核銷率／0.0% |
| 改善建議 | 建議 | 2 | 補充活動訂單歸因；於活動結束後 7／30 天追蹤回購 |

- 對應截圖：`advisor_screenshots/04_campaign_performance_card.png`
- 後續畫面截圖：`advisor_screenshots/04_campaign_performance_report.png`

## 流程截圖總覽

![00_initial](advisor_screenshots/00_initial.png)
![01_insights_card](advisor_screenshots/01_insights_card.png)
![01_insights_report](advisor_screenshots/01_insights_report.png)
![02_members_card](advisor_screenshots/02_members_card.png)
![02_members_report](advisor_screenshots/02_members_report.png)
![03_campaign_plan_card](advisor_screenshots/03_campaign_plan_card.png)
![03_campaign_plan_detail](advisor_screenshots/03_campaign_plan_detail.png)
![04_campaign_performance_card](advisor_screenshots/04_campaign_performance_card.png)
![04_campaign_performance_report](advisor_screenshots/04_campaign_performance_report.png)

## 驗收

- 四種情境均由對話輸入觸發 Agent API。
- cards 顯示 CRM facts 摘要。
- 洞察、會員與成效情境可開啟詳細報告。
- 活動建議情境可開啟 CRM 活動草稿詳情。
- Browser page errors：0
- Console errors：0
