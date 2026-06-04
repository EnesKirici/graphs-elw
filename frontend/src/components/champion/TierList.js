"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import ReactDOM from "react-dom";
import { TIER_ROLES, TIER_META, buildRoleTiers, champCounters } from "@/lib/tierData";

const PATCH = "16.11";

const CLASS_TR = {
  Fighter: "Dövüşçü", Tank: "Tank", Mage: "Büyücü",
  Assassin: "Suikastçi", Marksman: "Nişancı", Support: "Destek",
};

function wrColor(wr) {
  if (wr >= 52) return "text-emerald-400";
  if (wr >= 49) return "text-gray-200";
  return "text-red-400";
}

/* ===== Hover kartı (op.gg tarzı: WR/Pick/Ban + counter'lar + linkler) ===== */
function HoverCard({ data, role, pool, rect, onEnter, onLeave }) {
  if (typeof window === "undefined" || !rect) return null;
  const counters = champCounters(data.id, role, pool, PATCH);
  const cls = CLASS_TR[(data.tags || [])[0]] || "Şampiyon";

  // İkonun altına konumlandır, yatayda viewport'a sığdır
  const W = 320;
  let left = rect.left + rect.width / 2 - W / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - W - 12));
  const top = rect.bottom + 8;

  return ReactDOM.createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed z-[9999]"
      style={{ top, left, width: W }}
    >
      <div className="glass rounded-xl border border-[#2a3441] shadow-2xl shadow-black/80 overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#1b2230]/60 to-transparent">
          <img src={data.image} alt={data.name} width={44} height={44} className="rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{data.name}</p>
            <p className="text-[11px] text-gray-500">{cls}</p>
          </div>
          <span className={`text-base font-extrabold ${TIER_META[data.tier].text}`}>{data.tier}</span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#1b2230]/60 border-y border-[#1b2230]/60">
          <Stat label="Kazanma" value={data.stats.wr} color={wrColor(data.stats.wr)} />
          <Stat label="Seçilme" value={data.stats.pick} />
          <Stat label="Banlanma" value={data.stats.ban} />
        </div>

        <div className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Counterlar</p>
          <div className="flex items-center gap-2.5">
            {counters.map(({ champ, wr }) => (
              <div key={champ.id} className="flex flex-col items-center gap-1">
                <img src={champ.image} alt={champ.name} width={34} height={34} className="rounded-md" />
                <span className={`text-[10px] font-semibold ${wr >= 50 ? "text-emerald-400" : "text-red-400"}`}>{wr}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 px-3 py-2.5 border-t border-[#1b2230]/60 text-[11px]">
          <Link href={`/champions/${data.id}`} className="text-blue-400 hover:text-blue-300 transition-colors">Build</Link>
          <span className="text-gray-700">·</span>
          <Link href={`/champions/${data.id}`} className="text-blue-400 hover:text-blue-300 transition-colors">Rehber</Link>
          <span className="text-gray-700">·</span>
          <Link href={`/champions/${data.id}`} className="text-blue-400 hover:text-blue-300 transition-colors">Counterlar</Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value, color = "text-gray-200" }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}%</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ===== Tier satırındaki tek şampiyon ===== */
function ChampCell({ c, onHover, onLeave }) {
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      onMouseEnter={() => onHover(c, ref.current?.getBoundingClientRect())}
      onMouseLeave={onLeave}
      className="flex flex-col items-center gap-1 w-[68px] cursor-pointer group"
    >
      <Link href={`/champions/${c.id}`} className="relative">
        <img
          src={c.image}
          alt={c.name}
          width={48}
          height={48}
          className={`rounded-full border-2 ${TIER_META[c.tier].ring} group-hover:scale-105 transition-transform`}
        />
      </Link>
      <p className="text-[10px] text-gray-300 text-center truncate w-full leading-tight">{c.name}</p>
      <p className={`text-[10px] font-semibold ${wrColor(c.stats.wr)} leading-none`}>{c.stats.wr}%</p>
    </div>
  );
}

export default function TierList({ champions = [], version }) {
  const [role, setRole] = useState("TOP");
  const [hover, setHover] = useState(null); // { data, rect }
  const closeTimer = useRef(null);

  const tiers = useMemo(() => buildRoleTiers(champions, role, PATCH), [champions, role]);
  const featured = tiers[0];
  const byTier = useMemo(() => {
    const g = { S: [], A: [], B: [], C: [], D: [] };
    tiers.forEach((c) => g[c.tier]?.push(c));
    return g;
  }, [tiers]);

  const openHover = (data, rect) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHover({ data, rect });
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const roleLabel = TIER_ROLES.find((r) => r.key === role)?.label;

  return (
    <div className="space-y-5">
      {/* Filtre çubuğu */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {TIER_ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === r.key ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <img src={r.icon} alt={r.label} width={16} height={16} className={role === r.key ? "" : "opacity-70"} />
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-[#1b2230]/60 text-gray-400">Emerald +</span>
          <span className="px-2.5 py-1 rounded-md bg-[#1b2230]/60 text-gray-400">Ranked Solo</span>
          <span className="px-2.5 py-1 rounded-md bg-[#1b2230]/60 text-gray-400">Patch {version || PATCH}</span>
        </div>
      </div>

      {/* Öne çıkan şampiyon */}
      {featured && (
        <div className="glass rounded-xl p-5 flex items-start gap-5">
          <Link href={`/champions/${featured.id}`} className="relative flex-shrink-0">
            <img src={featured.image} alt={featured.name} width={72} height={72} className="rounded-xl border-2 border-amber-400/70" />
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-[#0a0e14] text-xs font-extrabold flex items-center justify-center shadow-lg">S</span>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-white">{featured.name}</h2>
              <span className="text-xs text-gray-500">· {roleLabel} · Patch {version || PATCH}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              <span className="text-gray-200 font-semibold">{featured.name}</span>, bu yamada {roleLabel} koridorunun
              en güçlü seçimlerinden. %{featured.stats.wr} kazanma ve %{featured.stats.pick} seçilme oranıyla meta'nın
              zirvesinde; dengeli hasar ve oyun etkisiyle hem solo hem takım dövüşlerinde öne çıkıyor.
            </p>
            <div className="flex items-center gap-5 mt-3">
              <FeatStat label="Kazanma" value={featured.stats.wr} color={wrColor(featured.stats.wr)} />
              <FeatStat label="Seçilme" value={featured.stats.pick} />
              <FeatStat label="Banlanma" value={featured.stats.ban} />
            </div>
          </div>
        </div>
      )}

      {/* Tier satırları */}
      <div className="glass rounded-xl overflow-hidden">
        {["S", "A", "B", "C", "D"].map((t) => (
          <div key={t} className="flex border-b border-[#1b2230]/40 last:border-0">
            <div
              className="w-14 flex-shrink-0 flex items-center justify-center border-r border-[#1b2230]/40"
              style={{ background: `${TIER_META[t].color}14` }}
            >
              <span className={`text-2xl font-extrabold ${TIER_META[t].text}`}>{t}</span>
            </div>
            <div className="flex-1 p-3">
              {byTier[t].length === 0 ? (
                <p className="text-xs text-gray-600 py-3 px-1">Bu tier'da şampiyon yok</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {byTier[t].map((c) => (
                    <ChampCell key={c.id} c={c} onHover={openHover} onLeave={scheduleClose} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hover && (
        <HoverCard
          data={hover.data}
          role={role}
          pool={tiers}
          rect={hover.rect}
          onEnter={cancelClose}
          onLeave={scheduleClose}
        />
      )}
    </div>
  );
}

function FeatStat({ label, value, color = "text-gray-200" }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold ${color}`}>{value}%</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
