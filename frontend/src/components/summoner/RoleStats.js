"use client";

/*
  RoleStats — SEZON BOYUNCA koridor istatistikleri.
  Backend'den gelen seasonRoles verisini kullanır (son 10 maç değil).
  SoloQ/Flex filtresi backend'den hazır gelir.
*/

import { useState } from "react";

const QUEUE_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "solo", label: "SoloQ" },
  { key: "flex", label: "Flex" },
];

export default function RoleStats({ seasonRoles }) {
  const [filter, setFilter] = useState("all");

  if (!seasonRoles) return null;

  const roleStats = seasonRoles[filter] || [];
  if (roleStats.length === 0 && filter !== "all") {
    // Filtre boşsa tümünü göster
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Başlık + Filtreler */}
      <div className="px-5 py-3.5 border-b border-edge/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Koridorlar <span className="text-gray-500 font-normal">(Sezon)</span></h3>
        <div className="flex items-center gap-1">
          {QUEUE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filter === f.key
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kolon başlıkları */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2">
        <span className="w-[100px] text-[11px] text-gray-400 font-medium">Rol</span>
        <span className="w-10 text-[11px] text-gray-400 font-medium text-center">Oyun</span>
        <span className="flex-1 text-[11px] text-gray-400 font-medium text-center">Zafer / Yenilgi</span>
        <span className="w-14 text-[11px] text-gray-400 font-medium text-right">WR</span>
      </div>

      {/* Satırlar */}
      <div className="px-4 pb-5 pt-1 space-y-2">
        {roleStats.length === 0 ? (
          <p className="text-xs text-gray-600 py-3 text-center">Bu filtrede veri yok</p>
        ) : (
          roleStats.map((r) => (
            <div
              key={r.role}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2.5 w-[100px]">
                <img src={r.icon} alt={r.label} width={28} height={28} className="flex-shrink-0" />
                <span className="text-sm font-medium text-gray-200">{r.label}</span>
              </div>

              <span className="text-base font-bold text-white w-10 text-center">{r.games}</span>

              <div className="flex-1 h-7 rounded overflow-hidden flex bg-edge">
                {r.wins > 0 && (
                  <div
                    className="h-full bg-emerald-600 flex items-center justify-center transition-all"
                    style={{ width: `${r.winRate}%` }}
                  >
                    <span className="text-[11px] font-bold text-white px-1">{r.wins}W</span>
                  </div>
                )}
                {r.losses > 0 && (
                  <div
                    className="h-full bg-red-600 flex items-center justify-center transition-all"
                    style={{ width: `${100 - r.winRate}%` }}
                  >
                    <span className="text-[11px] font-bold text-white px-1">{r.losses}L</span>
                  </div>
                )}
              </div>

              <span className={`text-sm font-bold font-mono w-14 text-right ${
                r.winRate >= 50 ? "text-emerald-400" : "text-red-400"
              }`}>
                {r.winRate}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
