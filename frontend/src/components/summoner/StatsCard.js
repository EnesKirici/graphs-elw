"use client";

import { useState } from "react";
import QueueTabs from "./QueueTabs";
import RoleRadar from "./RoleRadar";

const QUEUE_OPTIONS = [
  { key: "all", label: "Tümü" },
  { key: "solo", label: "SoloQ" },
  { key: "flex", label: "Flex" },
];

function CircleProgress({ value, max, label, display, color = "#3b82f6", size = 104 }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDash = circumference * progress;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1b2230" strokeWidth="5" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          transform="rotate(-90 48 48)"
          className="transition-all duration-1000"
        />
        <text x="48" y="50" textAnchor="middle" dominantBaseline="middle"
          className="fill-white font-bold" style={{ fontSize: "16px" }}>
          {display}
        </text>
      </svg>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

/*
  İstatistik merkezi: üstte Tümü/SoloQ/Flex sekmesi; solda 2 daire (Toplam Maç,
  Kazanma Oranı) + altında K/D/A özeti, SAĞDA aynı queue ile Koridorlar radarı.
*/
export default function StatsCard({
  seasonChampions = {},   // { all, ranked, solo, flex, normal }
  seasonRoles,
  solo,
  flex,
  totalSeasonMatches = 0,
}) {
  const [queue, setQueue] = useState("all");

  const champList = seasonChampions[queue] || seasonChampions.all || [];
  const seasonTotals = champList.reduce(
    (acc, c) => {
      const g = c.games || 0;
      acc.games += g;
      acc.wins += c.wins || 0;
      acc.losses += c.losses || 0;
      acc.kills += (c.avgKda?.kills || 0) * g;
      acc.deaths += (c.avgKda?.deaths || 0) * g;
      acc.assists += (c.avgKda?.assists || 0) * g;
      return acc;
    },
    { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 },
  );

  // Toplam Maç: Tümü → Riot sezon toplamı; SoloQ/Flex → lig wins+losses
  const leagueData = queue === "solo" ? solo : queue === "flex" ? flex : null;
  const leagueGames = leagueData ? (leagueData.wins || 0) + (leagueData.losses || 0) : 0;
  const totalGames =
    queue === "all"
      ? (totalSeasonMatches > 0 ? totalSeasonMatches : seasonTotals.games)
      : (leagueGames > 0 ? leagueGames : seasonTotals.games);

  const analyzedGames = seasonTotals.games;
  const wins = seasonTotals.wins;
  const losses = seasonTotals.losses;
  const winRate = analyzedGames > 0 ? Math.round((wins / analyzedGames) * 100) : 0;
  const avgK = analyzedGames > 0 ? seasonTotals.kills / analyzedGames : 0;
  const avgD = analyzedGames > 0 ? seasonTotals.deaths / analyzedGames : 0;
  const avgA = analyzedGames > 0 ? seasonTotals.assists / analyzedGames : 0;
  const kdaRatio = avgD > 0 ? (avgK + avgA) / avgD : avgK + avgA;
  const hasKda = analyzedGames > 0;

  const hotStreak = (queue === "flex" ? flex : solo)?.hotStreak;
  const isEmpty = totalGames === 0 && analyzedGames === 0;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">İstatistikler</h3>
        <QueueTabs value={queue} onChange={setQueue} options={QUEUE_OPTIONS} />
      </div>

      <div className="p-5">
        {isEmpty ? (
          <p className="text-xs text-gray-600 text-center py-8">Bu kuyrukta veri yok</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* SOL — 2 daire (Toplam Maç, Kazanma Oranı) + özet */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-center gap-8">
                {totalGames > 0 && (
                  <CircleProgress
                    value={totalGames}
                    max={Math.max(totalGames, 100)}
                    label="Toplam Maç"
                    display={totalGames}
                    color="#3b82f6"
                  />
                )}
                {analyzedGames > 0 && (
                  <CircleProgress
                    value={winRate}
                    max={100}
                    label="Kazanma Oranı"
                    display={`${winRate}%`}
                    color={winRate >= 51 ? "#10b981" : winRate >= 45 ? "#f59e0b" : "#ef4444"}
                  />
                )}
              </div>
              {analyzedGames > 0 && (
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#1b2230]/30">
                  <div className="text-center">
                    <span className="text-xs text-emerald-400 font-medium">{wins}W</span>
                    <span className="text-xs text-gray-600 mx-1">/</span>
                    <span className="text-xs text-red-400 font-medium">{losses}L</span>
                  </div>
                  {hasKda && (
                    <span className="text-xs text-gray-300">
                      {avgK.toFixed(1)} / {avgD.toFixed(1)} / {avgA.toFixed(1)}{" "}
                      <span className="text-[10px] text-gray-500">ort.</span>
                    </span>
                  )}
                  {hotStreak && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                      Galibiyet Serisi
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* SAĞ — Koridorlar radarı (aynı queue) */}
            {seasonRoles && (
              <div className="lg:w-[290px] lg:flex-shrink-0 lg:border-l lg:border-[#1b2230]/40 lg:pl-5">
                <RoleRadar seasonRoles={seasonRoles} filter={queue} embedded />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
