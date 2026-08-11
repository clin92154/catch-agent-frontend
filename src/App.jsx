import { useEffect, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const RICH_TEXT_PATTERN = /<span class="(catch-(?:highlight|positive|negative|warning|info|ai))">([\s\S]*?)<\/span>/g;

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
];

const INTENT_LABELS = {
  revenue_anomaly: "營收異常",
  visitor_anomaly: "來客異常",
  average_order_value_increase: "客單價分析",
  store_district: "門市商圈",
  product_sales: "商品銷量",
  demand_forecast: "叫貨預測",
  waste_anomaly: "報廢異常",
};

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "你好，我是 CATCH 營運助手。你可以直接輸入門市名稱、日期與想查詢的營運問題。",
    cards: [],
    files: [],
    charts: [],
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

async function askAgent(message) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
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

function Message({ message }) {
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submitMessage(text = input) {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: question },
    ]);
    setInput("");
    setLoading(true);

    try {
      const payload = await askAgent(question);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload?.reply?.text || "API 已完成，但沒有文字回覆。",
          cards: payload?.reply?.cards || [],
          files: payload?.reply?.files || [],
          charts: payload?.reply?.charts || [],
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
          error: true,
          intent: "連線失敗",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
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
            <details className="suggestion-group" key={group.label} defaultOpen={groupIndex === 0}>
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
          <div><strong>Agent API</strong><small>每次問題獨立分析，不保存對話記憶</small></div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div><span className="eyebrow">CATCH AGENT</span><h1>門市營運與智慧叫貨</h1></div>
          <div className="header-actions">
            <span className="ai-status"><i />AI 輔助分析</span>
            <button type="button" className="clear-button" onClick={() => setMessages(initialMessages)}>清除對話</button>
          </div>
        </header>

        <div className="conversation" aria-live="polite">
          {messages.map((message) => <Message key={message.id} message={message} />)}
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
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入問題，例如：中壢門市這週有沒有營收異常？"
              rows="1"
              disabled={loading}
              aria-label="輸入營運問題"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="送出問題">
              送出 <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p>Enter 送出 · Shift + Enter 換行 · AI 回覆僅依系統資料</p>
        </footer>
      </section>
    </main>
  );
}
