"use client";

import Link from "next/link";

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g önce`;
  return `${Math.floor(days / 30)}ay önce`;
}

export default function DuoPartnersCard({ duoPartners }) {
  if (!duoPartners || duoPartners.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/50">
        <h3 className="text-sm font-semibold text-gray-200">Sık Oynanan Duo'lar</h3>
      </div>
      <div className="divide-y divide-edge/30">
        {duoPartners.map((duo) => (
          <Link
            key={duo.puuid}
            href={`/summoner/${encodeURIComponent(duo.gameName)}/${encodeURIComponent(duo.tagLine)}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
          >
            {/* Profil ikonu */}
            <img
              src={duo.profileIconUrl}
              alt=""
              width={36}
              height={36}
              className="rounded-lg flex-shrink-0"
            />

            {/* İsim + maç bilgisi */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-medium text-gray-200 truncate">{duo.gameName}</span>
                <span className="text-[10px] text-gray-600">#{duo.tagLine}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-500">{duo.games} maç</span>
                <span className="text-[11px] text-emerald-400/80">{duo.wins}W</span>
                <span className="text-[11px] text-red-400/80">{duo.losses}L</span>
                {duo.lastPlayed > 0 && (
                  <span className="text-[10px] text-gray-600">{timeAgo(duo.lastPlayed)}</span>
                )}
              </div>
            </div>

            {/* WR + Şampiyon ikonları */}
            <div className="flex-shrink-0 text-right">
              <span className={`text-sm font-bold ${duo.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                {duo.winRate}%
              </span>
              {duo.championImages?.length > 0 && (
                <div className="flex justify-end -space-x-1.5 mt-1">
                  {duo.championImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-sm border border-card"
                    />
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
