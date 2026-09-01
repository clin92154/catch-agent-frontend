import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const CRM_ADMIN_URL = (import.meta.env.VITE_CRM_ADMIN_URL || "").replace(/\/$/, "");
const RICH_TEXT_PATTERN = /<span class="(catch-(?:highlight|positive|negative|warning|info|ai))">([\s\S]*?)<\/span>/g;
const MARKETING_PROMPT = "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。";
const INSIGHT_PROMPT = "分析本週營收、Top 5 商品、門市與通路表現。";
const MEMBER_PROMPT = "找出最近最可能購買的會員。";
const CONVERSATION_STORAGE_KEY = "catch-agent-conversation-id";

const suggestionGroups = [
  {
    label: "AI 行銷洞察",
    items: [
      INSIGHT_PROMPT,
      "上週 Top 5 商品與通路表現如何？",
      "本週哪個門市營收最高？有異常嗎？",
    ],
  },
  {
    label: "AI 會員分析",
    items: [
      MEMBER_PROMPT,
      "找出最近可能流失的會員。",
      "找出女性、曾購買蛋糕且近 90 天有消費的會員。",
    ],
  },
  {
    label: "AI 活動規劃",
    items: [
      MARKETING_PROMPT,
      "幫我規劃今年母親節蛋糕活動，提供會員專屬優惠。",
      "規劃中秋節禮盒活動，推薦適合的會員客群。",
    ],
  },
  {
    label: "AI 成效分析",
    items: [
      "目前有哪些行銷活動？",
      "查看母親節活動成效。",
      "比較今年與去年母親節活動成效。",
    ],
  },
];

const INTENT_LABELS = {
  revenue_anomaly: "營收異常",
  visitor_anomaly: "來客異常",
  average_order_value_increase: "客單價分析",
  store_district: "門市商圈",
  product_sales: "商品銷量",
  demand_forecast: "叫貨預測",
  waste_anomaly: "報廢異常",
  marketing_insights: "行銷洞察",
  member_analysis: "會員分析",
  marketing_campaign_plan: "活動規劃",
  campaign_performance: "成效分析",
  strategy_research: "策略研究",
};

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "你好，我是 CATCH 營運助手。你可以查詢行銷洞察、會員分群、活動規劃與活動成效。",
    cards: [],
    files: [],
    charts: [],
    reports: [],
  },
];

function assetUrl(path) {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function intentLabel(intent) {
  /** 將後端 task 代碼轉成前端可理解的繁體中文。 */
  return INTENT_LABELS[intent] || intent;
}

function confidenceTone(score) {
  /** 依信心度套用風險、注意或 AI 狀態色。 */
  if (score <= 3) return "confidence-low";
  if (score <= 6) return "confidence-medium";
  return "confidence-high";
}

async function askAgent(message, conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      timezone: "Asia/Taipei",
      context: { store_codes: [] },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(payload, response.status);
  }
  return payload;
}

function apiError(payload, status) {
  const apiMessage = payload?.error?.message || "目前無法完成這項處理，請稍後再試。";
  const details = payload?.error?.details || {};
  const error = new Error(apiMessage);
  error.code = payload?.error?.code;
  error.details = details;
  error.status = status;
  return error;
}

async function createCampaignDraft(conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/campaigns/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(payload, response.status);
  }
  return payload;
}

async function sendCampaignCoupon(campaignId, conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/campaigns/${encodeURIComponent(campaignId)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(payload, response.status);
  }
  return payload;
}

async function getCampaignMetrics(campaignId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/campaigns/${encodeURIComponent(campaignId)}/metrics`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(payload, response.status);
  }
  return payload?.data || {};
}

async function getConversation(conversationId, signal) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/conversations/${encodeURIComponent(conversationId)}`, { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "目前無法讀取對話內容，請稍後再試。");
  }
  return payload?.data || null;
}

