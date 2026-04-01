"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Sparkles, Star } from "lucide-react";

const TIERS = [
  { key: "challenger", label: "Challenger", color: "text-yellow-300", badge: "/ranks/badges/challenger.png" },
  { key: "grandmaster", label: "Grandmaster", color: "text-red-400", badge: "/ranks/badges/grandmaster.png" },
  { key: "master", label: "Master", color: "text-purple-400", badge: "/ranks/badges/master.png" },
];

const QUEUES = [
  { key: "RANKED_SOLO_5x5", label: "Solo/Duo" },
  { key: "RANKED_FLEX_SR", label: "Flex" },
];

const ROLE_ICONS = {
  Top: "/roles/top.png", Mid: "/roles/mid.png", Jungle: "/roles/jungle.png",
  ADC: "/roles/bot.png", Support: "/roles/support.png",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function LeaderboardPage() {
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
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <img src={tierInfo?.badge} alt={tier} width={56} height={56} />
          <div>
            <h1 className="text-2xl font-bold text-white">Sıralama</h1>
            <p className="text-sm text-gray-500">TR1 — {tierInfo?.label} — {data?.total || 0} oyuncu</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1b2230] rounded-lg p-1">
            {TIERS.map((t) => (
              <button key={t.key} onClick={() => setTier(t.key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  tier === t.key ? `bg-white/10 ${t.color} font-medium` : "text-gray-500 hover:text-gray-300"
                }`}>
                <img src={t.badge} alt="" width={16} height={16} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1b2230] rounded-lg p-1">
            {QUEUES.map((q) => (
              <button key={q.key} onClick={() => setQueue(q.key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  queue === q.key ? "bg-blue-500/15 text-blue-400 font-medium" : "text-gray-500 hover:text-gray-300"
                }`}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[50px_1fr_100px_70px_90px_70px_110px_60px_70px] gap-2 px-6 py-3.5 text-[11px] text-gray-500 uppercase tracking-wider border-b border-[#1b2230]/50 font-medium">
          <span>#</span>
          <span>Oyuncu</span>
          <span className="text-center">Şampiyonlar</span>
          <span className="text-center">Koridor</span>
          <span className="text-center">LP</span>
          <span className="text-center">Oyun</span>
          <span className="text-center">Zafer / Yenilgi</span>
          <span className="text-center">WR</span>
          <span className="text-center">Durum</span>
        </div>

        {loading && (
          <div className="py-20 text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            Yükleniyor...
          </div>
        )}

        {!loading && data?.entries?.map((entry, i) => (
          <div
            key={entry.puuid || i}
            className={`grid grid-cols-[50px_1fr_100px_70px_90px_70px_110px_60px_70px] gap-2 items-center px-6 py-3 hover:bg-white/[0.03] transition-colors border-b border-[#1b2230]/15 ${
              i < 3 ? "bg-white/[0.015]" : ""
            }`}
          >
            {/* Sıra */}
            <span className={`text-base font-bold font-mono ${
              i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"
            }`}>
              {entry.rank}
            </span>

            {/* Oyuncu */}
            <div className="flex items-center gap-3">
              <img src={tierInfo?.badge} alt={tier} width={36} height={36} />
              <div>
                {entry.name?.gameName ? (
                  <Link
                    href={`/summoner/${encodeURIComponent(entry.name.gameName)}/${encodeURIComponent(entry.name.tagLine)}`}
                    className="text-sm text-gray-200 font-medium hover:text-blue-400 transition-colors"
                  >
                    {entry.name.gameName}
                    <span className="text-gray-500 text-xs ml-0.5">#{entry.name.tagLine}</span>
                  </Link>
                ) : (
                  <span className="text-sm text-gray-600 italic">Oyuncu #{entry.rank}</span>
                )}
              </div>
            </div>

            {/* Şampiyonlar */}
            <div className="flex items-center justify-center gap-0.5">
              {entry.topChamps ? (
                entry.topChamps.slice(0, 3).map((c, ci) => (
                  <img key={ci} src={c.image} alt={c.name} width={24} height={24} className="rounded-md" title={`${c.name} (Lvl ${c.level})`} />
                ))
              ) : (
                <span className="text-[10px] text-gray-600">—</span>
              )}
            </div>

            {/* Koridor */}
            <div className="flex items-center justify-center gap-1">
              {entry.topRoles ? (
                entry.topRoles.map((r, ri) => (
                  <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role} width={20} height={20} title={r.role} />
                ))
              ) : (
                <span className="text-[10px] text-gray-600">—</span>
              )}
            </div>

            {/* LP */}
            <span className={`text-base font-bold text-center font-mono ${tierInfo?.color}`}>
              {entry.lp.toLocaleString()}
            </span>

            {/* Oyun */}
            <span className="text-sm text-gray-300 text-center">{entry.games}</span>

            {/* W/L */}
            <div className="text-center">
              <span className="text-xs text-emerald-400 font-medium">{entry.wins}W</span>
              <span className="text-xs text-gray-600 mx-1">/</span>
              <span className="text-xs text-red-400 font-medium">{entry.losses}L</span>
            </div>

            {/* WR */}
            <span className={`text-sm font-mono font-bold text-center ${
              entry.winRate >= 55 ? "text-emerald-400" : entry.winRate >= 50 ? "text-blue-400" : "text-red-400"
            }`}>
              {entry.winRate}%
            </span>

            {/* Durum */}
            <div className="flex items-center justify-center gap-1">
              {entry.hotStreak && (
                <span className="p-1 rounded bg-orange-500/15" title="Galibiyet Serisi">
                  <Flame size={14} className="text-orange-400" />
                </span>
              )}
              {entry.freshBlood && (
                <span className="p-1 rounded bg-green-500/15" title="Yeni Giriş">
                  <Sparkles size={14} className="text-green-400" />
                </span>
              )}
              {entry.veteran && (
                <span className="p-1 rounded bg-purple-500/15" title="Veteran (100+ maç)">
                  <Star size={14} className="text-purple-400" />
                </span>
              )}
              {!entry.hotStreak && !entry.freshBlood && !entry.veteran && (
                <span className="text-[10px] text-gray-600">—</span>
              )}
            </div>
          </div>
        ))}

        {!loading && (!data?.entries || data.entries.length === 0) && (
          <div className="py-20 text-center text-gray-500">Veri bulunamadı</div>
        )}
      </div>
    </div>
  );
}
