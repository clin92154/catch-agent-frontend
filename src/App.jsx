import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const CRM_ADMIN_URL = (import.meta.env.VITE_CRM_ADMIN_URL || "").replace(/\/$/, "");
const RICH_TEXT_PATTERN = /<span class="(catch-(?:highlight|positive|negative|warning|info|ai))">([\s\S]*?)<\/span>/g;
const MARKETING_PROMPT = "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠。";
const INSIGHT_PROMPT = "分析本週營收、Top 5 商品、門市與通路表現。";
const MEMBER_PROMPT = "找出最近最可能購買的會員。";
const PERFORMANCE_PROMPT = "分析活動 1 是否成功，以及下一次怎麼改善。";
const STRATEGY_RESEARCH_PROMPT = "研究活動 1，提前四週和提前兩週哪個效果好？";
const HISTORICAL_RESEARCH_PROMPT = "先分析去年母親節，再規劃今年活動，並比較提前四週與提前兩週。";
const CONVERSATION_STORAGE_KEY = "catch-agent-conversation-id";

const suggestionGroups = [
  {
    label: "AI 行銷洞察",
    items: [
      INSIGHT_PROMPT,
      "上週哪個商品最好？",
      "本週哪個門市表現最好？",
    ],
  },
  {
    label: "AI 會員分析",
    items: [
      MEMBER_PROMPT,
      "找出最近可能流失的會員。",
      "預覽蛋糕且已綁定 LINE 的高價值會員。",
    ],
  },
  {
    label: "AI 活動規劃",
    items: [
      MARKETING_PROMPT,
      "幫我規劃今年母親節蛋糕活動，提供 LINE 會員專屬優惠。",
      "針對高價值會員設計 LINE 專屬優惠。",
    ],
  },
  {
    label: "AI 成效分析",
    items: [PERFORMANCE_PROMPT, "分析活動 1 的核銷率與 30 天回購。", "分析活動 1 的活動營收與客群效果。"],
  },
  {
    label: "AI 行銷研究",
    items: [
      HISTORICAL_RESEARCH_PROMPT,
      "根據去年分析規劃今年母親節活動。",
      "建立今年活動的策略研究設定。",
      STRATEGY_RESEARCH_PROMPT,
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
    throw new Error(payload?.error?.message || `API 回傳 ${response.status}`);
  }
  return payload;
}

async function createCampaignDraft(conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/campaigns/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `API 回傳 ${response.status}`);
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
    throw new Error(payload?.error?.message || `API 回傳 ${response.status}`);
  }
  return payload;
}

async function getCampaignMetrics(campaignId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/campaigns/${encodeURIComponent(campaignId)}/metrics`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `API 回傳 ${response.status}`);
  }
  return payload?.data || {};
}

async function getConversation(conversationId, signal) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/conversations/${encodeURIComponent(conversationId)}`, { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `API 回傳 ${response.status}`);
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
    workflow: payload?.workflow || null,
    confidence: payload?.reply?.confidence,
    intent: payload?.resolved_intent?.task || payload?.status || "完成",
    conversationId: payload?.conversation_id || null,
  };
}

function messageFromAgentPayload(payload) {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: payload?.reply?.text || "API 已完成，但沒有文字回覆。",
    cards: payload?.reply?.cards || [],
    actions: payload?.reply?.actions || [],
    files: payload?.reply?.files || [],
    charts: payload?.reply?.charts || [],
    reports: payload?.reply?.reports || [],
    workflow: payload?.workflow || null,
    confidence: payload?.reply?.confidence,
    intent: payload?.resolved_intent?.task || payload?.status || "完成",
    conversationId: payload?.conversation_id || null,
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
            {/* <span>
              <strong>{chart.name}</strong>
              <small>{chart.description}</small>
            </span> */}
            <a href={assetUrl(chart.file_url)} target="_blank" rel="noreferrer">開啟</a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function CardList({ cards = [] }) {
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
                <span className="insight-card-eyebrow">{cardEyebrows[card.type] || "CRM 資訊"}</span>
                <strong>{card.title}</strong>
              </div>
            </header>
            {card.description && <p className="insight-card-description">{card.description}</p>}
            {primaryItems.length > 0 && <div className="insight-grid">
            {primaryItems.map((item, itemIndex) => (
              <article
                className={`insight-item insight-item-${item.status || "neutral"}`}
                data-status={item.status}
                data-trend={item.trend}
                key={`${item.label}-${itemIndex}`}
              >
                <div className="insight-item-heading">
                  <strong>{item.label}</strong>
                  {item.change_pct && <span>{item.change_pct}</span>}
                </div>
                <div className="insight-value">
                  <b>{item.value ?? "資料尚未提供"}</b>
                  {item.unit && <small>{item.unit}</small>}
                </div>
                {item.comparison_value !== undefined && item.comparison_value !== null && item.comparison_value !== "" && (
                  <p className="insight-comparison">
                    {item.comparison_label || "比較期"}：{item.comparison_value}
                  </p>
                )}
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
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
        <strong>下一步</strong>
        <span>請選擇要繼續的操作</span>
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
          </div>
          <button className="report-modal-close" type="button" aria-label="關閉詳細報告" onClick={onClose}>×</button>
        </header>
        <div className="report-modal-body">
          {(report.sections || []).map((section, index) => (
            <ReportSection section={section} key={`${section.title}-${index}`} />
          ))}
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
      <h3>{section.title}</h3>
      {isKeyValue ? (
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
              <CampaignField label="CRM 草稿" value={campaignId} emphasis />
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
              <CampaignField label="活動草稿編號" value={campaignId} />
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

function Message({ message, onAction }) {
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
            <CardList cards={message.cards} />
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
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const restoreControllerRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(activeCampaign || activeReport));
    return () => document.body.classList.remove("modal-open");
  }, [activeCampaign, activeReport]);

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
          text: error instanceof Error ? error.message : "目前無法連線至 API。",
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
      setInput(action.payload?.message || action.label);
      requestAnimationFrame(() => inputRef.current?.focus());
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
          <div><strong>Agent API</strong><small>對話可延續，活動規劃會保留進度</small></div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div><span className="eyebrow">CATCH AGENT</span><h1>AI 行銷顧問</h1></div>
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
              }}
            >
              清除對話
            </button>
          </div>
        </header>

        <div className="conversation" aria-live="polite">
          {messages.map((message) => <Message key={message.id} message={message} onAction={handleAction} />)}
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
    </main>
  );
}
