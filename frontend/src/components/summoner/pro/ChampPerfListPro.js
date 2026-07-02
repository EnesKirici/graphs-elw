"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";
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

const fmt = (n) => n.toLocaleString("tr-TR");

// Gerçek şampiyon sırası (championRank) worker'dan gelene kadar test verisi yerine
// "yapım aşamasında" ipucu göster (Dünya + TR sırası birlikte).
function InDevRankHint() {
  const [anchor, setAnchor] = useState(null);
  return (
    <span
      className="inline-flex items-center gap-1 cursor-help"
      onMouseEnter={(e) => setAnchor(e.currentTarget)}
      onMouseLeave={() => setAnchor(null)}
    >
      <span className="text-gray-500">Sıra</span>
      <span className="text-gray-400 font-medium">—</span>
      <HelpCircle size={11} className="text-gray-600" />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[210px]">
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Dünya ve TR şampiyon sıralaması <b className="text-gray-100">yapım aşamasında</b> — yakında eklenecek.
            </p>
          </div>
        </Tooltip>
      )}
    </span>
  );
}

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
              // Gerçek sıra (championRank) worker'dan gelirse göster; yoksa "yapım aşamasında".
              const rk = c.championRank?.global != null ? c.championRank : null;
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
                    {rk ? (
                      <>
                        <p className="text-[11.5px] leading-tight mt-1 tabular-nums whitespace-nowrap">
                          <span className="text-gray-500">Sıra </span><span className="text-gray-200 font-medium">{fmt(rk.global)}</span>
                        </p>
                        <p className="text-[11.5px] leading-tight mt-0.5 tabular-nums whitespace-nowrap">
                          <span className="text-gray-500">{region} </span><span className="text-gray-100 font-medium">{fmt(rk.tr)}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-[11.5px] leading-tight mt-1 whitespace-nowrap">
                        <InDevRankHint />
                      </p>
                    )}
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
