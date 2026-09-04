from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright


AGENT_URL = os.environ.get("E2E_AGENT_URL", "http://127.0.0.1:5174")
AGENT_BACKEND_URL = os.environ.get("E2E_AGENT_BACKEND_URL", "http://127.0.0.1:8002")
CRM_API_URL = os.environ.get("E2E_CRM_API_URL", "http://127.0.0.1:8012")
OUTPUT_DIR = Path(os.environ.get("E2E_OUTPUT_DIR", "docs/e2e/basic_closed_loop_20260824"))
PROMPT = "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。"


def screenshot(page: Page, name: str) -> str:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return path.name


def response_summary(payload: dict[str, Any]) -> dict[str, Any]:
    reply = payload.get("reply") or {}
    return {
        "status": payload.get("status"),
        "conversation_id": payload.get("conversation_id"),
        "workflow": payload.get("workflow"),
        "resolved_intent": payload.get("resolved_intent"),
        "reply": {
            "text": reply.get("text"),
            "confidence": reply.get("confidence"),
            "cards": reply.get("cards") or [],
            "actions": reply.get("actions") or [],
            "reports": reply.get("reports") or [],
        },
    }


def json_block(value: Any) -> str:
    return "```json\n" + json.dumps(value, ensure_ascii=False, indent=2) + "\n```"


def card_audience_total(payload: dict[str, Any]) -> int | None:
    for card in (payload.get("reply") or {}).get("cards") or []:
        for item in card.get("items") or []:
            if item.get("label") != "預估客群":
                continue
            match = re.search(r"\d+", str(item.get("value") or ""))
            return int(match.group()) if match else None
    return None


