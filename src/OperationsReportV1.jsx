import { useMemo, useRef, useState } from "react";

import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./operations-report-v1.css";

const COLORS = ["#f05a28", "#2563eb", "#7c3aed", "#059669", "#d97706", "#db2777", "#0891b2", "#64748b"]; // 橘色優先
const number = (value, digits = 0) => value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("zh-TW", { maximumFractionDigits: digits });
const integer = (value) => value === null || value === undefined || value === "" ? null : Math.sign(Number(value)) * Math.round(Math.abs(Number(value)));
const percent = (value) => value === null || value === undefined || value === "" ? "—" : `${Number(value) > 0 ? "+" : ""}${number(value, 2)}%`;
const statusClass = (value) => Number(value) > 0 ? "positive" : Number(value) < 0 ? "negative" : "neutral";
const safeName = (value) => String(value || "CATCH營運決策分析").replace(/[\\/:*?"<>|]/g, "-");
const metricValue = (metric) => typeof metric === "number" || typeof metric === "string" ? metric : metric?.current ?? metric?.value ?? null;
const metricChange = (metric) => typeof metric === "object" && metric !== null ? metric.change_pct ?? null : null;
const reportTypeLabel = { daily: "每日洞察", weekly: "營運週報", monthly: "月度趨勢", ad_hoc: "即時診斷" };
const trackingStatusLabel = { monitoring: "觀察中", not_improved: "未改善", completed: "已改善", escalation_required: "需升級" };
const weatherLabel = { rainy: "雨天", hot: "高溫", cold: "低溫", clear: "晴天", cloudy: "多雲", windy: "強風" };
const weatherText = (value) => value ? String(value).split("、").map((item) => weatherLabel[item.trim()] || item).join("、") : "—";

function formatTaipeiTime(value) {
  if (!value) return "—";
  try { 
    return new Intl.DateTimeFormat("en-CA", { 
      timeZone: "Asia/Taipei", 
      year: "numeric", 
      month: "2-digit", 
      day: "2-digit"
    }).format(new Date(value)) + " 台灣時間"; 
  }
  catch { return value; }
}

function normalizeReport(input) {
  if (input?.metadata?.schema_version === "operations.report.v1") {
    const view = input.presentation || {};
    return { ...input, entities: view.entities || [], summary: view.summary || { store_count: 0, kpis: [] }, insights: view.insights || [], cards: view.cards || [], charts: view.charts || [], tables: view.tables || [], daily_details: view.daily_details || [], comparisons: view.comparisons || [], downloads: view.downloads || [], warnings: (input.facts?.warnings || []).map((item) => item?.message || String(item)), limitations: input.facts?.limitations || [] };
  }
  if (!Array.isArray(input)) return input || {};
  return { metadata: { schema_version: "legacy", title: "營運決策分析", generated_at: new Date().toISOString(), report_type: "ad_hoc" }, scope: { type: input.length === 1 ? "single" : "selection", store_count: input.length }, periods: {}, facts: { warnings: [], limitations: [] }, context: { entities: [], districts: [] }, tracking: { summary: {}, items: [] }, summary: { store_count: input.length, kpis: [] }, entities: input, insights: [], cards: [], charts: [], tables: [], daily_details: [], comparisons: [], downloads: [], sources: [] };
}

function selectedKpis(report, entity) {
  if (!entity) return Object.fromEntries((report.summary?.kpis || []).map((item) => [item.key, item]));
  const values = entity.summary_kpis || {};
  const item = (key, label, unit) => ({ key, label, unit, value: metricValue(values[key]), comparison_value: values[key]?.comparison, difference: values[key]?.difference, change_pct: metricChange(values[key]), trend: Number(metricChange(values[key])) > 0 ? "up" : Number(metricChange(values[key])) < 0 ? "down" : "flat" });
  return { revenue: item("revenue", "營收", "元"), visitors: item("visitors", "來客／交易", values.visitors?.source === "transaction_proxy" ? "筆" : "人"), order_count: item("order_count", "訂單數", "筆"), average_order_value: item("average_order_value", "平均客單價", "元"), high_value_orders: { key: "high_value_orders", label: "大客戶訂單", value: values.high_value_orders?.count ?? 0, unit: "筆", trend: "attention" } };
}

function downloadHtmlReport(reportElement, reportTitle) {
  if (!reportElement) return;
  const report = reportElement.cloneNode(true);
  report.querySelectorAll(".report-actions, .report-tabs, button").forEach((element) => element.remove());
  const css = Array.from(document.styleSheets).map((sheet) => { try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); } catch { return ""; } }).filter(Boolean).join("\n");
  const title = safeName(reportTitle || "CATCH營運決策分析");
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${css}
html, body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif; }
body { padding: 24px; }
.operations-report { width: 100%; max-width: 1440px; margin: 0 auto; background: #fff; }
.recharts-responsive-container { width: 100% !important; }
@media print { body { padding: 0; background: #fff; } .operations-report { max-width: none; box-shadow: none; } .ops-panel, .ops-section, .ops-kpi, .ops-artifact-chart { break-inside: avoid; } }
</style>
</head>
<body>
${report.outerHTML}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportExcel(report, entities, dailyRows) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const summaryRows = entities.map((entity) => ({
    門市: entity.name,
    商圈: entity.region,
    本期營收: integer(metricValue(entity.summary_kpis?.revenue)),
    比較期營收: integer(entity.summary_kpis?.revenue?.comparison),
    營收差額: integer(entity.summary_kpis?.revenue?.difference),
    營收變化率: metricChange(entity.summary_kpis?.revenue),
    本期來客: integer(metricValue(entity.summary_kpis?.visitors)),
    比較期來客: integer(entity.summary_kpis?.visitors?.comparison),
    來客差額: integer(entity.summary_kpis?.visitors?.difference),
    本期訂單數: integer(metricValue(entity.summary_kpis?.order_count)),
    比較期訂單數: integer(entity.summary_kpis?.order_count?.comparison),
    本期客單價: integer(metricValue(entity.summary_kpis?.average_order_value)),
    比較期客單價: integer(entity.summary_kpis?.average_order_value?.comparison),
    客單價差額: integer(entity.summary_kpis?.average_order_value?.difference),
    大客戶訂單: integer(entity.summary_kpis?.high_value_orders?.count || 0)
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "營運總覽");

  if (dailyRows.length) {
    const dailyDetails = dailyRows.map((row) => ({
      日期: row.date,
      門市: row.store_name,
      營收: integer(row.revenue),
      比較期營收: integer(row.comparison_revenue),
      來客: integer(row.visitors),
      比較期來客: integer(row.comparison_visitors),
      訂單數: integer(row.order_count),
      平均客單價: integer(row.average_order_value),
      大客戶訂單: integer(row.high_value_order_count),
      天氣: weatherText(row.weather?.summary),
      例外狀況: (row.exceptions || []).join("、")
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dailyDetails), "每日營運明細");
  }

  for (const table of report.tables || []) {
    if (!table.rows?.length) continue;

    const rows = table.rows.map((row) => Object.fromEntries(table.columns.map((column) => {
      const value = row[column.key];
      if (column.unit === "%") return [column.label, value === null || value === undefined ? null : Number(Number(value).toFixed(2))];
      if (column.unit) return [column.label, integer(value)];
      return [column.label, value];
    })));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), safeName(table.title).slice(0, 31));
  }

  if (report.tracking?.items?.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.tracking.items), "改善追蹤");

  XLSX.writeFile(workbook, `${safeName(report.metadata?.title)}.xlsx`);
}
function EmptySection({ children = "目前沒有可顯示的資料。" }) { return <p className="ops-empty">{children}</p>; }

function KpiCard({ metric }) {
  if (!metric) return null;
  const digits = 0;
  return <article className={`ops-kpi ops-kpi-${metric.trend || "flat"}`}><span>{metric.label}</span><strong>{number(metric.value, digits)}<small>{metric.unit}</small></strong>{metric.comparison_value !== undefined && <p className={statusClass(metric.change_pct)}>比較期 {number(metric.comparison_value, digits)}{metric.unit}・{percent(metric.change_pct)}</p>}</article>;
}

function Alerts({ entities }) {
  const alerts = entities.flatMap((entity) => (entity.alerts || []).map((alert) => ({ ...alert, entity_name: entity.name })));
  if (!alerts.length) return null;
  return <section className="ops-alert-grid">{alerts.map((alert, index) => <article className={`ops-alert ops-alert-${alert.severity || "info"}`} key={`${alert.entity_name}-${alert.type}-${index}`}><span>{alert.severity === "critical" ? "!" : alert.type === "high_value_order" ? "★" : "i"}</span><div><small>{alert.entity_name}</small><strong>{alert.message}</strong>{/* 過濾 rule ID，只保留 action 說明 */}{alert.action && !alert.action.match(/^[A-Z_0-9]+$/) && <p>{alert.action}</p>}</div></article>)}</section>;
}

function InsightPanel({ report, entities }) {
  const ids = new Set(entities.map((entity) => entity.id));
  const contextRows = (report.context?.entities || []).filter((item) => ids.has(item.entity_id));
  const insights = report.insights || [];
  const causes = contextRows.flatMap((item) => (item.possible_causes || []).filter((cause) => cause.attribution_status === "matched").map((cause) => ({ title: cause.label || "可能影響因素", message: cause.cause_type === "weather" ? `${item.entity_name}營收變化可能受到天氣不佳影響。` : `${item.entity_name}營收變化可能與${cause.label}有關。` })));
  if (!insights.length && !causes.length) return null;
  return <aside className="ops-insights"><header><span>AI</span><div><h2>AI 洞察摘要</h2><p>依已驗證營運資料整理</p></div></header><div className="ops-insight-list">{insights.map((item, index) => <article key={`${item.type || "insight"}-${index}`}><strong>{item.title || "營運洞察"}</strong><p>{item.message || item.summary || item.text}</p></article>)}{causes.map((cause, index) => <article key={`cause-${index}`}><strong>{cause.title}</strong><p>{cause.message}</p></article>)}</div></aside>;
}

function trendData(entities, dailyRows, comparisons, metric) {
  const valueKey = metric === "visitors" ? "visitors" : metric === "average_order_value" ? "average_order_value" : "revenue";
  const comparisonKey = `comparison_${valueKey}`;
  const ids = new Set(entities.map((entity) => entity.id));
  const rows = dailyRows.filter((row) => ids.has(row.store_id || row.id)); // 相容不同結構
  const district = entities.length <= 2 && new Set(entities.map((entity) => entity.region)).size === 1 ? entities[0]?.region : null;
  const baseline = Object.fromEntries(((comparisons || []).find((item) => item.district === district)?.daily_trends || []).map((row) => [row.date, row]));
  return [...new Set(rows.map((row) => row.date))].map((date) => { const result = { date }; for (const entity of entities) { const daily = rows.find((row) => (row.store_id === entity.id || row.id === entity.id) && row.date === date) || {}; result[entity.id] = daily[valueKey]; if (entities.length === 1) result[`${entity.id}_comparison`] = daily[comparisonKey]; } result.baseline = baseline[date]?.[`avg_${valueKey}`] ?? baseline[date]?.[valueKey]; return result; });
}

function TrendChart({ entities, dailyRows, comparisons, metric }) {
  const data = trendData(entities, dailyRows, comparisons, metric);
  if (!data.length) return <EmptySection>目前沒有每日趨勢資料。</EmptySection>;
  const label = metric === "visitors" ? "來客" : metric === "average_order_value" ? "客單價" : "營收";
  const district = entities.length <= 2 && new Set(entities.map((entity) => entity.region)).size === 1 ? entities[0]?.region : null;
  const hasBaseline = data.some((row) => row.baseline !== undefined && row.baseline !== null);
  const events = [...new Map(dailyRows.filter((row) => row.weather?.summary || row.event || row.exceptions?.length).map((row) => [row.date, { date: row.date, weather: weatherText(row.weather?.summary), event: row.event, exceptions: row.exceptions || [] }])).values()];
  return <div className="ops-chart"><ResponsiveContainer width="100%" height={300}><LineChart data={data} margin={{ top: 15, right: 24, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false}/><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}/><YAxis tickFormatter={(value) => number(value)} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}/><Tooltip formatter={(value, name) => [number(value), name]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }}/><Legend/>{entities.map((entity, index) => <Line key={entity.id} type="monotone" dataKey={entity.id} name={`${entity.name}${label}`} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 3 }}/>) }{entities.length === 1 && <Line type="monotone" dataKey={`${entities[0].id}_comparison`} name={`比較期${label}`} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false}/>} {hasBaseline && <Line type="monotone" dataKey="baseline" name={`${district}平均`} stroke="#475569" strokeWidth={2} strokeDasharray="7 5" dot={false}/>}</LineChart></ResponsiveContainer>{metric === "revenue" && events.length > 0 && <div className="ops-chart-events">{events.map((item) => <span key={item.date}><strong>{item.date}</strong>{item.weather !== "—" && `・${item.weather}`}{item.event && `・${item.event}`}{item.exceptions.length > 0 && `・${item.exceptions.join("、")}`}</span>)}</div>}</div>;
}

