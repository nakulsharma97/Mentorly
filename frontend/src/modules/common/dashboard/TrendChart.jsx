/**
 * Dependency-free SVG trend chart used for Revenue / Student growth /
 * Session / Rating trends. Renders a gradient area + animated line, or bars.
 * `data` = [{ label, value }].
 */
export default function TrendChart({
  data = [],
  type = "area",
  height = 200,
  gradientId = "mdArea",
  valueFormatter = (v) => v,
}) {
  const width = 640;
  const padX = 12;
  const padTop = 16;
  const padBottom = 26;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1);
  const count = data.length;

  const x = (i) => (count <= 1 ? padX + innerW / 2 : padX + (i / (count - 1)) * innerW);
  const y = (v) => padTop + innerH - (v / max) * innerH;

  // grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map((t) => padTop + innerH - t * innerH);

  if (type === "bar") {
    const gap = innerW / count;
    const barW = Math.min(46, gap * 0.5);
    return (
      <div className="md-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
          <defs>
            <linearGradient id="mdBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          {gridLines.map((gy, i) => (
            <line key={i} className="md-chart__grid" x1={padX} y1={gy} x2={width - padX} y2={gy} />
          ))}
          {data.map((d, i) => {
            const bx = padX + gap * i + (gap - barW) / 2;
            const bh = Math.max(3, ((Number(d.value) || 0) / max) * innerH);
            return (
              <g key={d.label + i}>
                <rect
                  className="md-chart__bar"
                  x={bx}
                  y={padTop + innerH - bh}
                  width={barW}
                  height={bh}
                  rx="5"
                >
                  <title>{`${d.label}: ${valueFormatter(d.value)}`}</title>
                </rect>
                <text className="md-chart__label" x={bx + barW / 2} y={height - 8} textAnchor="middle">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const linePts = data.map((d, i) => `${x(i)},${y(Number(d.value) || 0)}`).join(" ");
  const areaPts = `${padX},${padTop + innerH} ${linePts} ${width - padX},${padTop + innerH}`;
  // rough length for the draw animation
  const dash = innerW * 1.4;

  return (
    <div className="md-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((gy, i) => (
          <line key={i} className="md-chart__grid" x1={padX} y1={gy} x2={width - padX} y2={gy} />
        ))}

        <polygon points={areaPts} fill={`url(#${gradientId})`} />
        <polyline
          className="md-chart__line md-chart__line--animate"
          points={linePts}
          style={{ "--md-dash": dash }}
        />

        {data.map((d, i) => (
          <g key={d.label + i}>
            <circle className="md-chart__dot" cx={x(i)} cy={y(Number(d.value) || 0)} r="3.5">
              <title>{`${d.label}: ${valueFormatter(d.value)}`}</title>
            </circle>
            <text className="md-chart__label" x={x(i)} y={height - 8} textAnchor="middle">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
