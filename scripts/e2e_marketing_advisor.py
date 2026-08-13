from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:5176")
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs/e2e"
SCREENSHOT_DIR = OUTPUT_DIR / "advisor_screenshots"

SCENARIOS = [
    {
        "key": "01_insights",
        "title": "AI 行銷洞察",
        "prompt": "分析本週營收、Top 5 商品、門市與通路異常。",
        "card": "marketing_insight",
        "action": "查看完整洞察報告",
        "report": "AI 行銷洞察詳細報告",
    },
    {
        "key": "02_members",
        "title": "AI 會員分析",
        "prompt": "找出最近最可能購買、即將流失及值得優先經營的會員。",
        "card": "member_analysis",
        "action": "查看會員分析報告",
        "report": "AI 會員分析詳細報告",
    },
    {
        "key": "03_campaign_plan",
        "title": "AI 行銷活動建議",
        "prompt": "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠，並建立 CRM 活動草稿。",
        "card": "marketing_plan",
        "action": "查看活動草稿",
        "report": None,
    },
    {
        "key": "04_campaign_performance",
        "title": "AI 行銷成效分析",
        "prompt": "分析活動 fake-campaign-001 是否成功，以及下一次怎麼改善。",
        "card": "campaign_performance",
        "action": "查看完整成效報告",
        "report": "AI 行銷成效詳細報告",
    },
]


def capture(page: Page, key: str) -> str:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"{key}.png"
    page.screenshot(path=str(path), full_page=True)
    return str(path.relative_to(OUTPUT_DIR))


def api_summary(payload: dict) -> dict:
    """保留報告需要的 API 回傳欄位，避免把完整 response 充滿測試報告。"""

    reply = payload.get("reply") or {}
    cards = []
    for card in reply.get("cards") or []:
        cards.append(
            {
                "type": card.get("type"),
                "title": card.get("title"),
                "description": card.get("description"),
                "items": [
                    {
                        "label": item.get("label"),
                        "value": item.get("value"),
                        "unit": item.get("unit"),
                        "change_pct": item.get("change_pct"),
                        "status": item.get("status"),
                    }
                    for item in card.get("items") or []
                ],
            }
        )
    return {
        "resolved_intent": payload.get("resolved_intent"),
        "reply": {
            "text": reply.get("text"),
            "confidence": reply.get("confidence"),
            "cards": cards,
            "actions": reply.get("actions") or [],
            "reports": [
                {
                    "report_id": report.get("report_id"),
                    "title": report.get("title"),
                    "summary": report.get("summary"),
                    "section_titles": [
                        section.get("title")
                        for section in report.get("sections") or []
                    ],
                }
                for report in reply.get("reports") or []
            ],
        },
    }


def report_snapshot(report) -> dict:
    sections = []
    for section in report.locator(".report-section").all():
        headers = section.locator("thead th").all_inner_texts()
        rows = [row.locator("td").all_inner_texts() for row in section.locator("tbody tr").all()]
        sections.append(
            {
                "title": section.locator("h3").inner_text(),
                "columns": headers,
                "row_count": len(rows),
                "rows_preview": rows[:5],
            }
        )
    return {
        "title": report.locator("h2").inner_text(),
        "summary": report.locator(".report-modal-header p").inner_text(),
        "sections": sections,
    }


def campaign_snapshot(campaign) -> dict:
    fields = {}
    for item in campaign.locator(".campaign-modal-grid > div").all():
        fields[item.locator("span").inner_text()] = item.locator("strong").inner_text()
    return {
        "title": campaign.locator("h2").inner_text(),
        "fields": fields,
        "status_message": campaign.locator(".campaign-modal-status").inner_text(),
    }


def json_block(value: object) -> str:
    return "```json\n" + json.dumps(value, ensure_ascii=False, indent=2) + "\n```"


