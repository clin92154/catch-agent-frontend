import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./operations-report.css";

const COLORS = {
  revenue: "#f05a28",
  comparison: "#f8b59d",
  baseline: "#64748b",
  visitors: "#2f6db2",
  aov: "#6654c0",
};

// 數字格式化
const number = (value, digits = 0) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("zh-TW", { maximumFractionDigits: digits });

const percent = (value) =>
  value === null || value === undefined
    ? "—"
    : `${Number(value) > 0 ? "+" : ""}${number(value, 2)}%`;

const metricValue = (metric) =>
  typeof metric === "number" ? metric : metric?.current ?? metric?.value ?? null;

const metricChange = (metric) =>
  typeof metric === "object" ? metric?.change_pct : null;

const statusClass = (value) =>
  Number(value) > 0 ? "positive" : Number(value) < 0 ? "negative" : "neutral";

const safeName = (value) =>
  String(value || "CATCH營運決策分析").replace(/[\\/:*?"<>|]/g, "-");

// 將時間轉為 YYYY-MM-DD 台灣時間格式
const formatTaipeiDate = (isoString) => {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${formatter.format(date)} 台灣時間`;
  } catch {
    return isoString; 
  }
};

// 支援讀取最新 v1 Schema 的呈現層
function normalizeReport(input) {
  if (input?.metadata?.schema_version === "operations.report.v1") {
    const presentation = input.presentation || {};
    return {
      metadata: input.metadata,
      periods: input.periods || {},
      summary: presentation.summary || {},
      entities: presentation.entities || [],
      daily_details: presentation.daily_details || [],
      comparisons: presentation.comparisons || [],
      insights: presentation.insights || [],
      sources: input.sources || [],
      warnings: (input.facts?.warnings || []).map((item) => item.message || String(item)),
    };
  }

  // Fallback 相容舊版陣列結構
  if (!Array.isArray(input)) return input;
  return {
    metadata: {
      title: "營運決策分析",
      report_time: new Date().toISOString(),
    },
    periods: {},
    entities: input.map((row, index) => ({
      id: row.store_code || `S${index + 1}`,
      name: row.store_name || row["門市"] || `門市 ${index + 1}`,
      region: row.district || row["商圈"] || "未提供",
      summary_kpis: {
        revenue: {
          current: row.revenue,
          comparison: row.comparison_revenue,
          change_pct: row.revenue_change_pct,
        },
        visitors: {
          current: row.visitor_count,
          comparison: row.comparison_visitor_count,
          change_pct: row.visitor_change_pct,
        },
        average_order_value: {
          current: row.average_order_value,
          comparison: row.comparison_average_order_value,
          change_pct: row.average_order_value_change_pct,
        },
        high_value_orders: {
          count: row.high_value_order_count || 0,
        },
      },
      alerts: row.alerts || [],
    })),
    daily_details: input.flatMap(row => (row.daily_trends || []).map(dt => ({ store_id: row.store_code || `S${index + 1}`, store_name: row.store_name, ...dt }))),
    comparisons: [],
  };
}

function exportExcel(report, entities, dailyDetails) {
  const workbook = XLSX.utils.book_new();
  const summaries = entities.map((entity) => ({
    門市: entity.name,
    商圈: entity.region,
    本期營收: metricValue(entity.summary_kpis?.revenue),
    營收變化率: metricChange(entity.summary_kpis?.revenue),
    本期來客: metricValue(entity.summary_kpis?.visitors),
    來客變化率: metricChange(entity.summary_kpis?.visitors),
    本期客單價: metricValue(entity.summary_kpis?.average_order_value),
    大額訂單筆數: entity.summary_kpis?.high_value_orders?.count || 0,
  }));
  
  const daily = dailyDetails.map((row) => ({
    日期: row.date,
    門市: row.store_name,
    營收: row.revenue,
    比較期營收: row.comparison_revenue,
    來客數: row.visitors,
    客單價: row.average_order_value,
    天氣: row.weather?.summary || "",
    例外狀況: (row.exceptions || []).join("、")
  }));

  if (summaries.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaries), "營運總覽");
  if (daily.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(daily), "每日營運明細");
  
  XLSX.writeFile(workbook, `${safeName(report.metadata?.title)}.xlsx`);
}

function KpiCard({ label, metric, unit, isPercent = false }) {
  const change = metricChange(metric);
  return (
    <article className="ops-kpi">
      <span>{label}</span>
      <strong>
        {isPercent && change !== null ? percent(change) : number(metricValue(metric), label.includes("客單價") ? 2 : 0)}
        {!isPercent && <small>{unit}</small>}
      </strong>
      {!isPercent && (
        <p className={statusClass(change)}>
          {change === null || change === undefined
            ? "尚無比較資料"
            : `較比較期 ${percent(change)}`}
        </p>
      )}
    </article>
  );
}

function EmptySection({ children = "目前沒有可顯示的資料。" }) {
  return <p className="ops-empty">{children}</p>;
}

function DetailTable({ rows, mode }) {
  if (!rows || !rows.length) return <EmptySection />;
  
  if (mode === "revenue") {
    return (
      <div className="ops-table-scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>門市</th>
              <th>本期營收</th>
              <th>比較期營收</th>
              <th>差額</th>
              <th>例外狀況</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.store_name}-${row.date}-${index}`}>
                <td>{row.date}</td>
                <td>{row.store_name}</td>
                <td>{number(row.revenue)} 元</td>
                <td>{number(row.comparison_revenue)} 元</td>
                <td className={statusClass((row.revenue || 0) - (row.comparison_revenue || 0))}>
                  {number((row.revenue || 0) - (row.comparison_revenue || 0))} 元
                </td>
                <td>{(row.exceptions || []).join("、") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="ops-table-scroll">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>門市</th>
            <th>本期來客</th>
            <th>比較期</th>
            <th>差額</th>
            <th>天氣／事件</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.store_name}-${row.date}-${index}`}>
              <td>{row.date}</td>
              <td>{row.store_name}</td>
              <td>{number(row.visitors)}</td>
              <td>{number(row.comparison_visitors)}</td>
              <td className={statusClass((row.visitors || 0) - (row.comparison_visitors || 0))}>
                {number((row.visitors || 0) - (row.comparison_visitors || 0))}
              </td>
              <td>{row.weather?.summary || row.event || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({ entities, dailyDetails, comparisons = [], metric }) {
  const valueKey = metric === "revenue" ? "revenue" : metric === "visitors" ? "visitors" : "average_order_value";
  const comparisonKey = `comparison_${valueKey}`;
  
  const entityIds = new Set(entities.map((e) => e.id));
  const rows = dailyDetails.filter((r) => entityIds.has(r.store_id || r.id));
  const dates = [...new Set(rows.map((r) => r.date))];
  
  const district = entities.length <= 2 && new Set(entities.map((e) => e.region)).size === 1 ? entities[0]?.region : null;
  const baseline = comparisons.find((item) => item.district === district) || {};
  const baselineRows = Object.fromEntries((baseline.daily_trends || []).map((r) => [r.date, r]));
  
  const data = dates.map((date) => {
    const row = { date };
    entities.forEach((entity) => {
      const daily = rows.find((item) => (item.store_id === entity.id || item.id === entity.id) && item.date === date) || {};
      row[entity.id] = daily[valueKey];
      row[`${entity.id}_comparison`] = daily[comparisonKey];
    });
    row.baseline = baselineRows[date]?.[`avg_${valueKey}`] ?? baselineRows[date]?.[valueKey];
    return row;
  });

  if (!data.length) return <EmptySection>圖表尚無每日趨勢資料。</EmptySection>;

  const isSingle = entities.length === 1;

  return (
    <div className="ops-chart">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => number(value)} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value, name) => [number(value), name]}
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "12px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" />
          
          {entities.map((entity) =>
            metric === "revenue" ? (
              <Bar key={entity.id} dataKey={entity.id} name={`${entity.name} 營收`} fill={COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={40} />
            ) : (
              <Line key={entity.id} dataKey={entity.id} name={`${entity.name} ${metric === "visitors" ? "來客" : "客單價"}`} stroke={metric === "visitors" ? COLORS.visitors : COLORS.aov} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            )
          )}
          
          {isSingle && metric === "revenue" && (
            <Bar dataKey={`${entities[0].id}_comparison`} name="比較期營收" fill={COLORS.comparison} radius={[4, 4, 0, 0]} maxBarSize={40} />
          )}
          
          {baseline.daily_trends?.length > 0 && (
             <Line dataKey="baseline" name={`${baseline.district || "商圈"}平均`} stroke={COLORS.baseline} strokeWidth={2} strokeDasharray="5 5" dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function OperationsReport({ data }) {
  const report = useMemo(() => normalizeReport(data), [data]);
  const [selected, setSelected] = useState("all");
  
  const allEntities = report.entities || [];
  const entities = selected === "all" ? allEntities : allEntities.filter((entity) => entity.id === selected);
  
  // 總計計算
  const kpis = entities.reduce(
    (total, entity) => {
      const source = entity.summary_kpis || {};
      total.revenue += Number(metricValue(source.revenue) || 0);
      total.revenueChange = metricChange(source.revenue) || total.revenueChange; 
      total.visitors += Number(metricValue(source.visitors) || 0);
      total.visitorsChange = metricChange(source.visitors) || total.visitorsChange;
      total.highValue += Number(source.high_value_orders?.count || 0);
      return total;
    },
    { revenue: 0, revenueChange: null, visitors: 0, visitorsChange: null, highValue: 0 }
  );

  const aov = entities.length === 1 
    ? metricValue(entities[0]?.summary_kpis?.average_order_value) 
    : (kpis.visitors ? kpis.revenue / kpis.visitors : null);
    
  const aovChange = entities.length === 1 ? metricChange(entities[0]?.summary_kpis?.average_order_value) : null;

  const alerts = entities.flatMap((entity) =>
    (entity.alerts || []).map((alert) => ({ ...alert, entity_name: entity.name }))
  );

  const dailyDetails = (report.daily_details || []).filter((row) => selected === "all" || row.store_id === selected || row.id === selected);

  return (
    <div className="operations-report">
      {/* 頂部 Header */}
      <header className="ops-report-header">
        <div>
          <span className="ops-eyebrow">CATCH OPERATIONS REPORT</span>
          <h1>{report.metadata?.title || "營運決策分析"}</h1>
          <p>
            {report.periods?.current?.label || "查詢期間"} ｜ 產製時間 {formatTaipeiDate(report.metadata?.report_time)}
          </p>
        </div>
        <div className="report-actions">
          <button type="button" onClick={() => window.print()}>列印報表</button>
          <button type="button" onClick={() => exportExcel(report, entities, dailyDetails)}>匯出 Excel</button>
        </div>
      </header>

      {/* 門市切換 Tabs */}
      {allEntities.length > 1 && (
        <nav className="report-tabs">
          <button type="button" className={selected === "all" ? "active" : ""} onClick={() => setSelected("all")}>
            整合總覽
          </button>
          {allEntities.map((entity) => (
            <button type="button" className={selected === entity.id ? "active" : ""} onClick={() => setSelected(entity.id)} key={entity.id}>
              {entity.name}
            </button>
          ))}
        </nav>
      )}

      {/* 商圈基準提示 */}
      {report.comparisons?.length > 0 && selected !== "all" && (
        <section className="ops-baseline">
          <strong>比較基準</strong>
          <span>{report.comparisons[0].district}商圈平均</span>
          <small>圖表中虛線代表該門市所屬商圈之平均基準。</small>
        </section>
      )}

      {/* KPI 一體成型數據列 */}
      <section className="ops-kpi-grid">
        <KpiCard label="本期營收總計" metric={{ current: kpis.revenue, change_pct: entities.length === 1 ? kpis.revenueChange : null }} unit="元" />
        <KpiCard label="本期來客數總計" metric={{ current: kpis.visitors, change_pct: entities.length === 1 ? kpis.visitorsChange : null }} unit="人" />
        <KpiCard label="平均客單價" metric={{ current: aov, change_pct: aovChange }} unit="元" />
        <KpiCard label="大額訂單 (5千以上)" metric={{ current: kpis.highValue, change_pct: null }} unit="筆" />
      </section>

      {/* 異常與建議行動 */}
      {alerts.length > 0 && (
        <section className="ops-alerts">
          <header>
            <h2>異常提醒與建議行動</h2>
          </header>
          <div>
            {alerts.map((alert, index) => (
              <article key={`${alert.entity_name}-${index}`}>
                <strong>{alert.entity_name} ｜ {alert.message}</strong>
                {/* 確保過濾掉 HIGH_VALUE_ORDER 等後端開發代碼 */}
                <p>{alert.action || "請參考下方圖表確認每日明細狀況，必要時進行門市備貨調整。"}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 營收區塊 */}
      <section className="ops-panel">
        <header>
          <h2>營收趨勢分析</h2>
        </header>
        <TrendChart entities={entities} dailyDetails={dailyDetails} comparisons={report.comparisons} metric="revenue" />
        <h3>每日營收明細</h3>
        <DetailTable rows={dailyDetails} mode="revenue" />
      </section>

      {/* 來客區塊 */}
      <section className="ops-panel">
        <header>
          <h2>來客動態趨勢</h2>
        </header>
        <TrendChart entities={entities} dailyDetails={dailyDetails} comparisons={report.comparisons} metric="visitors" />
        <h3>每日來客明細</h3>
        <DetailTable rows={dailyDetails} mode="visitors" />
      </section>

      {/* 客單價與大單區塊 */}
      <section className="ops-panel">
        <header>
          <h2>客單價與大客戶訂單分析</h2>
        </header>
        <TrendChart entities={entities} dailyDetails={dailyDetails} comparisons={report.comparisons} metric="average_order_value" />
        
        <h3>大客戶清單 (單筆 5,000 元以上)</h3>
        {entities.some(e => e.summary_kpis?.high_value_orders?.count > 0) ? (
          <div className="ops-high-value">
            {entities.map((entity) => (
              <article key={entity.id}>
                <strong>{entity.name}</strong>
                <span>{number(metricValue(entity.summary_kpis?.average_order_value), 0)} 元</span>
                <small>高價值大單：{number(entity.summary_kpis?.high_value_orders?.count || 0)} 筆</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptySection>查詢期間內無單筆 5,000 元以上之訂單。</EmptySection>
        )}
      </section>

      {/* 頁尾 */}
      <footer className="ops-report-footer">
        <div>
          <strong>資料來源</strong>
          <p>
            {(report.sources || []).map((source) => typeof source === "string" ? source : source.name || `${source.source}`).join(" ｜ ") || "企業營運資料 ｜ 外部環境資料 ｜ 烘焙專家系統"}
          </p>
        </div>
        {(report.warnings || []).length > 0 && (
          <div>
            <strong>系統提醒</strong>
            <p>{report.warnings.join("、")}</p>
          </div>
        )}
      </footer>
    </div>
  );
}