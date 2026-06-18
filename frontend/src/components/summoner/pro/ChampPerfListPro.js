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
  if (wr >= 60) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-gray-300";
  return "text-red-400";
}
function wrBar(wr) {
  if (wr >= 60) return "bg-emerald-500";
  if (wr >= 50) return "bg-blue-500";
  if (wr >= 45) return "bg-gray-500";
  return "bg-red-500";
}
function kdaColor(k) {
  if (k === "Perfect" || k >= 4) return "text-emerald-400";
  if (k >= 3) return "text-blue-400";
  if (k >= 2) return "text-gray-200";
  return "text-red-400";
}

// PLACEHOLDER (TEST VERİSİ) — şampiyon dünya/TR sırası worker ile gelecek (ChampionPool ile aynı).
function placeholderChampRank(name, games) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const global = Math.max(800, 9000 + (h % 230000) - (games || 0) * 120);
  const tr = Math.max(60, Math.round(global / 13));
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
            <span className="w-14 text-center">KDA</span>
            <span className="w-12 text-right">WR</span>
          </div>

          <div className="divide-y divide-edge/25">
            {list.slice(0, 6).map((c, i) => {
              const ratio = c.avgKda?.ratio ?? 0;
              const rk = placeholderChampRank(c.championName, c.games);
              return (
                <Link
                  key={c.championName + i}
                  href={`/champions/${c.championName.replace(/[^a-zA-Z]/g, "") || c.championName}`}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-hover transition-colors"
                >
                  <img src={c.championImage} alt={c.championName} width={38} height={38} className="rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-100 font-semibold truncate leading-tight">{c.championName}</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                      Sıra <span className="text-gray-300 font-medium">{fmt(rk.global)}</span>
                      <span className="text-gray-500"> · {region} {fmt(rk.tr)}</span>
                    </p>
                  </div>
                  <span className="w-9 text-center text-[13px] text-gray-200 font-medium">{c.games}</span>
                  <div className="w-14 text-center">
                    <p className="text-[11px] text-gray-300 leading-tight">{c.avgKda?.kills}/{c.avgKda?.deaths}/{c.avgKda?.assists}</p>
                    <p className={`text-xs font-bold leading-tight ${kdaColor(ratio)}`}>{ratio === "Perfect" ? "Perfect" : Number(ratio).toFixed(1)}</p>
                  </div>
                  <div className="w-12 text-right">
                    <span className={`text-[13px] font-bold font-mono ${wrColor(c.winRate)}`}>{c.winRate}%</span>
                    <div className="mt-1 h-1.5 bg-edge rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${wrBar(c.winRate)}`} style={{ width: `${c.winRate}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
