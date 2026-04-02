"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const VIEWS = [
  { key: "played", label: "En Çok Oynanan" },
  { key: "mastery", label: "Ustalık Puanı" },
];

function formatPoints(p) {
  if (p >= 1000000) return (p / 1000000).toFixed(1) + "M";
  if (p >= 1000) return (p / 1000).toFixed(1) + "K";
  return p.toString();
}

function getMasteryCrestUrl(level) {
  if (!level || level <= 0) return null;
  if (level <= 3) return "/masteries/level0.png";
  if (level >= 10) return "/masteries/level10.png";
  return `/masteries/level${level}.png`;
}

function MasteryBadge({ level }) {
  const url = getMasteryCrestUrl(level);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`Mastery ${level}`}
      className="absolute -top-1.5 -left-1.5 w-[26px] h-auto pointer-events-none drop-shadow-lg"
    />
  );
}

function getWrColor(wr) {
  if (wr >= 60) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}

function getKdaColor(ratio) {
  if (ratio === "Perfect" || ratio >= 5) return "text-yellow-400";
  if (ratio >= 3) return "text-emerald-400";
  if (ratio >= 2) return "text-blue-400";
  return "text-gray-400";
}

export default function ChampionPool({ seasonChampions, masteries, totalScore }) {
  const [view, setView] = useState("played");
  const [open, setOpen] = useState(false);

  const currentLabel = VIEWS.find((v) => v.key === view)?.label;

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Başlık + Dropdown */}
      <div className="px-4 py-3 border-b border-[#1b2230]/50 flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-200 hover:text-white transition-colors cursor-pointer"
          >
            {currentLabel}
            <ChevronDown
              size={14}
              className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-[#1b2230] border border-[#2a3441] rounded-lg shadow-xl z-20 overflow-hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => {
                    setView(v.key);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                    view === v.key
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === "mastery" && (
          <span className="text-[11px] text-gray-500">{totalScore} puan</span>
        )}
        {view === "played" && seasonChampions?.length > 0 && (
          <span className="text-[11px] text-gray-500">Sezon 2025</span>
        )}
      </div>

      {/* İçerik */}
      {view === "played" ? (
        <PlayedView champions={seasonChampions} />
      ) : (
        <MasteryView masteries={masteries} />
      )}
    </div>
  );
}

/* ===== EN ÇOK OYNANAN (SEZON) ===== */
function PlayedView({ champions }) {
  if (!champions || champions.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-gray-600">Bu sezon ranked verisi bulunamadı</p>
      </div>
    );
  }

  return (
    <>
      {/* Kolon başlıkları */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <span className="w-4" />
        <span className="w-10" />
        <span className="flex-1 text-[10px] text-gray-500 font-medium">Şampiyon</span>
        <span className="w-10 text-[10px] text-gray-500 font-medium text-center">Oyun</span>
        <span className="w-20 text-[10px] text-gray-500 font-medium text-center">KDA</span>
        <span className="w-12 text-[10px] text-gray-500 font-medium text-right">WR</span>
      </div>

      <div className="divide-y divide-[#1b2230]/20">
        {champions.slice(0, 8).map((c, i) => {
          const kdaRatio = c.avgKda.ratio;
          const kdaDisplay =
            kdaRatio === "Perfect"
              ? "Perfect"
              : `${c.avgKda.kills}/${c.avgKda.deaths}/${c.avgKda.assists}`;

          return (
            <Link
              key={c.championName}
              href={`/champions/${c.championName.replace(/[^a-zA-Z]/g, "") || c.championName}`}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors group"
            >
              <span className="text-[11px] text-gray-600 font-mono w-4 text-right">
                {i + 1}
              </span>

              {/* Şampiyon resmi + mastery badge */}
              <div className="relative flex-shrink-0">
                <img
                  src={c.championImage}
                  alt={c.championName}
                  width={36}
                  height={36}
                  className="rounded-lg"
                />
                <MasteryBadge level={c.masteryLevel} />
              </div>

              {/* İsim */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium group-hover:text-white transition-colors truncate">
                  {c.championName}
                </p>
              </div>

              {/* Oyun sayısı */}
              <span className="w-10 text-center text-sm font-bold text-white">{c.games}</span>

              {/* KDA */}
              <div className="w-20 text-center">
                <p className="text-[11px] text-gray-400">{kdaDisplay}</p>
                <p className={`text-[10px] font-semibold ${getKdaColor(kdaRatio)}`}>
                  {kdaRatio === "Perfect" ? "∞" : kdaRatio.toFixed(2)}
                </p>
              </div>

              {/* Winrate bar */}
              <div className="w-12 text-right">
                <span className={`text-xs font-bold font-mono ${getWrColor(c.winRate)}`}>
                  {c.winRate}%
                </span>
                <div className="mt-0.5 h-1 bg-[#1b2230] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.winRate >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${c.winRate}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {champions.length > 8 && (
        <div className="px-4 py-2 text-center border-t border-[#1b2230]/20">
          <span className="text-[11px] text-gray-500">
            +{champions.length - 8} şampiyon daha
          </span>
        </div>
      )}
    </>
  );
}

/* ===== USTALLIK PUANI ===== */
function MasteryView({ masteries }) {
  if (!masteries || masteries.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-gray-600">Ustalık verisi bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#1b2230]/20">
      {masteries.slice(0, 7).map((m, i) => (
        <Link
          key={m.championId}
          href={`/champions/${m.championName.replace(/[^a-zA-Z]/g, "") || m.championId}`}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group"
        >
          <span className="text-[11px] text-gray-600 font-mono w-4 text-right">{i + 1}</span>

          <div className="relative flex-shrink-0">
            <img src={m.championImage} alt={m.championName} width={32} height={32} className="rounded-md" />
            <MasteryBadge level={m.championLevel} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 font-medium group-hover:text-white transition-colors">
              {m.championName}
            </p>
            <p className="text-[10px] text-gray-500">Level {m.championLevel}</p>
          </div>

          <span className="text-xs text-gray-400 font-mono">{formatPoints(m.championPoints)}</span>
        </Link>
      ))}
    </div>
  );
}
