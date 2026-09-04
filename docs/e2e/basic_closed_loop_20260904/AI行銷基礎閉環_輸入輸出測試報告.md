# AI 行銷活動建議｜基礎閉環 E2E 測試報告

- 測試時間：2026-09-04T16:17:55
- 測試結果：**PASS**
- 測試範圍：活動規劃 → CRM 客群預覽 → 使用者確認建立草稿 → metrics 回查 → 上下文商品推薦 → 活動成效追問 → 對話保存
- 發送策略：於人工確認 Dialog 確認後，對隔離 dev 測試庫中的合成會員執行發送

## 測試環境

```json
{
  "agent_frontend": "http://127.0.0.1:5174",
  "agent_backend": "http://127.0.0.1:8002",
  "crm_backend": "http://127.0.0.1:8012",
  "crm_database": "aposo_crm_agent_dev（dev 測試資料）",
  "llm_mode": "OpenAI Responses API（real）",
  "crm_adapter_mode": "http"
}
```

## 注意事項

```json
[
  "目前未發現資料一致性警告。"
]
```

## 流程摘要

| 步驟 | 驗證內容 | 結果 |
| --- | --- | --- |
| 0. 服務健康檢查 | 輸入／輸出／UI Action 已記錄 | PASS |
| 1. AI 活動規劃與 CRM 客群預覽 | 輸入／輸出／UI Action 已記錄 | PASS |
| 2. 使用者確認建立 CRM 活動草稿 | 輸入／輸出／UI Action 已記錄 | PASS |
| 3. CRM 活動草稿狀態與 metrics 回查 | 輸入／輸出／UI Action 已記錄 | PASS |
| 4. 使用者確認發送優惠券並回查活動成效 | 輸入／輸出／UI Action 已記錄 | PASS |
| 5. 於同一活動上下文詢問主推商品 | 輸入／輸出／UI Action 已記錄 | PASS |
| 6. 同一對話追問活動成效 | 輸入／輸出／UI Action 已記錄 | PASS |
| 7. 對話與 workflow 狀態保存 | 輸入／輸出／UI Action 已記錄 | PASS |

## 逐步輸入與輸出

### 0. 服務健康檢查

#### 輸入

```json
{
  "services": [
    {
      "name": "agent_backend",
      "url": "http://127.0.0.1:8002/health",
      "status_code": 200,
      "body": {
        "status": "ok",
        "version": "0.1.0"
      }
    },
    {
      "name": "crm_backend",
      "url": "http://127.0.0.1:8012/health",
      "status_code": 200,
      "body": {
        "status": "ok",
        "version": "1.0.1"
      }
    }
  ]
}
```

#### 輸出

```json
{
  "result": "PASS",
  "isolated_ports": [
    8012,
    8002,
    5175,
    5176
  ]
}
```

### 1. AI 活動規劃與 CRM 客群預覽

#### 輸入

```json
{
  "user_message": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
  "request": {
    "message": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "timezone": "Asia/Taipei",
    "context": {
      "store_codes": []
    }
  }
}
```

#### 輸出

