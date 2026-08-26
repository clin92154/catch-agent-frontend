import { lazy, Suspense, useEffect, useRef, useState } from "react";
const OperationsReport = lazy(() => import("./OperationsReportV1"));


const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const RICH_TEXT_PATTERN = /<span class="(catch-(?:highlight|positive|negative|warning|info|ai))">([\s\S]*?)<\/span>/g;


const suggestionGroups = [
  {
    label: "模組一｜營收分析",
    items: [
      "中壢門市本週營收狀況如何？",
      "比較南京和中壢門市本月營收。",
      "比較南京、中壢與大安三間門市本週營收。",
      "整理全部門市本月營收排行。",
      "找出本週營收異常的門市。"
    ]
  },

  {
    label: "模組一｜來客與客單價",
    items: [
      "中壢門市本週來客狀況如何？",
      "比較南京和中壢門市本月來客。",
      "比較各商圈本週平均客單價。",
      "哪些門市本週有單筆 5,000 元以上的大客戶訂單？",
      "找出本週來客或客單價異常的門市。"
    ]
  },

  {
    label: "模組一｜綜合營運比較",
    items: [
      "中壢門市本週營運狀況如何？",
      "比較南京、中壢與大安三間門市本月營運狀況。",
      "比較全部門市本月營收、來客與平均客單價。",
      "比較各商圈本週營運狀況。",
      "找出本月營運表現最需要注意的門市。"
    ]
  },

  {
    label: "模組一｜日期與同期",
    items: [
      "查看中壢門市今天營運狀況。",
      "比較中壢門市本週與上週營運狀況。",
      "比較全部門市本月與上月營運狀況。",
      "比較全部門市本月與去年同期營運狀況。",
      "比較今年與去年全部門市營運狀況。"
    ]
  },

  {
    label: "模組一｜外部因素與檔期",
    items: [
      "分析中壢門市本週營收與天氣變化。",
      "比較南京和中壢門市本週營運與天氣差異。",
      "分析本週營收異常門市是否同時出現明顯降雨。",
      "比較母親節檔期與去年同期的全部門市營運狀況。"
    ]
  },

  {
    label: "其他模組",
    items: [
      "分析三峽門市本週商品銷量。",
      "找出三峽門市本週熱銷商品。",
      "預測三峽門市未來三天的叫貨量。",
      "找出全部門市目前低庫存商品。",
      "找出昨日報廢超過 4 顆的門市與商品。"
    ]
  }
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
    sources: [],
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

function isCsvFile(file) {
  /** 依檔名、MIME Type 或 URL 自動判斷 CSV 附件。 */

  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  const url = String(file?.url || "").toLowerCase().split("?")[0];

  return (
    type.includes("text/csv")
    || type.includes("application/csv")
    || type === "csv"
    || name.endsWith(".csv")
    || url.endsWith(".csv")
  );
}

function isExcelFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  return (
    name.endsWith(".xlsx")
    || name.endsWith(".xls")
    || type.includes("spreadsheet")
    || type === "xlsx"
  );
}

function isJsonFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  return (
    name.endsWith(".json")
    || type.includes("application/json")
    || type === "json"
  );
}

function isImageFile(file) {
  const value = `${file?.type || ""} ${file?.name || ""} ${file?.url || ""}`.toLowerCase().split("?")[0];
  return value.includes("image/") || /\.(?:png|jpe?g|gif|webp|svg)$/.test(value);
}

const CSV_IDENTITY_COLUMNS = new Set(["門市", "門市名稱", "商圈", "商品", "商品名稱"]);
const CSV_COLUMN_ROLES = { change: ["變化率", "差額", "增減"], attention: ["營運提醒", "營運狀態", "同期評估", "觸發規則", "異常狀態"], highlight: ["大額訂單", "大客戶訂單", "最大單筆"] };