function messageFromSavedPayload(item, index) {
  if (item.role === "user") {
    return { id: `saved-user-${index}`, role: "user", text: item.content };
  }
  const payload = item.payload || {};
  return {
    id: `saved-assistant-${index}`,
    role: "assistant",
    text: payload?.reply?.text || item.content,
    cards: payload?.reply?.cards || [],
    actions: payload?.reply?.actions || [],
    files: payload?.reply?.files || [],
    charts: payload?.reply?.charts || [],
    reports: payload?.reply?.reports || [],
    progress: payload?.reply?.progress || [],
    workflow: payload?.workflow || null,
    confidence: payload?.reply?.confidence,
    intent: payload?.resolved_intent?.task || payload?.status || "完成",
    conversationId: payload?.conversation_id || null,
    audienceMembers: payload?.audience_members || [],
  };
}

function messageFromAgentPayload(payload) {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: payload?.reply?.text || "已完成處理，但目前沒有可顯示的文字回覆。",
    cards: payload?.reply?.cards || [],
    actions: payload?.reply?.actions || [],
    files: payload?.reply?.files || [],
    charts: payload?.reply?.charts || [],
    reports: payload?.reply?.reports || [],
    progress: payload?.reply?.progress || [],
    workflow: payload?.workflow || null,
    confidence: payload?.reply?.confidence,
    intent: payload?.resolved_intent?.task || payload?.status || "完成",
    conversationId: payload?.conversation_id || null,
    audienceMembers: payload?.audience_members || [],
  };
}

