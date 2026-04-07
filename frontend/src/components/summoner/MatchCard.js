"use client";

import { useState } from "react";
import Link from "next/link";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";
import Tooltip from "@/components/shared/Tooltip";

function fmtDur(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}dk`;
  const h = Math.floor(d / 3600000);
  if (h < 24) return `${h}sa`;
  const dd = Math.floor(d / 86400000);
  return dd < 30 ? `${dd}g` : `${Math.floor(dd / 30)}ay`;
}

function kdaColor(k) {
  if (k === "Perfect" || k >= 5) return "text-yellow-400";
  if (k >= 3) return "text-emerald-400";
  if (k >= 2) return "text-blue-400";
  return "text-gray-400";
}

const roles = { TOP: "Top", JUNGLE: "JG", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Sup" };

const TIER_ORDER = { challenger: 0, grandmaster: 1, diamond: 2, emerald: 3, gold: 4, silver: 5 };
function sortBadges(badges) {
  return [...badges].sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
}

// Rank renk sistemi — LoL gerçek rank renkleri
// Challenger: beyaz-altın-mavi gradient, Grandmaster: siyah-kırmızı, Diamond: açık mavi-cyan
const TIER_STYLES = {
  challenger:  { gradient: "linear-gradient(90deg, #f0e6d2, #c8aa6e, #78c8e6, #c8aa6e, #f0e6d2)", bg: "bg-gradient-to-r from-[#c8aa6e]/20 via-[#78c8e6]/15 to-[#c8aa6e]/20", border: "border-[#c8aa6e]/50", glow: "0 0 8px rgba(200,170,110,0.3)", shimmer: true },
  grandmaster: { gradient: "linear-gradient(90deg, #cd3737, #ff6b6b, #cd3737)", bg: "bg-gradient-to-r from-[#1a0505]/40 via-[#cd3737]/15 to-[#1a0505]/40", border: "border-[#cd3737]/40", glow: "0 0 6px rgba(205,55,55,0.25)", shimmer: true },
  diamond:     { gradient: "linear-gradient(90deg, #4a9bd9, #78c8e6, #576ece)", bg: "bg-gradient-to-r from-[#576ece]/12 to-[#4a9bd9]/8", border: "border-[#4a9bd9]/30", glow: null, shimmer: false },
  emerald:     { text: "text-[#2d9e6e]", bg: "bg-[#2d9e6e]/10", border: "border-[#2d9e6e]/25", glow: null, shimmer: false },
  gold:        { text: "text-[#c89b3c]", bg: "bg-[#c89b3c]/8",  border: "border-[#c89b3c]/20", glow: null, shimmer: false },
  silver:      { text: "text-[#80939e]", bg: "bg-[#80939e]/6",  border: "border-[#80939e]/15", glow: null, shimmer: false },
};

function PlayerIcon({ player: p }) {
  const [anchor, setAnchor] = useState(null);
  const href = p.gameName && p.tagLine ? `/summoner/${encodeURIComponent(p.gameName)}/${encodeURIComponent(p.tagLine)}` : null;

  const img = (
    <img
      src={p.image} alt={p.name} width={24} height={24}
      className={`rounded-sm ${p.isMe ? "ring-1 ring-blue-400" : ""} ${href ? "cursor-pointer hover:brightness-125 transition-all" : ""}`}
      onMouseEnter={(e) => setAnchor(e.currentTarget)}
      onMouseLeave={() => setAnchor(null)}
    />
  );

  return (
    <>
      {href ? <Link href={href} onClick={(e) => e.stopPropagation()}>{img}</Link> : img}
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl shadow-black/90 whitespace-nowrap">
            <p className="text-[11px] text-white font-medium">{p.gameName || p.name}<span className="text-gray-500 text-[9px] ml-0.5">#{p.tagLine}</span></p>
            <p className="text-[9px] text-gray-500">{p.name}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

function BadgeTag({ badge }) {
  const [anchor, setAnchor] = useState(null);
  const s = TIER_STYLES[badge.tier] || TIER_STYLES.silver;
  const hasGradientText = !!s.gradient;

  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${s.bg} ${s.border} cursor-default whitespace-nowrap ${!hasGradientText ? (s.text || "") : ""}`}
        style={hasGradientText ? {
          boxShadow: s.glow || undefined,
        } : undefined}
      >
        <span
          className={hasGradientText ? "bg-clip-text text-transparent font-bold" : ""}
          style={hasGradientText ? { backgroundImage: s.gradient } : undefined}
        >
          {badge.label}
        </span>
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${hasGradientText ? "bg-clip-text text-transparent" : (s.text || "")}`} style={hasGradientText ? { backgroundImage: s.gradient } : undefined}>{badge.label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${s.bg} ${s.border} border ${!hasGradientText ? (s.text || "") : "text-gray-300"}`}>{badge.tier}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{badge.desc}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

