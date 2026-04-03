"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ReactDOM from "react-dom";

function Tooltip({ anchorEl, children }) {
  if (!anchorEl || typeof window === "undefined") return null;
  const rect = anchorEl.getBoundingClientRect();
  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: `${rect.top - 8}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// WR değerine göre renk — kırmızı → turuncu → yeşil geçişi
function wrToColor(wr) {
  if (wr >= 51) return "#10b981"; // yeşil
  if (wr >= 45) return "#f59e0b"; // turuncu
  return "#ef4444"; // kırmızı
}

export default function WinrateSection({ timeline, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovIdx, setHovIdx] = useState(null);
  const [hovAnchor, setHovAnchor] = useState(null);

  if (!timeline || timeline.length < 2) return null;

  const width = 300;
  const height = 70;
  const pad = { x: 30, y: 10 };

  const chartW = width - pad.x * 2;
  const chartH = height - pad.y * 2;

  const rates = timeline.map((t) => t.winRate);
  const minWr = Math.max(Math.min(...rates) - 5, 0);
  const maxWr = Math.min(Math.max(...rates) + 5, 100);
  const range = Math.max(maxWr - minWr, 10);

  const getX = (i) => pad.x + (i / (timeline.length - 1)) * chartW;
  const getY = (wr) => pad.y + chartH - ((wr - minWr) / range) * chartH;

  const ref50Y = (50 >= minWr && 50 <= maxWr) ? getY(50) : null;
  const lastWr = timeline[timeline.length - 1].winRate;

  // Çizgiyi segment segment çiz — her segment'in rengi WR'a göre
  const segments = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    const avgWr = (timeline[i].winRate + timeline[i + 1].winRate) / 2;
    segments.push({
      x1: getX(i), y1: getY(timeline[i].winRate),
      x2: getX(i + 1), y2: getY(timeline[i + 1].winRate),
      color: wrToColor(avgWr),
    });
  }

  // Gradient fill — son WR rengine göre
  const fillColor = wrToColor(lastWr);

  // Fill polygon
  const polyPoints = timeline.map((t, i) => `${getX(i)},${getY(t.winRate)}`).join(" ");
  const fillPoints = `${pad.x},${pad.y + chartH} ${polyPoints} ${pad.x + chartW},${pad.y + chartH}`;

  // Tarih etiketleri
  const dateLabels = [];
  if (timeline.length > 0) {
    dateLabels.push({ i: 0, label: timeline[0].date });
    if (timeline.length > 4) {
      const mid = Math.floor(timeline.length / 2);
      dateLabels.push({ i: mid, label: timeline[mid].date });
    }
    dateLabels.push({ i: timeline.length - 1, label: timeline[timeline.length - 1].date });
  }

  const hovData = hovIdx !== null ? timeline[hovIdx] : null;

  return (
    <div className="mt-3 pt-2 border-t border-[#1b2230]/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer group"
      >
        <span className="text-[11px] text-gray-400 group-hover:text-gray-200 transition-colors">
          Win Rate Geçmişi
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{timeline.length} maç</span>
          <ChevronDown size={14} className={`text-gray-600 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="mt-2">
          <svg
            width="100%" height={height + 18}
            viewBox={`0 0 ${width} ${height + 18}`}
            preserveAspectRatio="none"
            onMouseLeave={() => { setHovIdx(null); setHovAnchor(null); }}
          >
            <defs>
              <linearGradient id="wrFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Min/Max WR etiketleri */}
            <text x={pad.x - 4} y={pad.y + 4} textAnchor="end" className="fill-gray-600" style={{ fontSize: "8px" }}>
              {Math.round(maxWr)}%
            </text>
            <text x={pad.x - 4} y={pad.y + chartH + 2} textAnchor="end" className="fill-gray-600" style={{ fontSize: "8px" }}>
              {Math.round(minWr)}%
            </text>

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

            {/* Gradient dolgu */}
            <polygon points={fillPoints} fill="url(#wrFillGrad)" />

            {/* Renkli çizgi segmentleri */}
            {segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={s.color} strokeWidth={2} strokeLinecap="round" />
            ))}

            {/* Hover noktaları — büyük görünmez hitbox */}
            {timeline.map((t, i) => (
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
              <circle cx={getX(hovIdx)} cy={getY(timeline[hovIdx].winRate)}
                r={4} fill={wrToColor(timeline[hovIdx].winRate)} className="pointer-events-none" />
            )}

            {/* Son nokta — her zaman görünür */}
            <circle cx={getX(timeline.length - 1)} cy={getY(lastWr)}
              r={3} fill={wrToColor(lastWr)} className="pointer-events-none" />

            {/* Tarih etiketleri */}
            {dateLabels.map((dl) => (
              <text key={dl.i} x={getX(dl.i)} y={height + 12}
                textAnchor={dl.i === 0 ? "start" : dl.i === timeline.length - 1 ? "end" : "middle"}
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