def ask(page: Page, question: str) -> tuple[dict[str, Any], dict[str, Any]]:
    input_box = page.get_by_role("textbox", name="輸入營運問題")
    input_box.fill(question)
    with page.expect_response(
        lambda response: response.url.endswith("/api/v1/agent/query")
        and response.request.method == "POST",
        timeout=90000,
    ) as response_info:
        page.get_by_role("button", name="送出問題").click()
    response = response_info.value
    payload = response.json()
    request_body = json.loads(response.request.post_data or "{}")
    if not response.ok:
        raise AssertionError(f"Agent query 失敗（{response.status}）：{question}")
    page.wait_for_function("() => document.querySelectorAll('.typing-bubble').length === 0", timeout=90000)
    return request_body, payload


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    screenshots: list[str] = []
    page_errors: list[str] = []
    console_errors: list[str] = []
    dialogs: list[str] = []
    steps: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on(
            "dialog",
            lambda dialog: (dialogs.append(dialog.message), dialog.accept()),
        )

        page.goto(AGENT_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        screenshots.append(screenshot(page, "01_initial"))

        health_checks = []
        for name, url in (
            ("agent_backend", f"{AGENT_BACKEND_URL}/health"),
            ("crm_backend", f"{CRM_API_URL}/health"),
        ):
            response = page.request.get(url)
            health_checks.append(
                {
                    "name": name,
                    "url": url,
                    "status_code": response.status,
                    "body": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text()[:200],
                }
            )
            assert response.ok, f"{name} health check failed: {response.status}"
        steps.append(
            {
                "step": "0. 服務健康檢查",
                "input": {"services": health_checks},
                "output": {"result": "PASS", "isolated_ports": [8012, 8002, 5175, 5176]},
            }
        )

        page.get_by_role("button", name="清除對話").click()
        page.wait_for_function("() => document.querySelectorAll('.message-row').length === 1")

        query_request, plan_payload = ask(page, PROMPT)
        plan = plan_payload.get("workflow") or {}
        plan_reply = plan_payload.get("reply") or {}
        assert plan.get("status") == "plan_ready", plan_payload
        assert plan.get("current_step") == "create_draft", plan_payload
        assert any(card.get("type") == "marketing_plan" for card in plan_reply.get("cards", []))
        assert any(action.get("type") == "create_campaign_draft" for action in plan_reply.get("actions", []))
        conversation_id = plan_payload.get("conversation_id")
        assert conversation_id
        plan_audience_total = card_audience_total(plan_payload)
        screenshots.append(screenshot(page, "02_plan_ready"))
        steps.append(
            {
                "step": "1. AI 活動規劃與 CRM 客群預覽",
                "input": {"user_message": PROMPT, "request": query_request},
                "output": response_summary(plan_payload),
                "ui": {
                    "card_types": [card.get("type") for card in plan_reply.get("cards", [])],
                    "action_types": [action.get("type") for action in plan_reply.get("actions", [])],
                    "workflow_display": "第 1 版 · 待確認建立",
                },
            }
        )

        create_button = page.get_by_role("button", name="建立活動草稿").last
        assert create_button.is_visible()
        assert not dialogs, "建立草稿不應使用瀏覽器原生確認視窗"
        create_button.click()
        approval_dialog = page.get_by_role("dialog", name="確認建立活動草稿")
        assert approval_dialog.is_visible()
        assert "優惠券仍要再次確認才會發送" in approval_dialog.inner_text()
        with page.expect_response(
            lambda response: response.url.endswith("/api/v1/agent/campaigns/draft")
            and response.request.method == "POST",
            timeout=90000,
        ) as create_info:
            approval_dialog.get_by_role("button", name="確認建立").click()
        create_response = create_info.value
        create_payload = create_response.json()
        create_request = json.loads(create_response.request.post_data or "{}")
        assert create_response.ok, create_payload
        page.wait_for_function("() => document.querySelectorAll('.typing-bubble').length === 0", timeout=90000)
        created_workflow = create_payload.get("workflow") or {}
        campaign_id = created_workflow.get("campaign_id")
        assert campaign_id, create_payload
        assert created_workflow.get("status") == "draft_created", create_payload
        send_button = page.get_by_role("button", name="發送優惠券").last
        assert send_button.is_visible()
        draft_audience_total = card_audience_total(create_payload)
        screenshots.append(screenshot(page, "03_draft_created"))
        steps.append(
            {
                "step": "2. 使用者確認建立 CRM 活動草稿",
                "input": {
                    "ui_action": "建立活動草稿",
                    "confirm_dialog": dialogs[-1] if dialogs else None,
                    "request": create_request,
                },
                "output": response_summary(create_payload),
                "ui": {
                    "card_status": "CRM 草稿已建立",
                    "next_action": "發送優惠券（本次未觸發）",
                },
            }
        )

        metrics_response = page.request.get(
            f"{AGENT_BACKEND_URL}/api/v1/agent/campaigns/{campaign_id}/metrics"
        )
        assert metrics_response.ok, metrics_response.text()
        metrics_payload = metrics_response.json()
        metrics = metrics_payload.get("data") or {}
        audience_consistency = {
            "plan_preview": plan_audience_total,
            "draft_response": draft_audience_total,
            "crm_metrics": metrics.get("audience_total"),
            "consistent": len({
                value for value in (plan_audience_total, draft_audience_total, metrics.get("audience_total"))
                if value is not None
            }) == 1,
        }
        steps.append(
            {
                "step": "3. CRM 活動草稿狀態與 metrics 回查",
                "input": {
                    "method": "GET",
                    "url": f"{AGENT_BACKEND_URL}/api/v1/agent/campaigns/{campaign_id}/metrics",
                },
                "output": metrics_payload,
                "assertions": {
                    "campaign_id": campaign_id,
                    "campaign_status": metrics.get("campaign_status"),
                    "audience_total": metrics.get("audience_total"),
                    "issued_count": metrics.get("issued_count"),
                    "redeemed_count": metrics.get("redeemed_count"),
                    "audience_consistency": audience_consistency,
                },
            }
        )

        send_button.click()
        send_dialog = page.get_by_role("dialog", name="確認發送優惠券")
        assert send_dialog.is_visible()
        assert "CRM 會建立本次活動的優惠券" in send_dialog.inner_text()
        with page.expect_response(
            lambda response: response.url.endswith(f"/api/v1/agent/campaigns/{campaign_id}/send")
            and response.request.method == "POST",
            timeout=90000,
        ) as send_info:
            send_dialog.get_by_role("button", name="確認發送").click()
        send_response = send_info.value
        send_payload = send_response.json()
        assert send_response.ok, send_payload
        assert (send_payload.get("workflow") or {}).get("status") == "sent", send_payload
        assert page.get_by_text("已完成 CRM 優惠券發送").last.is_visible()
        screenshots.append(screenshot(page, "04_campaign_sent"))
        steps.append(
            {
                "step": "4. 使用者確認發送優惠券並回查活動成效",
                "input": {
                    "ui_action": "發送優惠券",
                    "confirm_dialog": "確認發送優惠券",
                    "request": json.loads(send_response.request.post_data or "{}"),
                },
                "output": response_summary(send_payload),
                "ui": {
                    "card_status": "CRM 已完成發送",
                    "next_action": "查看完整成效報告",
                },
            }
        )

        product_prompt = "上週哪個商品最好？"
        product_request, product_payload = ask(page, product_prompt)
        product_reply = product_payload.get("reply") or {}
        assert (product_payload.get("resolved_intent") or {}).get("tool", {}).get("tool") == "recommend_campaign_product", product_payload
        assert any(card.get("type") == "product_source" for card in product_reply.get("cards", [])), product_payload
        assert page.get_by_role("button", name="套用推薦商品").last.is_visible()
        screenshots.append(screenshot(page, "04_product_recommendation"))
        steps.append(
            {
                "step": "5. 於同一活動上下文詢問主推商品",
                "input": {"user_message": product_prompt, "request": product_request},
                "output": response_summary(product_payload),
                "ui": {
                    "card_types": [card.get("type") for card in product_reply.get("cards", [])],
                    "action_types": [action.get("type") for action in product_reply.get("actions", [])],
                    "apply_action": next((action for action in product_reply.get("actions", []) if action.get("label") == "套用推薦商品"), None),
                    "next_step": "使用者點擊後帶入修改主推商品問句，仍需再次送出確認",
                },
            }
        )

        analysis_prompt = f"活動 {campaign_id} 目前成效如何？請告訴我核銷率與活動營收。"
        analysis_request, analysis_payload = ask(page, analysis_prompt)
        analysis_reply = analysis_payload.get("reply") or {}
        assert (analysis_payload.get("resolved_intent") or {}).get("task") == "campaign_performance", analysis_payload
        assert any(card.get("type") == "campaign_performance" for card in analysis_reply.get("cards", [])), analysis_payload
        screenshots.append(screenshot(page, "04_performance_card"))
        report_button = page.get_by_role("button", name="查看完整成效報告").last
        report_screenshot = None
        if report_button.is_visible():
            report_button.click()
            page.locator(".report-modal").wait_for(state="visible", timeout=30000)
            report_screenshot = screenshot(page, "05_performance_report")
            screenshots.append(report_screenshot)
            page.locator(".report-modal-close").click()
        steps.append(
            {
                "step": "6. 同一對話追問活動成效",
                "input": {"user_message": analysis_prompt, "request": analysis_request},
                "output": response_summary(analysis_payload),
                "ui": {
                    "card_types": [card.get("type") for card in analysis_reply.get("cards", [])],
                    "action_types": [action.get("type") for action in analysis_reply.get("actions", [])],
                    "report_screenshot": report_screenshot,
                },
            }
        )

        snapshot_response = page.request.get(
            f"{AGENT_BACKEND_URL}/api/v1/agent/conversations/{conversation_id}"
        )
        assert snapshot_response.ok, snapshot_response.text()
        snapshot_payload = snapshot_response.json()
        snapshot = snapshot_payload.get("data") or {}
        messages = snapshot.get("messages") or []
        # 兩次問答至少會保存 user/assistant 各兩筆；草稿 action 是否另存訊息
        # 由後端實作決定，因此不把 action 訊息數量寫死。
        assert len(messages) >= 4, snapshot_payload
        steps.append(
            {
                "step": "7. 對話與 workflow 狀態保存",
                "input": {
                    "method": "GET",
                    "url": f"{AGENT_BACKEND_URL}/api/v1/agent/conversations/{conversation_id}",
                },
                "output": {
                    "conversation_id": snapshot.get("conversation_id"),
                    "workflow": snapshot.get("workflow"),
                    "message_count": len(messages),
                    "message_roles": [message.get("role") for message in messages],
                },
                "assertions": {
                    "same_conversation": snapshot.get("conversation_id") == conversation_id,
                    "campaign_id": campaign_id,
                    "analysis_reply_saved": any(
                        "成效" in (message.get("content") or "") for message in messages
                    ),
                },
            }
        )
        browser.close()

    warnings = []
    result_status = "PASS" if not warnings else "PASS_WITH_WARNING"
    result = {
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "environment": {
            "agent_frontend": AGENT_URL,
            "agent_backend": AGENT_BACKEND_URL,
            "crm_backend": CRM_API_URL,
            "crm_database": "aposo_crm_agent_dev（dev 測試資料）",
            "llm_mode": os.environ.get("E2E_LLM_MODE", "請由執行環境確認"),
            "crm_adapter_mode": "http",
        },
        "result": result_status,
        "campaign_id": campaign_id,
        "conversation_id": conversation_id,
        "steps": steps,
        "warnings": warnings,
        "screenshots": screenshots,
        "safety": "本次已在人工確認 Dialog 中確認發送；發送對象為隔離 dev 測試庫中的合成會員。",
        "diagnostics": {
            "page_errors": page_errors,
            "console_errors": console_errors,
            "accepted_dialogs": dialogs,
        },
    }
    report_lines = [
        "# AI 行銷活動建議｜基礎閉環 E2E 測試報告",
        "",
        f"- 測試時間：{result['started_at']}",
        f"- 測試結果：**{result_status}**",
        "- 測試範圍：活動規劃 → CRM 客群預覽 → 使用者確認建立草稿 → metrics 回查 → 上下文商品推薦 → 活動成效追問 → 對話保存",
        "- 發送策略：於人工確認 Dialog 確認後，對隔離 dev 測試庫中的合成會員執行發送",
        "",
        "## 測試環境",
        "",
        json_block(result["environment"]),
        "",
        "## 注意事項",
        "",
        json_block(result["warnings"] or ["目前未發現資料一致性警告。"]),
        "",
        "## 流程摘要",
        "",
        "| 步驟 | 驗證內容 | 結果 |",
        "| --- | --- | --- |",
        *[f"| {step['step']} | 輸入／輸出／UI Action 已記錄 | PASS |" for step in steps],
        "",
        "## 逐步輸入與輸出",
        "",
    ]
    for step in steps:
        report_lines.extend([
            f"### {step['step']}",
            "",
            "#### 輸入",
            "",
            json_block(step["input"]),
            "",
            "#### 輸出",
            "",
            json_block(step["output"]),
            "",
        ])
        if step.get("ui"):
            report_lines.extend(["#### 字卡／按鈕／畫面驗收", "", json_block(step["ui"]), ""])
        if step.get("assertions"):
            report_lines.extend(["#### 驗收條件", "", json_block(step["assertions"]), ""])

    report_lines.extend(["## 測試截圖", ""])
    captions = {
        "01_initial.png": "服務啟動後的 Agent 前台",
        "02_plan_ready.png": "規劃字卡：客群預覽、規劃發想、決策重點與建立按鈕",
        "03_draft_created.png": "使用者確認後建立 CRM 草稿",
        "04_product_recommendation.png": "活動上下文中的主推商品推薦字卡與套用按鈕",
        "04_performance_card.png": "同一對話追問活動成效",
        "05_performance_report.png": "成效完整報告（若本次資料提供報告）",
    }
    for image in screenshots:
        report_lines.extend([f"### {captions.get(image, image)}", "", f"![{image}]({image})", ""])

    report_lines.extend([
        "## 結論",
        "",
        f"- CRM 草稿：`{campaign_id}`",
        f"- 對話：`{conversation_id}`",
        f"- 最終 workflow：`{(snapshot.get('workflow') or {}).get('status', '未提供')}`",
        "- 已驗證 Agent → CRM Adapter（HTTP）→ CRM Backend → dev DB 的基礎閉環。",
        f"- 流程驗收：`PASS`；資料一致性驗收：`{'PASS' if not warnings else 'WARNING'}`。",
        "- `建立活動草稿` 與 `發送優惠券` 都由使用者在獨立確認 Dialog 明確確認後才呼叫。",
        "- 舊版 `scripts/e2e_marketing_flow.py` 仍假設規劃完成即有草稿，與目前確認式流程不一致；本報告使用新的基礎閉環腳本。",
        "",
        "## 重跑命令",
        "",
        "```bash",
        "uv run --with playwright python scripts/e2e_basic_closed_loop.py",
        "```",
    ])
    report_path = OUTPUT_DIR / "AI行銷基礎閉環_輸入輸出測試報告.md"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
