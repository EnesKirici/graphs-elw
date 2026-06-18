"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Sparkles, Star, Shield, Award, Zap } from "lucide-react";

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

// Rozet bilgileri — hover tooltip için
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
    <span className={`relative group/badge p-1 rounded ${badge.bg} cursor-default`}>
      <Icon size={15} className={badge.color} />
      {/* Hover tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/badge:block z-[9999] pointer-events-none">
        <span className="tip-dark bg-[#0a0e14] border border-edge rounded-lg px-3 py-2 shadow-xl shadow-black/80 whitespace-nowrap block">
          <span className={`text-xs font-medium ${badge.color} block`}>{badge.label}</span>
          <span className="text-[10px] text-gray-500 block mt-0.5">{badge.desc}</span>
        </span>
      </span>
    </span>
  );
}

export default function LeaderboardClassic() {
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
      {/* Breadcrumb + Geri */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-gray-300">Sıralama</span>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>
      </div>

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
                  queue === q.key ? "bg-blue-500/15 text-blue-400 font-medium" : "text-gray-500 hover:text-gray-300"
                }`}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tablo — overflow-visible for tooltips */}
      <div className="glass rounded-xl overflow-visible">
        {/* Header */}
        <div className="grid grid-cols-[50px_1fr_160px_80px_90px_70px_110px_60px_80px] gap-2 px-6 py-3.5 text-[11px] text-gray-500 uppercase tracking-wider border-b border-edge/50 font-medium">
          <span>#</span>
          <span>Oyuncu</span>
          <span className="text-center">Şampiyonlar</span>
          <span className="text-center">Koridor</span>
          <span className="text-center">LP</span>
          <span className="text-center">Oyun</span>
          <span className="text-center">Zafer / Yenilgi</span>
          <span className="text-center">WR</span>
          <span className="text-center">Rozetler</span>
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
            className={`grid grid-cols-[50px_1fr_160px_80px_90px_70px_110px_60px_80px] gap-2 items-center px-6 py-3 hover:bg-hover transition-colors border-b border-edge/15 ${
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
              {entry.name?.gameName ? (
                <Link
                  href={`/summoner/${encodeURIComponent(entry.name.gameName)}/${encodeURIComponent(entry.name.tagLine)}`}
                  className="text-sm text-gray-200 font-medium hover:text-blue-400 transition-colors truncate"
                >
                  {entry.name.gameName}
                  <span className="text-gray-500 text-xs ml-0.5">#{entry.name.tagLine}</span>
                </Link>
              ) : (
                <span className="text-sm text-gray-600 italic">Oyuncu #{entry.rank}</span>
              )}
            </div>

            {/* Şampiyonlar — 5 tane, büyük */}
            <div className="flex items-center justify-center gap-1">
              {entry.topChamps ? (
                entry.topChamps.slice(0, 5).map((c, ci) => (
                  <img key={ci} src={c.image} alt={c.name} width={28} height={28}
                    className="rounded-md" title={`${c.name} (Lvl ${c.level})`} />
                ))
              ) : (
                <span className="text-[10px] text-gray-600">—</span>
              )}
            </div>

            {/* Koridor */}
            <div className="flex items-center justify-center gap-1.5">
              {entry.topRoles ? (
                entry.topRoles.map((r, ri) => (
                  <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role}
                    width={22} height={22} title={r.role} />
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

            {/* Rozetler — hover tooltip */}
            <div className="flex items-center justify-center gap-1">
              <BadgeIcon type="hotStreak" active={entry.hotStreak} />
              <BadgeIcon type="freshBlood" active={entry.freshBlood} />
              <BadgeIcon type="veteran" active={entry.veteran} />
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
