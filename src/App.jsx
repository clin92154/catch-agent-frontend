import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const CRM_ADMIN_URL = (import.meta.env.VITE_CRM_ADMIN_URL || "").replace(/\/$/, "");
const RICH_TEXT_PATTERN = /<span class="(catch-(?:highlight|positive|negative|warning|info|ai))">([\s\S]*?)<\/span>/g;
const MARKETING_PROMPT = "規劃沉睡會員的蛋糕喚回活動，提供 9 折優惠，並建立 CRM 活動草稿。";
const INSIGHT_PROMPT = "分析本週營收、Top 5 商品、門市與通路異常。";
const MEMBER_PROMPT = "找出最近最可能購買、即將流失及值得優先經營的會員。";
const PERFORMANCE_PROMPT = "分析活動 1 是否成功，以及下一次怎麼改善。";
const CONVERSATION_STORAGE_KEY = "catch-agent-conversation-id";

const suggestionGroups = [
  {
    label: "AI 營運診斷",
    items: [
      "三峽門市 2026/07/13 到 07/19 有沒有營收異常？",
      "找出 2026/07/13 到 07/19 來客異常的門市。",
      "哪些門市 2026/07/13 到 07/19 有 5,000 元以上大額訂單？",
    ],
  },
  {
    label: "AI 智慧叫貨",
    items: [
      "分析三峽門市 2026/07/13 到 07/19 的商品銷量。",
      "預測三峽門市 2026/07/20 起三天的叫貨量。",
      "找出 2025/03/01 報廢超過 4 顆的門市與商品。",
    ],
  },
  {
    label: "AI 行銷規劃",
    items: [INSIGHT_PROMPT, MEMBER_PROMPT, MARKETING_PROMPT, PERFORMANCE_PROMPT],
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
};

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "你好，我是 CATCH 營運助手。你可以直接輸入門市名稱、日期與想查詢的營運問題。",
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
  return (
    <div className="insight-card-list" aria-label="營運分析圖卡">
      {cards.map((card, cardIndex) => (
        <section
          className={`insight-card insight-card-${card.type}`}
          key={`${card.type}-${card.title}-${cardIndex}`}
        >
          <header className="insight-card-header">
            <strong>{card.title}</strong>
          </header>
          {card.description && <p className="insight-card-description">{card.description}</p>}
          <div className="insight-grid">
            {(card.items || []).map((item, itemIndex) => (
              <article
                className="insight-item"
                data-status={item.status}
                data-trend={item.trend}
                key={`${item.label}-${itemIndex}`}
              >
                <div className="insight-item-heading">
                  <strong>{item.label}</strong>
                  {item.change_pct && <span>{item.change_pct}</span>}
                </div>
                <div className="insight-value">
                  <b>{item.value}</b>
                  {item.unit && <small>{item.unit}</small>}
                </div>
                {item.comparison_value && (
                  <p className="insight-comparison">
                    {item.comparison_label || "比較期"}：{item.comparison_value}
                  </p>
                )}
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ActionList({ actions = [], onAction }) {
  if (!actions.length) return null;
  return (
    <div className="message-actions" aria-label="後續操作">
      {actions.map((action, index) => (
        <button
          type="button"
          className={`message-action message-action-${action.type}`}
          key={`${action.type}-${action.label}-${index}`}
          data-action-type={action.type}
          onClick={() => onAction(action)}
        >
          {action.label}
          <span aria-hidden="true">{action.type === "continue_chat" ? "＋" : "↗"}</span>
        </button>
      ))}
    </div>
  );
}

function ReportPanel({ report, onClose }) {
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
            <section className="report-section" key={`${section.title}-${index}`}>
              <h3>{section.title}</h3>
              <div className="report-table-wrap">
                <table>
                  <thead>
                    <tr>{(section.columns || []).map((column) => <th key={column}>{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(section.rows || []).map((row, rowIndex) => (
                      <tr key={`${section.title}-${rowIndex}`}>
                        {row.map((value, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{value}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function cardValue(card, label) {
  return card?.items?.find((item) => item.label === label)?.value || "—";
}

function CampaignDraftModal({ campaign, onClose }) {
  if (!campaign) return null;
  const { card, campaignId, metrics, loading, error } = campaign;
  const statusLabel = metrics?.campaign_status === "draft" ? "待確認" : metrics?.campaign_status || "待確認";
  const audienceValue = metrics ? `${metrics.audience_total} 人` : cardValue(card, "預估客群");
  return (
    <div className="campaign-modal" role="presentation">
      <button className="campaign-modal-backdrop" type="button" aria-label="關閉活動草稿" onClick={onClose} />
      <section className="campaign-modal-panel" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title">
        <header className="campaign-modal-header">
          <div>
            <span className="eyebrow">活動規劃</span>
            <h2 id="campaign-modal-title">活動草稿詳情</h2>
          </div>
          <button className="campaign-modal-close" type="button" aria-label="關閉活動草稿" onClick={onClose}>×</button>
        </header>
        <div className="campaign-modal-grid">
          <div><span>活動主題</span><strong>{cardValue(card, "活動主題")}</strong></div>
          <div><span>目標客群</span><strong>{cardValue(card, "目標客群")}</strong></div>
          <div><span>預估客群</span><strong>{audienceValue}</strong></div>
          <div><span>優惠內容</span><strong>{cardValue(card, "優惠內容")}</strong></div>
          <div><span>建議通路</span><strong>{cardValue(card, "建議通路")}</strong></div>
          <div><span>活動草稿編號</span><strong>{campaignId}</strong></div>
          <div><span>目前狀態</span><strong>{statusLabel}</strong></div>
          <div><span>已發送優惠</span><strong>{metrics ? `${metrics.issued_count} 人` : "—"}</strong></div>
          <div><span>已使用優惠</span><strong>{metrics ? `${metrics.redeemed_count} 人` : "—"}</strong></div>
        </div>
        <div className="campaign-modal-status">
          {loading && "正在讀取活動最新資料。"}
          {!loading && error && "目前無法讀取最新活動狀態，先顯示本次規劃摘要。"}
          {!loading && !error && "待確認：目前尚未發送優惠或啟動活動。"}
        </div>
        {CRM_ADMIN_URL && (
          <div className="campaign-modal-footer">
            <a
              className="message-action message-action-open_campaign"
              href={`${CRM_ADMIN_URL}/staff/dashboard`}
              target="_blank"
              rel="noreferrer"
            >
              開啟 CRM 後台
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function Message({ message, onAction }) {
  const isUser = message.role === "user";
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
                <strong>第 {message.workflow.revision} 版 · 待確認</strong>
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
      setMessages((current) => [
        ...current,
        {
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
        },
      ]);
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
    if (action.type === "open_campaign") {
      const campaignId = action.payload?.campaign_id || "—";
      setActiveCampaign({
        card: message.cards?.find((card) => card.type === "marketing_plan"),
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
          <p className="sidebar-label">快速提問</p>
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
          <div><span className="eyebrow">CATCH AGENT</span><h1>門市營運與智慧叫貨</h1></div>
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