```json
{
  "status": null,
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": {
    "type": "marketing_campaign",
    "context_status": "active",
    "mode": "single_step",
    "status": "plan_ready",
    "current_step": "create_draft",
    "source_text": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "revision": 1,
    "next_actions": [
      "create_campaign_draft",
      "continue_chat"
    ],
    "plan": {
      "campaign_name": "沉睡會員蛋糕喚回活動",
      "objective": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
      "product_focus": "蛋糕",
      "coupon": {
        "name": "蛋糕喚回 9 折優惠券",
        "channel": "store",
        "allowed_channels": [
          "store"
        ],
        "valid_days": 30,
        "point_cost": 1,
        "usage_scope": "蛋糕商品適用",
        "cyberbiz_coupon_type": "percent",
        "cyberbiz_coupon_value": 90,
        "cyberbiz_order_price_threshold": 0,
        "cyberbiz_tags": [
          "蛋糕",
          "沉睡會員",
          "喚回"
        ],
        "member_visible": false,
        "points_redeemable": false,
        "redeem_kind": "coupon"
      },
      "audience_filters": {
        "product_keyword": "蛋糕",
        "rfm_segments": [],
        "max_recency_days": 365,
        "require_line_bound": false,
        "purchase_timeframe_days": 730,
        "condition": {
          "version": "v1",
          "operator": "AND",
          "rules": [
            {
              "field": "purchase.product_name",
              "operator": "contains",
              "value": "蛋糕",
              "window_days": 730,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "member.has_email",
              "operator": "eq",
              "value": true,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "purchase.recency_days",
              "operator": "between",
              "value": [
                61,
                365
              ],
              "as_of_date": "2026-09-04"
            }
          ]
        }
      },
      "message_title": "沉睡會員蛋糕喚回｜限時 9 折",
      "message_content": "曾經喜歡的蛋糕，現在回來享 9 折優惠！會員專屬優惠券限時 30 天，歡迎再次品嚐。",
      "marketing_logic": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。"
    },
    "steps": []
  },
  "resolved_intent": {
    "task": "marketing_campaign_plan",
    "tool": {
      "tool": "create_marketing_campaign"
    }
  },
  "reply": {
    "text": "已依你的需求完成「沉睡會員蛋糕喚回活動」活動規劃。\n規劃發想：保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。\n決策重點：客群鎖定曾購買蛋糕且符合指定客群條件；主推蛋糕；提供9 折；以門市為主要通路；活動期間30天。\n目前預估 355 位會員符合條件，請確認後建立 CRM 活動草稿。",
    "confidence": 10,
    "cards": [
      {
        "type": "marketing_plan",
        "title": "AI 行銷活動規劃",
        "description": "已完成 CRM 客群預覽，請確認後建立活動草稿。",
        "items": [
          {
            "label": "活動主題",
            "value": "沉睡會員蛋糕喚回活動",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "目標客群",
            "value": "曾購買蛋糕且符合指定客群條件",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "預估客群",
            "value": "355 人",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "優惠內容",
            "value": "9 折",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "建議通路",
            "value": "門市",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "活動期間",
            "value": "30 天",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "CRM 草稿",
            "value": "尚未建立",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "活動說明",
            "value": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "規劃發想",
            "value": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "決策重點",
            "value": "客群鎖定曾購買蛋糕且符合指定客群條件；主推蛋糕；提供9 折；以門市為主要通路；活動期間30天。",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "主推商品",
            "value": "蛋糕",
            "trend": "unavailable",
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "create_campaign_draft",
        "label": "建立活動草稿",
        "payload": {}
      },
      {
        "type": "continue_chat",
        "label": "查看客群篩選條件",
        "payload": {
          "message": "說明目前客群的篩選條件"
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

#### 字卡／按鈕／畫面驗收

```json
{
  "card_types": [
    "marketing_plan"
  ],
  "action_types": [
    "create_campaign_draft",
    "continue_chat",
    "continue_chat"
  ],
  "workflow_display": "第 1 版 · 待確認建立"
}
```

### 2. 使用者確認建立 CRM 活動草稿

#### 輸入

```json
{
  "ui_action": "建立活動草稿",
  "confirm_dialog": null,
  "request": {
    "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
    "confirmed": true
  }
}
```

#### 輸出

```json
{
  "status": null,
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": {
    "type": "marketing_campaign",
    "context_status": "active",
    "mode": "single_step",
    "status": "draft_created",
    "current_step": "send_coupon",
    "campaign_id": "18",
    "source_text": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "revision": 1,
    "next_actions": [
      "send_coupon",
      "open_campaign",
      "continue_chat"
    ],
    "plan": {
      "campaign_name": "沉睡會員蛋糕喚回活動",
      "objective": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
      "product_focus": "蛋糕",
      "coupon": {
        "name": "蛋糕喚回 9 折優惠券",
        "channel": "store",
        "allowed_channels": [
          "store"
        ],
        "valid_days": 30,
        "point_cost": 1,
        "usage_scope": "蛋糕商品適用",
        "cyberbiz_coupon_type": "percent",
        "cyberbiz_coupon_value": 90,
        "cyberbiz_order_price_threshold": 0,
        "cyberbiz_tags": [
          "蛋糕",
          "沉睡會員",
          "喚回"
        ],
        "member_visible": false,
        "points_redeemable": false,
        "redeem_kind": "coupon"
      },
      "audience_filters": {
        "product_keyword": "蛋糕",
        "rfm_segments": [],
        "max_recency_days": 365,
        "require_line_bound": false,
        "purchase_timeframe_days": 730,
        "condition": {
          "version": "v1",
          "operator": "AND",
          "rules": [
            {
              "field": "purchase.product_name",
              "operator": "contains",
              "value": "蛋糕",
              "window_days": 730,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "member.has_email",
              "operator": "eq",
              "value": true,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "purchase.recency_days",
              "operator": "between",
              "value": [
                61,
                365
              ],
              "as_of_date": "2026-09-04"
            }
          ]
        }
      },
      "message_title": "沉睡會員蛋糕喚回｜限時 9 折",
      "message_content": "曾經喜歡的蛋糕，現在回來享 9 折優惠！會員專屬優惠券限時 30 天，歡迎再次品嚐。",
      "marketing_logic": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。"
    },
    "steps": []
  },
  "resolved_intent": {
    "task": "marketing_campaign_plan",
    "tool": {
      "tool": "create_marketing_campaign"
    }
  },
  "reply": {
    "text": "已依你的需求完成「沉睡會員蛋糕喚回活動」活動規劃。\n規劃發想：保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。\n決策重點：客群鎖定曾購買蛋糕且符合指定客群條件；主推蛋糕；提供9 折；以門市為主要通路；活動期間30天。\n目前預估 355 位會員符合條件，CRM 草稿已建立，請確認是否發送優惠券。",
    "confidence": 10,
    "cards": [
      {
        "type": "marketing_plan",
        "title": "AI 行銷活動規劃",
        "description": "已依客群條件建立 CRM 活動草稿，請確認是否發送優惠券。",
        "items": [
          {
            "label": "活動主題",
            "value": "沉睡會員蛋糕喚回活動",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "目標客群",
            "value": "曾購買蛋糕且符合指定客群條件",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "預估客群",
            "value": "355 人",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "優惠內容",
            "value": "9 折",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "建議通路",
            "value": "門市",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "活動期間",
            "value": "30 天",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "CRM 草稿",
            "value": "已建立",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "活動說明",
            "value": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "規劃發想",
            "value": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "決策重點",
            "value": "客群鎖定曾購買蛋糕且符合指定客群條件；主推蛋糕；提供9 折；以門市為主要通路；活動期間30天。",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "主推商品",
            "value": "蛋糕",
            "trend": "unavailable",
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_campaign",
        "label": "查看活動草稿",
        "payload": {
          "campaign_id": "18"
        }
      },
      {
        "type": "send_coupon",
        "label": "確認發送優惠券",
        "payload": {
          "campaign_id": "18"
        }
      },
      {
        "type": "continue_chat",
        "label": "查看客群篩選條件",
        "payload": {
          "message": "說明目前客群的篩選條件"
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

#### 字卡／按鈕／畫面驗收

```json
{
  "card_status": "CRM 草稿已建立",
  "next_action": "發送優惠券（本次未觸發）"
}
```

### 3. CRM 活動草稿狀態與 metrics 回查

#### 輸入

```json
{
  "method": "GET",
  "url": "http://127.0.0.1:8002/api/v1/agent/campaigns/18/metrics"
}
```

#### 輸出

```json
{
  "status": "success",
  "data": {
    "campaign_id": 18,
    "campaign_status": "draft",
    "audience_total": 355,
    "issued_count": 0,
    "redeemed_count": 0,
    "campaign_name": "沉睡會員蛋糕喚回活動",
    "usage_rate": 0.0,
    "estimated_revenue": 0.0,
    "revenue_order_count": 0,
    "analysis": "活動尚未執行，待建立發券與核銷資料後分析。"
  }
}
```

#### 驗收條件

```json
{
  "campaign_id": "18",
  "campaign_status": "draft",
  "audience_total": 355,
  "issued_count": 0,
  "redeemed_count": 0,
  "audience_consistency": {
    "plan_preview": 355,
    "draft_response": 355,
    "crm_metrics": 355,
    "consistent": true
  }
}
```

### 4. 使用者確認發送優惠券並回查活動成效

#### 輸入

```json
{
  "ui_action": "發送優惠券",
  "confirm_dialog": "確認發送優惠券",
  "request": {
    "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
    "confirmed": true
  }
}
```

#### 輸出

```json
{
  "status": null,
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": {
    "type": "marketing_campaign",
    "context_status": "active",
    "mode": "single_step",
    "status": "sent",
    "current_step": "completed",
    "campaign_id": "18",
    "source_text": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "revision": 1,
    "next_actions": [
      "open_campaign"
    ],
    "plan": {
      "campaign_name": "沉睡會員蛋糕喚回活動",
      "objective": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
      "product_focus": "蛋糕",
      "coupon": {
        "name": "蛋糕喚回 9 折優惠券",
        "channel": "store",
        "allowed_channels": [
          "store"
        ],
        "valid_days": 30,
        "point_cost": 1,
        "usage_scope": "蛋糕商品適用",
        "cyberbiz_coupon_type": "percent",
        "cyberbiz_coupon_value": 90,
        "cyberbiz_order_price_threshold": 0,
        "cyberbiz_tags": [
          "蛋糕",
          "沉睡會員",
          "喚回"
        ],
        "member_visible": false,
        "points_redeemable": false,
        "redeem_kind": "coupon"
      },
      "audience_filters": {
        "product_keyword": "蛋糕",
        "rfm_segments": [],
        "max_recency_days": 365,
        "require_line_bound": false,
        "purchase_timeframe_days": 730,
        "condition": {
          "version": "v1",
          "operator": "AND",
          "rules": [
            {
              "field": "purchase.product_name",
              "operator": "contains",
              "value": "蛋糕",
              "window_days": 730,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "member.has_email",
              "operator": "eq",
              "value": true,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "purchase.recency_days",
              "operator": "between",
              "value": [
                61,
                365
              ],
              "as_of_date": "2026-09-04"
            }
          ]
        }
      },
      "message_title": "沉睡會員蛋糕喚回｜限時 9 折",
      "message_content": "曾經喜歡的蛋糕，現在回來享 9 折優惠！會員專屬優惠券限時 30 天，歡迎再次品嚐。",
      "marketing_logic": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。"
    },
    "steps": []
  },
  "resolved_intent": {
    "task": "campaign_performance",
    "tool": {
      "tool": "analyze_campaign_performance"
    }
  },
  "reply": {
    "text": "已完成 CRM 優惠券發送，「沉睡會員蛋糕喚回活動」共建立 355 張優惠券。",
    "confidence": 10,
    "cards": [
      {
        "type": "campaign_performance",
        "title": "優惠券發送結果",
        "description": "CRM 已完成優惠券發送，後續可持續查看核銷與營收。",
        "items": [
          {
            "label": "活動主題",
            "value": "沉睡會員蛋糕喚回活動",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "本次發送",
            "value": "355 張",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "已核銷",
            "value": "0 張",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "核銷率",
            "value": "0.00%",
            "trend": "unavailable",
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "open_campaign",
        "label": "查看活動成效",
        "payload": {
          "campaign_id": "18"
        }
      }
    ],
    "reports": []
  }
}
```

#### 字卡／按鈕／畫面驗收

```json
{
  "card_status": "CRM 已完成發送",
  "next_action": "查看完整成效報告"
}
```

### 5. 於同一活動上下文詢問主推商品

#### 輸入

```json
{
  "user_message": "上週哪個商品最好？",
  "request": {
    "message": "上週哪個商品最好？",
    "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
    "timezone": "Asia/Taipei",
    "context": {
      "store_codes": []
    }
  }
}
```

#### 輸出

```json
{
  "status": null,
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": {
    "type": "marketing_campaign",
    "context_status": "active",
    "mode": "single_step",
    "status": "sent",
    "current_step": "completed",
    "campaign_id": "18",
    "source_text": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "revision": 1,
    "next_actions": [
      "open_campaign"
    ],
    "plan": {
      "campaign_name": "沉睡會員蛋糕喚回活動",
      "objective": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
      "product_focus": "蛋糕",
      "coupon": {
        "name": "蛋糕喚回 9 折優惠券",
        "channel": "store",
        "allowed_channels": [
          "store"
        ],
        "valid_days": 30,
        "point_cost": 1,
        "usage_scope": "蛋糕商品適用",
        "cyberbiz_coupon_type": "percent",
        "cyberbiz_coupon_value": 90,
        "cyberbiz_order_price_threshold": 0,
        "cyberbiz_tags": [
          "蛋糕",
          "沉睡會員",
          "喚回"
        ],
        "member_visible": false,
        "points_redeemable": false,
        "redeem_kind": "coupon"
      },
      "audience_filters": {
        "product_keyword": "蛋糕",
        "rfm_segments": [],
        "max_recency_days": 365,
        "require_line_bound": false,
        "purchase_timeframe_days": 730,
        "condition": {
          "version": "v1",
          "operator": "AND",
          "rules": [
            {
              "field": "purchase.product_name",
              "operator": "contains",
              "value": "蛋糕",
              "window_days": 730,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "member.has_email",
              "operator": "eq",
              "value": true,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "purchase.recency_days",
              "operator": "between",
              "value": [
                61,
                365
              ],
              "as_of_date": "2026-09-04"
            }
          ]
        }
      },
      "message_title": "沉睡會員蛋糕喚回｜限時 9 折",
      "message_content": "曾經喜歡的蛋糕，現在回來享 9 折優惠！會員專屬優惠券限時 30 天，歡迎再次品嚐。",
      "marketing_logic": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。"
    },
    "steps": []
  },
  "resolved_intent": {
    "task": "marketing_campaign_plan",
    "tool": {
      "tool": "recommend_campaign_product"
    }
  },
  "reply": {
    "text": "根據 全部門市 2026-08-24～2026-08-30 的 CRM 商品報表，目前最適合優先評估「芋泥卡士達布蕾6吋(O)」作為這次活動主推商品。",
    "confidence": 10,
    "cards": [
      {
        "type": "product_source",
        "title": "目前活動的商品建議",
        "description": "全部門市｜分析期間：2026-08-24～2026-08-30",
        "items": [
          {
            "label": "推薦商品",
            "value": "芋泥卡士達布蕾6吋(O)",
            "trend": "unavailable",
            "status": "normal",
            "description": "營收 5,575 元、銷量 4 件"
          },
          {
            "label": "推薦依據",
            "value": "營收排名第 1，近期變化 +100.0%",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "毛利率",
            "value": "54.4%",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "替代商品",
            "value": "果然芒芒 6吋(U)、中秋禮盒- A3綜合(U)",
            "trend": "unavailable",
            "status": "info"
          }
        ]
      }
    ],
    "actions": [
      {
        "type": "continue_chat",
        "label": "套用推薦商品",
        "payload": {
          "message": "請將這個活動的主推商品改為芋泥卡士達布蕾6吋(O)"
        }
      },
      {
        "type": "open_report",
        "label": "查看商品推薦報告",
        "payload": {
          "report_id": "crm-insight-2026-08-24-2026-08-30-all"
        }
      }
    ],
    "reports": [
      {
        "report_id": "crm-insight-2026-08-24-2026-08-30-all",
        "title": "AI 活動商品推薦報告",
        "summary": "建議先以 芋泥卡士達布蕾6吋(O) 做主商品，再依毛利與庫存確認優惠深度；此結果是商品報表推薦，不會自動修改目前活動。",
        "sections": [
          {
            "title": "推薦商品",
            "columns": [
              "商品",
              "營收",
              "銷量",
              "毛利率",
              "變化"
            ],
            "rows": [
              [
                "芋泥卡士達布蕾6吋(O)",
                "5,575 元",
                "4",
                "54.4%",
                "+100.0%"
              ],
              [
                "果然芒芒 6吋(U)",
                "5,340 元",
                "3",
                "31.8%",
                "+100.0%"
              ],
              [
                "中秋禮盒- A3綜合(U)",
                "4,085 元",
                "3",
                "49.1%",
                "+100.0%"
              ]
            ]
          },
          {
            "title": "活動使用提醒",
            "columns": [
              "項目"
            ],
            "rows": [
              [
                "套用推薦商品前，請確認活動客群、庫存、毛利與優惠門檻。"
              ]
            ]
          }
        ]
      }
    ]
  }
}
```

#### 字卡／按鈕／畫面驗收

```json
{
  "card_types": [
    "product_source"
  ],
  "action_types": [
    "continue_chat",
    "open_report"
  ],
  "apply_action": {
    "type": "continue_chat",
    "label": "套用推薦商品",
    "payload": {
      "message": "請將這個活動的主推商品改為芋泥卡士達布蕾6吋(O)"
    }
  },
  "next_step": "使用者點擊後帶入修改主推商品問句，仍需再次送出確認"
}
```

### 6. 同一對話追問活動成效

#### 輸入

```json
{
  "user_message": "活動 18 目前成效如何？請告訴我核銷率與活動營收。",
  "request": {
    "message": "活動 18 目前成效如何？請告訴我核銷率與活動營收。",
    "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
    "timezone": "Asia/Taipei",
    "context": {
      "store_codes": []
    }
  }
}
```

#### 輸出

```json
{
  "status": null,
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": null,
  "resolved_intent": {
    "task": "campaign_performance",
    "tool": {
      "tool": "analyze_campaign_performance"
    }
  },
  "reply": {
    "text": "活動已執行，已發券 355 張、核銷 0 張，目前核銷率 0.00%。",
    "confidence": 10,
    "cards": [
      {
        "type": "campaign_performance",
        "title": "AI 行銷成效分析",
        "description": "活動已執行，已發券 355 張、核銷 0 張，目前核銷率 0.00%。",
        "items": [
          {
            "label": "活動主題",
            "value": "沉睡會員蛋糕喚回活動",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "活動狀態",
            "value": "已執行",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "核銷率",
            "value": "0.0%",
            "trend": "unavailable",
            "status": "anomaly"
          },
          {
            "label": "活動營收",
            "value": "0 元",
            "unit": "營收",
            "trend": "unavailable",
            "status": "normal"
          },
          {
            "label": "30 天回購",
            "value": "CRM 尚未提供",
            "trend": "unavailable",
            "status": "unavailable"
          },
          {
            "label": "最佳商品",
            "value": "資料不可用",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "最佳通路",
            "value": "門市",
            "trend": "unavailable",
            "status": "info"
          },
          {
            "label": "同期比較",
            "value": "資料不可用",
            "trend": "unavailable",
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
          "report_id": "crm-campaign-performance-18"
        }
      }
    ],
    "reports": [
      {
        "report_id": "crm-campaign-performance-18",
        "title": "AI 行銷成效詳細報告",
        "summary": "活動已執行，已發券 355 張、核銷 0 張，目前核銷率 0.00%。",
        "sections": [
          {
            "title": "活動 KPI",
            "columns": [
              "指標",
              "數值"
            ],
            "rows": [
              [
                "活動主題",
                "沉睡會員蛋糕喚回活動"
              ],
              [
                "活動狀態",
                "已執行"
              ],
              [
                "目標客群",
                "355 人"
              ],
              [
                "已發送",
                "355 人"
              ],
              [
                "已使用",
                "0 人"
              ],
              [
                "核銷率",
                "0.0%"
              ],
              [
                "營收",
                "0 元"
              ],
              [
                "毛利",
                "資料不可用"
              ],
              [
                "ROI",
                "資料不可用"
              ],
              [
                "7 天回購率",
                "CRM 尚未提供"
              ],
              [
                "30 天回購率",
                "CRM 尚未提供"
              ]
            ]
          },
          {
            "title": "客群／商品／通路成效",
            "columns": [
              "維度",
              "項目",
              "轉換率",
              "營收"
            ],
            "rows": [
              [
                "通路",
                "門市",
                "0.00%",
                "0 元"
              ]
            ]
          },
          {
            "title": "今年／去年檔期比較",
            "columns": [
              "檔期",
              "客群",
              "轉換率",
              "營收",
              "30 天回購"
            ],
            "rows": [
              [
                "沉睡會員蛋糕喚回活動",
                "355 人",
                "0.00%",
                "0 元",
                "資料不可用"
              ]
            ]
          },
          {
            "title": "研究限制",
            "columns": [
              "項目"
            ],
            "rows": [
              [
                "CRM 找不到相同檔期的前次活動，暫無同期比較。"
              ],
              [
                "CRM 尚未提供可拆分的商品與客群成效資料。"
              ]
            ]
          },
          {
            "title": "改善建議",
            "columns": [
              "建議"
            ],
            "rows": [
              [
                "補充活動訂單歸因"
              ],
              [
                "於活動結束後 7／30 天追蹤回購"
              ]
            ]
          }
        ]
      }
    ]
  }
}
```

#### 字卡／按鈕／畫面驗收

```json
{
  "card_types": [
    "campaign_performance"
  ],
  "action_types": [
    "open_report"
  ],
  "report_screenshot": "05_performance_report.png"
}
```

### 7. 對話與 workflow 狀態保存

#### 輸入

```json
{
  "method": "GET",
  "url": "http://127.0.0.1:8002/api/v1/agent/conversations/conv_00773dc6865a4e5e85c74ccfe3137a36"
}
```

#### 輸出

```json
{
  "conversation_id": "conv_00773dc6865a4e5e85c74ccfe3137a36",
  "workflow": {
    "type": "marketing_campaign",
    "context_status": "suspended",
    "mode": "single_step",
    "status": "sent",
    "current_step": "completed",
    "campaign_id": "18",
    "source_text": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。",
    "revision": 1,
    "next_actions": [
      "open_campaign"
    ],
    "plan": {
      "campaign_name": "沉睡會員蛋糕喚回活動",
      "objective": "喚回曾購買蛋糕但近期未消費的沉睡會員，促進再次購買",
      "product_focus": "蛋糕",
      "coupon": {
        "name": "蛋糕喚回 9 折優惠券",
        "channel": "store",
        "allowed_channels": [
          "store"
        ],
        "valid_days": 30,
        "point_cost": 1,
        "usage_scope": "蛋糕商品適用",
        "cyberbiz_coupon_type": "percent",
        "cyberbiz_coupon_value": 90,
        "cyberbiz_order_price_threshold": 0,
        "cyberbiz_tags": [
          "蛋糕",
          "沉睡會員",
          "喚回"
        ],
        "member_visible": false,
        "points_redeemable": false,
        "redeem_kind": "coupon"
      },
      "audience_filters": {
        "product_keyword": "蛋糕",
        "rfm_segments": [],
        "max_recency_days": 365,
        "require_line_bound": false,
        "purchase_timeframe_days": 730,
        "condition": {
          "version": "v1",
          "operator": "AND",
          "rules": [
            {
              "field": "purchase.product_name",
              "operator": "contains",
              "value": "蛋糕",
              "window_days": 730,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "member.has_email",
              "operator": "eq",
              "value": true,
              "as_of_date": "2026-09-04"
            },
            {
              "field": "purchase.recency_days",
              "operator": "between",
              "value": [
                61,
                365
              ],
              "as_of_date": "2026-09-04"
            }
          ]
        }
      },
      "message_title": "沉睡會員蛋糕喚回｜限時 9 折",
      "message_content": "曾經喜歡的蛋糕，現在回來享 9 折優惠！會員專屬優惠券限時 30 天，歡迎再次品嚐。",
      "marketing_logic": "保留使用者明確指定的蛋糕偏好與 9 折優惠；因上一組客群為 0 人，放寬 AI 推導的沉睡定義與消費條件：將近期未消費範圍調整為 61～365 天，納入近 730 天內曾購買蛋糕的會員，並不額外限制金額、年齡、性別或 LINE 綁定。"
    },
    "steps": []
  },
  "message_count": 8,
  "message_roles": [
    "user",
    "assistant",
    "assistant",
    "assistant",
    "user",
    "assistant",
    "user",
    "assistant"
  ]
}
```

#### 驗收條件

```json
{
  "same_conversation": true,
  "campaign_id": "18",
  "analysis_reply_saved": true
}
```

## 測試截圖

### 服務啟動後的 Agent 前台

![01_initial.png](01_initial.png)

### 規劃字卡：客群預覽、規劃發想、決策重點與建立按鈕

![02_plan_ready.png](02_plan_ready.png)

### 使用者確認後建立 CRM 草稿

![03_draft_created.png](03_draft_created.png)

### 04_campaign_sent.png

![04_campaign_sent.png](04_campaign_sent.png)

### 活動上下文中的主推商品推薦字卡與套用按鈕

![04_product_recommendation.png](04_product_recommendation.png)

### 同一對話追問活動成效

![04_performance_card.png](04_performance_card.png)

### 成效完整報告（若本次資料提供報告）

![05_performance_report.png](05_performance_report.png)

## 結論

- CRM 草稿：`18`
- 對話：`conv_00773dc6865a4e5e85c74ccfe3137a36`
- 最終 workflow：`sent`
- 已驗證 Agent → CRM Adapter（HTTP）→ CRM Backend → dev DB 的基礎閉環。
- 流程驗收：`PASS`；資料一致性驗收：`PASS`。
- `建立活動草稿` 與 `發送優惠券` 都由使用者在獨立確認 Dialog 明確確認後才呼叫。
- 舊版 `scripts/e2e_marketing_flow.py` 仍假設規劃完成即有草稿，與目前確認式流程不一致；本報告使用新的基礎閉環腳本。

## 重跑命令

```bash
uv run --with playwright python scripts/e2e_basic_closed_loop.py
```
