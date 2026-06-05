"use client";

import { useState } from "react";

const STATS = [
  { key: "attack",     label: "Saldırı",  color: "#ef4444" },
  { key: "defense",    label: "Savunma",   color: "#22c55e" },
  { key: "magic",      label: "Büyü",      color: "#8b5cf6" },
  { key: "difficulty",  label: "Zorluk",    color: "#f59e0b" },
];

export default function ChampionRadar({ info }) {
  const [hovIdx, setHovIdx] = useState(null);

  const cx = 120, cy = 120, R = 80;
  const count = STATS.length;
  const angles = STATS.map((_, i) => (Math.PI * 2 * i) / count - Math.PI / 2);

  const pt = (angle, ratio) => ({
    x: cx + R * ratio * Math.cos(angle),
    y: cy + R * ratio * Math.sin(angle),
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = angles.map((a, i) => {
    const val = info[STATS[i].key] || 0;
    return pt(a, Math.max(val / 10, 0.05));
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const outerPts = angles.map((a) => pt(a, 1));

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/50">
        <h3 className="text-sm font-semibold text-gray-200">Şampiyon Profili</h3>
      </div>

      <div className="flex flex-col items-center px-4 pt-4 pb-3">
        <svg width={240} height={240} viewBox="0 0 240 240">
          <defs>
            <linearGradient id="champRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Grid katmanları */}
          {gridLevels.map((level, i) => {
            const poly = angles.map((a) => pt(a, level)).map((p) => `${p.x},${p.y}`).join(" ");
            return (
              <polygon key={i} points={poly} fill="none"
                stroke={i === 3 ? "var(--c-grid-strong)" : "var(--c-grid)"} strokeWidth={i === 3 ? 1 : 0.5} />
            );
          })}

          {/* Eksen çizgileri */}
          {outerPts.map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--c-grid)" strokeWidth={0.5} />
          ))}

          {/* Veri alanı */}
          <polygon points={dataPolygon} fill="url(#champRadarFill)" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />

          {/* Veri noktaları */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4}
              fill={STATS[i].color} stroke={`${STATS[i].color}80`} strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
            />
          ))}

          {/* Etiketler */}
          {outerPts.map((p, i) => {
            const val = info[STATS[i].key] || 0;
            const labelOffset = 22;
            const lx = cx + (R + labelOffset) * Math.cos(angles[i]);
            const ly = cy + (R + labelOffset) * Math.sin(angles[i]);
            const isHov = hovIdx === i;

            return (
              <g key={`label-${i}`}>
                <text
                  x={lx} y={ly - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                  className={isHov ? "fill-white" : "fill-gray-400"}
                >
                  {STATS[i].label}
                </text>
                <text
                  x={lx} y={ly + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: "13px", fontWeight: 700 }}
                  fill={STATS[i].color}
                >
                  {val}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Alt bar göstergeler */}
        <div className="w-full space-y-2 mt-1 px-2">
          {STATS.map((stat) => {
            const val = info[stat.key] || 0;
            return (
              <div key={stat.key} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-14 text-right">{stat.label}</span>
                <div className="flex-1 bg-edge rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full animate-fill-bar"
                    style={{ width: `${val * 10}%`, backgroundColor: stat.color }}
                  />
                </div>
                <span className="text-[11px] font-bold text-gray-300 w-5">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