function artifactColor(series, index) {
  if (series.style === "comparison") return "#f8b59d";
  if (series.style === "benchmark_dashed") return "#64748b";
  if (series.style === "store_b") return "#2563eb";
  return COLORS[index % COLORS.length];
}

function ArtifactTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return <div className="ops-chart-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.name}>{item.name}：{number(item.value)} {item.unit || ""}</span>)}{row.annotation && <small>{row.annotation}</small>}{row.weather && <small>天氣：{row.weather}</small>}</div>;
}

function ArtifactChart({ chart }) {
  const data = (chart.categories || []).map((category, index) => ({ category, annotation: chart.x_annotations?.[index] || null, weather: chart.weather?.rainfall?.[index] !== null && chart.weather?.rainfall?.[index] !== undefined ? `雨量 ${number(chart.weather.rainfall[index], 1)} mm` : null, ...(chart.series || []).reduce((values, series) => ({ ...values, [series.name]: series.values?.[index] }), {}) }));
  if (!data.length || !chart.series?.length) return null;
  const horizontal = chart.orientation === "horizontal";
  const rightAxis = chart.series.some((series) => series.axis === "right");
  const height = horizontal ? Math.min(420, Math.max(280, data.length * 28)) : 300;
  const chartSeries = (series) => series.chart_type === "bar" ? <Bar key={series.name} dataKey={series.name} name={series.name} yAxisId={series.axis === "right" ? "right" : "left"} fill={artifactColor(series, chart.series.indexOf(series))} barSize={16} maxBarSize={16} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}/> : <Line key={series.name} type="monotone" dataKey={series.name} name={series.name} yAxisId={series.axis === "right" ? "right" : "left"} stroke={artifactColor(series, chart.series.indexOf(series))} strokeWidth={series.style === "benchmark_dashed" ? 2 : 3} strokeDasharray={series.style === "benchmark_dashed" || series.style === "comparison" ? "7 5" : undefined} dot={series.style === "benchmark_dashed" ? false : { r: 3 }}/>;
  const tooltip = <Tooltip content={<ArtifactTooltip/>}/>;
  return <article className="ops-artifact-chart"><header><div><h3>{chart.name}</h3>{chart.subtitle && <p>{chart.subtitle}</p>}</div><span>{chart.id}</span></header><ResponsiveContainer width="100%" height={height}>{chart.type === "bar" ? <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} barCategoryGap="45%" barGap={6} margin={{ top: 10, right: 36, left: horizontal ? 80 : 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!horizontal} vertical={horizontal}/>{horizontal ? <><XAxis type="number" yAxisId="left" tickFormatter={(value) => number(value)}/><YAxis type="category" dataKey="category" width={78}/></> : <><XAxis dataKey="category"/><YAxis yAxisId="left" tickFormatter={(value) => number(value)}/></>}{tooltip}<Legend/>{chart.series.map(chartSeries)}</BarChart> : <ComposedChart data={data} margin={{ top: 10, right: rightAxis ? 50 : 24, left: 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false}/><XAxis dataKey="category"/><YAxis yAxisId="left" tickFormatter={(value) => number(value)}/>{rightAxis && <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => number(value)}/>} {tooltip}<Legend/>{chart.series.map(chartSeries)}</ComposedChart>}</ResponsiveContainer>{data.some((row) => row.annotation || row.weather) && <div className="ops-chart-events">{data.filter((row) => row.annotation || row.weather).map((row) => <span key={row.category}><strong>{row.category}</strong>{row.weather && `・${row.weather}`}{row.annotation && `・${row.annotation}`}</span>)}</div>}{chart.description && <p className="ops-chart-description">{chart.description}</p>}</article>;
}

