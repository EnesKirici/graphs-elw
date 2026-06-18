"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";

const TIER_CONFIG = {
  challenger:  { gradient: "linear-gradient(90deg, #f0e6d2, #c8aa6e, #78c8e6, #c8aa6e, #f0e6d2)", bg: "from-[#c8aa6e]/20 via-[#78c8e6]/15 to-[#c8aa6e]/20", border: "border-[#c8aa6e]/50", glow: "0 0 8px rgba(200,170,110,0.3)" },
  grandmaster: { gradient: "linear-gradient(90deg, #cd3737, #ff6b6b, #cd3737)", bg: "from-[#1a0505]/40 via-[#cd3737]/15 to-[#1a0505]/40", border: "border-[#cd3737]/40", glow: "0 0 6px rgba(205,55,55,0.25)" },
  diamond:     { gradient: "linear-gradient(90deg, #4a9bd9, #78c8e6, #576ece)", bg: "from-[#576ece]/12 to-[#4a9bd9]/8", border: "border-[#4a9bd9]/30", glow: null },
  emerald:     { color: "#2d9e6e", bg: "bg-[#2d9e6e]/10", border: "border-[#2d9e6e]/25", glow: null },
  gold:        { color: "#c89b3c", bg: "bg-[#c89b3c]/8",  border: "border-[#c89b3c]/20", glow: null },
  silver:      { color: "#80939e", bg: "bg-[#80939e]/6",  border: "border-[#80939e]/15", glow: null },
};

/**
 * Negatif (kötü performans) rozetleri için özel tooltip mesajı üret.
 */
function getNegativeTooltipText(badge, totalGames) {
  if (badge.key === "lose_streak") {
    return `Art arda ${badge.count} mağlubiyet`;
  }
  if (badge.key?.startsWith("bad_champ_")) {
    return `Bu sezon %${badge.rate} kazanma oranıyla ${badge.count} maç`;
  }
  if (badge.key === "early_death") {
    return `Son ${totalGames} maçın ${badge.count} tanesinde alındı`;
  }
  if (badge.key === "gold_loss") {
    return `Son ${totalGames} maçın ${badge.count} tanesinde alındı`;
  }
  return null;
}

export default function ProfileBadge({ badge, totalGames, size = "md", muted = false }) {
  const [anchor, setAnchor] = useState(null);
  const isNegative = badge.category === "negative";
  const t = TIER_CONFIG[badge.tier] || TIER_CONFIG.silver;
  const hasGradient = !!t.gradient;
  const isSmall = size === "sm";

  // Sakin (muted) varyant: banner üstünde tek tonlu yarı saydam çip — rengarenk
  // tier renkleri yerine rol pill'iyle uyumlu nötr görünüm. Tooltip renkli kalır.
  if (muted) {
    return (
      <>
        <span
          onMouseEnter={(e) => setAnchor(e.currentTarget)}
          onMouseLeave={() => setAnchor(null)}
          className="inline-flex items-center rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-white/85 px-2 py-0.5 text-[10px] font-medium cursor-default"
        >
          {badge.label}
        </span>
        {anchor && (
          <Tooltip anchorEl={anchor}>
            <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap">
              <span
                className={`text-xs font-bold ${isNegative ? "" : hasGradient ? "bg-clip-text text-transparent" : ""}`}
                style={isNegative ? { color: "#ef4444" } : hasGradient ? { backgroundImage: t.gradient } : { color: t.color }}
              >
                {badge.label}
              </span>
              {!isNegative && <span className="text-[9px] text-gray-500 ml-2 capitalize">{badge.tier}</span>}
              <p className="text-[11px] text-gray-400 mt-1">
                {isNegative ? getNegativeTooltipText(badge, totalGames) : `Son ${totalGames} maçın ${badge.count} tanesinde alındı`}
              </p>
            </div>
          </Tooltip>
        )}
      </>
    );
  }

  // Negatif rozetler kırmızımsı stil kullanır
  const negativeStyle = isNegative ? {
    color: "#ef4444",
    bg: "bg-red-500/8",
    border: "border-red-500/20",
  } : null;

  const bgClass = isNegative
    ? negativeStyle.bg
    : hasGradient ? `bg-gradient-to-r ${t.bg}` : t.bg;
  const borderClass = isNegative ? negativeStyle.border : t.border;

  const tooltipText = isNegative
    ? getNegativeTooltipText(badge, totalGames)
    : `Son ${totalGames} maçın ${badge.count} tanesinde alındı`;

  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={`inline-flex items-center border rounded cursor-default ${bgClass} ${borderClass} ${isSmall ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} font-semibold backdrop-blur-sm`}
        style={{ boxShadow: t.glow || undefined }}
      >
        <span
          className={isNegative ? "" : hasGradient ? "bg-clip-text text-transparent" : ""}
          style={isNegative ? { color: negativeStyle.color } : hasGradient ? { backgroundImage: t.gradient } : { color: t.color }}
        >
          {badge.label}
        </span>
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap">
            <span
              className={`text-xs font-bold ${isNegative ? "" : hasGradient ? "bg-clip-text text-transparent" : ""}`}
              style={isNegative ? { color: negativeStyle.color } : hasGradient ? { backgroundImage: t.gradient } : { color: t.color }}
            >
              {badge.label}
            </span>
            {!isNegative && <span className="text-[9px] text-gray-500 ml-2 capitalize">{badge.tier}</span>}
            <p className="text-[11px] text-gray-400 mt-1">{tooltipText}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

