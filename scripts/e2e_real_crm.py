from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:5176")
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs/e2e"
SCREENSHOT_DIR = OUTPUT_DIR / "real_screenshots"


def capture(page: Page, name: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return str(path.relative_to(OUTPUT_DIR))


def submit(page: Page, prompt: str) -> None:
    page.get_by_role("button", name="清除對話").click()
    page.wait_for_function("() => document.querySelectorAll('.message-row').length === 1")
    page.get_by_role("textbox", name="輸入營運問題").fill(prompt)
    page.get_by_role("button", name="送出問題").click()
    page.locator(".typing-bubble").wait_for(state="hidden", timeout=120000)


def response_summary(payload: dict) -> dict:
    reply = payload.get("reply") or {}
    return {
        "resolved_intent": payload.get("resolved_intent"),
        "reply": {
            "text": reply.get("text"),
            "confidence": reply.get("confidence"),
            "cards": [card.get("type") for card in reply.get("cards") or []],
            "actions": reply.get("actions") or [],
            "report_ids": [report.get("report_id") for report in reply.get("reports") or []],
        },
    }


def campaign_id_from_modal(modal) -> str:
    for item in modal.locator(".campaign-modal-grid > div").all():
        if item.locator("span").inner_text() == "活動草稿編號":
            return item.locator("strong").inner_text()
    raise AssertionError("找不到 CRM 活動草稿編號")


def run() -> None:
    page_errors: list[str] = []
    console_errors: list[str] = []
    responses: list[dict] = []
    screenshots: list[str] = []
    records: list[dict] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

        def capture_agent_response(response) -> None:
            if response.request.method == "POST" and response.url.endswith("/api/v1/agent/query"):
                try:
                    responses.append({"status": response.status, "payload": response.json()})
                except Exception:
                    responses.append({"status": response.status, "payload": {}})

        page.on("response", capture_agent_response)
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        screenshots.append(capture(page, "00_initial"))

        insight_prompt = "幫我看看這週生意怎麼樣？哪些商品賣最好、哪間店或哪個通路怪怪的？"
        submit(page, insight_prompt)
        page.locator(".insight-card-marketing_insight").last.wait_for(state="visible", timeout=120000)
        screenshots.append(capture(page, "01_insights"))
        report_action = page.get_by_role("button", name="查看完整洞察報告").last
        report_action.click()
        page.locator(".report-modal").wait_for(state="visible")
        screenshots.append(capture(page, "01_insights_report"))
        page.locator(".report-modal-close").click()
        records.append({"title": "AI 行銷洞察", "prompt": insight_prompt, "response": response_summary(responses[-1]["payload"])})

        member_prompt = "最近有哪些會員很可能會再買？哪些人快流失了，值得我們先關心？"
        submit(page, member_prompt)
        page.locator(".insight-card-member_analysis").last.wait_for(state="visible", timeout=120000)
        screenshots.append(capture(page, "02_members"))
        page.get_by_role("button", name="查看會員分析報告").last.click()
        page.locator(".report-modal").wait_for(state="visible")
        screenshots.append(capture(page, "02_members_report"))
        page.locator(".report-modal-close").click()
        records.append({"title": "AI 會員分析", "prompt": member_prompt, "response": response_summary(responses[-1]["payload"])})

        campaign_prompt = "我想把沉睡會員叫回來，主打蛋糕，給 9 折，你幫我規劃一個活動並先存成 CRM 草稿。"
        submit(page, campaign_prompt)
        page.locator(".insight-card-marketing_plan").last.wait_for(state="visible", timeout=120000)
        screenshots.append(capture(page, "03_campaign_plan"))
        page.get_by_role("button", name="查看活動草稿").last.click()
        campaign_modal = page.locator(".campaign-modal")
        campaign_modal.wait_for(state="visible")
        campaign_id = campaign_id_from_modal(campaign_modal)
        assert campaign_id != "—"
        screenshots.append(capture(page, "03_campaign_draft"))
        page.locator(".campaign-modal-close").click()
        records.append({
            "title": "AI 行銷活動建議",
            "prompt": campaign_prompt,
            "campaign_id": campaign_id,
            "response": response_summary(responses[-1]["payload"]),
        })

        performance_prompt = f"幫我看看活動 {campaign_id} 成效好不好？用了多少張券、帶來多少營收？下次怎麼調整？"
        submit(page, performance_prompt)
        page.locator(".insight-card-campaign_performance").last.wait_for(state="visible", timeout=120000)
        screenshots.append(capture(page, "04_campaign_performance"))
        page.get_by_role("button", name="查看完整成效報告").last.click()
        page.locator(".report-modal").wait_for(state="visible")
        screenshots.append(capture(page, "04_campaign_performance_report"))
        records.append({
            "title": "AI 行銷成效分析",
            "prompt": performance_prompt,
            "campaign_id": campaign_id,
            "response": response_summary(responses[-1]["payload"]),
        })
        browser.close()

    assert not page_errors, page_errors
    assert not console_errors, console_errors
    assert all(item["status"] == 200 for item in responses), responses

    report = [
        "# AI 行銷顧問｜真實 CRM E2E 測試報告",
        "",
        f"- 測試時間：{datetime.now().isoformat(timespec='seconds')}",
        f"- 測試入口：`{BASE_URL}`",
        "- CRM Adapter：HTTP 真實 CRM API",
        "- LLM：本次使用 deterministic Demo LLM，僅驗證真實 CRM HTTP 串接，不產生外部 LLM 費用",
        "",
        "## 結果",
        "",
        "| 情境 | 結果 |",
        "| --- | --- |",
    ]
    report.extend(f"| {item['title']} | PASS |" for item in records)
    report.extend(["", "## 對話與 API 摘要", ""])
    for item in records:
        report.extend(
            [
                f"### {item['title']}",
                "",
                f"- 輸入：{item['prompt']}",
                f"- CRM 活動：{item.get('campaign_id', '不適用')}",
                "- Agent 回傳：",
                "```json",
                json.dumps(item["response"], ensure_ascii=False, indent=2),
                "```",
                "",
            ]
        )
    report.extend(["## 截圖", ""])
    report.extend(f"![{Path(path).stem}]({path})" for path in screenshots)
    report.extend(["", "- Browser page errors：0", "- Console errors：0", ""])
    output = OUTPUT_DIR / "AI行銷顧問_真實CRM_E2E_測試報告.md"
    output.write_text("\n".join(report), encoding="utf-8")
    print(json.dumps({"result": "PASS", "campaign_id": records[2]["campaign_id"], "report": str(output), "screenshots": screenshots}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()