function RichText({ text = "" }) {
  /** 只將後端白名單 span 轉成 React 元素，其餘內容維持純文字。 */
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(RICH_TEXT_PATTERN)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(<span className={match[1]} key={`${match.index}-${match[1]}`}>{match[2]}</span>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function FileList({ files = [] }) {
  if (!files.length) return null;
  return (
    <div className="attachment-list" aria-label="可下載文件">
      {files.map((file) => (
        <a
          className="attachment-card"
          href={assetUrl(file.url)}
          key={`${file.name}-${file.url}`}
          target="_blank"
          rel="noreferrer"
          download={file.name}
        >
          <span className="attachment-icon" aria-hidden="true">
            {(file.type || "FILE").slice(0, 4).toUpperCase()}
          </span>
          <span>
            <strong>{file.name}</strong>
            <small>{file.description || file.type}</small>
          </span>
        </a>
      ))}
    </div>
  );
}

function ChartList({ charts = [] }) {
  if (!charts.length) return null;
  return (
    <div className="chart-list" aria-label="分析圖表">
      {charts.map((chart) => (
        <figure className="chart-card" key={`${chart.name}-${chart.file_url}`}>
          <img src={assetUrl(chart.file_url)} alt={chart.description || chart.name} />
          <figcaption>
            <span>
              <strong>{chart.name}</strong>
              {chart.description && <small>{chart.description}</small>}
            </span>
            <a href={assetUrl(chart.file_url)} target="_blank" rel="noreferrer" aria-label={`開啟${chart.name}`}>查看圖表 ↗</a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function AudiencePreviewCard({ card, audienceMembers = [], onViewMembers }) {
  const count = cardValue(card, "符合會員");
  const criteria = cardValue(card, "篩選條件");
  const reason = cardValue(card, "AI 挑選依據");
  const display = cardValue(card, "明細顯示");
  const status = cardValue(card, "資料狀態");
  return (
    <>
      <div className="audience-summary-grid">
        <div className="audience-summary-count">
          <span>符合條件的會員</span>
          <strong>{count}</strong>
          <small>已依目前條件完成預覽</small>
        </div>
        <div className="audience-summary-status">
          <span>資料狀態</span>
          <strong>{status}</strong>
          <small>尚未建立活動或發送訊息</small>
        </div>
      </div>
      <div className="audience-criteria">
        <span>這群會員符合</span>
        <strong>{criteria}</strong>
      </div>
      <div className="audience-reason">
        <span>AI 為什麼挑選這群人</span>
        <strong>{reason}</strong>
      </div>
      {audienceMembers.length > 0 && (
        <div className="audience-card-footer">
          <span>完整符合 {count}，{display === "—" ? `目前展示前 ${audienceMembers.length} 位摘要` : `明細：${display}`}</span>
          <button type="button" className="audience-details-button" onClick={onViewMembers}>
            查看會員詳情 ↗
          </button>
        </div>
      )}
    </>
  );
}

function CampaignPlanCard({ card }) {
  const fieldLabels = {
    "目標客群": "邀請對象",
    "預估客群": "預估觸及",
    "優惠內容": "會員優惠",
    "建議通路": "建議接觸方式",
    "活動期間": "活動時間",
    "CRM 草稿": "活動草稿",
  };
  const items = (card.items || []).filter(
    (item) => !["活動說明", "規劃發想", "決策重點"].includes(item.label),
  );
  const theme = items.find((item) => item.label === "活動主題");
  const facts = items.filter((item) => item.label !== "活動主題");
  return (
    <>
      {theme && (
        <div className="campaign-plan-hero">
          <span>這次要做的活動</span>
          <strong>{theme.value}</strong>
        </div>
      )}
      <div className="campaign-plan-facts">
        {facts.map((item) => (
          <article
            className={`campaign-plan-fact${["邀請對象", "活動草稿", "主推商品"].includes(fieldLabels[item.label] || item.label) ? " campaign-plan-fact-wide" : ""}`}
            key={item.label}
          >
            <span>{fieldLabels[item.label] || item.label}</span>
            <strong>{item.value ?? "資料尚未提供"}</strong>
          </article>
        ))}
      </div>
    </>
  );
}

function CardList({ cards = [], audienceMembers = [], onViewAudienceMembers }) {
  if (!cards.length) return null;
  const noteLabels = new Set(["活動說明", "規劃發想", "決策重點"]);
  const cardEyebrows = {
    marketing_plan: "規劃摘要",
    campaign_performance: "活動成果",
    strategy_research: "研究摘要",
    marketing_insight: "營運摘要",
    member_analysis: "會員摘要",
  };
  return (
    <div className="insight-card-list" aria-label="營運分析圖卡">
      {cards.map((card, cardIndex) => {
        const items = card.items || [];
        const primaryItems = card.type === "marketing_plan"
          ? items.filter((item) => !noteLabels.has(item.label))
          : items;
        const noteItems = card.type === "marketing_plan"
          ? items.filter((item) => noteLabels.has(item.label))
          : [];
        return (
          <section
            className={`insight-card insight-card-${card.type}`}
            key={`${card.type}-${card.title}-${cardIndex}`}
          >
            <header className="insight-card-header">
              <div>
                <span className="insight-card-eyebrow">
                  {card.title === "CRM 歷史活動" ? "歷史活動" : cardEyebrows[card.type] || "分析摘要"}
                </span>
                <strong>{card.title}</strong>
              </div>
            </header>
            {card.description && <p className="insight-card-description">{card.description}</p>}
            {card.type === "audience_preview" ? (
              <AudiencePreviewCard
                card={card}
                audienceMembers={audienceMembers}
                onViewMembers={onViewAudienceMembers}
              />
            ) : card.type === "marketing_plan" ? (
              <CampaignPlanCard card={card} />
            ) : primaryItems.length > 0 && <div className="insight-grid">
            {primaryItems.map((item, itemIndex) => {
              const value = item.value ?? "資料尚未提供";
              const valueText = String(value);
              // 摘要卡中的長名稱仍應留在同一欄換行，只有規劃／研究說明才跨欄，避免歷史活動卡出現大片空白。
              const isLongValue = valueText.includes("\n")
                || (["marketing_plan", "strategy_research"].includes(card.type) && valueText.length >= 8);
              const isUnavailable = item.status === "unavailable" || valueText === "資料不可用" || valueText === "資料尚未提供";
              return (
              <article
                className={`insight-item insight-item-${item.status || "neutral"}${isLongValue ? " insight-item-long" : ""}${isUnavailable ? " insight-item-unavailable" : ""}`}
                data-status={item.status}
                data-value-length={valueText.length}
                data-trend={item.trend}
                key={`${item.label}-${itemIndex}`}
              >
                <div className="insight-item-heading">
                  <strong>{item.label}</strong>
                  {item.change_pct && <span>{item.change_pct}</span>}
                </div>
                <div className="insight-value">
                  <b>{value}</b>
                  {item.unit && <small>{item.unit}</small>}
                </div>
                {item.comparison_value !== undefined && item.comparison_value !== null && item.comparison_value !== "" && (
                  <p className="insight-comparison">
                    {item.comparison_label || "比較期"}：{item.comparison_value}
                  </p>
                )}
                {item.description && <p>{item.description}</p>}
              </article>
              );
            })}
            </div>}
            {noteItems.length > 0 && (
              <div className="insight-notes" aria-label="活動規劃說明">
                {noteItems.map((item) => (
                  <div className="insight-note" key={item.label}>
                    <span>{item.label}</span>
                    <p>{item.value ?? "資料尚未提供"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ActionList({ actions = [], onAction }) {
  if (!actions.length) return null;
  return (
    <div className="message-actions-wrap" aria-label="後續操作">
      <div className="message-actions-heading">
        <strong>接下來可以</strong>
        <span>請選擇一個操作</span>
      </div>
      <div className="message-actions">
        {actions.map((action, index) => (
          <button
            type="button"
            className={`message-action message-action-${action.type}`}
            key={`${action.type}-${action.label}-${index}`}
            data-action-type={action.type}
            onClick={() => onAction(action)}
          >
            <span>{action.label}</span>
            <span aria-hidden="true">{action.type === "continue_chat" ? "＋" : "↗"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AudienceMembersModal({ members = [], onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!members.length) return null;
  return (
    <div className="audience-modal" role="presentation">
      <button className="audience-modal-backdrop" type="button" aria-label="關閉會員詳情" onClick={onClose} />
      <section className="audience-modal-panel" role="dialog" aria-modal="true" aria-labelledby="audience-modal-title">
        <header className="audience-modal-header">
          <div>
            <span className="eyebrow">客群摘要</span>
            <h2 id="audience-modal-title">符合條件的會員 <span className="audience-modal-count">共 {members.length} 位摘要</span></h2>
          </div>
          <button className="audience-modal-close" type="button" aria-label="關閉會員詳情" onClick={onClose}>×</button>
        </header>
        <div className="audience-modal-body">
          <div className="audience-member-list">
            {members.map((member) => (
              <article className="audience-member-row" key={member.member_label}>
                <strong>{member.member_label}</strong>
                <span>{member.segment_name || "一般會員"}</span>
                <span>{["active", "enabled"].includes(member.status) ? "會員狀態：啟用" : `會員狀態：${member.status || "未提供"}`}</span>
                <span>{member.points == null ? "點數資料未提供" : `目前點數：${Number(member.points).toLocaleString()}`}</span>
                {member.age != null && <span>年齡：{member.age} 歲</span>}
                {member.gender && <span>性別：{member.gender === "female" ? "女性" : member.gender === "male" ? "男性" : member.gender}</span>}
                {member.last_purchase_at && <span>最近消費：{member.last_purchase_at}</span>}
                {member.order_count != null && <span>累積訂單：{Number(member.order_count).toLocaleString()} 筆</span>}
                {member.product_preference && <span>偏好商品：{member.product_preference}</span>}
                {member.discount_sensitive != null && <span>{member.discount_sensitive ? "對優惠較敏感" : "價格敏感度一般"}</span>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportPanel({ report, onClose }) {
  useEffect(() => {
    if (!report) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [report, onClose]);

  if (!report) return null;
  return (
    <div className="report-modal" role="presentation">
      <button className="report-modal-backdrop" type="button" aria-label="關閉詳細報告" onClick={onClose} />
      <section className="report-modal-panel" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <header className="report-modal-header">
          <div>
            <span className="eyebrow">詳細分析</span>
            <h2 id="report-modal-title">{report.title}</h2>
            <p>{report.summary}</p>
            <span className="report-modal-meta">本報告包含 {(report.sections || []).length} 個分析區塊</span>
          </div>
          <button className="report-modal-close" type="button" aria-label="關閉詳細報告" onClick={onClose}>×</button>
        </header>
        <div className="report-modal-body">
          {(report.sections || []).length > 0 ? (
            report.sections.map((section, index) => (
              <ReportSection section={section} key={`${section.title}-${index}`} />
            ))
          ) : (
            <div className="report-empty-state">目前沒有可展示的詳細數據。</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ReportSection({ section }) {
  const columns = section.columns || [];
  const rows = section.rows || [];
  const isKeyValue = columns.length === 2 && rows.length <= 12;
  const isList = columns.length === 1;
  return (
    <section className={`report-section ${isKeyValue ? "report-section-key-value" : ""} ${isList ? "report-section-list" : ""}`}>
      <header className="report-section-header">
        <h3>{section.title}</h3>
        <span>{rows.length} {isList ? "項" : "筆"}</span>
      </header>
      {!rows.length ? (
        <div className="report-empty-state">目前沒有可展示的資料。</div>
      ) : isKeyValue ? (
        <div className="report-kpi-grid">
          {rows.map((row, rowIndex) => (
            <div className="report-kpi" key={`${section.title}-${rowIndex}`}>
              <span>{row[0] || columns[0]}</span>
              <strong>{row[1] || "資料尚未提供"}</strong>
            </div>
          ))}
        </div>
      ) : isList ? (
        <ul className="report-list">
          {rows.map((row, rowIndex) => (
            <li key={`${section.title}-${rowIndex}`}>{row[0] || "資料尚未提供"}</li>
          ))}
        </ul>
      ) : (
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${section.title}-${rowIndex}`}>
                  {row.map((value, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{value || "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function cardValue(card, label) {
  return card?.items?.find((item) => item.label === label)?.value || "—";
}

function CampaignField({ label, value, emphasis = false }) {
  return (
    <div className={`campaign-field ${emphasis ? "campaign-field-emphasis" : ""}`}>
      <span>{label}</span>
      <strong>{value ?? "資料尚未提供"}</strong>
    </div>
  );
}

function CampaignNotes({ card }) {
  const notes = ["活動說明", "規劃發想", "決策重點"]
    .map((label) => ({ label, value: cardValue(card, label) }))
    .filter(({ value }) => value !== "—");
  if (!notes.length) return null;
  return (
    <div className="campaign-modal-notes">
      <h3>規劃說明</h3>
      {notes.map((note) => (
        <div className="campaign-modal-note" key={note.label}>
          <span>{note.label}</span>
          <p>{note.value}</p>
        </div>
      ))}
    </div>
  );
}

function CampaignDraftModal({ campaign, onClose }) {
  if (!campaign) return null;
  const { card, campaignId, metrics, loading, error } = campaign;
  const isPerformanceCard = card?.type === "campaign_performance";
  const statusLabel = metrics?.campaign_status === "executed"
    ? "已發送"
    : metrics?.campaign_status === "draft"
      ? "待確認"
      : metrics?.campaign_status || "待確認";
  const audienceValue = metrics ? `${metrics.audience_total} 人` : cardValue(card, "預估客群");
  return (
    <div className="campaign-modal" role="presentation">
      <button className="campaign-modal-backdrop" type="button" aria-label="關閉活動草稿" onClick={onClose} />
      <section className="campaign-modal-panel" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title">
        <header className="campaign-modal-header">
          <div>
            <span className="eyebrow">活動規劃</span>
            <h2 id="campaign-modal-title">{isPerformanceCard ? "活動成效摘要" : "活動草稿詳情"}</h2>
            <p>{isPerformanceCard ? "快速檢視目前活動成果與後續查看位置。" : "確認活動條件後，再決定是否建立 CRM 草稿。"}</p>
          </div>
          <div className="campaign-modal-header-actions">
            <span className={`modal-status modal-status-${statusLabel === "已發送" ? "done" : "pending"}`}>{statusLabel}</span>
            <button className="campaign-modal-close" type="button" aria-label="關閉活動草稿" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="campaign-modal-body">
          <div className="campaign-modal-grid">
          {isPerformanceCard ? (
            <>
              <CampaignField label="活動主題" value={cardValue(card, "活動主題") || "本次活動"} emphasis />
              <CampaignField label="本次發送" value={cardValue(card, "本次發送")} />
              <CampaignField label="已核銷" value={cardValue(card, "已核銷")} />
              <CampaignField label="核銷率" value={cardValue(card, "核銷率")} />
              <CampaignField label="目前狀態" value={statusLabel} />
              <CampaignField label="活動營收" value={metrics?.estimated_revenue ?? "資料尚未提供"} />
            </>
          ) : (
            <>
              <CampaignField label="活動主題" value={cardValue(card, "活動主題")} emphasis />
              <CampaignField label="目標客群" value={cardValue(card, "目標客群")} />
              <CampaignField label="主推商品" value={cardValue(card, "主推商品")} />
              <CampaignField label="預估客群" value={audienceValue} />
              <CampaignField label="優惠內容" value={cardValue(card, "優惠內容")} />
              <CampaignField label="建議通路" value={cardValue(card, "建議通路")} />
              <CampaignField label="活動草稿狀態" value={campaignId ? "已建立" : "尚未建立"} />
              <CampaignField label="目前狀態" value={statusLabel} />
              <CampaignField label="已發送優惠" value={metrics ? `${metrics.issued_count} 人` : "—"} />
              <CampaignField label="已使用優惠" value={metrics ? `${metrics.redeemed_count} 人` : "—"} />
            </>
          )}
          </div>
          {!isPerformanceCard && <CampaignNotes card={card} />}
          <div className="campaign-modal-status">
          {loading && "正在讀取活動最新資料。"}
          {!loading && error && "目前無法讀取最新活動狀態，先顯示本次規劃摘要。"}
          {!loading && !error && metrics?.campaign_status === "draft" && "草稿已建立，請至 CRM 後台確認是否發送優惠券。"}
          {!loading && !error && metrics?.campaign_status === "executed" && "CRM 已完成發送，可查看後續核銷與營收成效。"}
          {!loading && !error && !metrics?.campaign_status && "目前尚未取得 CRM 活動狀態。"}
          </div>
          {CRM_ADMIN_URL && (
            <div className="campaign-modal-footer">
            <a
              className="message-action message-action-open_campaign"
              href={`${CRM_ADMIN_URL}/staff/automation/ai-marketing?campaign_id=${encodeURIComponent(campaignId)}`}
              target="_blank"
              rel="noreferrer"
            >
              開啟 CRM 後台
            </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Message({ message, onAction, onViewAudienceMembers }) {
  const isUser = message.role === "user";
  const workflowStatusLabel = {
    historical_analyzed: "去年檔期已分析",
    plan_ready: "待確認建立",
    research_ready: "研究設定待確認",
    draft_created: "草稿已建立",
    sent: "已發送",
  }[message.workflow?.status] || "待確認";
  return (
    <article className={`message-row ${isUser ? "message-user" : "message-assistant"}`}>
      {!isUser && <div className="avatar avatar-ai" aria-hidden="true">AI</div>}
      <div className="message-content">
        <div className={`message-bubble ${message.error ? "message-error" : ""}`}>
          {!isUser && (
            <div className="message-heading">
              <strong>CATCH 營運助手</strong>
              {message.intent && <span className="intent-badge">{intentLabel(message.intent)}</span>}
              {message.confidence && (
                <span className={`confidence-badge ${confidenceTone(message.confidence)}`}>
                  信心度 {message.confidence}/10
                </span>
              )}
            </div>
          )}
          <p><RichText text={message.text} /></p>
        </div>
        {!isUser && (
          <>
            <CardList
              cards={message.cards}
              audienceMembers={message.audienceMembers}
              onViewAudienceMembers={() => onViewAudienceMembers(message.audienceMembers)}
            />
            {message.progress?.length > 0 && (
              <div className="agent-progress" data-testid="agent-progress">
                <div className="agent-progress-heading">
                  <strong>分析進度</strong>
                  <span>已完成可驗證步驟</span>
                </div>
                <ol>
                  {message.progress.map((step) => (
                    <li key={step.key} className={`agent-progress-${step.status}`}>
                      <span aria-hidden="true">{step.status === "completed" ? "✓" : "·"}</span>
                      <span>{step.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {message.workflow && (
              <div className="workflow-progress" data-testid="workflow-progress">
                <span>活動規劃進度</span>
                <strong>第 {message.workflow.revision} 版 · {workflowStatusLabel}</strong>
              </div>
            )}
            <ActionList actions={message.actions} onAction={(action) => onAction(action, message)} />
            <FileList files={message.files} />
            <ChartList charts={message.charts} />
          </>
        )}
      </div>
      {isUser && <div className="avatar avatar-user" aria-hidden="true">你</div>}
    </article>
  );
}

export default function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [conversationId, setConversationId] = useState(
    () => window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY),
  );
  const [restoringConversation, setRestoringConversation] = useState(
    () => Boolean(window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY)),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [activeAudienceMembers, setActiveAudienceMembers] = useState(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const restoreControllerRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(activeCampaign || activeReport || activeAudienceMembers));
    return () => document.body.classList.remove("modal-open");
  }, [activeCampaign, activeReport, activeAudienceMembers]);

  useEffect(() => {
    if (!conversationId) {
      setRestoringConversation(false);
      return undefined;
    }
    let active = true;
    const controller = new AbortController();
    restoreControllerRef.current = controller;
    getConversation(conversationId, controller.signal)
      .then((snapshot) => {
        if (!active || !snapshot) return;
        const savedMessages = (snapshot.messages || []).map(messageFromSavedPayload);
        setMessages([initialMessages[0], ...savedMessages]);
      })
      .catch(() => {
        if (!active) return;
        window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
        setConversationId(null);
      })
      .finally(() => {
        if (active) setRestoringConversation(false);
      });
    return () => {
      active = false;
      controller.abort();
      if (restoreControllerRef.current === controller) {
        restoreControllerRef.current = null;
      }
    };
  }, []);

  async function submitMessage(text = input) {
    const question = text.trim();
    if (!question || loading || restoringConversation) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: question },
    ]);
    setInput("");
    setLoading(true);

    try {
      const payload = await askAgent(question, conversationId);
      const nextConversationId = payload?.conversation_id || conversationId;
      setConversationId(nextConversationId);
      if (nextConversationId) {
        window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, nextConversationId);
      }
      setMessages((current) => [...current, messageFromAgentPayload(payload)]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "目前無法連線至服務，請稍後再試。",
          cards: [],
          files: [],
          charts: [],
          reports: [],
          workflow: null,
          error: true,
          intent: "連線失敗",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action, message) {
    if (action.type === "create_campaign_draft") {
      const actionConversationId = message.conversationId || conversationId;
      if (!actionConversationId) return;
      if (!window.confirm("確認建立這份 CRM 活動草稿嗎？建立後仍需確認才會發送優惠券。")) return;
      setLoading(true);
      try {
        const payload = await createCampaignDraft(actionConversationId);
        setMessages((current) => [
          ...current.map((item) => item.id === message.id
            ? { ...item, actions: item.actions.filter((itemAction) => itemAction.type !== "create_campaign_draft") }
            : item),
          messageFromAgentPayload(payload),
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: error instanceof Error ? error.message : "目前無法建立活動草稿。",
            cards: [], actions: [], files: [], charts: [], reports: [], workflow: null,
            error: true, intent: "建立失敗", conversationId: actionConversationId,
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (action.type === "send_coupon") {
      const actionConversationId = message.conversationId || conversationId;
      const campaignId = action.payload?.campaign_id;
      if (!actionConversationId || !campaignId) return;
      if (!window.confirm("確認發送優惠券嗎？這會透過 CRM 建立本次活動的優惠券。")) return;
      setLoading(true);
      try {
        const payload = await sendCampaignCoupon(campaignId, actionConversationId);
        setMessages((current) => [
          ...current.map((item) => item.id === message.id
            ? { ...item, actions: item.actions.filter((itemAction) => itemAction.type !== "send_coupon") }
            : item),
          messageFromAgentPayload(payload),
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: error instanceof Error ? error.message : "目前無法發送優惠券。",
            cards: [], actions: [], files: [], charts: [], reports: [], workflow: null,
            error: true, intent: "發送失敗", conversationId: actionConversationId,
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (action.type === "open_campaign") {
      const campaignId = action.payload?.campaign_id || "—";
      setActiveCampaign({
        card: message.cards?.find((card) => card.type === "marketing_plan")
          || message.cards?.find((card) => card.type === "campaign_performance"),
        campaignId,
        loading: true,
      });
      try {
        const metrics = await getCampaignMetrics(campaignId);
        setActiveCampaign((current) => current?.campaignId === campaignId ? { ...current, metrics, loading: false } : current);
      } catch (error) {
        setActiveCampaign((current) => current?.campaignId === campaignId ? { ...current, error, loading: false } : current);
      }
      return;
    }
    if (action.type === "open_report") {
      const reportId = action.payload?.report_id;
      const report = message.reports?.find((item) => item.report_id === reportId) || message.reports?.[0];
      if (report) setActiveReport(report);
      return;
    }
    if (action.type === "continue_chat") {
      const nextPrompt = action.payload?.message || action.label;
      await submitMessage(nextPrompt);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter"
      && !event.shiftKey
      && (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div><strong>CATCH</strong><span>營運智慧助手</span></div>
        </div>

        <section className="sidebar-section">
          <p className="sidebar-label">快速測試</p>
          {suggestionGroups.map((group, groupIndex) => (
            <details className="suggestion-group" key={group.label} open={groupIndex === 0}>
              <summary>
                <span>{group.label}</span>
                <i aria-hidden="true">⌄</i>
              </summary>
              <div className="suggestion-list">
                {group.items.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => submitMessage(suggestion)}>
                    <span aria-hidden="true">＋</span>{suggestion}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </section>

        <div className="sidebar-note">
          <span className="status-dot" />
          <div><strong>對話助手</strong><small>對話可延續，活動規劃會保留進度</small></div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div><span className="eyebrow">CATCH</span><h1>AI 行銷顧問</h1></div>
          <div className="header-actions">
            <span className="ai-status"><i />AI 輔助分析</span>
            <button
              type="button"
              className="clear-button"
              onClick={() => {
                restoreControllerRef.current?.abort();
                restoreControllerRef.current = null;
                setMessages(initialMessages);
                setConversationId(null);
                setRestoringConversation(false);
                window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
                setActiveCampaign(null);
                setActiveReport(null);
                setActiveAudienceMembers(null);
              }}
            >
              清除對話
            </button>
          </div>
        </header>

        <div className="conversation" aria-live="polite">
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              onAction={handleAction}
              onViewAudienceMembers={setActiveAudienceMembers}
            />
          ))}
          {loading && (
            <div className="message-row message-assistant">
              <div className="avatar avatar-ai">AI</div>
              <div className="message-bubble typing-bubble">
                <span /><span /><span /><em>正在整理營運資料</em>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="composer-area">
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入問題，例如：中壢門市這週有沒有營收異常？"
              rows="1"
              disabled={loading || restoringConversation}
              aria-label="輸入營運問題"
            />
            <button type="submit" disabled={loading || restoringConversation || !input.trim()} aria-label="送出問題">
              送出 <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p>Enter 換行 · ⌘/Ctrl + Enter 送出 · AI 回覆僅依系統資料</p>
        </footer>
      </section>
      <CampaignDraftModal campaign={activeCampaign} onClose={() => setActiveCampaign(null)} />
      <ReportPanel report={activeReport} onClose={() => setActiveReport(null)} />
      <AudienceMembersModal members={activeAudienceMembers || []} onClose={() => setActiveAudienceMembers(null)} />
    </main>
  );
}
