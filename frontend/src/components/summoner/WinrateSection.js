"use client";

import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";

// WR değerine göre renk — kırmızı → turuncu → yeşil geçişi
function wrToColor(wr) {
  if (wr >= 51) return "#10b981"; // yeşil
  if (wr >= 45) return "#f59e0b"; // turuncu
  return "#ef4444"; // kırmızı
}

const TIME_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "7d", label: "7 Gün", days: 7 },
  { key: "15d", label: "15 Gün", days: 15 },
  { key: "30d", label: "30 Gün", days: 30 },
];

export default function WinrateSection({ timeline, defaultOpen = false, label = "Win Rate Geçmişi" }) {
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState(defaultOpen);
  const [hovIdx, setHovIdx] = useState(null);
  const [hovAnchor, setHovAnchor] = useState(null);
  const [filter, setFilter] = useState("all");

  if (!timeline || timeline.length < 2) return null;

  // Filtreleme
  const filteredTimeline = filter === "all"
    ? timeline
    : (() => {
        const f = TIME_FILTERS.find((t) => t.key === filter);
        if (!f?.days) return timeline;
        const cutoff = Date.now() - f.days * 86400000;
        return timeline.filter((t) => !t.timestamp || t.timestamp >= cutoff);
      })();

  // Filtrelenmiş veri 2'den azsa fallback olarak tümünü göster
  const data = filteredTimeline.length >= 2 ? filteredTimeline : timeline;

  const width = 300;
  const height = 70;
  const pad = { x: 30, y: 10 };

  const chartW = width - pad.x * 2;
  const chartH = height - pad.y * 2;

  const rates = data.map((t) => t.winRate);
  const minWr = Math.max(Math.min(...rates) - 5, 0);
  const maxWr = Math.min(Math.max(...rates) + 5, 100);
  const range = Math.max(maxWr - minWr, 10);

  const getX = (i) => pad.x + (i / (data.length - 1)) * chartW;
  const getY = (wr) => pad.y + chartH - ((wr - minWr) / range) * chartH;

  const ref50Y = (50 >= minWr && 50 <= maxWr) ? getY(50) : null;
  const lastWr = data[data.length - 1].winRate;

  // Min/Max etiketleri %50 referans çizgisine çok yakınsa gizle (üst üste binmesin)
  const showMaxLabel = ref50Y === null || Math.abs(getY(maxWr) - ref50Y) > 9;
  const showMinLabel = ref50Y === null || Math.abs(getY(minWr) - ref50Y) > 9;

  // Çizgiyi segment segment çiz — her segment'in rengi WR'a göre
  const segments = [];
  for (let i = 0; i < data.length - 1; i++) {
    const avgWr = (data[i].winRate + data[i + 1].winRate) / 2;
    segments.push({
      x1: getX(i), y1: getY(data[i].winRate),
      x2: getX(i + 1), y2: getY(data[i + 1].winRate),
      color: wrToColor(avgWr),
    });
  }

  // Fill — her segment kendi renginde doldurulur
  const bottomY = pad.y + chartH;

  // Tarih etiketleri
  const dateLabels = [];
  if (data.length > 0) {
    dateLabels.push({ i: 0, label: data[0].date });
    if (data.length > 4) {
      const mid = Math.floor(data.length / 2);
      dateLabels.push({ i: mid, label: data[mid].date });
    }
    dateLabels.push({ i: data.length - 1, label: data[data.length - 1].date });
  }

  const hovData = hovIdx !== null ? data[hovIdx] : null;

  return (
    <div className="mt-3 pt-2 border-t border-[#1b2230]/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer group"
      >
        <span className="text-[11px] text-gray-400 group-hover:text-gray-200 transition-colors">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{data.length} maç</span>
          <ChevronDown size={14} className={`text-gray-600 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="mt-2">
          {/* Zaman filtreleri */}
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setHovIdx(null); setHovAnchor(null); }}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  filter === f.key
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <svg
            width="100%" height={height + 18}
            viewBox={`0 0 ${width} ${height + 18}`}
            preserveAspectRatio="none"
            onMouseLeave={() => { setHovIdx(null); setHovAnchor(null); }}
          >
            <defs>
              {segments.map((s, i) => (
                <linearGradient key={`fg${i}`} id={`${uid}Fill${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {/* Min/Max WR etiketleri (50% çizgisine yakınsa gizlenir) */}
            {showMaxLabel && (
              <text x={pad.x - 4} y={pad.y + 4} textAnchor="end" className="fill-gray-600" style={{ fontSize: "8px" }}>
                {Math.round(maxWr)}%
              </text>
            )}
            {showMinLabel && (
              <text x={pad.x - 4} y={pad.y + chartH + 2} textAnchor="end" className="fill-gray-600" style={{ fontSize: "8px" }}>
                {Math.round(minWr)}%
              </text>
            )}

            {/* %50 referans çizgisi */}
            {ref50Y !== null && (
              <>
                <line x1={pad.x} y1={ref50Y} x2={width - pad.x} y2={ref50Y}
                  stroke="#1b2230" strokeWidth={1} strokeDasharray="4,3" />
                <text x={pad.x - 4} y={ref50Y + 3} textAnchor="end" className="fill-gray-500" style={{ fontSize: "8px" }}>
                  50%
                </text>
              </>
            )}

            {/* Segment bazlı gradient dolgu */}
            {segments.map((s, i) => (
              <polygon key={`f${i}`} points={`${s.x1},${bottomY} ${s.x1},${s.y1} ${s.x2},${s.y2} ${s.x2},${bottomY}`} fill={`url(#${uid}Fill${i})`} />
            ))}

            {/* Renkli çizgi segmentleri */}
            {segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={s.color} strokeWidth={2} strokeLinecap="round" />
            ))}

            {/* Hover noktaları — büyük görünmez hitbox */}
            {data.map((t, i) => (
              <circle
                key={i}
                cx={getX(i)} cy={getY(t.winRate)}
                r={8}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => { setHovIdx(i); setHovAnchor(e.currentTarget); }}
              />
            ))}

            {/* Hover edilen nokta — görünür */}
            {hovIdx !== null && (
              <circle cx={getX(hovIdx)} cy={getY(data[hovIdx].winRate)}
                r={4} fill={wrToColor(data[hovIdx].winRate)} className="pointer-events-none" />
            )}

            {/* Son nokta — her zaman görünür */}
            <circle cx={getX(data.length - 1)} cy={getY(lastWr)}
              r={3} fill={wrToColor(lastWr)} className="pointer-events-none" />

            {/* Tarih etiketleri */}
            {dateLabels.map((dl) => (
              <text key={dl.i} x={getX(dl.i)} y={height + 12}
                textAnchor={dl.i === 0 ? "start" : dl.i === data.length - 1 ? "end" : "middle"}
                className="fill-gray-600" style={{ fontSize: "9px" }}>
                {dl.label}
              </text>
            ))}
          </svg>

          {/* Portal Tooltip */}
          {hovData && hovAnchor && (
            <Tooltip anchorEl={hovAnchor}>
              <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
                <p className={`text-sm font-bold`} style={{ color: wrToColor(hovData.winRate) }}>{hovData.winRate}%</p>
                <p className="text-[11px] text-gray-400">{hovData.date} · Maç {hovData.game}</p>
              </div>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
