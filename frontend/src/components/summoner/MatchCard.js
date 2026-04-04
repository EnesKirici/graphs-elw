"use client";

import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";

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

export default function MatchCard({ match: m }) {

  const remake = m.duration < 300;
  const bdr = remake ? "border-l-blue-400" : m.win ? "border-l-emerald-500" : "border-l-red-500";
  const bg = remake ? "bg-blue-500/[0.04]" : m.win ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]";
  const resTxt = remake ? "Remake" : m.win ? "Zafer" : "Yenilgi";
  const resClr = remake ? "text-blue-400" : m.win ? "text-emerald-400" : "text-red-400";

  return (
    <div className={`border-l-[3px] ${bdr} ${bg} hover:bg-white/[0.03] transition-colors`}>
      <div className="flex items-center gap-3 px-3 py-2.5">

        {/* CHAMP + SPELL (altında) + RUNE (yanında) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Şampiyon + altında spell'ler */}
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
          {/* Rünler — paylaşılan RuneTooltip */}
          <RuneTooltip runes={m.runes} keystoneSize={22} subTreeSize={16} />
        </div>

        {/* NAME + ROLE */}
        <div className="w-16 flex-shrink-0">
          <p className="text-[11px] font-medium text-gray-200 truncate">{m.champion.name}</p>
          <p className="text-[9px] text-gray-500">{roles[m.role] || m.role}</p>
          <p className="text-[9px] text-gray-600">{m.queueType}</p>
        </div>

        {/* KDA */}
        <div className="w-20 flex-shrink-0 text-center">
          <p className="text-sm font-semibold text-gray-200">{m.kills}<span className="text-gray-600">/</span>{m.deaths}<span className="text-gray-600">/</span>{m.assists}</p>
          <p className={`text-[10px] font-mono ${kdaColor(m.kda)}`}>{typeof m.kda === "number" ? m.kda.toFixed(2) : m.kda}</p>
        </div>

        {/* CS */}
        <div className="w-10 flex-shrink-0 text-center hidden md:block">
          <p className="text-[11px] text-gray-300">{m.cs}</p>
          <p className="text-[9px] text-gray-600">CS</p>
        </div>

        {/* ITEMS — paylaşılan ItemTooltip */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {m.items.slice(0, 6).map((item, i) => (
            <ItemTooltip key={i} item={item} size={24} />
          ))}
          {Array.from({ length: Math.max(0, 6 - m.items.length) }).map((_, i) => (
            <div key={`e${i}`} className="w-6 h-6 rounded-sm bg-[#1b2230]" />
          ))}
        </div>

        {/* RESULT */}
        <div className="w-14 flex-shrink-0 text-center">
          <p className={`text-[11px] font-bold ${resClr}`}>{resTxt}</p>
          <p className="text-[10px] text-gray-500">{fmtDur(m.duration)}</p>
          <p className="text-[9px] text-gray-600">{timeAgo(m.gameCreation)}</p>
        </div>

        {/* TEAMS */}
        <div className="flex-shrink-0 hidden lg:block">
          <div className="flex gap-0.5 mb-0.5">
            {m.allies?.map((a, i) => (
              <img key={i} src={a.image} alt={a.name} width={24} height={24}
                className={`rounded-sm ${a.isMe ? "ring-1 ring-blue-400" : ""}`} title={a.name} />
            ))}
          </div>
          <div className="flex gap-0.5">
            {m.enemies?.map((e, i) => (
              <img key={i} src={e.image} alt={e.name} width={24} height={24} className="rounded-sm" title={e.name} />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
