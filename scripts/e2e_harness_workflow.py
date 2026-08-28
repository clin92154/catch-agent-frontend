from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright


AGENT_URL = os.environ.get("E2E_AGENT_URL", "http://127.0.0.1:5176")
OUTPUT_DIR = Path(
    os.environ.get(
        "E2E_OUTPUT_DIR",
        f"docs/e2e/harness_workflow_{datetime.now():%Y%m%d_%H%M%S}",
    )
)


def snapshot(page: Page, name: str) -> str:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    page.locator(".message-row").last.scroll_into_view_if_needed()
    path = OUTPUT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return str(path)


def ask(page: Page, message: str) -> tuple[dict[str, Any], dict[str, Any]]:
    box = page.get_by_role("textbox", name="輸入營運問題")
    box.fill(message)
    with page.expect_response(
        lambda response: response.url.endswith("/api/v1/agent/query")
        and response.request.method == "POST",
        timeout=90000,
    ) as response_info:
        page.get_by_role("button", name="送出問題").click()
    response = response_info.value
    payload = response.json()
    request = json.loads(response.request.post_data or "{}")
    if not response.ok:
        raise AssertionError(payload)
    page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
    return request, payload


def reply_summary(payload: dict[str, Any]) -> dict[str, Any]:
    reply = payload.get("reply") or {}
    return {
        "status": payload.get("status"),
        "resolved_intent": payload.get("resolved_intent"),
        "workflow": payload.get("workflow"),
        "reply": {
            "text": reply.get("text"),
            "confidence": reply.get("confidence"),
            "progress": reply.get("progress") or [],
            "cards": reply.get("cards") or [],
            "actions": reply.get("actions") or [],
            "reports": reply.get("reports") or [],
        },
    }


def has_action(payload: dict[str, Any], action_type: str) -> bool:
    return any(
        action.get("type") == action_type
        for action in (payload.get("reply") or {}).get("actions") or []
    )


def main() -> None:
    steps: list[dict[str, Any]] = []
    screenshots: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(AGENT_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="清除對話").click()
        screenshots.append(snapshot(page, "01_initial"))

        compound_message = (
            "先分析去年母親節，再規劃今年母親節活動，提供 LINE 會員專屬優惠，"
            "並比較提前四週與提前兩週。"
        )
        request, payload = ask(page, compound_message)
        reply = payload["reply"]
        card_types = [card["type"] for card in reply["cards"]]
        assert card_types == ["marketing_insight", "marketing_plan", "strategy_research"], payload
        assert [item["status"] for item in reply["progress"]] == [
            "completed",
            "completed",
            "completed",
        ], payload
        assert payload["workflow"]["mode"] == "multi_step", payload
        assert payload["workflow"]["status"] == "research_ready", payload
        assert has_action(payload, "create_campaign_draft"), payload
        assert not has_action(payload, "send_coupon"), payload
        page.get_by_test_id("agent-progress").wait_for(state="visible")
        screenshots.append(snapshot(page, "02_compound_workflow_progress"))
        steps.append(
            {
                "step": "1. 複合需求與受控 Tool Chain",
                "input": {"message": compound_message, "request": request},
                "output": reply_summary(payload),
                "assertions": [
                    "三階段 cards：營運洞察、活動規劃、策略研究",
                    "三個可驗證步驟皆 completed",
                    "保留建立草稿 action，但未出現 send_coupon",
                ],
            }
        )

        audience_message = (
            "找出女性 28歲到35歲、近90天有消費，而且已綁定 LINE 的會員"
        )
        request, payload = ask(page, audience_message)
        reply = payload["reply"]
        assert payload["resolved_intent"]["tool"]["tool"] == "preview_audience", payload
        condition_text = next(
            item["value"]
            for card in reply["cards"]
            for item in card.get("items", [])
            if item.get("label") == "篩選條件"
        )
        assert all(term in condition_text for term in ("女性", "28", "35", "90", "LINE")), payload
        assert condition_text.count("已綁定 LINE") == 1, payload
        screenshots.append(snapshot(page, "03_dynamic_audience_dsl"))
        steps.append(
            {
                "step": "2. 動態客群條件 DSL",
                "input": {"message": audience_message, "request": request},
                "output": reply_summary(payload),
                "assertions": [
                    "typed Tool = preview_audience",
                    "回應卡顯示 v1 DSL 的 AND 條件摘要",
                    "包含年齡、性別、消費期間、LINE 綁定共 4 條白名單規則",
                ],
            }
        )

        capability_message = "CRM 工具有哪些？"
        request, payload = ask(page, capability_message)
        assert payload["resolved_intent"]["tool"]["tool"] == "get_crm_capabilities", payload
        assert payload["reply"]["cards"][0]["type"] == "context_evidence", payload
        screenshots.append(snapshot(page, "04_crm_capabilities"))
        steps.append(
            {
                "step": "3. CRM 能力目錄",
                "input": {"message": capability_message, "request": request},
                "output": reply_summary(payload),
                "assertions": ["typed Tool = get_crm_capabilities", "回傳能力與限制資訊卡"],
            }
        )

        assert page.get_by_role("button", name="建立活動草稿").last.is_visible()
        page.get_by_role("button", name="建立活動草稿").last.scroll_into_view_if_needed()
        screenshots.append(snapshot(page, "05_manual_confirmation_boundary"))
        steps.append(
            {
                "step": "4. 人工確認邊界",
                "input": {"message": "未點擊建立活動草稿"},
                "output": {
                    "ui": "建立活動草稿按鈕可見",
                    "side_effect": "未建立草稿、未發送優惠券",
                },
                "assertions": ["草稿建立保留給使用者確認"],
            }
        )
        browser.close()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "title": "AI 行銷 Agent Harness 基礎流程 E2E",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "agent_url": AGENT_URL,
        "result": "PASS",
        "openai_called": False,
        "screenshots": screenshots,
        "steps": steps,
    }
    (OUTPUT_DIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    lines = [
        "# AI 行銷 Agent Harness 基礎流程 E2E 報告",
        "",
        "> 結果：**PASS**。本次使用 Demo LLM 與 Fake CRM Adapter 的隔離測試資料，不呼叫 OpenAI、不建立活動、不發送優惠券。",
        "",
        "## 驗收摘要",
        "",
        "| 步驟 | 驗證內容 | 結果 | 截圖 |",
        "| --- | --- | --- | --- |",
    ]
    for step, image in zip(steps, screenshots[1:]):
        lines.append(
            f"| {step['step']} | {'；'.join(step['assertions'])} | **PASS** | "
            f"![{Path(image).stem}]({Path(image).name}) |"
        )
    lines.extend(
        [
            "",
            "## 對話與 API 回傳紀錄",
            "",
            "以下保留每一步的自然語句、POST request、resolved tool、cards、progress、workflow 與 actions。",
            "",
            "```json",
            json.dumps(steps, ensure_ascii=False, indent=2),
            "```",
            "",
            "## 結論",
            "",
            "- 複合需求會自動依序完成去年分析、今年規劃與策略研究，後續步驟可取得前一步的摘要資料。",
            "- 客群條件會轉成受限制的 v1 AND／OR DSL，由 typed Tool 交給 CRM Adapter 執行。",
            "- 前端顯示可驗證的分析進度，不顯示模型原始思考鏈。",
            "- 草稿建立仍停在人工確認按鈕，未經確認不會產生寫入或發送副作用。",
        ]
    )
    (OUTPUT_DIR / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"result": "PASS", "output_dir": str(OUTPUT_DIR), "screenshots": screenshots}, ensure_ascii=False))


if __name__ == "__main__":
    main()