function DailyTable({ rows, mode }) {
  if (!rows.length) return null;
  const revenue = mode === "revenue";
  return <div className="ops-table-scroll"><table><thead><tr><th>日期</th><th>門市</th><th>{revenue ? "本期營收" : "本期來客"}</th><th>{revenue ? "比較期營收" : "比較期來客"}</th><th>差額</th>{revenue && <th>天氣</th>}<th>例外狀況</th></tr></thead><tbody>{rows.map((row, index) => { const current = revenue ? row.revenue : row.visitors; const comparison = revenue ? row.comparison_revenue : row.comparison_visitors; return <tr key={`${mode}-${row.store_id}-${row.date}-${index}`}><td>{row.date}</td><td>{row.store_name}</td><td>{number(current)}{revenue ? " 元" : ""}</td><td>{number(comparison)}{revenue ? " 元" : ""}</td><td className={statusClass(Number(current || 0) - Number(comparison || 0))}>{number(Number(current || 0) - Number(comparison || 0))}{revenue ? " 元" : ""}</td>{revenue && <td>{weatherText(row.weather?.summary)}</td>}<td>{(row.exceptions || []).join("、") || "—"}</td></tr>; })}</tbody></table></div>;
}

function AovTable({ rows }) {
  if (!rows.length) return null;
  return <div className="ops-table-scroll"><table><thead><tr><th>日期</th><th>門市</th><th>平均客單價</th><th>比較期客單價</th><th>大客戶訂單</th><th>最高訂單金額</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`aov-${row.store_id}-${row.date}-${index}`}><td>{row.date}</td><td>{row.store_name}</td><td>{number(row.average_order_value)} 元</td><td>{number(row.comparison_average_order_value)} 元</td><td>{number(row.high_value_order_count)} 筆</td><td>{number(row.max_order_amount)} 元</td></tr>)}</tbody></table></div>;
}

