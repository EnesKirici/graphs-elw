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
 * ELW skoru şeffaflık modalı (DPM tarzı). Skoru oluşturan her metriği stat → puan
 * olarak gösterir. Tıklamayla açılır; arka plan/Esc ile kapanır.
 */
export default function ElwScoreModal({ matchId, puuid, champImage, mode = "individual", onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("breakdown"); // "breakdown" | "vsOpp"

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

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-2xl bg-[#0a0e14] border border-[#2a3441] shadow-2xl shadow-black/80 overflow-hidden"
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
          <div className="text-[11px] font-semibold text-gray-500 tracking-widest uppercase mb-2">
            ELW Skoru
          </div>
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

        {/* Sekmeler + gövde */}
        {data && (
          <>
            <div className="flex border-b border-[#1a2230]">
              <button
                onClick={() => setTab("breakdown")}
                className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors ${
                  tab === "breakdown" ? "text-gray-100 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                ELW Kırılımı
              </button>
              {data.vsOpponent && (
                <button
                  onClick={() => setTab("vsOpp")}
                  className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors ${
                    tab === "vsOpp" ? "text-gray-100 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  vs Rakip
                </button>
              )}
            </div>

            {/* ELW Kırılımı — her metrik: stat → puan */}
            {tab === "breakdown" && (
              <div className="px-5 py-3.5">
                <div className="flex items-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  <span className="flex-1">Metrik</span>
                  <span className="w-28 text-right pr-3">İstatistiğin</span>
                  <span className="w-12 text-right">Puan</span>
                </div>
                <div className="space-y-0.5">
                  {data.components.map((c) => (
                    <div key={c.key} className="flex items-center text-[12px] py-1 border-b border-white/[0.03] last:border-0">
                      <span className="flex-1 text-gray-300">{c.label}</span>
                      <span className="w-28 text-right pr-3 text-gray-400 tabular-nums">{c.stat}</span>
                      <span
                        className={`w-12 text-right font-bold tabular-nums ${
                          c.points > 0 ? "text-emerald-400" : c.points < 0 ? "text-red-400" : "text-gray-600"
                        }`}
                      >
                        {c.points > 0 ? "+" : ""}
                        {c.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-3.5 pt-3 border-t border-[#1a2230]">
                  Her metrik <b className="text-gray-400">role göre ağırlıklı</b> (ormanın ejderi, desteğin vizyonu…).
                  Galibiyet/mağlubiyet puana girmez — <b className="text-gray-400">ne yaptığın</b> sayılır. Puanlar lobi
                  ortalamasına göre 0–10'a ölçeklenir.
                </p>
              </div>
            )}

            {/* vs Rakip — koridor rakibiyle kıyas */}
            {tab === "vsOpp" && data.vsOpponent && (
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-[12px] text-gray-400">Koridor rakibin:</span>
                  <img src={data.vsOpponent.champion.image} alt="" width={24} height={24} className="rounded" />
                  <span className="text-[12px] font-semibold text-gray-200">{data.vsOpponent.champion.name}</span>
                </div>
                <div className="flex items-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  <span className="w-14 text-right pr-2">Sen</span>
                  <span className="flex-1 text-center">Metrik</span>
                  <span className="w-14 text-left pl-2">Rakip</span>
                  <span className="w-12 text-right">Fark</span>
                </div>
                <div className="space-y-0.5">
                  {data.vsOpponent.rows.map((r) => (
                    <div key={r.key} className="flex items-center text-[12px] py-1 border-b border-white/[0.03] last:border-0">
                      <span className="w-14 text-right pr-2 text-gray-200 tabular-nums">{fmtNum(r.me)}</span>
                      <span className="flex-1 text-center text-gray-500">{r.label}</span>
                      <span className="w-14 text-left pl-2 text-gray-400 tabular-nums">{fmtNum(r.opp)}</span>
                      <span
                        className={`w-12 text-right font-bold tabular-nums ${
                          r.diff > 0 ? "text-emerald-400" : r.diff < 0 ? "text-red-400" : "text-gray-600"
                        }`}
                      >
                        {r.diff > 0 ? "+" : ""}
                        {fmtNum(r.diff)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-3.5 pt-3 border-t border-[#1a2230]">
                  Aynı roldeki rakiple kıyas. <b className="text-emerald-400">Yeşil</b> = öndesin, <b className="text-red-400">kırmızı</b> = gerisin.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
