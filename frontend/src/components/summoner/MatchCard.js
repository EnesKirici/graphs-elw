"use client";

import { useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

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

const roles = { TOP: "Top", JUNGLE: "JG", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Sup" };

/* Fixed tooltip — element pozisyonuna göre ekrana sabitlenir */
function Tooltip({ anchorEl, children }) {
  if (!anchorEl || typeof window === "undefined") return null;
  const rect = anchorEl.getBoundingClientRect();

  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: `${rect.top - 8}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default function MatchCard({ match: m }) {
  const [hovItem, setHovItem] = useState(null);
  const [hovRune, setHovRune] = useState(false);
  const [itemAnchor, setItemAnchor] = useState(null);
  const [runeAnchor, setRuneAnchor] = useState(null);

  const remake = m.duration < 300;
  const bdr = remake ? "border-l-blue-400" : m.win ? "border-l-emerald-500" : "border-l-red-500";
  const bg = remake ? "bg-blue-500/[0.04]" : m.win ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]";
  const resTxt = remake ? "Remake" : m.win ? "Zafer" : "Yenilgi";
  const resClr = remake ? "text-blue-400" : m.win ? "text-emerald-400" : "text-red-400";

  return (
    <div className={`border-l-[3px] ${bdr} ${bg} hover:bg-white/[0.03] transition-colors`}>
      <div className="flex items-center gap-3 px-3 py-2.5">

        {/* CHAMP + SPELL + RUNE */}
        <div className="flex items-start gap-1.5 flex-shrink-0">
          <div className="relative">
            <img src={m.champion.image} alt="" width={44} height={44} className="rounded-lg" />
            <span className="absolute -bottom-1 -right-1 text-[8px] bg-[#0d1117] text-gray-400 px-0.5 rounded border border-[#1b2230] font-mono">{m.champLevel}</span>
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            {m.spells?.[0]?.image && <img src={m.spells[0].image} alt="" width={20} height={20} className="rounded-sm" title={m.spells[0].name} />}
            {m.spells?.[1]?.image && <img src={m.spells[1].image} alt="" width={20} height={20} className="rounded-sm" title={m.spells[1].name} />}
            {m.runes?.keystone?.icon && (
              <div
                ref={(el) => { if (el && !runeAnchor) setRuneAnchor(el); }}
                onMouseEnter={() => setHovRune(true)}
                onMouseLeave={() => setHovRune(false)}
              >
                <img src={m.runes.keystone.icon} alt="" width={20} height={20} className="rounded-sm cursor-help hover:ring-1 ring-blue-500/50" />
              </div>
            )}
            {m.runes?.subTree?.icon && <img src={m.runes.subTree.icon} alt="" width={20} height={20} className="rounded-sm opacity-60" />}
          </div>
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

        {/* ITEMS */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {m.items.slice(0, 6).map((item, i) => (
            <div key={i}
              onMouseEnter={(e) => { setHovItem(i); setItemAnchor(e.currentTarget); }}
              onMouseLeave={() => { setHovItem(null); setItemAnchor(null); }}
            >
              <img src={item.image} alt="" width={24} height={24} className="rounded-sm" />
            </div>
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
              <img key={i} src={a.image} alt={a.name} width={20} height={20}
                className={`rounded-sm ${a.isMe ? "ring-1 ring-blue-400" : ""}`} title={a.name} />
            ))}
          </div>
          <div className="flex gap-0.5">
            {m.enemies?.map((e, i) => (
              <img key={i} src={e.image} alt={e.name} width={20} height={20} className="rounded-sm" title={e.name} />
            ))}
          </div>
        </div>
      </div>

      {/* ITEM TOOLTIP — Portal */}
      {hovItem !== null && m.items[hovItem]?.name && itemAnchor && (
        <Tooltip anchorEl={itemAnchor}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-white">{m.items[hovItem].name}</p>
              {m.items[hovItem].gold > 0 && <span className="text-[11px] text-yellow-500 font-mono whitespace-nowrap">{m.items[hovItem].gold}g</span>}
            </div>
            {m.items[hovItem].desc?.stats?.length > 0 && (
              <div className="mb-2">
                {m.items[hovItem].desc.stats.map((s, j) => (
                  <p key={j} className="text-[11px] text-blue-300">{s}</p>
                ))}
              </div>
            )}
            {m.items[hovItem].desc?.passives?.length > 0 && (
              <div className="space-y-1.5 border-t border-[#1b2230] pt-2">
                {m.items[hovItem].desc.passives.map((p, j) => (
                  <div key={j}>
                    <p className="text-[11px] font-semibold text-yellow-400">{p.name}</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}

      {/* RUNE TOOLTIP — Portal, hover ile */}
      {hovRune && m.runes && runeAnchor && (
        <Tooltip anchorEl={runeAnchor}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-4 shadow-2xl shadow-black/90 w-72">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {m.runes.primaryTree?.icon && <img src={m.runes.primaryTree.icon} alt="" width={18} height={18} />}
                  <span className="text-[11px] font-medium text-gray-300">{m.runes.primaryTree?.name}</span>
                </div>
                <div className="space-y-2">
                  {m.runes.primaryPerks?.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={p.icon} alt="" width={i === 0 ? 28 : 22} height={i === 0 ? 28 : 22}
                        className={`rounded-md flex-shrink-0 ${i === 0 ? "ring-1 ring-yellow-500/50" : ""}`} />
                      <p className={i === 0 ? "text-[11px] font-semibold text-white" : "text-[10px] text-gray-400"}>{p.name}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {m.runes.subTree?.icon && <img src={m.runes.subTree.icon} alt="" width={18} height={18} />}
                  <span className="text-[11px] font-medium text-gray-300">{m.runes.subTree?.name}</span>
                </div>
                <div className="space-y-2">
                  {m.runes.secondaryPerks?.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={p.icon} alt="" width={22} height={22} className="rounded-md flex-shrink-0" />
                      <p className="text-[10px] text-gray-400">{p.name}</p>
                    </div>
                  ))}
                </div>
                {m.runes.statShards?.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[#1b2230]/50 space-y-1">
                    {m.runes.statShards.map((s, i) => (
                      <p key={i} className="text-[9px] text-gray-500 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? "bg-red-400" : i === 1 ? "bg-purple-400" : "bg-green-400"}`} />
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