function tableValue(table, column, value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (column.unit === "%") return number(numeric, 2);
  if (column.unit === "元") return number(numeric);
  if (["人", "筆", "家", "間"].includes(column.unit)) return number(numeric);
  return number(numeric, Number.isInteger(numeric) ? 0 : 2);
}

function UseCaseTables({ tables }) {
  const visible = tables.filter((table) => table.rows?.length);
  if (!visible.length) return null;
  return <section className="ops-section"><header className="ops-section-header"><div><span>DATA TABLES</span><h2>營運分析</h2></div><p>明細資料總表</p></header><div className="ops-table-stack">{visible.map((table) => <article className="ops-data-table" key={table.id}><h3>{table.title}</h3><div className="ops-table-scroll"><table><thead><tr>{table.columns.map((column) => <th key={column.key}>{column.label}{column.unit ? `（${column.unit}）` : ""}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`${table.id}-${rowIndex}`}>{table.columns.map((column) => <td key={column.key}>{tableValue(table, column, row[column.key])}</td>)}</tr>)}</tbody></table></div></article>)}</div></section>;
}

function TrackingSection({ tracking }) {
  if (!tracking?.items?.length) return null;
  return <section className="ops-section"><header className="ops-section-header"><div><span>改善狀態</span><h2>異常改善追蹤</h2></div></header><div className="ops-tracking-grid">{tracking.items.map((item, index) => <article key={item.case_id || index}><div><span className={`ops-status ops-status-${item.status}`}>{trackingStatusLabel[item.status] || "追蹤中"}</span><small>連續 {item.consecutive_periods || item.consecutive_weeks || 1} {item.period_type === "month" ? "個月" : "週"}</small></div><h3>{item.store_name || item.store_id}・{item.metric === "revenue" ? "營收" : "來客／交易"}</h3><p>改善追蹤基準：{item.before?.baseline !== undefined ? `${number(item.before.baseline)} ${item.before?.unit || ""}` : "—"}</p><p>本期：{item.after?.value !== undefined ? `${number(item.after.value)} ${item.after?.unit || ""}` : "—"}</p><strong>{item.status === "escalation_required" ? "需升級處理" : item.status === "completed" ? "已改善，可核銷" : item.status === "not_improved" ? "未改善，需建立任務" : "持續觀察"}</strong></article>)}</div></section>;
}

