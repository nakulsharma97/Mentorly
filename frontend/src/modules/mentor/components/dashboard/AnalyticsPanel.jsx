import { useMemo, useState } from "react";
import SectionCard from "../../../common/dashboard/SectionCard";
import TrendChart from "../../../common/dashboard/TrendChart";
import Icon from "../../../common/dashboard/Icon";
import { formatMoney } from "../../../common/dashboard/dashboardUtils";

/**
 * Analytics section with switchable trends: Revenue / Students / Sessions /
 * Rating. Each series is [{ label, value }] for the last 6 months.
 */
const TABS = [
  { key: "revenue", label: "Revenue", icon: "payments", type: "area", money: true },
  { key: "students", label: "Student Growth", icon: "group_add", type: "area" },
  { key: "sessions", label: "Session Trend", icon: "video_camera_front", type: "bar" },
  { key: "rating", label: "Rating Trend", icon: "star", type: "area", decimals: 1 },
];

export default function AnalyticsPanel({ series }) {
  const [active, setActive] = useState("revenue");
  const tab = TABS.find((t) => t.key === active) || TABS[0];
  const data = useMemo(() => series?.[active] || [], [series, active]);

  const total = useMemo(() => {
    const values = data.map((d) => Number(d.value) || 0);
    if (tab.key === "rating") {
      const nonZero = values.filter((v) => v > 0);
      const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
      return avg.toFixed(1);
    }
    const sum = values.reduce((a, b) => a + b, 0);
    return tab.money ? formatMoney(sum) : sum;
  }, [data, tab]);

  const fmt = tab.money
    ? (v) => formatMoney(v)
    : tab.decimals
      ? (v) => Number(v).toFixed(1)
      : (v) => v;

  return (
    <SectionCard
      title="Advanced Analytics"
      icon="insights"
      headerExtra={
        <div className="md-analytics-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`md-tab ${active === t.key ? "md-tab--active" : ""}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="md-chart__summary">
        <span className="md-chart__summary-value">{total}</span>
        <span className="md-badge md-badge--info">
          <Icon name={tab.icon} /> {tab.label} · last 6 months
        </span>
      </div>
      <TrendChart
        data={data}
        type={tab.type}
        gradientId={`mdArea-${active}`}
        valueFormatter={fmt}
      />
    </SectionCard>
  );
}