def render_scenario_details(details: dict) -> list[str]:
    scenario = details["scenario"]
    request = details["request"]
    api = details["api_response"]
    lines = [
        f"## {scenario['title']}",
        "",
        "### 步驟 1｜使用者輸入與 API 請求",
        "",
        f"- 對話輸入：`{request['message']}`",
        f"- API：`{request['method']} {request['path']}`",
        "",
        json_block(request["body"]),
        "",
        "### 步驟 2｜Agent API 回傳",
        "",
        f"- resolved tool：`{(api.get('resolved_intent') or {}).get('tool', {}).get('tool', '-')}`",
        f"- resolved task：`{(api.get('resolved_intent') or {}).get('task', '-')}`",
        f"- 回覆文字：{(api.get('reply') or {}).get('text', '-')}",
        f"- 信心度：`{(api.get('reply') or {}).get('confidence', '-')}/10`",
        "",
        json_block(api),
        "",
        "### 步驟 3｜觸發字卡",
        "",
    ]
    for card in (api.get("reply") or {}).get("cards") or []:
        lines.extend(
            [
                f"#### `{card.get('type')}`｜{card.get('title')}",
                "",
                f"{card.get('description') or '無額外說明'}",
                "",
                "| 欄位 | 回傳值 | 狀態 |",
                "| --- | --- | --- |",
            ]
        )
        for item in card.get("items") or []:
            value = f"{item.get('value') or '-'}{item.get('unit') or ''}"
            if item.get("change_pct"):
                value += f"（{item['change_pct']}）"
            lines.append(f"| {item.get('label') or '-'} | {value} | {item.get('status') or '-'} |")
        lines.append("")

    lines.extend(["### 步驟 4｜可操作按鈕", ""])
    actions = (api.get("reply") or {}).get("actions") or []
    if actions:
        lines.extend(["| 按鈕文字 | action type | payload |", "| --- | --- | --- |"])
        for action in actions:
            lines.append(
                f"| {action.get('label') or '-'} | `{action.get('type') or '-'}` | `{json.dumps(action.get('payload') or {}, ensure_ascii=False)}` |"
            )
    else:
        lines.append("本情境沒有後續按鈕。")
    lines.append("")

    lines.extend(["### 步驟 5｜按鈕後續畫面", ""])
    if details.get("report_view"):
        view = details["report_view"]
        lines.extend(
            [
                f"- 點擊按鈕：`{details['triggered_action']}`",
                f"- 報告標題：{view['title']}",
                f"- 報告摘要：{view['summary']}",
                "",
                "| 報告區塊 | 欄位 | 資料筆數 | 前 5 筆資料 |",
                "| --- | --- | ---: | --- |",
            ]
        )
        for section in view["sections"]:
            rows = "；".join("／".join(row) for row in section["rows_preview"]) or "無資料"
            lines.append(
                f"| {section['title']} | {'、'.join(section['columns']) or '-'} | {section['row_count']} | {rows} |"
            )
    elif details.get("campaign_view"):
        view = details["campaign_view"]
        lines.extend(
            [
                f"- 點擊按鈕：`{details['triggered_action']}`",
                f"- 詳情標題：{view['title']}",
                "",
                "| CRM 活動欄位 | 回傳值 |",
                "| --- | --- |",
            ]
        )
        lines.extend(f"| {label} | {value} |" for label, value in view["fields"].items())
        lines.extend([f"| 狀態訊息 | {view['status_message']} |"])
    else:
        lines.append("未開啟後續畫面。")
    lines.extend(["", f"- 對應截圖：`{details['card_screenshot']}`"])
    if details.get("followup_screenshot"):
        lines.append(f"- 後續畫面截圖：`{details['followup_screenshot']}`")
    lines.append("")
    return lines


