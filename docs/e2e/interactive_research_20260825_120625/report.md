# 互動式行銷研究 Workflow E2E 報告

結果：PASS

| 步驟 | 輸入 | 主要驗證 | 截圖 |
| --- | --- | --- | --- |
| 1. 去年檔期分析 | `先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。` | PASS | `02_historical_analysis.png` |
| 2. 今年活動規劃與客群預覽 | `根據去年分析規劃今年母親節活動` | PASS | `03_campaign_plan.png` |
| 3. 策略研究設定草稿 | `建立今年活動的策略研究設定` | PASS | `04_strategy_design.png` |

## API 與 UI 紀錄

```json
[
  {
    "step": "1. 去年檔期分析",
    "input": {
      "message": "先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。",
      "request": {
        "message": "先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。",
        "timezone": "Asia/Taipei",
        "context": {
          "store_codes": []
        }
      }
    },
    "output": {
      "status": null,
      "resolved_intent": {
        "task": "marketing_insights",
        "tool": {
          "tool": "analyze_historical_campaign"
        }
      },
      "workflow": {
        "type": "marketing_campaign",
        "context_status": "active",
        "status": "historical_analyzed",
        "current_step": "review_historical",
        "event_name": "母親節",
        "historical_report_id": "historical-crm-insight-2025-04-01-2025-05-31-all",
        "source_text": "先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。",
        "revision": 1,
        "next_actions": [
          "continue_chat"
        ]
      },
      "reply": {
        "text": "已完成去年檔期分析（2025-04-01～2025-05-31）。接下來可以依照這份基線規劃今年活動，再設定提前觸達策略的比較研究。",
        "cards": [
          {
            "type": "marketing_insight",
            "title": "去年檔期分析",
            "description": "分析期間：2025-04-01～2025-05-31",
            "items": [
              {
                "label": "Top 商品",
                "value": "資料不可用",
                "trend": "unavailable",
                "status": "unavailable"
              },
              {
                "label": "最高營收通路",
                "value": "pos",
                "trend": "unavailable",
                "status": "normal"
              },
              {
                "label": "資料用途",
                "value": "今年活動規劃基線",
                "trend": "unavailable",
                "status": "info"
              }
            ]
          }
        ],
        "actions": [
          {
            "type": "open_report",
            "label": "查看去年分析報告",
            "payload": {
              "report_id": "historical-crm-insight-2025-04-01-2025-05-31-all"
            }
          },
          {
            "type": "continue_chat",
            "label": "根據去年分析規劃今年活動",
            "payload": {
              "message": "根據去年分析規劃今年母親節活動"
            }
          }
        ],
        "reports": [
          {
            "report_id": "historical-crm-insight-2025-04-01-2025-05-31-all",
            "title": "去年檔期行銷分析報告",
            "summary": "已完成去年檔期基線分析；這份報告可作為今年活動假設的依據，不代表今年策略已被證明有效。",
            "sections": [
              {
                "title": "去年檔期摘要",
                "columns": [
                  "項目",
                  "結果"
                ],
                "rows": [
                  [
                    "分析期間",
                    "2025-04-01～2025-05-31"
                  ],
                  [
                    "Top 商品",
                    "資料不可用"
                  ],
                  [
                    "最高營收通路",
                    "pos"
                  ],
                  [
                    "最高營收門市",
                    "中壢門市"
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
                    "去年資料只提供觀察基線，不能單獨證明今年策略造成增量。"
                  ],
                  [
                    "下一步需設定實驗組、對照組與主要指標。"
                  ]
                ]
              }
            ]
          }
        ]
      }
    }
  },
  {
    "step": "2. 今年活動規劃與客群預覽",
    "input": {
      "message": "根據去年分析規劃今年母親節活動",
      "request": {
        "message": "根據去年分析規劃今年母親節活動",
        "conversation_id": "conv_fdef947d302345bfb8e0a9d27e13a2b9",
        "timezone": "Asia/Taipei",
        "context": {
          "store_codes": []
        }
      }
    },
    "output": {
      "status": null,
      "resolved_intent": {
        "task": "marketing_campaign_plan",
        "tool": {
          "tool": "create_marketing_campaign"
        }
      },
      "workflow": {
        "type": "marketing_campaign",
        "context_status": "active",
        "status": "plan_ready",
        "current_step": "create_draft",
        "event_name": "母親節",
        "historical_report_id": "historical-crm-insight-2025-04-01-2025-05-31-all",
        "source_text": "根據去年分析規劃今年母親節活動",
        "revision": 2,
        "next_actions": [
          "create_campaign_draft",
          "continue_chat"
        ],
        "plan": {
          "campaign_name": "母親節精選商品感謝回饋活動",
          "objective": "以母親節送禮情境帶動精選商品銷售，並提升符合消費條件的會員回購。",
          "event_name": "母親節",
          "coupon": {
            "name": "母親節會員9折",
            "channel": "store",
            "allowed_channels": [
              "store"
            ],
            "valid_days": 30,
            "point_cost": 1,
            "usage_scope": "all",
            "cyberbiz_coupon_type": "percent",
            "cyberbiz_coupon_value": 90,
            "cyberbiz_order_price_threshold": 0,
            "cyberbiz_tags": [],
            "member_visible": false,
            "points_redeemable": false,
            "redeem_kind": "coupon"
          },
          "audience_filters": {
            "rfm_segments": [],
            "require_line_bound": false
          },
          "message_title": "母親節會員專屬精選商品優惠",
          "message_content": "母親節送禮推薦，會員專屬精選商品9折，限時回饋。",
          "marketing_logic": "以母親節送禮與家庭聚會需求作為活動切入，保留符合消費條件的會員與精選商品條件，透過9折降低回購門檻，再以限時檔期創造購買理由。"
        }
      },
      "reply": {
        "text": "已依你的需求完成「母親節精選商品感謝回饋活動」活動規劃。\n規劃發想：以母親節送禮與家庭聚會需求作為活動切入，保留符合消費條件的會員與精選商品條件，透過9折降低回購門檻，再以限時檔期創造購買理由。\n決策重點：客群鎖定符合消費條件的會員；主推依活動條件推薦；提供9 折；以門市為主要通路；活動期間30天。\n目前預估 480 位會員符合條件，請確認後建立 CRM 活動草稿。",
        "cards": [
          {
            "type": "marketing_plan",
            "title": "AI 行銷活動規劃",
            "description": "已完成 CRM 客群預覽，請確認後建立活動草稿。",
            "items": [
              {
                "label": "活動主題",
                "value": "母親節精選商品感謝回饋活動",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "目標客群",
                "value": "符合消費條件的會員",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "預估客群",
                "value": "480 人",
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
                "value": "以母親節送禮情境帶動精選商品銷售，並提升符合消費條件的會員回購。",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "規劃發想",
                "value": "以母親節送禮與家庭聚會需求作為活動切入，保留符合消費條件的會員與精選商品條件，透過9折降低回購門檻，再以限時檔期創造購買理由。",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "決策重點",
                "value": "客群鎖定符合消費條件的會員；主推依活動條件推薦；提供9 折；以門市為主要通路；活動期間30天。",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "主推商品",
                "value": "依活動條件推薦",
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
            "label": "建立策略研究設定",
            "payload": {
              "message": "建立今年活動的策略研究設定"
            }
          }
        ],
        "reports": []
      }
    }
  },
  {
    "step": "3. 策略研究設定草稿",
    "input": {
      "message": "建立今年活動的策略研究設定",
      "request": {
        "message": "建立今年活動的策略研究設定",
        "conversation_id": "conv_fdef947d302345bfb8e0a9d27e13a2b9",
        "timezone": "Asia/Taipei",
        "context": {
          "store_codes": []
        }
      }
    },
    "output": {
      "status": null,
      "resolved_intent": {
        "task": "strategy_research",
        "tool": {
          "tool": "prepare_strategy_study"
        }
      },
      "workflow": {
        "type": "marketing_campaign",
        "context_status": "active",
        "status": "research_ready",
        "current_step": "design_research",
        "event_name": "母親節",
        "historical_report_id": "historical-crm-insight-2025-04-01-2025-05-31-all",
        "source_text": "建立今年活動的策略研究設定",
        "revision": 3,
        "next_actions": [
          "create_campaign_draft",
          "continue_chat"
        ],
        "plan": {
          "campaign_name": "母親節精選商品感謝回饋活動",
          "objective": "以母親節送禮情境帶動精選商品銷售，並提升符合消費條件的會員回購。",
          "event_name": "母親節",
          "coupon": {
            "name": "母親節會員9折",
            "channel": "store",
            "allowed_channels": [
              "store"
            ],
            "valid_days": 30,
            "point_cost": 1,
            "usage_scope": "all",
            "cyberbiz_coupon_type": "percent",
            "cyberbiz_coupon_value": 90,
            "cyberbiz_order_price_threshold": 0,
            "cyberbiz_tags": [],
            "member_visible": false,
            "points_redeemable": false,
            "redeem_kind": "coupon"
          },
          "audience_filters": {
            "rfm_segments": [],
            "require_line_bound": false
          },
          "message_title": "母親節會員專屬精選商品優惠",
          "message_content": "母親節送禮推薦，會員專屬精選商品9折，限時回饋。",
          "marketing_logic": "以母親節送禮與家庭聚會需求作為活動切入，保留符合消費條件的會員與精選商品條件，透過9折降低回購門檻，再以限時檔期創造購買理由。"
        },
        "research_query": {
          "campaign_id": "planned-campaign",
          "scenario_type": "seasonal_timing",
          "event_name": "母親節",
          "objective": "驗證兩種行銷策略的增量成效",
          "hypothesis": "提前規劃並分階段觸達，會比只在檔期前觸達帶來更高增量轉換。",
          "primary_metric": "conversion_rate",
          "treatment_label": "提前四週分階段觸達",
          "control_label": "提前兩週觸達",
          "treatment_touch_weeks": 4,
          "control_touch_weeks": 2,
          "simulation": true
        }
      },
      "reply": {
        "text": "已完成母親節活動的策略研究設定。目前只產生可審核草稿，待活動建立後執行。",
        "cards": [
          {
            "type": "strategy_research",
            "title": "今年活動策略研究設定",
            "description": "待確認，尚未建立 CRM 研究或發送優惠券。",
            "items": [
              {
                "label": "研究情境",
                "value": "母親節",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "研究假設",
                "value": "提前規劃並分階段觸達，會比只在檔期前觸達帶來更高增量轉換。",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "實驗組",
                "value": "提前四週分階段觸達",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "對照組",
                "value": "提前兩週觸達",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "主要指標",
                "value": "conversion_rate",
                "trend": "unavailable",
                "status": "info"
              },
              {
                "label": "資料狀態",
                "value": "待活動建立後執行",
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
            "label": "確認研究設定",
            "payload": {
              "message": "確認這份策略研究設定"
            }
          },
          {
            "type": "continue_chat",
            "label": "調整研究條件",
            "payload": {
              "message": "調整策略研究設定"
            }
          }
        ],
        "reports": [
          {
            "report_id": "strategy-design-planned-campaign",
            "title": "AI 行銷活動策略研究設定",
            "summary": "研究設定已完成，待活動草稿建立並經主管確認後，才會執行實驗與產出成效報告。",
            "sections": [
              {
                "title": "研究設定",
                "columns": [
                  "項目",
                  "內容"
                ],
                "rows": [
                  [
                    "研究情境",
                    "母親節"
                  ],
                  [
                    "研究目標",
                    "驗證兩種行銷策略的增量成效"
                  ],
                  [
                    "研究假設",
                    "提前規劃並分階段觸達，會比只在檔期前觸達帶來更高增量轉換。"
                  ],
                  [
                    "主要指標",
                    "conversion_rate"
                  ]
                ]
              },
              {
                "title": "實驗設計",
                "columns": [
                  "組別",
                  "觸達策略"
                ],
                "rows": [
                  [
                    "實驗組",
                    "提前四週分階段觸達（4 週）"
                  ],
                  [
                    "對照組",
                    "提前兩週觸達（2 週）"
                  ],
                  [
                    "分組原則",
                    "同一客群池隨機分組，盡量固定渠道、優惠與預算"
                  ]
                ]
              },
              {
                "title": "執行限制",
                "columns": [
                  "項目"
                ],
                "rows": [
                  [
                    "目前為設定草稿，尚未建立 CRM 活動或發布研究。"
                  ],
                  [
                    "POC 可驗證流程與資料流，不能單獨證明策略有效。"
                  ]
                ]
              }
            ]
          }
        ]
      }
    },
    "assertion": "未建立 CRM 草稿、未發布策略研究、未發送優惠券"
  }
]
```
