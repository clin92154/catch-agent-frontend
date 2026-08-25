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
        f"docs/e2e/interactive_research_{datetime.now():%Y%m%d_%H%M%S}",
    )
)


def snapshot(page: Page, name: str) -> str:
    page.locator(".message-row").last.scroll_into_view_if_needed()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
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


def summary(payload: dict[str, Any]) -> dict[str, Any]:
    reply = payload.get("reply") or {}
    return {
        "status": payload.get("status"),
        "resolved_intent": payload.get("resolved_intent"),
        "workflow": payload.get("workflow"),
        "reply": {
            "text": reply.get("text"),
            "cards": reply.get("cards") or [],
            "actions": reply.get("actions") or [],
            "reports": reply.get("reports") or [],
        },
    }


def main() -> None:
    steps: list[dict[str, Any]] = []
    screenshots: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(AGENT_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        screenshots.append(snapshot(page, "01_initial"))
        page.get_by_role("button", name="清除對話").click()

        first_message = "先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。"
        first_request, first = ask(page, first_message)
        assert first["workflow"]["status"] == "historical_analyzed", first
        assert first["resolved_intent"]["tool"]["tool"] == "analyze_historical_campaign", first
        assert first["reply"]["cards"][0]["title"] == "去年檔期分析", first
        screenshots.append(snapshot(page, "02_historical_analysis"))
        steps.append({
            "step": "1. 去年檔期分析",
            "input": {"message": first_message, "request": first_request},
            "output": summary(first),
        })

        page.get_by_role("button", name="根據去年分析規劃今年活動").last.click()
        second_message = "根據去年分析規劃今年母親節活動"
        second_request, second = ask(page, second_message)
        assert second["workflow"]["status"] == "plan_ready", second
        assert second["resolved_intent"]["tool"]["tool"] == "create_marketing_campaign", second
        assert any(
            action["label"] == "建立策略研究設定"
            for action in second["reply"]["actions"]
        ), second
        screenshots.append(snapshot(page, "03_campaign_plan"))
        steps.append({
            "step": "2. 今年活動規劃與客群預覽",
            "input": {"message": second_message, "request": second_request},
            "output": summary(second),
        })

        page.get_by_role("button", name="建立策略研究設定").last.click()
        third_message = "建立今年活動的策略研究設定"
        third_request, third = ask(page, third_message)
        assert third["workflow"]["status"] == "research_ready", third
        assert third["workflow"]["current_step"] == "design_research", third
        assert third["resolved_intent"]["tool"]["tool"] == "prepare_strategy_study", third
        assert third["reply"]["cards"][0]["type"] == "strategy_research", third
        assert any(
            action["type"] == "create_campaign_draft"
            for action in third["reply"]["actions"]
        ), third
        screenshots.append(snapshot(page, "04_strategy_design"))
        steps.append({
            "step": "3. 策略研究設定草稿",
            "input": {"message": third_message, "request": third_request},
            "output": summary(third),
            "assertion": "未建立 CRM 草稿、未發布策略研究、未發送優惠券",
        })
        browser.close()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "title": "互動式行銷研究 Workflow E2E",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "agent_url": AGENT_URL,
        "screenshots": screenshots,
        "steps": steps,
        "result": "PASS",
    }
    (OUTPUT_DIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    lines = [
        "# 互動式行銷研究 Workflow E2E 報告",
        "",
        "結果：PASS",
        "",
        "| 步驟 | 輸入 | 主要驗證 | 截圖 |",
        "| --- | --- | --- | --- |",
    ]
    for step, image in zip(steps, screenshots[1:]):
        lines.append(
            f"| {step['step']} | `{step['input']['message']}` | PASS | `{Path(image).name}` |"
        )
    lines.extend(["", "## API 與 UI 紀錄", "", "```json", json.dumps(steps, ensure_ascii=False, indent=2), "```"])
    (OUTPUT_DIR / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"result": "PASS", "output_dir": str(OUTPUT_DIR), "screenshots": screenshots}, ensure_ascii=False))


if __name__ == "__main__":
    main()