export default function OperationsReport({ data }) {
  const reportRef = useRef(null);
  const report = useMemo(() => normalizeReport(data), [data]);
  const [selected, setSelected] = useState("all");
  const allEntities = report.entities || [];
  const selectedEntity = selected === "all" ? null : allEntities.find((entity) => entity.id === selected);
  const entities = selectedEntity ? [selectedEntity] : allEntities;
  const ids = new Set(entities.map((entity) => entity.id));
  const dailyRows = (report.daily_details || []).filter((row) => ids.has(row.store_id || row.id)); // 相容 ID
  const kpis = selectedKpis(report, selectedEntity);
  const selectedContext = selectedEntity ? (report.context?.entities || []).find((item) => item.entity_id === selectedEntity.id) : null;
  return <div className="operations-report" ref={reportRef}>
    <header className="ops-report-header"><div className="ops-brand"><span>C</span><div><small>CATCH OPERATIONS REPORT</small><h1>{report.metadata?.title || "營運決策分析"}</h1><p>{report.periods?.current?.label || "查詢期間"}・{reportTypeLabel[report.metadata?.report_type] || "營運報表"}・產製時間 {formatTaipeiTime(report.metadata?.generated_at || report.metadata?.report_time)}</p></div></div><div className="report-actions"><button type="button" onClick={() => downloadHtmlReport(reportRef.current, report.metadata?.title)}>下載 HTML 報表</button><button className="primary" type="button" onClick={() => exportExcel(report, entities, dailyRows)}>匯出 Excel</button></div></header>
    {allEntities.length > 1 && <nav className="report-tabs"><button type="button" className={selected === "all" ? "active" : ""} onClick={() => setSelected("all")}>整合總覽</button>{allEntities.map((entity) => <button type="button" className={selected === entity.id ? "active" : ""} onClick={() => setSelected(entity.id)} key={entity.id}>{entity.name}</button>)}</nav>}
    {selectedContext && <section className="ops-region"><span>⌖</span><div><strong>商圈與外部環境：{selectedEntity.region}</strong><p>{selectedContext.assessments?.map((item) => item.summary).filter(Boolean).join(" ") || "目前沒有外部環境摘要。"}</p></div></section>}
    <Alerts entities={entities}/><section className="ops-kpi-grid">{["revenue", "visitors", "order_count", "average_order_value", "high_value_orders"].map((key) => <KpiCard key={key} metric={kpis[key]}/>)}</section>
    <section className="ops-overview-grid"><article className="ops-panel"><header><div><span>REVENUE</span><h2>營收趨勢對比</h2><p>本期、比較期與適用的商圈平均基準</p></div></header><TrendChart entities={entities} dailyRows={dailyRows} comparisons={report.comparisons} metric="revenue"/></article><InsightPanel report={report} entities={entities}/></section>
    {dailyRows.length > 0 && <section className="ops-section"><header className="ops-section-header"><div><span>DAILY DETAILS</span><h2>每日營運明細與例外狀況（營收）</h2></div><p>天氣、事件及大客戶訂單一併呈現</p></header><DailyTable rows={dailyRows} mode="revenue"/></section>}
    {dailyRows.length > 0 && <section className="ops-split"><article className="ops-panel"><header><div><span>VISITORS</span><h2>來客動態趨勢</h2></div></header><TrendChart entities={entities} dailyRows={dailyRows} comparisons={report.comparisons} metric="visitors"/></article><article className="ops-panel"><header><div><span>VISITOR DETAILS</span><h2>來客明細</h2></div></header><DailyTable rows={dailyRows} mode="visitors"/></article></section>}
    {dailyRows.length > 0 && <section className="ops-split"><article className="ops-panel"><header><div><span>AVERAGE ORDER VALUE</span><h2>客單價與大客戶訂單</h2></div></header><TrendChart entities={entities} dailyRows={dailyRows} comparisons={report.comparisons} metric="average_order_value"/></article><article className="ops-panel"><header><div><span>ORDER DETAILS</span><h2>客單價與大單明細</h2></div></header><AovTable rows={dailyRows}/></article></section>}
    {(report.charts || []).length > 0 && <section className="ops-section"><header className="ops-section-header"><div><span>CHARTS</span><h2>營運圖表</h2></div><p>後端固定 Chart Data（圖表資料）</p></header><div className="ops-chart-grid">{report.charts.map((chart) => <ArtifactChart chart={chart} key={chart.id}/>)}</div></section>}
    <UseCaseTables tables={report.tables || []}/><TrackingSection tracking={report.tracking}/>
    <footer className="ops-report-footer"><div><strong>資料來源</strong><p>{(report.sources || []).join(" ｜ ") || "—"}</p></div>{report.warnings?.length > 0 && <div><strong>資料提醒</strong><p>{report.warnings.join("、")}</p></div>}{report.limitations?.length > 0 && <div><strong>資料限制</strong><p>{report.limitations.join("、")}</p></div>}<small>Report ID：{report.metadata?.report_id || "—"}・Schema：{report.metadata?.schema_version || "—"}</small></footer>
  </div>;
}
