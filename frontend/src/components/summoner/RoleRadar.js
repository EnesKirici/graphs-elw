"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";
import QueueTabs from "./QueueTabs";

const QUEUE_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "solo", label: "SoloQ" },
  { key: "flex", label: "Flex" },
  { key: "normal", label: "Normal" },
];

// Sıralama: Top (üst), Mid (sağ), ADC (sağ alt), Support (sol alt), Jungle (sol)
const RADAR_ROLES = [
  { role: "TOP",     label: "Top",     icon: "/roles/top.svg" },
  { role: "MIDDLE",  label: "Mid",     icon: "/roles/mid.svg" },
  { role: "BOTTOM",  label: "ADC",     icon: "/roles/bot.svg" },
  { role: "UTILITY", label: "Support", icon: "/roles/support.svg" },
  { role: "JUNGLE",  label: "Jungle",  icon: "/roles/jungle.svg" },
];

/*
  embedded=true  → kart chrome'u yok; İstatistik merkezi içinde gömülü çalışır.
  filter (kontrollü) verilirse dışarıdan sürülür (StatsHub queue'su); yoksa kendi sekmesi.
*/
export default function RoleRadar({ seasonRoles, filter: controlledFilter, embedded = false }) {
  const [internalFilter, setInternalFilter] = useState("all");
  const filter = controlledFilter ?? internalFilter;
  const [hovIdx, setHovIdx] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  if (!seasonRoles) return null;

  const filtered = seasonRoles[filter] || [];
  const lookup = {};
  filtered.forEach((r) => { lookup[r.role] = r; });

  const roles = RADAR_ROLES.map((r) => ({
    ...r,
    games:   lookup[r.role]?.games   || 0,
    wins:    lookup[r.role]?.wins    || 0,
    losses:  lookup[r.role]?.losses  || 0,
    winRate: lookup[r.role]?.winRate || 0,
  }));

  const totalGames = roles.reduce((s, r) => s + r.games, 0);
  const maxGames = Math.max(...roles.map((r) => r.games), 1);

  // Pentagon geometrisi — cy aşağıda ki Top ikonuna alan kalsın
  const cx = 130, cy = 135, R = 75;
  const angles = RADAR_ROLES.map((_, i) => (Math.PI * 2 * i) / 5 - Math.PI / 2);

  const pt = (angle, ratio) => ({
    x: cx + R * ratio * Math.cos(angle),
    y: cy + R * ratio * Math.sin(angle),
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = angles.map((a, i) => {
    const ratio = roles[i].games > 0 ? Math.max(roles[i].games / maxGames, 0.08) : 0;
    return pt(a, ratio);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const outerPts = angles.map((a) => pt(a, 1));

  const iconSize = 22;
  const iconOffsets = [
    { dx: -iconSize / 2, dy: -46 },
    { dx: 16, dy: -12 },
    { dx: 12, dy: 6 },
    { dx: -iconSize - 12, dy: 6 },
    { dx: -iconSize - 16, dy: -12 },
  ];

  const hov = hovIdx !== null ? roles[hovIdx] : null;

  const content = (
    <div className="flex flex-col items-center px-4 pt-4 pb-3">
      {totalGames === 0 ? (
        <p className="text-xs text-gray-600 py-8">Bu filtrede veri yok</p>
      ) : (
        <>
          <svg width={260} height={280} viewBox="0 0 260 280">
            <defs>
              <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Grid katmanları */}
            {gridLevels.map((level, i) => {
              const poly = angles.map((a) => pt(a, level)).map((p) => `${p.x},${p.y}`).join(" ");
              return (
                <polygon key={i} points={poly} fill="none"
                  stroke={i === 3 ? "#2a3441" : "#1b2230"} strokeWidth={i === 3 ? 1 : 0.5} />
              );
            })}

            {/* Eksen çizgileri */}
            {outerPts.map((p, i) => (
              <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1b2230" strokeWidth={0.5} />
            ))}

            {/* Veri alanı */}
            <polygon points={dataPolygon} fill="url(#radarFill)" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />

            {/* Veri noktaları — hover */}
            {dataPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x} cy={p.y}
                r={16}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => { setHovIdx(i); setAnchorEl(e.currentTarget); }}
                onMouseLeave={() => { setHovIdx(null); setAnchorEl(null); }}
              />
            ))}

            {/* Görünen noktalar (hitbox'ın altında) */}
            {dataPoints.map((p, i) => (
              <circle
                key={`dot-${i}`}
                cx={p.x} cy={p.y}
                r={roles[i].games > 0 ? 4 : 2.5}
                fill={roles[i].games > 0 ? "#3b82f6" : "#1b2230"}
                stroke={roles[i].games > 0 ? "#60a5fa" : "#2a3441"}
                strokeWidth={1.5}
                className="pointer-events-none"
              />
            ))}

            {/* Rol ikonları + oyun sayıları */}
            {outerPts.map((p, i) => {
              const off = iconOffsets[i];
              const ix = p.x + off.dx;
              const iy = p.y + off.dy;
              return (
                <g key={`label-${i}`} className="pointer-events-none">
                  <image href={roles[i].icon} x={ix} y={iy} width={iconSize} height={iconSize}
                    style={{ opacity: roles[i].games > 0 ? 1 : 0.3 }} />
                  <text
                    x={ix + iconSize / 2}
                    y={iy + iconSize + 12}
                    textAnchor="middle"
                    style={{ fontSize: "11px", fontWeight: roles[i].games > 0 ? 700 : 400 }}
                    className={roles[i].games > 0 ? "fill-gray-200" : "fill-gray-600"}
                  >
                    {roles[i].games > 0 ? roles[i].games : "—"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Alt legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 -mt-2">
            {roles.filter((r) => r.games > 0).sort((a, b) => b.games - a.games).map((r) => (
              <div key={r.role} className="flex items-center gap-1.5">
                <img src={r.icon} alt={r.label} width={14} height={14} />
                <span className="text-[11px] text-gray-400">{r.label}</span>
                <span className={`text-[11px] font-bold ${r.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.winRate}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const tooltip = hovIdx !== null && hov && anchorEl && (
    <Tooltip anchorEl={anchorEl}>
      <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
        <p className="text-xs text-white font-semibold">{hov.label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {hov.games > 0
            ? <>{hov.games} maç · <span className="text-emerald-400">{hov.wins}W</span>{" "}<span className="text-red-400">{hov.losses}L</span></>
            : "Oynanmadı"
          }
        </p>
        {hov.games > 0 && (
          <p className={`text-[11px] font-bold mt-0.5 ${hov.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
            {hov.winRate}% WR
          </p>
        )}
      </div>
    </Tooltip>
  );

  // Gömülü mod: İstatistik merkezi içinde — kart chrome'u yok, sadece radar.
  if (embedded) {
    return (
      <div>
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Koridorlar</h3>
        {content}
        {tooltip}
      </div>
    );
  }

  // Standalone kart
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Koridorlar <span className="text-gray-500 font-normal">(Sezon)</span>
        </h3>
        <QueueTabs value={filter} onChange={setInternalFilter} options={QUEUE_FILTERS} />
      </div>
      {content}
      {tooltip}
    </div>
  );
}
