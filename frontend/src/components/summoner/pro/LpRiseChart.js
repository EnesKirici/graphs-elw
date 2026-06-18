"use client";

import { useState, useId, useRef, useEffect } from "react";
import { TIER_TR, tierColor, miniCrestUrl, absoluteToDisplay } from "./rankUtils";

const TIME_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "7d", label: "7G", days: 7 },
  { key: "15d", label: "15G", days: 15 },
  { key: "30d", label: "30G", days: 30 },
];

function wrColor(wr) {
  if (wr >= 51) return "#10b981";
  if (wr >= 45) return "#9ca3af";
  return "#ef4444";
}

// Görünür LP aralığındaki bölüm/tier sınırları (sol eksen emblemleri için)
function levelBoundaries(yMin, yMax) {
  const lo = Math.ceil(yMin / 100) * 100;
  const hi = Math.floor(yMax / 100) * 100;
  let bs = [];
  for (let b = lo; b <= hi; b += 100) bs.push(b);
  if (bs.length > 5) {
    bs = [];
    const lo4 = Math.ceil(yMin / 400) * 400, hi4 = Math.floor(yMax / 400) * 400;
    for (let b = lo4; b <= hi4; b += 400) bs.push(b);
  }
  return bs;
}

/*
  dpm.lol stili çizgi grafiği — LP gelişimi VE WR geçmişi için tek bileşen (aynı boyut).
  variant="lp": mutlak LP, tier renkli çizgi, sol kenarda Riot mini-crest emblemleri.
  variant="wr": winRate, yeşil/kırmızı çizgi, %50 referans çizgisi.
  Grafiğin her yerine gelince tooltip + dikey kılavuz.
*/
export default function LpRiseChart({ timeline, peak, estimated, showHeaderLabel = true, variant = "lp" }) {
  const uid = useId().replace(/:/g, "");
  const [filter, setFilter] = useState("all");
  const [hovIdx, setHovIdx] = useState(null);
  const isWr = variant === "wr";

  const wrapRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(300);
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => setChartWidth(Math.max(el.clientWidth, 200));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!timeline || timeline.length < 2) return null;

  const filtered = filter === "all"
    ? timeline
    : (() => {
        const f = TIME_FILTERS.find((t) => t.key === filter);
        if (!f?.days) return timeline;
        const cutoff = Date.now() - f.days * 86400000;
        const r = timeline.filter((t) => !t.timestamp || t.timestamp >= cutoff);
        return r.length >= 2 ? r : timeline;
      })();
  const data = filtered;

  const val = (d) => (isWr ? d.winRate : d.lp);
  const segColor = (d) => (isWr ? wrColor(d.winRate) : tierColor(d.tier));

  const width = chartWidth;
  const height = 78;
  const pad = { l: isWr ? 18 : 22, r: 6, y: 13 };
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.y * 2;

  const vals = data.map(val);
  let yMin, yMax;
  if (isWr) {
    yMin = Math.max(Math.min(...vals) - 5, 0);
    yMax = Math.min(Math.max(...vals) + 5, 100);
    if (yMax - yMin < 10) { yMin = Math.max(yMin - 5, 0); yMax = Math.min(yMax + 5, 100); }
  } else {
    const peakLp = peak?.lp ?? Math.max(...vals);
    const lo = Math.min(Math.min(...vals), peakLp);
    const hi = Math.max(Math.max(...vals), peakLp);
    const span = Math.max(hi - lo, 20);
    yMin = lo - span * 0.14;
    yMax = hi + span * 0.14;
  }
  const range = Math.max(yMax - yMin, 1);

  const getX = (i) => pad.l + (i / (data.length - 1)) * chartW;
  const getY = (v) => pad.y + chartH - ((v - yMin) / range) * chartH;

  // Sol eksen tier emblemleri (yalnız LP)
  let levels = [];
  if (!isWr) {
    let bs = levelBoundaries(yMin, yMax);
    if (bs.length === 0) bs = [Math.round((yMin + yMax) / 2 / 100) * 100];
    levels = bs.map((b) => ({ b, y: getY(b), tier: absoluteToDisplay(b).tier }));
  }

  // Referans çizgisi: LP → peak; WR → %50
  const refV = isWr ? 50 : (peak?.lp ?? Math.max(...vals));
  const refY = getY(refV);
  const refInRange = refV >= yMin && refV <= yMax;

  const segments = [];
  for (let i = 0; i < data.length - 1; i++) {
    segments.push({
      x1: getX(i), y1: getY(val(data[i])),
      x2: getX(i + 1), y2: getY(val(data[i + 1])),
      color: segColor(data[i]),
    });
  }
  const bottomY = pad.y + chartH;
  const last = data[data.length - 1];
  const hov = hovIdx != null ? data[hovIdx] : null;

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = rect.width > 0 ? (x - pad.l) / chartW : 0;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
    setHovIdx(idx);
  }

  const tipLeft = hov ? Math.max(54, Math.min(width - 54, getX(hovIdx))) : 0;
  const tipTop = hov ? getY(val(hov)) : 0;
  const hovColor = hov ? segColor(hov) : "#22d3ee";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {showHeaderLabel ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400">{isWr ? "WR Geçmişi" : "LP Gelişimi"}</span>
            {!isWr && estimated && (
              <span className="text-[8px] text-gray-600 border border-edge rounded px-1 py-px cursor-help" title="Henüz yeterli LP geçmişi kaydı yok; eğri kısmen tahmini.">tahmini</span>
            )}
          </div>
        ) : (
          (!isWr && estimated) ? (
            <span className="text-[8px] text-gray-600 border border-edge rounded px-1 py-px cursor-help" title="Henüz yeterli LP geçmişi kaydı yok; eğri kısmen tahmini.">tahmini</span>
          ) : <span />
        )}
        <div className="flex items-center gap-1">
          {TIME_FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setHovIdx(null); }}
              className={`text-[9px] px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${filter === f.key ? "text-cyan-300 bg-cyan-500/10" : "text-gray-500 hover:text-gray-300"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="w-full relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            {segments.map((s, i) => (
              <linearGradient key={`fg${i}`} id={`${uid}fill${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Tier emblemleri + bölüm çizgileri (LP) */}
          {levels.map((lv, i) => (
            <g key={`lv${i}`}>
              <line x1={pad.l} y1={lv.y} x2={width - pad.r} y2={lv.y} stroke="var(--c-grid)" strokeWidth="0.75" strokeDasharray="3,3" strokeOpacity="0.5" />
              <image href={miniCrestUrl(lv.tier)} x={1} y={lv.y - 8} width={16} height={16} preserveAspectRatio="xMidYMid meet" opacity="0.95" />
            </g>
          ))}

          {/* Referans çizgisi */}
          {refInRange && (
            <>
              <line x1={pad.l} y1={refY} x2={width - pad.r} y2={refY} stroke="var(--c-grid-strong)" strokeWidth="1" strokeDasharray="4,3" />
              <text x={width - pad.r} y={Math.max(refY - 3, 8)} textAnchor="end" className="fill-gray-600" style={{ fontSize: "8px" }}>{isWr ? "%50" : "Peak"}</text>
            </>
          )}

          {/* Renkli dolgu + çizgi */}
          {segments.map((s, i) => (
            <polygon key={`f${i}`} points={`${s.x1},${bottomY} ${s.x1},${s.y1} ${s.x2},${s.y2} ${s.x2},${bottomY}`} fill={`url(#${uid}fill${i})`} />
          ))}
          {segments.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth="2" strokeLinecap="round" />
          ))}

          {/* Dikey kılavuz + hover noktası */}
          {hov && (
            <>
              <line x1={getX(hovIdx)} y1={pad.y} x2={getX(hovIdx)} y2={bottomY} stroke={hovColor} strokeWidth="0.75" strokeOpacity="0.5" />
              <circle cx={getX(hovIdx)} cy={getY(val(hov))} r="3.5" fill="var(--c-card)" stroke={hovColor} strokeWidth="2" />
            </>
          )}
          <circle cx={getX(data.length - 1)} cy={getY(val(last))} r="2.5" fill={segColor(last)} className="pointer-events-none" />

          <rect x="0" y="0" width={width} height={height} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHovIdx(null)} className="cursor-crosshair" />
        </svg>

        {/* İnline tooltip */}
        {hov && (
          <div className="absolute pointer-events-none z-20" style={{ left: `${tipLeft}px`, top: `${tipTop}px`, transform: "translate(-50%, calc(-100% - 10px))" }}>
            <div className="rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap shadow-2xl shadow-black/80" style={{ background: "var(--dpm-panel)", border: `1px solid ${hovColor}55` }}>
              <p className="text-[10px] text-gray-400 leading-none mb-1" suppressHydrationWarning>{hov.date}</p>
              {isWr ? (
                <span className="text-[13px] font-bold leading-none" style={{ color: hovColor }}>{hov.winRate}% WR</span>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <img src={miniCrestUrl(hov.tier)} alt="" width={18} height={18} />
                  <span className="text-[13px] font-bold leading-none" style={{ color: hovColor }}>
                    {TIER_TR[hov.tier] || hov.tier}{hov.rank ? ` ${hov.rank}` : ""} · {hov.divLp} LP
                  </span>
                </div>
              )}
              <p className="text-[9px] text-gray-500 leading-none mt-1">Maç {hov.game}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
