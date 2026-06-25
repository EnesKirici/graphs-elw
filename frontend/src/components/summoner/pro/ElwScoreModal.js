"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getElwBreakdown } from "@/lib/api";
import { scoreColor } from "./scoreColor";

const GRADE_COLOR = {
  "S+": "#fbbf24", S: "#fbbf24", A: "#a78bfa", B: "#34d399", C: "#fb923c", D: "#f87171",
};

// Büyük sayıları kısalt (altın/hasar): 11326 → 11.3k.
function fmtNum(n) {
  if (typeof n !== "number") return n;
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return `${n}`;
}

/**
 * ELW skoru şeffaflık modalı (DPM tarzı, kategorili). Üstte şampiyon + skor + harf notu;
 * altında kategori sekmeleri (Global / vs Rakip / Objektif / Takım / Role-Özel), her
 * kategoride harf notu + metrikler (stat → puan). Tıklamayla açılır; arka plan/Esc kapatır.
 */
export default function ElwScoreModal({ matchId, puuid, champImage, mode = "individual", onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    getElwBreakdown(matchId, puuid, mode)
      .then((d) => alive && (d?.error ? setErr(true) : setData(d)))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [matchId, puuid, mode]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const cats = data?.categories || [];
  const cat = cats[tab] || cats[0] || null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl bg-[#0a0e14] border border-[#2a3441] shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık — şampiyon + skor + harf notu */}
        <div className="relative flex flex-col items-center pt-6 pb-4 px-5 border-b border-[#1a2230]">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-600 hover:text-gray-300 text-lg leading-none"
            aria-label="Kapat"
          >
            ✕
          </button>
          <div className="text-[11px] font-semibold text-gray-500 tracking-widest uppercase mb-2">ELW Skoru</div>
          {champImage && (
            <img src={champImage} alt="" width={46} height={46} className="rounded-lg mb-2.5 border border-[#2a3441]" />
          )}
          {data ? (
            <>
              <div className="text-[42px] font-black leading-none" style={{ color: scoreColor(data.score) }}>
                {data.score.toFixed(1)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[22px] font-black leading-none" style={{ color: GRADE_COLOR[data.grade] || "#94a3b8" }}>
                  {data.grade}
                </span>
                <span className="text-[12px] text-gray-500">· {data.roleLabel}</span>
              </div>
            </>
          ) : err ? (
            <div className="text-[13px] text-gray-500 py-4">Skor kırılımı alınamadı.</div>
          ) : (
            <div className="text-[13px] text-gray-500 py-4 animate-pulse">Hesaplanıyor…</div>
          )}
        </div>

        {data && cats.length > 0 && (
          <>
            {/* Kategori sekmeleri */}
            <div className="flex border-b border-[#1a2230] overflow-x-auto">
              {cats.map((c, i) => (
                <button
                  key={c.key}
                  onClick={() => setTab(i)}
                  className={`flex-1 whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold transition-colors ${
                    i === tab ? "text-gray-100 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Kategori gövdesi — harf notu + metrikler */}
            {cat && (
              <div className="px-5 py-4">
                <div className="text-center mb-3">
                  <div className="text-[13px] font-semibold text-gray-300">{cat.label}</div>
                  <div className="text-[30px] font-black leading-none mt-0.5" style={{ color: GRADE_COLOR[cat.grade] || "#94a3b8" }}>
                    {cat.grade}
                  </div>
                  {cat.key === "vsOpp" && data.opponent && (
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-gray-500">vs</span>
                      <img src={data.opponent.image} alt="" width={20} height={20} className="rounded" />
                      <span className="text-[11px] text-gray-300">{data.opponent.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  <span className="w-20 text-left">İstatistiğin</span>
                  <span className="flex-1 text-center">Metrik</span>
                  <span className="w-12 text-right">Puan</span>
                </div>
                <div className="space-y-0.5">
                  {cat.metrics.map((m) => (
                    <div key={m.key} className="flex items-center text-[12px] py-1 border-b border-white/[0.03] last:border-0">
                      <span className="w-20 text-left text-gray-200 tabular-nums">{m.stat}</span>
                      <span className="flex-1 text-center text-gray-500">{m.label}</span>
                      <span
                        className={`w-12 text-right font-bold tabular-nums ${
                          m.points > 0 ? "text-emerald-400" : m.points < 0 ? "text-red-400" : "text-gray-600"
                        }`}
                      >
                        {m.points > 0 ? "+" : ""}
                        {m.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="px-5 pb-4 text-[10px] text-gray-500 leading-relaxed">
              Her metrik <b className="text-gray-400">role göre ağırlıklı</b>. Galibiyet/mağlubiyet puana
              girmez — <b className="text-gray-400">ne yaptığın</b> sayılır. Toplam skor lobi ortalamasına göre 0–10.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
