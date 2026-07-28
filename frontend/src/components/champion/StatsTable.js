"use client";

import { useState } from "react";

// Gerçek LoL stat ikonları (rün-shard StatMods seti). Mana/Mana Yenileme/Menzil'in
// DDragon/CommunityDragon'da resmi ikonu YOK → onlara tinted inline SVG (aşağıda).
const SM = "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods";
const CD = "https://raw.communitydragon.org/latest/game/assets/perks/statmods";
const STAT_CONFIG = [
  { key: "hp",            label: "Can",             perLevel: "hpperlevel",            img: `${SM}/StatModsHealthScalingIcon.png`, color: "#22c55e", unit: "" },
  { key: "hpregen",       label: "Can Yenileme",    perLevel: "hpregenperlevel",       img: `${SM}/StatModsHealthPlusIcon.png`,    color: "#4ade80", unit: "/5s" },
  { key: "mp",            label: "Mana",            perLevel: "mpperlevel",            svg: "mana",     color: "#3b82f6", unit: "" },
  { key: "mpregen",       label: "Mana Yenileme",   perLevel: "mpregenperlevel",       svg: "manaregen", color: "#60a5fa", unit: "/5s" },
  { key: "armor",         label: "Zırh",            perLevel: "armorperlevel",         img: `${SM}/StatModsArmorIcon.png`,         color: "#f59e0b", unit: "" },
  { key: "spellblock",    label: "Büyü Direnci",    perLevel: "spellblockperlevel",    img: `${SM}/StatModsMagicResIcon.png`,      color: "#8b5cf6", unit: "" },
  { key: "attackdamage",  label: "Saldırı Gücü",    perLevel: "attackdamageperlevel",  img: `${CD}/statmodsattackdamageicon.png`,  color: "#ef4444", unit: "" },
  { key: "attackspeed",   label: "Saldırı Hızı",    perLevel: "attackspeedperlevel",   img: `${SM}/StatModsAttackSpeedIcon.png`,   color: "#06b6d4", unit: "", isAS: true },
  { key: "movespeed",     label: "Hareket Hızı",    perLevel: null,                    img: `${SM}/StatModsMovementSpeedIcon.png`, color: "#a78bfa", unit: "" },
  { key: "attackrange",   label: "Menzil",          perLevel: null,                    svg: "range",    color: "#f472b6", unit: "" },
];

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };

// Stat ikonu — gerçek LoL StatMods görseli VEYA (ikonu olmayan statlar için) tinted SVG.
function StatGlyph({ cfg }) {
  if (cfg.img) {
    return <img src={cfg.img} alt="" width={24} height={24} className="w-6 h-6 object-contain" onError={hideOnError} />;
  }
  const c = cfg.color;
  if (cfg.svg === "mana") {
    return <svg width={22} height={22} viewBox="0 0 24 24" fill={c} aria-hidden="true"><path d="M12 2.5C8.2 8 5.5 11 5.5 15a6.5 6.5 0 0013 0c0-4-2.7-7-6.5-12.5z" /></svg>;
  }
  if (cfg.svg === "manaregen") {
    return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3C9 7.5 6.5 10 6.5 13.5a5.5 5.5 0 0011 0C17.5 10 15 7.5 12 3z" /></svg>;
  }
  if (cfg.svg === "range") {
    return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.4" fill={c} stroke="none" /><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5" /></svg>;
  }
  return null;
}

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
      <div className="px-5 py-3.5 border-b border-edge/50 flex items-center justify-between">
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
            className="w-6 h-6 rounded bg-edge text-gray-400 hover:text-gray-100 hover:bg-[#2a3444] flex items-center justify-center text-sm transition-colors cursor-pointer"
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={18}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="flex-1 stat-slider"
          />
          <button
            onClick={() => setLevel(Math.min(18, level + 1))}
            className="w-6 h-6 rounded bg-edge text-gray-400 hover:text-gray-100 hover:bg-[#2a3444] flex items-center justify-center text-sm transition-colors cursor-pointer"
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
            <div key={cfg.key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-hover transition-colors">
              <span className="w-7 flex items-center justify-center flex-shrink-0">
                <StatGlyph cfg={cfg} />
              </span>
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
                <div className="w-8 bg-edge rounded-full h-1 flex-shrink-0">
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
