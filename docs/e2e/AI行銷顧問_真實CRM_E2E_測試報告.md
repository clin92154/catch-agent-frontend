# AI 行銷顧問｜真實 CRM E2E 測試報告

- 測試時間：2026-08-12T14:33:03
- 測試入口：`http://127.0.0.1:5174`
- CRM Adapter：HTTP 真實 CRM API
- LLM：本次使用 deterministic Demo LLM，僅驗證真實 CRM HTTP 串接，不產生外部 LLM 費用

## 結果

| 情境 | 結果 |
| --- | --- |
| AI 行銷洞察 | PASS |
| AI 會員分析 | PASS |
| AI 行銷活動建議 | PASS |
| AI 行銷成效分析 | PASS |

## 對話與 API 摘要

### AI 行銷洞察

- 輸入：分析本週營收、Top 5 商品、門市與通路異常。
- CRM 活動：不適用
- Agent 回傳：
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
      "marketing_insight",
      "anomaly_list"
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
    "report_ids": [
      "crm-insight-2026-08-01-2026-08-07"
    ]
  }
}
```

### AI 會員分析

- 輸入：找出最近最可能購買、即將流失及值得優先經營的會員。
- CRM 活動：不適用
- Agent 回傳：
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
      "member_analysis"
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
    "report_ids": [
      "crm-member-churn_risk"
    ]
  }
}
```

### AI 行銷活動建議

- 輸入：規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠，並建立 CRM 活動草稿。
- CRM 活動：8
- Agent 回傳：
```json
{
  "resolved_intent": {
    "task": "marketing_campaign_plan",
    "tool": {
      "tool": "create_marketing_campaign"
    }
  },
  "reply": {
    "text": "已完成「沉睡會員蛋糕喚回活動」活動規劃，預估 21 位會員符合條件，CRM 草稿編號為 8。",
    "confidence": 10,
    "cards": [
      "marketing_plan"
    ],
    "actions": [
      {
        "type": "open_campaign",
        "label": "查看活動草稿",
        "payload": {
          "campaign_id": "8"
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
    "report_ids": []
  }
}
```

### AI 行銷成效分析

- 輸入：分析活動 8 是否成功，以及下一次怎麼改善。
- CRM 活動：8
- Agent 回傳：
```json
{
  "resolved_intent": {
    "task": "campaign_performance",
    "tool": {
      "tool": "analyze_campaign_performance"
    }
  },
  "reply": {
    "text": "CRM 已回傳活動發送、核銷與目前可歸因營收。",
    "confidence": 10,
    "cards": [
      "campaign_performance"
    ],
    "actions": [
      {
        "type": "open_report",
        "label": "查看完整成效報告",
        "payload": {
          "report_id": "crm-campaign-performance-8"
        }
      }
    ],
    "report_ids": [
      "crm-campaign-performance-8"
    ]
  }
}
```

## 截圖

![00_initial](real_screenshots/00_initial.png)
![01_insights](real_screenshots/01_insights.png)
![01_insights_report](real_screenshots/01_insights_report.png)
![02_members](real_screenshots/02_members.png)
![02_members_report](real_screenshots/02_members_report.png)
![03_campaign_plan](real_screenshots/03_campaign_plan.png)
![03_campaign_draft](real_screenshots/03_campaign_draft.png)
![04_campaign_performance](real_screenshots/04_campaign_performance.png)
![04_campaign_performance_report](real_screenshots/04_campaign_performance_report.png)

- Browser page errors：0
- Console errors：0