function csvCellClass(header, value = "") {
  const role = CSV_IDENTITY_COLUMNS.has(String(header)) ? "identity" : Object.entries(CSV_COLUMN_ROLES).find(([, terms]) => terms.some((term) => String(header).includes(term)))?.[0];
  if (!role) return "";
  if (role === "change") {
    const numberValue = Number(String(value).replaceAll(",", "").match(/[+-]?\d+(?:\.\d+)?/)?.[0]);
    return `csv-cell-emphasis csv-cell-change ${Number.isFinite(numberValue) && numberValue < 0 ? "is-negative" : Number.isFinite(numberValue) && numberValue > 0 ? "is-positive" : ""}`;
  }
  if (role === "attention") return `csv-cell-emphasis csv-cell-attention ${/(穩定|正常|無明顯)/.test(String(value)) ? "is-normal" : ""}`;
  return `csv-cell-emphasis csv-cell-${role}`;
}

function CsvTable({ file }) {
  /** 自動下載 CSV，並在 Agent 回覆下方渲染表格。 */

  const [state, setState] = useState({
    loading: true,
    rows: [],
    error: "",
  });
  const [sort, setSort] = useState({ index: -1, direction: 1 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCsv() {
      try {
        const response = await fetch(assetUrl(file.url), {
          signal: controller.signal,
          headers: {
            Accept: "text/csv,text/plain,*/*",
          },
        });

        if (!response.ok) {
          throw new Error(`無法讀取 CSV（HTTP ${response.status}）`);
        }

        const text = await response.text();
        const rows = parseCsv(text);

        if (rows.length < 2) {
          throw new Error("CSV 沒有可顯示的資料列");
        }

        setState({
          loading: false,
          rows,
          error: "",
        });
      } catch (error) {
        if (error.name === "AbortError") return;

        setState({
          loading: false,
          rows: [],
          error: error.message || "CSV 載入失敗",
        });
      }
    }

    loadCsv();

    return () => controller.abort();
  }, [file.url]);

  if (state.loading) {
    return (
      <section className="csv-preview">
        <p className="csv-status">正在載入重點門市資料……</p>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="csv-preview csv-preview-error">
        <p className="csv-status">{state.error}</p>
        {/* 下載入口暫時隱藏，完整 CSV 仍保留於後端。 */}
      </section>
    );
  }

  const [headers, ...records] = state.rows;
  const sortedRecords = sort.index < 0 ? records : [...records].sort((left, right) => {
    const first = Number(String(left[sort.index] || "").replace(/[,%]/g, ""));
    const second = Number(String(right[sort.index] || "").replace(/[,%]/g, ""));
    const result = Number.isFinite(first) && Number.isFinite(second) ? first - second : String(left[sort.index] || "").localeCompare(String(right[sort.index] || ""), "zh-Hant");
    return result * sort.direction;
  });

  return (
    <section className="csv-preview">
      <header className="csv-preview-header">
        <strong>{file.name || "重點門市摘要"}</strong>
        {/* <a href={assetUrl(file.url)} download={file.name}>下載全部</a> */}
      </header>

      <div className="csv-table-scroll">
        <table>
          <colgroup>{headers.map((header, index) => <col key={`${header}-width-${index}`} style={{ width: `${100 / headers.length}%` }} />)}</colgroup>
          <thead>
            <tr>
              {headers.map((header, index) => <th className={csvCellClass(header)} key={`${header}-${index}`}><button type="button" onClick={() => setSort({ index, direction: sort.index === index ? -sort.direction : 1 })}>{header}<span>{sort.index === index ? sort.direction > 0 ? " ↑" : " ↓" : " ↕"}</span></button></th>)}
            </tr>
          </thead>

          <tbody>
            {(expanded ? sortedRecords : sortedRecords.slice(0, 3)).map((record, rowIndex) => (
              <tr key={`${file.url}-${rowIndex}`}>
                {headers.map((header, columnIndex) => {
                  const value = record[columnIndex];

                  return (
                    <td className={csvCellClass(header, value)} key={`${header}-${columnIndex}`}>
                      {value === undefined || value === ""
                        ? "—"
                        : value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedRecords.length > 3 && <tr className="csv-show-more"><td colSpan={headers.length}><button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "收合" : "顯示更多..."}</button></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CsvTableList({ files = [] }) {
  /** 從 reply.files 自動找出所有 CSV 並渲染表格。 */

  const csvFiles = files.filter(isCsvFile);

  if (!csvFiles.length) {
    return null;
  }

  return (
    <div className="csv-preview-list">
      {csvFiles.map((file) => (
        <CsvTable
          file={file}
          key={file.url || file.name}
        />
      ))}
    </div>
  );
}

function parseCsv(text) {
  /** 解析包含引號、逗號與換行的 CSV。 */

  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if (
      (character === "\n" || character === "\r")
      && !insideQuotes
    ) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      row.push(value.trim());

      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  row.push(value.trim());

  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  // 移除 UTF-8 BOM。
  if (rows[0]?.[0]) {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  }

  return rows;
}

function InteractiveChart({ chart }) {
  const [hidden, setHidden] = useState([]);
  const [hover, setHover] = useState(null);
  const colors = ["#ff6b00", "#2f6db2", "#6654c0", "#238b45"];
  const categories = chart.categories || [];
  const visible = (chart.series || []).map((series, index) => ({ ...series, index })).filter((series) => !hidden.includes(series.index));
  const width = 700;
  const height = 300;
  const left = 68;
  const top = 18;
  const right = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - 62;
  const axisMax = (axis) => Math.max(1, ...visible.filter((series) => (series.axis || "left") === axis).flatMap((series) => series.values || []).map(Number).filter(Number.isFinite));
  const pointX = (index) => left + (categories.length < 2 ? plotWidth / 2 : index * plotWidth / (categories.length - 1));
  const pointY = (value, axis) => top + plotHeight - Number(value) / axisMax(axis || "left") * plotHeight;
  const format = (value) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
  const compact = (value) => new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const show = (series, index) => setHover(`${categories[index]}｜${series.name}：${format(series.values[index])} ${series.unit || ""}`);
  const hasRight = visible.some((series) => series.axis === "right");
  const leftUnit = visible.find((series) => (series.axis || "left") === "left")?.unit || "數值";
  const rightUnit = visible.find((series) => series.axis === "right")?.unit;
  const xLabel = chart.type === "line" ? { daily: "日期（日）", weekly: "期間（週）", monthly: "期間（月）" }[chart.granularity] || "期間" : chart.id === "CHART05" ? "商圈" : "門市／商圈總計";

  if (!categories.length || !chart.series?.length) return <p className="chart-empty">沒有可顯示的圖表資料。</p>;

  return (
    <div className="interactive-chart">
      <header className="chart-heading"><div><h3>{chart.name}</h3>{chart.description && <p>{chart.description}</p>}</div>{chart.granularity && <span>{chart.granularity === "daily" ? "每日" : chart.granularity === "weekly" ? "每週" : "每月"}</span>}</header>
      <div className="chart-legend">{chart.series.map((series, index) => <button type="button" className={hidden.includes(index) ? "is-hidden" : ""} key={`${series.name}-${index}`} onClick={() => setHidden((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}><i style={{ background: colors[index % colors.length] }} />{series.name}（{series.unit}）</button>)}{chart.weather && <span className="weather-legend"><i />雨天</span>}</div>
      <p className="chart-hover" aria-live="polite">{hover || "將游標移到圖表上查看數值"}</p>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.description || chart.name} onMouseLeave={() => setHover(null)}>
          {(chart.weather?.rainy || []).map((rainy, index) => rainy && <rect className="chart-rain" x={left + index * plotWidth / categories.length} y={top} width={plotWidth / categories.length} height={plotHeight} key={`rain-${index}`} />)}
          {[0, 1, 2, 3, 4].map((row) => <g key={row}><line className="chart-grid" x1={left} x2={left + plotWidth} y1={top + row * plotHeight / 4} y2={top + row * plotHeight / 4} /><text className="chart-tick" x={left - 9} y={top + row * plotHeight / 4 + 4} textAnchor="end">{compact(axisMax("left") * (4 - row) / 4)}</text>{hasRight && <text className="chart-tick" x={left + plotWidth + 9} y={top + row * plotHeight / 4 + 4}>{compact(axisMax("right") * (4 - row) / 4)}</text>}</g>)}
          <line className="chart-axis" x1={left} x2={left} y1={top} y2={top + plotHeight} /><line className="chart-axis" x1={left} x2={left + plotWidth} y1={top + plotHeight} y2={top + plotHeight} />{hasRight && <line className="chart-axis" x1={left + plotWidth} x2={left + plotWidth} y1={top} y2={top + plotHeight} />}
          {chart.type === "bar" ? visible.flatMap((series, seriesIndex) => {
            const groupWidth = plotWidth / categories.length;
            const barWidth = Math.min(38, groupWidth / Math.max(visible.length + 1, 2));
            return (series.values || []).map((value, index) => {
              if (value === null || value === undefined) return null;
              const barHeight = plotHeight - (pointY(value, series.axis) - top);
              const x = left + index * groupWidth + (groupWidth - visible.length * barWidth) / 2 + seriesIndex * barWidth;
              return <g key={`${series.index}-${index}`}><rect className="chart-mark" x={x} y={top + plotHeight - barHeight} width={barWidth - 3} height={barHeight} rx="3" fill={colors[series.index % colors.length]} onMouseEnter={() => show(series, index)}><title>{categories[index]}：{format(value)} {series.unit}</title></rect>{categories.length <= 8 && <text className="chart-value-label" x={x + (barWidth - 3) / 2} y={Math.max(top + 10, top + plotHeight - barHeight - 5)} textAnchor="middle">{compact(value)}</text>}</g>;
            });
          }) : visible.map((series) => {
            const points = (series.values || []).map((value, index) => value === null || value === undefined ? null : `${pointX(index)},${pointY(value, series.axis)}`).filter(Boolean).join(" ");
            return <g key={series.index}><polyline className="chart-line" points={points} stroke={colors[series.index % colors.length]} />{(series.values || []).map((value, index) => value === null || value === undefined ? null : <circle className="chart-mark" cx={pointX(index)} cy={pointY(value, series.axis)} r="5" fill={colors[series.index % colors.length]} key={index} onMouseEnter={() => show(series, index)}><title>{categories[index]}：{format(value)} {series.unit}</title></circle>)}</g>;
          })}
          {categories.map((label, index) => <text className="chart-axis-label" x={chart.type === "bar" ? left + (index + 0.5) * plotWidth / categories.length : pointX(index)} y={top + plotHeight + 22} textAnchor="middle" transform={categories.length > 7 ? `rotate(-35 ${chart.type === "bar" ? left + (index + 0.5) * plotWidth / categories.length : pointX(index)} ${top + plotHeight + 22})` : undefined} key={`${label}-${index}`}>{label}</text>)}
          <text className="chart-axis-title" x={left + plotWidth / 2} y={height - 4} textAnchor="middle">{xLabel}</text><text className="chart-axis-title" x="14" y={top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 14 ${top + plotHeight / 2})`}>{leftUnit}</text>{hasRight && <text className="chart-axis-title" x={width - 10} y={top + plotHeight / 2} textAnchor="middle" transform={`rotate(90 ${width - 10} ${top + plotHeight / 2})`}>{rightUnit}</text>}
        </svg>
      </div>
      {chart.weather && <p className="chart-note">藍色區塊代表雨天；天氣資料僅供同期參考。</p>}
      {(chart.annotations || []).map((note) => <p className="chart-note" key={note}>{note}</p>)}
    </div>
  );
}

function PreviewModal({ preview, onClose }) {
  useEffect(() => {
    if (!preview) return undefined;
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [preview, onClose]);

  if (!preview) return null;
  const downloadUrl = preview.url || preview.file_url;

  return (
    <div className="preview-backdrop" onClick={onClose} role="presentation">
      <section className="preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={preview.name}>
        <header className="preview-modal-header">
          <strong>{preview.name}</strong>

          <div>
            {downloadUrl && <a href={assetUrl(downloadUrl)} download={preview.name}>{preview.kind === "report" ? "下載 JSON" : "下載"}</a>}

            <button type="button" onClick={onClose} aria-label="關閉預覽">
              ✕
            </button>
          </div>
        </header>

        <div className="preview-modal-body">
          {preview.kind === "chart" && (preview.series?.length ? <InteractiveChart chart={preview} /> : <img className="preview-chart" src={assetUrl(preview.file_url)} alt={preview.name} />)}

          {preview.kind === "image" && <img className="preview-chart" src={assetUrl(preview.url)} alt={preview.name} />}

          {preview.kind === "excel" && (
            <ExcelPreview file={preview} />
          )}

          {preview.kind === "report" && (
            <ReportPreview file={preview} />
          )}
        </div>
      </section>
    </div>
  );
}


function ExcelPreview({ file }) {
  const [data, setData] = useState({ loading: true, headers: [], rows: [], error: "" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadExcel() {
      setData({ loading: true, headers: [], rows: [], error: "" });

      try {
        const [response, XLSX] = await Promise.all([fetch(assetUrl(file.url), { signal: controller.signal }), import("xlsx")]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Excel 沒有工作表");

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "—" });
        const [headers = [], ...records] = rows;

        setData({ loading: false, headers, rows: records, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") setData({ loading: false, headers: [], rows: [], error: "Excel 資料讀取失敗，請稍後再試。" });
      }
    }

    loadExcel();
    return () => controller.abort();
  }, [file.url]);

  if (data.loading) return <p>Excel 載入中...</p>;
  if (data.error) return <p className="message-error">{data.error}</p>;
  if (!data.headers.length) return <p>Excel 沒有可顯示的資料。</p>;

  return (
    <div className="preview-table-scroll">
      <table className="preview-table">
        <thead>
          <tr>
            {data.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {data.headers.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportPreview({ file }) {
  const [state, setState] = useState({ loading: true, report: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadReport() {
      setState({ loading: true, report: null, error: "" });

      try {
        const response = await fetch(assetUrl(file.url), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const report = await response.json();
        setState({ loading: false, report, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") setState({ loading: false, report: null, error: "報表資料讀取失敗，請稍後再試。" });
      }
    }

    loadReport();
    return () => controller.abort();
  }, [file.url]);

  if (state.loading) return <p>報表資料載入中...</p>;
  if (state.error) return <p className="message-error">{state.error}</p>;
  if (!state.report) return <p>報表沒有可顯示的資料。</p>;

  return (
    <Suspense fallback={<p>報表元件載入中...</p>}>
      <OperationsReport data={state.report}/>
    </Suspense>
  );
}

function FileList({ files = [], onPreview }) {
  const downloadFiles = files.filter((file) => !isCsvFile(file));

  if (!downloadFiles.length) return null;

  return (
    <>
      {downloadFiles.map((file) => {
        const kind = isImageFile(file) ? "image" : isExcelFile(file) ? "excel" : isJsonFile(file) ? "report" : null;

        if (!kind) {
          return (
            <a
              className="attachment-card"
              href={assetUrl(file.url)}
              download={file.name}
              key={file.url}
            >
              <span className="attachment-icon">FILE</span>
              <span><small>下載{file.name}</small></span>
            </a>
          );
        }

        return (
          <button
            className="attachment-card"
            type="button"
            key={file.url}
            onClick={() => onPreview({
              ...file,
              kind,
            })}
          >
            <span className="attachment-icon">
              {kind === "image" ? "IMAGE" : kind === "excel" ? "XLSX" : "REPORT"}
            </span>

            <span>
              <small>點選{file.name}</small>
            </span>
          </button>
        );
      })}
    </>
  );
}

function StaticFileList({ files = [] }) {
  /** 固定測試模式只呈現附件資訊，不讀取後端 URL。 */
  return files.map((file) => <span className="attachment-card attachment-card-static" key={`${file.name}-${file.url}`}><span className="attachment-icon">FILE</span><span><small>{file.name}</small></span></span>);
}

function ChartList({ charts = [], onPreview }) {
  if (!charts.length) return null;

  return (
    <>
      {charts.map((chart) => (
        <button
          className="attachment-card chart-attachment-card"
          type="button"
          key={chart.id || `${chart.name}-${chart.file_url}`}
          onClick={() => onPreview({
            ...chart,
            kind: "chart",
          })}
        >
          <span className="attachment-icon">CHART</span>

          <span>
            <small>點選{chart.name}</small>
          </span>
        </button>
      ))}
    </>
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
          {card.description && <small className="insight-card-description">{card.description}</small>}
          <div className="insight-grid" style={{ "--insight-columns": Math.max(card.items?.length || 0, 1) }}>
            {(card.items || []).map((item, itemIndex) => (
              <article
                className="insight-item"
                data-status={item.status}
                data-trend={item.trend}
                key={`${item.label}-${itemIndex}`}
              >
                <div className="insight-item-heading">
                  <strong>{item.label}</strong>
                  {item.change_pct && <span>{item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : ""} {item.change_pct}</span>}
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

function QuickReplyList({ replies = [], disabled = false, onSelect }) {
  if (!replies.length) return null;
  return (
    <div className="quick-reply-list" aria-label="建議下一步">
      {replies.map((reply) => <button className="quick-reply-button" type="button" key={reply.id} disabled={disabled} onClick={() => onSelect(reply.query)}>{reply.label}<span aria-hidden="true">›</span></button>)}
    </div>
  );
}

function Message({ message, onPreview }) {
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
            {!message.offline && <CsvTableList files={message.files} />}
            {((message.offline ? message.files?.length > 0 : message.files?.some((file) => !isCsvFile(file))) || message.charts?.length > 0) && (
              <div className="attachment-list" aria-label="可下載文件">
                {message.offline ? <StaticFileList files={message.files} /> : <FileList files={message.files} onPreview={onPreview} />}
                <ChartList charts={message.charts} onPreview={onPreview} />
              </div>
            )}
          </>
        )}
        {!isUser && message.sources?.length > 0 && (
          <p className="message-sources">
            參考依據：{message.sources.join("、")}
          </p>
        )}
      </div>
      {isUser && <div className="avatar avatar-user" aria-hidden="true">你</div>}
    </article>
  );
}

export default function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [quickReplies, setQuickReplies] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

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
    setQuickReplies([]);
    setLoading(true);

    try {
      const payload = await askAgent(question);
      setQuickReplies(payload?.reply?.quick_replies || []);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload?.reply?.text || "API 已完成，但沒有文字回覆。",
          sources: payload?.reply?.sources || [],
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
          sources: [],
          cards: [],
          files: [],
          charts: [],
          error: true,
          intent: "連線失敗",
        },
      ]);
      setQuickReplies([]);
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

  function clearConversation() {
    setMessages(initialMessages);
    setQuickReplies([]);
    setInput("");
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

          <div className="suggestion-groups-scroll">
            {suggestionGroups.map((group, groupIndex) => (
              <details
                className="suggestion-group"
                key={group.label}
                defaultOpen={groupIndex === 0}
              >
                <summary>
                  <span>{group.label}</span>
                  <i aria-hidden="true">⌄</i>
                </summary>

                <div className="suggestion-list">
                  {group.items.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                    >
                      <span aria-hidden="true">＋</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <div className="sidebar-note">
          <span className="status-dot" />
          <div>
            <strong>Agent API</strong>
            <small>每次問題獨立分析，不保存對話記憶</small>
          </div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div><span className="eyebrow">CATCH AGENT</span><h1>門市營運與智慧叫貨</h1></div>
          <div className="header-actions">
            <span className="ai-status"><i />AI 輔助分析</span>
            <button type="button" className="clear-button" onClick={clearConversation}>清除對話</button>
          </div>
        </header>

        <div className="conversation" aria-live="polite">
          {messages.map((message) => (
            <Message key={message.id} message={message} onPreview={setPreview} />
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
          <QuickReplyList replies={quickReplies} disabled={loading} onSelect={submitMessage} />
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
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
      <PreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
      />
    </main>
  );
}
