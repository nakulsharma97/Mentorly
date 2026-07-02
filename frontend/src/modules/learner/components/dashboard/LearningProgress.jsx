import { useMemo, useState } from "react";
import SectionCard from "../../../common/dashboard/SectionCard";
import TrendChart from "../../../common/dashboard/TrendChart";
import Icon from "../../../common/dashboard/Icon";

const TABS = [
  { key: "weekly", label: "Weekly Progress", icon: "calendar_view_week", type: "bar", unit: "sessions" },
  { key: "monthly", label: "Monthly Progress", icon: "calendar_month", type: "area", unit: "sessions" },
  { key: "hours", label: "Hours Learned", icon: "schedule", type: "area", unit: "hrs" },
];

/** Interactive learning-progress charts (weekly / monthly / hours). */
export default function LearningProgress({ series }) {
  const [active, setActive] = useState("weekly");
  const tab = TABS.find((t) => t.key === active) || TABS[0];
  const data = useMemo(() => series?.[active] || [], [series, active]);

  const total = useMemo(
    () => data.reduce((a, b) => a + (Number(b.value) || 0), 0),
    [data],
  );

  return (
    <SectionCard
      title="Learning Progress"
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
        <span className="md-chart__summary-value">
          {tab.unit === "hrs" ? total.toFixed(1) : total}
        </span>
        <span className="md-badge md-badge--info">
          <Icon name={tab.icon} /> {tab.unit} · {tab.label.toLowerCase()}
        </span>
      </div>
      <TrendChart data={data} type={tab.type} gradientId={`ldArea-${active}`} />
    </SectionCard>
  );
}
