"use client";

import { useState } from "react";
import Link from "next/link";
import QueueTabs from "@/components/summoner/QueueTabs";

const GAME_TYPES = [
  { key: "all", label: "Tümü" },
  { key: "ranked", label: "Dereceli" },
  { key: "normal", label: "Normal" },
];

function wrColor(wr) {
  if (wr >= 60) return "text-cyan-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 44) return "text-purple-400";
  return "text-red-400";
}

// PLACEHOLDER/DEMO (TEST VERİSİ) — şampiyon Dünya + TR sırası worker ile gelecek (c.championRank).
const DEMO_RANKS = [
  { global: 1840, tr: 142 },
  { global: 12503, tr: 961 },
  { global: 6720, tr: 503 },
];
function placeholderChampRank(name, games, i) {
  if (i != null && DEMO_RANKS[i]) return DEMO_RANKS[i];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const global = Math.max(8000, 40000 + (h % 1200000) - (games || 0) * 2000);
  const tr = Math.max(500, Math.round(global / 13));
  return { global, tr };
}
const fmt = (n) => n.toLocaleString("tr-TR");

export default function ChampPerfListPro({ seasonChampions, region = "TR" }) {
  const [gameType, setGameType] = useState("all");

  const raw = Array.isArray(seasonChampions)
    ? seasonChampions
    : (seasonChampions?.[gameType] || seasonChampions?.all || []);
  const list = [...raw].sort((a, b) => (b.games ?? 0) - (a.games ?? 0));

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Şampiyon Performansı</h3>
        <QueueTabs value={gameType} onChange={setGameType} options={GAME_TYPES} />
      </div>

      {list.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">Veri bulunamadı</p>
      ) : (
        <>
          {/* Sütun başlıkları */}
          <div className="flex items-center gap-2.5 px-4 py-2 text-[10px] text-gray-400 uppercase tracking-wider border-b border-edge/40">
            <span className="w-[38px]" />
            <span className="flex-1">Şampiyon</span>
            <span className="w-9 text-center">Oyun</span>
            <span className="w-[68px] text-center">KDA</span>
            <span className="w-10 text-right">WR</span>
          </div>

          <div className="divide-y divide-edge/25">
            {list.slice(0, 6).map((c, i) => {
              // Gerçek sıra (championRank) gelene kadar placeholder/demo göster.
              const rk = c.championRank?.global != null ? c.championRank : placeholderChampRank(c.championName, c.games, i);
              return (
                <Link
                  key={c.championName + i}
                  href={`/champions/${c.championName.replace(/[^a-zA-Z]/g, "") || c.championName}`}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-hover transition-colors"
                >
                  <img src={c.championImage} alt={c.championName} width={38} height={38} className="rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {/* Ad + Dünya sırası + TR sırası — okunur boyut, sayılar parlak (sönük kalmasın) */}
                    <p className="text-[13px] text-gray-100 font-semibold truncate leading-tight">{c.championName}</p>
                    <p className="text-[11.5px] leading-tight mt-1 tabular-nums whitespace-nowrap">
                      <span className="text-gray-500">Sıra </span><span className="text-gray-200 font-medium">{fmt(rk.global)}</span>
                    </p>
                    <p className="text-[11.5px] leading-tight mt-0.5 tabular-nums whitespace-nowrap">
                      <span className="text-gray-500">{region} </span><span className="text-gray-100 font-medium">{fmt(rk.tr)}</span>
                    </p>
                  </div>
                  <span className="w-9 text-center text-[13px] text-gray-200 font-medium tabular-nums">{c.games}</span>
                  <span className="w-[68px] text-center text-[11px] text-gray-400 tabular-nums">
                    {c.avgKda?.kills}/{c.avgKda?.deaths}/{c.avgKda?.assists}
                  </span>
                  <span className={`w-10 text-right text-[13px] font-bold font-mono ${wrColor(c.winRate)}`}>{Math.round(c.winRate)}%</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
