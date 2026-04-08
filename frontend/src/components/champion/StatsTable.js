"use client";

import { useState } from "react";

const STAT_CONFIG = [
  { key: "hp",            label: "Can",             perLevel: "hpperlevel",            icon: "❤️",  color: "#22c55e", unit: "" },
  { key: "hpregen",       label: "Can Yenileme",    perLevel: "hpregenperlevel",       icon: "💚",  color: "#4ade80", unit: "/5s" },
  { key: "mp",            label: "Mana",            perLevel: "mpperlevel",            icon: "💧",  color: "#3b82f6", unit: "" },
  { key: "mpregen",       label: "Mana Yenileme",   perLevel: "mpregenperlevel",       icon: "💙",  color: "#60a5fa", unit: "/5s" },
  { key: "armor",         label: "Zırh",            perLevel: "armorperlevel",         icon: "🛡️", color: "#f59e0b", unit: "" },
  { key: "spellblock",    label: "Büyü Direnci",    perLevel: "spellblockperlevel",    icon: "🔮",  color: "#8b5cf6", unit: "" },
  { key: "attackdamage",  label: "Saldırı Gücü",    perLevel: "attackdamageperlevel",  icon: "⚔️",  color: "#ef4444", unit: "" },
  { key: "attackspeed",   label: "Saldırı Hızı",    perLevel: "attackspeedperlevel",   icon: "⚡",  color: "#06b6d4", unit: "", isAS: true },
  { key: "movespeed",     label: "Hareket Hızı",    perLevel: null,                    icon: "👟",  color: "#a78bfa", unit: "" },
  { key: "attackrange",   label: "Menzil",          perLevel: null,                    icon: "🎯",  color: "#f472b6", unit: "" },
];

function calcStat(base, perLevel, level, isAS = false) {
  if (!perLevel) return base;
  if (isAS) {
    // Attack speed scaling formula
    return base * (1 + perLevel * (level - 1) * (0.7025 + 0.0175 * (level - 1)) / 100);
  }
  return base + perLevel * (level - 1) * (0.7025 + 0.0175 * (level - 1));
}

export default function StatsTable({ stats }) {
  const [level, setLevel] = useState(1);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Temel İstatistikler</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Seviye</span>
          <span className="text-sm font-bold text-blue-400 w-5 text-center">{level}</span>
        </div>
      </div>

      {/* Level slider */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLevel(Math.max(1, level - 1))}
            className="w-6 h-6 rounded bg-[#1b2230] text-gray-400 hover:text-white hover:bg-[#2a3444] flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={18}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="flex-1 accent-blue-500 h-1.5 cursor-pointer"
          />
          <button
            onClick={() => setLevel(Math.min(18, level + 1))}
            className="w-6 h-6 rounded bg-[#1b2230] text-gray-400 hover:text-white hover:bg-[#2a3444] flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
        <div className="flex justify-between mt-1.5 px-8">
          {[1, 6, 11, 18].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                level === l ? "bg-blue-500/20 text-blue-400" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              Lv.{l}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {STAT_CONFIG.map((cfg) => {
          const base = stats[cfg.key] ?? 0;
          const perLvl = cfg.perLevel ? (stats[cfg.perLevel] ?? 0) : null;
          const current = calcStat(base, perLvl, level, cfg.isAS);
          const formatted = cfg.isAS
            ? current.toFixed(3)
            : Number.isInteger(current) ? current : current.toFixed(1);
          const growth = perLvl ? (current - base) : 0;

          return (
            <div key={cfg.key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <span className="text-sm w-5 text-center flex-shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 truncate">{cfg.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gray-100">{formatted}{cfg.unit}</span>
                  {growth > 0 && (
                    <span className="text-[10px] text-emerald-500/70">
                      +{cfg.isAS ? (growth * 100).toFixed(1) + "%" : growth.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              {/* Mini bar */}
              {cfg.perLevel && (
                <div className="w-8 bg-[#1b2230] rounded-full h-1 flex-shrink-0">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((level / 18) * 100, 100)}%`,
                      backgroundColor: cfg.color,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
