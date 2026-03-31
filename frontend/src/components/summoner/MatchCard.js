/*
  MatchCard — tek bir maçın kompakt kartı.

  Sol kenar: yeşil (win) veya kırmızı (loss) çizgi
  İçerik: Şampiyon | KDA | CS/Gold | Items | Süre
*/

import Link from "next/link";

// Süreyi dakika:saniye formatına çevir
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Zaman farkını hesapla: "2 saat önce", "3 gün önce"
function timeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}dk önce`;
  if (hours < 24) return `${hours}sa önce`;
  if (days < 30) return `${days}g önce`;
  return `${Math.floor(days / 30)}ay önce`;
}

// KDA rengini belirle
function getKdaColor(kda) {
  if (kda === "Perfect") return "text-yellow-400";
  if (kda >= 5) return "text-yellow-400";
  if (kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-blue-400";
  return "text-gray-400";
}

// Rol kısaltmaları
const roleNames = {
  TOP: "Top",
  JUNGLE: "Orman",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Destek",
};

export default function MatchCard({ match }) {
  const m = match;
  const kdaText = `${m.kills}/${m.deaths}/${m.assists}`;
  const kdaRatio = typeof m.kda === "number" ? m.kda.toFixed(2) : m.kda;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg overflow-hidden transition-colors hover:bg-white/[0.02] ${
        m.win ? "border-l-[3px] border-l-blue-500" : "border-l-[3px] border-l-red-500"
      }`}
    >
      {/* Win/Loss arka plan tint */}
      <div className={`flex items-center gap-3 flex-1 px-3 py-2.5 ${
        m.win ? "bg-blue-500/[0.03]" : "bg-red-500/[0.03]"
      }`}>
        {/* Şampiyon ikonu */}
        <div className="relative flex-shrink-0">
          <img
            src={m.champion.image}
            alt={m.champion.name}
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="absolute -bottom-1 -right-1 text-[9px] bg-[#0d1117] text-gray-400 px-1 rounded font-mono border border-[#1b2230]">
            {m.champLevel}
          </span>
        </div>

        {/* Şampiyon + Rol + Queue */}
        <div className="w-20 flex-shrink-0">
          <p className="text-sm font-medium text-gray-200 truncate">
            {m.champion.name}
          </p>
          <p className="text-[10px] text-gray-500">
            {roleNames[m.role] || m.role} · {m.queueType}
          </p>
        </div>

        {/* KDA */}
        <div className="w-24 flex-shrink-0 text-center">
          <p className="text-sm font-semibold text-gray-200">{kdaText}</p>
          <p className={`text-[11px] font-mono ${getKdaColor(m.kda)}`}>
            {kdaRatio} KDA
          </p>
        </div>

        {/* CS + Gold */}
        <div className="w-16 flex-shrink-0 text-center hidden md:block">
          <p className="text-xs text-gray-300">{m.cs} CS</p>
          <p className="text-[10px] text-gray-500">
            {(m.gold / 1000).toFixed(1)}K
          </p>
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {m.items.slice(0, 6).map((item, i) => (
            <img
              key={i}
              src={item.image}
              alt=""
              width={24}
              height={24}
              className="rounded-sm"
            />
          ))}
          {/* Boş slot'ları doldur */}
          {Array.from({ length: Math.max(0, 6 - m.items.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-6 h-6 rounded-sm bg-[#1b2230]"
            />
          ))}
        </div>

        {/* Multikill badge */}
        <div className="w-12 flex-shrink-0 text-center">
          {m.pentaKills > 0 && (
            <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">
              PENTA
            </span>
          )}
          {m.pentaKills === 0 && m.quadraKills > 0 && (
            <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
              QUADRA
            </span>
          )}
          {m.pentaKills === 0 && m.quadraKills === 0 && m.tripleKills > 0 && (
            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
              TRIPLE
            </span>
          )}
        </div>

        {/* Süre + Zaman */}
        <div className="w-16 flex-shrink-0 text-right">
          <p className="text-xs text-gray-400">{formatDuration(m.duration)}</p>
          <p className="text-[10px] text-gray-600">{timeAgo(m.gameCreation)}</p>
        </div>

        {/* Win/Loss yazısı */}
        <div className="w-10 flex-shrink-0 text-right">
          <span className={`text-xs font-bold ${m.win ? "text-blue-400" : "text-red-400"}`}>
            {m.win ? "W" : "L"}
          </span>
        </div>
      </div>
    </div>
  );
}