export default function MatchCard({ match: m }) {

  const remake = m.duration < 300;
  const bdr = remake ? "border-l-blue-400" : m.win ? "border-l-emerald-500" : "border-l-red-500";
  const bg = remake ? "bg-blue-500/[0.04]" : m.win ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]";
  const resTxt = remake ? "Remake" : m.win ? "Zafer" : "Yenilgi";
  const resClr = remake ? "text-blue-400" : m.win ? "text-emerald-400" : "text-red-400";
  const badges = sortBadges(m.badges || []);

  return (
    <div className={`border-l-[3px] ${bdr} ${bg} hover:bg-white/[0.03] transition-colors`}>
      <div className="flex items-center gap-3 px-3 py-2.5">

        {/* CHAMP + SPELL + RUNE */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={m.champion.image} alt="" width={44} height={44} className="rounded-lg" />
              <span className="absolute -bottom-1 -right-1 text-[8px] bg-[#0d1117] text-gray-400 px-0.5 rounded border border-[#1b2230] font-mono">{m.champLevel}</span>
            </div>
            <div className="flex gap-0.5">
              {m.spells?.[0]?.image && <img src={m.spells[0].image} alt="" width={18} height={18} className="rounded-sm" title={m.spells[0].name} />}
              {m.spells?.[1]?.image && <img src={m.spells[1].image} alt="" width={18} height={18} className="rounded-sm" title={m.spells[1].name} />}
            </div>
          </div>
          <RuneTooltip runes={m.runes} keystoneSize={22} subTreeSize={16} />
        </div>

        {/* NAME + ROLE */}
        <div className="w-16 flex-shrink-0">
          <p className="text-[11px] font-medium text-gray-200 truncate">{m.champion.name}</p>
          <p className="text-[9px] text-gray-500">{roles[m.role] || m.role}</p>
          <p className="text-[9px] text-gray-600">{m.queueType}</p>
        </div>

        {/* KDA + CS alt satır */}
        <div className="w-20 flex-shrink-0 text-center">
          <p className="text-sm font-semibold text-gray-200">{m.kills}<span className="text-gray-600">/</span>{m.deaths}<span className="text-gray-600">/</span>{m.assists}</p>
          <p className={`text-[10px] font-mono ${kdaColor(m.kda)}`}>{typeof m.kda === "number" ? m.kda.toFixed(2) : m.kda}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">{m.cs} CS</p>
        </div>

        {/* ITEMS */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {m.items.slice(0, 6).map((item, i) => (
            <ItemTooltip key={i} item={item} size={24} />
          ))}
          {Array.from({ length: Math.max(0, 6 - m.items.length) }).map((_, i) => (
            <div key={`e${i}`} className="w-6 h-6 rounded-sm bg-[#1b2230]" />
          ))}
        </div>

        {/* BADGES */}
        {badges.length > 0 && (
          <div className="flex-1 min-w-0 hidden md:flex flex-wrap items-center gap-1 px-1">
            {badges.slice(0, 3).map((b) => (
              <BadgeTag key={b.key} badge={b} />
            ))}
            {badges.length > 3 && (
              <span className="text-[9px] text-gray-600">+{badges.length - 3}</span>
            )}
          </div>
        )}

        {/* RESULT */}
        <div className="w-14 flex-shrink-0 text-center ml-auto">
          <p className={`text-[11px] font-bold ${resClr}`}>{resTxt}</p>
          <p className="text-[10px] text-gray-500">{fmtDur(m.duration)}</p>
          <p className="text-[9px] text-gray-600">{timeAgo(m.gameCreation)}</p>
        </div>

        {/* TEAMS */}
        <div className="flex-shrink-0 hidden lg:block">
          <div className="flex gap-0.5 mb-0.5">
            {m.allies?.map((a, i) => (
              <PlayerIcon key={i} player={a} />
            ))}
          </div>
          <div className="flex gap-0.5">
            {m.enemies?.map((e, i) => (
              <PlayerIcon key={i} player={e} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Dışa aç — profilde de kullanılır
export { TIER_STYLES };
