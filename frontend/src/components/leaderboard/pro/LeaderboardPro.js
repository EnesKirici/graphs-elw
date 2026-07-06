"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Shield, Zap } from "lucide-react";

const TIERS = [
  { key: "challenger", label: "Challenger", color: "text-yellow-300", badge: "/ranks/badges/challenger.webp" },
  { key: "grandmaster", label: "Grandmaster", color: "text-red-400", badge: "/ranks/badges/grandmaster.webp" },
  { key: "master", label: "Master", color: "text-purple-400", badge: "/ranks/badges/master.webp" },
];

const QUEUES = [
  { key: "RANKED_SOLO_5x5", label: "Solo/Duo" },
  { key: "RANKED_FLEX_SR", label: "Flex" },
];

const ROLE_ICONS = {
  Top: "/roles/top.webp", Mid: "/roles/mid.webp", Jungle: "/roles/jungle.webp",
  ADC: "/roles/bot.webp", Support: "/roles/support.webp",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BADGES = {
  hotStreak: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/15", label: "Galibiyet Serisi", desc: "Son 3+ maçı üst üste kazanmış" },
  freshBlood: { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Yeni Giriş", desc: "Bu lig'e yeni yükselmiş" },
  veteran: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/15", label: "Veteran", desc: "Bu lig'de 100+ maç oynamış" },
};

function BadgeIcon({ type, active }) {
  if (!active) return null;
  const badge = BADGES[type];
  const Icon = badge.icon;
  return (
    <span className={`relative group/badge p-1 rounded ${badge.bg} cursor-default`} title={`${badge.label} — ${badge.desc}`}>
      <Icon size={15} className={badge.color} />
    </span>
  );
}

// Mobil: yalnız # / Oyuncu / LP / WR (sabit ~750px grid 390'ı taşırıyordu — diğer kolonlar md+)
const GRID = "grid-cols-[34px_minmax(0,1fr)_64px_48px] md:grid-cols-[50px_1fr_150px_80px_90px_64px_104px_60px_76px]";

export default function LeaderboardPro() {
  const [tier, setTier] = useState("challenger");
  const [queue, setQueue] = useState("RANKED_SOLO_5x5");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/leaderboard?tier=${tier}&queue=${queue}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tier, queue]);

  const tierInfo = TIERS.find((t) => t.key === tier);

  return (
    <div className="dpm-scope min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Başlık + Filtreler */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={tierInfo?.badge} alt={tier} width={56} height={56} className="drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]" />
            <div>
              <h1 className="text-2xl font-bold text-white">Sıralama</h1>
              <p className="text-sm text-gray-500">TR1 — {tierInfo?.label} — {data?.total || 0} oyuncu</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-card border border-edge rounded-lg p-1">
              {TIERS.map((t) => (
                <button key={t.key} onClick={() => setTier(t.key)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    tier === t.key ? `bg-soft ${t.color} font-medium` : "text-gray-500 hover:text-gray-300"
                  }`}>
                  <img src={t.badge} alt="" width={16} height={16} />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-card border border-edge rounded-lg p-1">
              {QUEUES.map((q) => (
                <button key={q.key} onClick={() => setQueue(q.key)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    queue === q.key ? "bg-cyan-500/10 text-cyan-300 font-medium" : "text-gray-500 hover:text-gray-300"
                  }`}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="glass rounded-xl overflow-visible">
          <div className={`grid ${GRID} gap-2 px-3 md:px-6 py-3 text-[11px] text-gray-500 uppercase tracking-wider border-b border-edge/50 font-medium`}>
            <span>#</span>
            <span>Oyuncu</span>
            <span className="hidden md:block text-center">Şampiyonlar</span>
            <span className="hidden md:block text-center">Koridor</span>
            <span className="text-center">LP</span>
            <span className="hidden md:block text-center">Oyun</span>
            <span className="hidden md:block text-center">G / M</span>
            <span className="text-center">WR</span>
            <span className="hidden md:block text-center">Rozet</span>
          </div>

          {loading && (
            <div className="py-20 text-center text-gray-500">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
              Yükleniyor...
            </div>
          )}

          {!loading && data?.entries?.map((entry, i) => (
            <div key={entry.puuid || i}
              className={`grid ${GRID} gap-2 items-center px-3 md:px-6 py-3 hover:bg-hover transition-colors border-b border-edge/15 ${i < 3 ? "bg-white/[0.015]" : ""}`}>
              {/* Sıra — ilk 3 madalya rengi */}
              <span className={`text-base font-bold font-mono ${
                i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"
              }`}>
                {entry.rank}
              </span>

              {/* Oyuncu */}
              <div className="flex items-center gap-3 min-w-0">
                <img src={tierInfo?.badge} alt={tier} width={34} height={34} />
                {entry.name?.gameName ? (
                  <Link
                    href={`/summoner/${encodeURIComponent(entry.name.gameName)}/${encodeURIComponent(entry.name.tagLine)}`}
                    className="text-sm text-gray-200 font-medium hover:text-cyan-300 transition-colors truncate"
                  >
                    {entry.name.gameName}
                    <span className="text-gray-600 text-xs ml-0.5">#{entry.name.tagLine}</span>
                  </Link>
                ) : (
                  <span className="text-sm text-gray-600 italic">Oyuncu #{entry.rank}</span>
                )}
              </div>

              {/* Şampiyonlar */}
              <div className="hidden md:flex items-center justify-center gap-1">
                {entry.topChamps ? entry.topChamps.slice(0, 5).map((c, ci) => (
                  <img key={ci} src={c.image} alt={c.name} width={26} height={26} className="rounded-md" title={`${c.name} (Lvl ${c.level})`} />
                )) : <span className="text-[10px] text-gray-600">—</span>}
              </div>

              {/* Koridor */}
              <div className="hidden md:flex items-center justify-center gap-1.5">
                {entry.topRoles ? entry.topRoles.map((r, ri) => (
                  <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role} width={22} height={22} title={r.role} />
                )) : <span className="text-[10px] text-gray-600">—</span>}
              </div>

              {/* LP — cyan accent */}
              <span className="text-base font-bold text-center font-mono" style={{ color: "var(--dpm-accent)" }}>
                {entry.lp.toLocaleString()}
              </span>

              {/* Oyun */}
              <span className="hidden md:block text-sm text-gray-300 text-center">{entry.games}</span>

              {/* G / M */}
              <div className="hidden md:block text-center">
                <span className="text-xs text-emerald-400 font-medium">{entry.wins}G</span>
                <span className="text-xs text-gray-600 mx-1">·</span>
                <span className="text-xs text-red-400 font-medium">{entry.losses}M</span>
              </div>

              {/* WR */}
              <span className={`text-sm font-mono font-bold text-center ${
                entry.winRate >= 55 ? "text-emerald-400" : entry.winRate >= 50 ? "text-gray-200" : "text-red-400"
              }`}>
                {entry.winRate}%
              </span>

              {/* Rozet */}
              <div className="hidden md:flex items-center justify-center gap-1">
                <BadgeIcon type="hotStreak" active={entry.hotStreak} />
                <BadgeIcon type="freshBlood" active={entry.freshBlood} />
                <BadgeIcon type="veteran" active={entry.veteran} />
                {!entry.hotStreak && !entry.freshBlood && !entry.veteran && <span className="text-[10px] text-gray-600">—</span>}
              </div>
            </div>
          ))}

          {!loading && (!data?.entries || data.entries.length === 0) && (
            <div className="py-20 text-center text-gray-500">Veri bulunamadı</div>
          )}
        </div>
      </div>
    </div>
  );
}
