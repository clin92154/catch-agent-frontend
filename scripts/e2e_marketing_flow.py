from __future__ import annotations

import json
import os
import re
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:5176")
OUTPUT_DIR = Path(os.environ.get("E2E_OUTPUT_DIR", "docs/e2e"))
SCREENSHOT_DIR = OUTPUT_DIR / "screenshots"
CAMPAIGN_PROMPT = "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。"


def screenshot(page: Page, name: str) -> str:
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return path.name


def write_report(result: dict) -> None:
    screenshots = result["screenshots"]
    report_lines = [
        "# AI 行銷規劃 Demo｜Frontend E2E 測試報告",
        "",
        f"- 測試時間：{result['started_at']}",
        f"- 測試入口：`{BASE_URL}`",
        "- 測試範圍：快速提問、AI 行銷規劃字卡、活動草稿詳情、同一對話調整活動、狀態保存、清除對話、API 錯誤呈現",
        "- 驗收結果：**通過**",
        "",
        "## 測試摘要",
        "",
        "| Flow | 結果 |",
        "| --- | --- |",
        "| 首頁與輸入框 | PASS |",
        "| AI 行銷規劃字卡 | PASS |",
        "| 查看活動草稿 | PASS |",
        "| 同一對話調整活動條件 | PASS |",
        "| 對話與活動進度保存 | PASS |",
        "| 清除後重新開始新對話 | PASS |",
        "| 清除對話 | PASS |",
        "| API 錯誤訊息 | PASS |",
        "",
        "## 流程截圖",
        "",
    ]
    captions = {
        "01_initial": "1. 首頁：歡迎訊息、快速提問與輸入框",
        "02_reload_restore": "2. 頁面重新整理：還原已保存的對話與活動進度",
        "02_marketing_plan": "3. AI 行銷規劃：活動字卡與操作按鈕",
        "03_campaign_detail": "4. 活動草稿詳情：顯示活動摘要與待確認狀態",
        "04_adjustment_prefilled": "5. 調整活動條件：操作按鈕帶入輸入框，等待使用者補充",
        "05_adjustment_response": "6. 將活動改成父親節後重新送出：取得新的活動規劃字卡",
        "06_clear_conversation": "7. 清除對話：回到初始狀態",
        "07_api_error": "8. API 失敗：顯示可理解的錯誤訊息",
    }
    for name in screenshots:
        stem = Path(name).stem
        report_lines.extend([f"### {captions.get(stem, stem)}", "", f"![{stem}](screenshots/{name})", ""])

    report_lines.extend(
        [
            "## 實際驗證資料",
            "",
            f"- CRM 草稿編號：`{result['campaign_id']}`",
            f"- CRM 最新狀態：`{result['crm_metrics']['campaign_status']}`，客群 `{result['crm_metrics']['audience_total']}` 人，已發送 `{result['crm_metrics']['issued_count']}` 人，已使用 `{result['crm_metrics']['redeemed_count']}` 人",
            f"- 對話識別碼：`{result['conversation_id']}`",
            f"- 活動規劃版本：`{result['workflow_revision']}`",
            f"- 已保存訊息數：`{result['saved_message_count']}`",
            f"- 字卡內容：{result['campaign_card_text']}",
            f"- Browser page errors：`{len(result['page_errors'])}`",
            f"- Console errors：`{len(result['console_errors'])}`",
            f"- Transient API console errors：`{len(result['transient_console_errors'])}`",
            f"- Console warnings：`{len(result['console_warnings'])}`",
            f"- Expected API console errors：`{len(result['expected_console_errors'])}`",
            "",
            "## 測試命令",
            "",
            "```bash",
            "npm run e2e:marketing",
            "```",
            "",
        ]
    )
    (OUTPUT_DIR / "AI行銷規劃_E2E_測試報告.md").write_text(
        "\n".join(report_lines), encoding="utf-8"
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page_errors: list[str] = []
    console_errors: list[str] = []
    console_warnings: list[str] = []
    expected_console_errors: list[str] = []
    screenshots: list[str] = []
    expected_error_mode = False
    query_requests: list[dict] = []
    query_responses: list[dict] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        def on_console(message) -> None:
            if message.type == "error":
                target = expected_console_errors if expected_error_mode else console_errors
                target.append(message.text)
            elif message.type == "warning":
                console_warnings.append(message.text)

        page.on("console", on_console)

        def on_request(request) -> None:
            if request.method != "POST" or not request.url.endswith("/api/v1/agent/query"):
                return
            try:
                query_requests.append(json.loads(request.post_data or "{}"))
            except json.JSONDecodeError:
                return

        page.on("request", on_request)

        def on_response(response) -> None:
            if response.request.method != "POST" or not response.url.endswith("/api/v1/agent/query"):
                return
            try:
                query_responses.append(response.json())
            except (json.JSONDecodeError, ValueError):
                return

        page.on("response", on_response)
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        screenshots.append(screenshot(page, "01_initial"))

        marketing_cards = page.locator(".insight-card-marketing_plan")
        page.locator("summary").filter(has_text="AI 活動規劃").click()
        for attempt in range(3):
            if attempt == 0:
                page.get_by_role("button", name=CAMPAIGN_PROMPT).click()
            else:
                page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
                page.get_by_role("button", name="清除對話").click()
                page.wait_for_function(
                    "() => document.querySelectorAll('.message-row').length === 1"
                )
                page.get_by_role("textbox", name="輸入營運問題").fill(CAMPAIGN_PROMPT)
                page.get_by_role("button", name="送出問題").click()
            try:
                marketing_cards.first.wait_for(state="visible", timeout=45000)
                break
            except PlaywrightTimeoutError:
                if attempt == 2:
                    raise
        open_button = page.get_by_role("button", name="查看活動草稿").first
        adjust_button = page.get_by_role("button", name="調整活動條件").first
        assert open_button.is_visible()
        assert adjust_button.is_visible()
        first_workflow = page.locator('[data-testid="workflow-progress"]').last
        assert first_workflow.get_by_text("第 1 版 · 待確認", exact=True).is_visible()
        first_campaign_request = next(
            item
            for item in reversed(query_requests)
            if item.get("message") == CAMPAIGN_PROMPT
        )
        first_campaign_response = next(
            item
            for item in reversed(query_responses)
            if item.get("workflow", {}).get("revision") == 1
        )
        conversation_id = first_campaign_response.get("conversation_id")
        assert conversation_id
        assert first_campaign_request.get("conversation_id") is None
        page.reload(wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        marketing_cards.first.wait_for(state="visible", timeout=90000)
        assert page.locator('[data-testid="workflow-progress"]').last.get_by_text(
            "第 1 版 · 待確認", exact=True
        ).is_visible()
        screenshots.append(screenshot(page, "02_reload_restore"))
        screenshots.append(screenshot(page, "02_marketing_plan"))

        campaign_card_text = marketing_cards.first.inner_text()
        assert marketing_cards.first.get_by_text("活動說明", exact=True).is_visible()
        assert marketing_cards.first.get_by_text("規劃發想", exact=True).is_visible()
        assert marketing_cards.first.get_by_text("決策重點", exact=True).is_visible()
        campaign_match = re.search(r"CRM 草稿\s+(\d+)", campaign_card_text)
        assert campaign_match, campaign_card_text
        campaign_id = campaign_match.group(1)
        audience_match = re.search(r"預估客群\s+(\d+) 人", campaign_card_text)
        assert audience_match, campaign_card_text
        expected_audience_total = int(audience_match.group(1))

        open_button.click()
        modal = page.locator(".campaign-modal")
        modal.wait_for(state="visible")
        assert modal.get_by_text("活動草稿詳情", exact=True).is_visible()
        assert modal.get_by_text(campaign_id, exact=True).is_visible()
        metrics_response = page.request.get(
            f"{BASE_URL}/api/v1/agent/campaigns/{campaign_id}/metrics"
        )
        assert metrics_response.status == 200
        crm_metrics = metrics_response.json()["data"]
        assert crm_metrics["audience_total"] == expected_audience_total
        modal.get_by_text("0 人", exact=True).first.wait_for(state="visible")
        screenshots.append(screenshot(page, "03_campaign_detail"))
        page.locator(".campaign-modal-close").click()
        assert not modal.is_visible()

        adjust_button.click()
        page.get_by_text("請調整這個活動規劃", exact=True).last.wait_for(state="visible")
        page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
        input_box = page.get_by_role("textbox", name="輸入營運問題")
        assert input_box.input_value() == "請調整這個活動規劃"
        screenshots.append(screenshot(page, "04_adjustment_prefilled"))

        input_box.fill("請把這個活動改成父親節，優惠改為 88 折，並建立 CRM 活動草稿。")
        page.get_by_role("button", name="送出問題").click()
        page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
        page.wait_for_function(
            "() => document.querySelectorAll('.insight-card-marketing_plan').length >= 2",
            timeout=90000,
        )
        second_workflow = page.locator('[data-testid="workflow-progress"]').last
        assert second_workflow.get_by_text("第 2 版 · 待確認", exact=True).is_visible()
        adjusted_request = next(
            item
            for item in reversed(query_requests)
            if "改成父親節" in item.get("message", "")
        )
        assert adjusted_request.get("conversation_id")
        assert adjusted_request["conversation_id"] == conversation_id
        second_campaign_response = next(
            item
            for item in reversed(query_responses)
            if item.get("workflow", {}).get("revision") == 2
        )
        assert second_campaign_response["conversation_id"] == conversation_id
        assert second_campaign_response["workflow"]["plan"]["event_name"] == "父親節"
        assert second_campaign_response["workflow"]["plan"]["campaign_name"] == "父親節蛋糕感謝回饋活動"
        assert marketing_cards.last.get_by_text("父親節蛋糕感謝回饋活動", exact=True).is_visible()
        snapshot_response = page.request.get(
            f"{BASE_URL}/api/v1/agent/conversations/{conversation_id}"
        )
        assert snapshot_response.status == 200
        snapshot_data = snapshot_response.json()["data"]
        assert snapshot_data["workflow"]["revision"] == 2
        assert len(snapshot_data["messages"]) == 4
        screenshots.append(screenshot(page, "05_adjustment_response"))

        page.get_by_role("button", name="清除對話").click()
        page.wait_for_function(
            "() => document.querySelectorAll('.message-row').length === 1"
        )
        screenshots.append(screenshot(page, "06_clear_conversation"))

        page.get_by_role("textbox", name="輸入營運問題").fill("分析本週營收、Top 5 商品、門市與通路異常。")
        page.get_by_role("button", name="送出問題").click()
        page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
        page.locator(".insight-card-marketing_insight").last.wait_for(state="visible", timeout=90000)
        restarted_response = next(
            item
            for item in reversed(query_responses)
            if item.get("resolved_intent", {}).get("task") == "marketing_insights"
        )
        assert restarted_response["conversation_id"] != conversation_id
        page.get_by_role("button", name="清除對話").click()
        page.wait_for_function("() => document.querySelectorAll('.message-row').length === 1")

        expected_error_mode = True
        page.route(
            "**/api/v1/agent/query",
            lambda route: route.fulfill(
                status=503,
                content_type="application/json",
                body=json.dumps(
                    {"error": {"code": "AGENT_UNAVAILABLE", "message": "服務暫時無法使用"}},
                    ensure_ascii=False,
                ),
            ),
        )
        page.get_by_role("textbox", name="輸入營運問題").fill("測試服務錯誤")
        page.get_by_role("button", name="送出問題").click()
        error_message = page.locator(".message-error")
        error_message.wait_for(state="visible")
        assert "服務暫時無法使用" in error_message.inner_text()
        screenshots.append(screenshot(page, "07_api_error"))
        page.unroute("**/api/v1/agent/query")
        expected_error_mode = False

        transient_console_errors = [
            error for error in console_errors if error.startswith("Failed to load resource:")
        ]
        unexpected_console_errors = [
            error for error in console_errors if error not in transient_console_errors
        ]

        result = {
            "started_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "campaign_id": campaign_id,
            "conversation_id": conversation_id,
            "workflow_revision": snapshot_data["workflow"]["revision"],
            "saved_message_count": len(snapshot_data["messages"]),
            "crm_metrics": crm_metrics,
            "campaign_card_text": re.sub(r"；+", "；", campaign_card_text.replace("\n", "；")).strip("；"),
            "screenshots": screenshots,
            "page_errors": page_errors,
            "console_errors": unexpected_console_errors,
            "transient_console_errors": transient_console_errors,
            "console_warnings": console_warnings,
            "expected_console_errors": expected_console_errors,
        }
        browser.close()

    assert not page_errors, page_errors
    assert not unexpected_console_errors, unexpected_console_errors
    assert not console_warnings, console_warnings
    write_report(result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