def main() -> None:
    screenshots: list[str] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    results: list[dict] = []
    api_responses: list[dict] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

        def record_response(response) -> None:
            if response.request.method != "POST":
                return
            if not response.url.endswith("/api/v1/agent/query"):
                return
            try:
                api_responses.append(response.json())
            except Exception:
                return

        page.on("response", record_response)
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        screenshots.append(capture(page, "00_initial"))

        input_box = page.get_by_role("textbox", name="輸入營運問題")
        for scenario in SCENARIOS:
            scenario = dict(scenario)
            if scenario["key"] == "04_campaign_performance" and results:
                campaign_id = results[-1].get("campaign_view", {}).get("fields", {}).get("活動草稿編號")
                if campaign_id:
                    scenario["prompt"] = f"分析活動 {campaign_id} 是否成功，以及下一次怎麼改善。"
            page.get_by_role("button", name="清除對話").click()
            page.wait_for_function("() => document.querySelectorAll('.message-row').length === 1")
            input_box.fill(scenario["prompt"])
            page.get_by_role("button", name="送出問題").click()
            page.locator(".typing-bubble").wait_for(state="hidden", timeout=90000)
            card = page.locator(f".insight-card-{scenario['card']}").last
            card.wait_for(state="visible", timeout=90000)
            assert api_responses, "Agent query response was not captured"
            api_payload = api_responses[-1]
            card_screenshot = capture(page, scenario["key"] + "_card")
            screenshots.append(card_screenshot)
            action = page.get_by_role("button", name=scenario["action"]).last
            assert action.is_visible()
            action.click()

            details = {
                "scenario": scenario,
                "request": {
                    "method": "POST",
                    "path": "/api/v1/agent/query",
                    "message": scenario["prompt"],
                    "body": {
                        "message": scenario["prompt"],
                        "timezone": "Asia/Taipei",
                        "context": {"store_codes": []},
                    },
                },
                "api_response": api_summary(api_payload),
                "triggered_action": scenario["action"],
                "card_screenshot": card_screenshot,
            }

            if scenario["report"]:
                report = page.locator(".report-modal")
                report.wait_for(state="visible")
                assert report.get_by_text(scenario["report"], exact=True).is_visible()
                details["report_view"] = report_snapshot(report)
                details["followup_screenshot"] = capture(page, scenario["key"] + "_report")
                screenshots.append(details["followup_screenshot"])
                page.locator(".report-modal-close").click()
            else:
                campaign = page.locator(".campaign-modal")
                campaign.wait_for(state="visible")
                assert campaign.get_by_text("活動草稿詳情", exact=True).is_visible()
                campaign.locator(".campaign-modal-status").get_by_text("待確認：目前尚未發送優惠或啟動活動。", exact=True).wait_for(state="visible")
                details["campaign_view"] = campaign_snapshot(campaign)
                details["followup_screenshot"] = capture(page, scenario["key"] + "_detail")
                screenshots.append(details["followup_screenshot"])
                page.locator(".campaign-modal-close").click()

            details["result"] = "PASS"
            results.append(details)

        browser.close()

    assert not page_errors, page_errors
    assert not console_errors, console_errors
    report = [
        "# AI 行銷顧問 Agent｜四情境 E2E 測試報告",
        "",
        f"- 測試時間：{datetime.now().isoformat(timespec='seconds')}",
        f"- 測試入口：`{BASE_URL}`",
        "- CRM Demo 模式：Agent 透過 HTTP CRM Adapter 取得 CRM Backend 回覆",
        "- 驗證內容：AI 行銷洞察、AI 會員分析、AI 行銷活動建議、AI 行銷成效分析",
        "",
        "## 結果",
        "",
        "| 情境 | 結果 |",
        "| --- | --- |",
    ]
    report.extend(f"| {item['scenario']['title']} | {item['result']} |" for item in results)
    report.extend(["", "## 逐情境對話紀錄", ""])
    for item in results:
        report.extend(render_scenario_details(item))
    report.extend(["## 流程截圖總覽", ""])
    report.extend(f"![{Path(path).stem}]({path})" for path in screenshots)
    report.extend(
        [
            "",
            "## 驗收",
            "",
            "- 四種情境均由對話輸入觸發 Agent API。",
            "- cards 顯示 CRM facts 摘要。",
            "- 洞察、會員與成效情境可開啟詳細報告。",
            "- 活動建議情境可開啟 CRM 活動草稿詳情。",
            "- Browser page errors：0",
            "- Console errors：0",
            "",
        ]
    )
    (OUTPUT_DIR / "AI行銷顧問_四情境_E2E_測試報告.md").write_text("\n".join(report), encoding="utf-8")
    print(
        json.dumps(
            {
                "results": [
                    {"scenario": item["scenario"]["key"], "result": item["result"]}
                    for item in results
                ],
                "screenshots": screenshots,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
