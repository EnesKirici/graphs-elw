"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDur(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + "k" : g; }
function fmtDmg(d) { return d >= 1000 ? (d / 1000).toFixed(1) + "k" : d; }
function fmtTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function kdaColor(kda) {
  if (kda === "Perfect" || kda >= 5) return "text-yellow-400";
  if (kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-blue-400";
  return "text-gray-400";
}
function rankBadgeUrl(tier) { return tier ? `/ranks/badges/${tier.toLowerCase()}.png` : null; }
function formatRank(tier, div) {
  if (!tier) return "Unranked";
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  return ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier) ? name : `${name} ${div || ""}`.trim();
}

function HoverImg({ src, alt, size, className, tooltip }) {
  const [a, setA] = useState(null);
  return (
    <>
      <img src={src} alt={alt || ""} width={size} height={size} className={className}
        onMouseEnter={(e) => setA(e.currentTarget)} onMouseLeave={() => setA(null)} />
      {a && tooltip && (
        <Tooltip anchorEl={a}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
            {tooltip}
          </div>
        </Tooltip>
      )}
    </>
  );
}

function groupItemsByRecall(items) {
  if (!items || !items.length) return [];
  const groups = [];
  let current = { timestamp: items[0].timestamp, items: [items[0]] };
  for (let i = 1; i < items.length; i++) {
    if (items[i].timestamp - current.items[current.items.length - 1].timestamp < 90) {
      current.items.push(items[i]);
    } else {
      groups.push(current);
      current = { timestamp: items[i].timestamp, items: [items[i]] };
    }
  }
  groups.push(current);
  return groups;
}

const ROLES_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const OBJECTIVES = [
  { key: "baron", label: "Baron", icon: "/objectives/baron.png" },
  { key: "dragon", label: "Dragon", icon: "/objectives/dragon.png" },
  { key: "tower", label: "Kule", icon: "/objectives/tower.png" },
  { key: "inhibitor", label: "İnhibitör", icon: "/objectives/inhibitor.png" },
  { key: "riftHerald", label: "Alamet", icon: "/objectives/riftHerald.png" },
  { key: "horde", label: "Voidgrub", icon: null },
];

const TABS = [
  { key: "overview", label: "Genel Bakış" },
  { key: "damage", label: "Hasar" },
  { key: "stats", label: "İstatistikler" },
  { key: "analysis", label: "Analiz" },
];

const SKILL_COLORS = {
  Q: "bg-blue-500 text-white",
  W: "bg-teal-500 text-white",
  E: "bg-emerald-500 text-white",
  R: "bg-amber-500 text-white",
};

/* ===== ANA BİLEŞEN ===== */
export default function MatchDetail({ matchId, puuid: searchedPuuid, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [selectedPuuid, setSelectedPuuid] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}`);
        setData(await res.json());
      } catch { setData(null); }
      setLoading(false);
    })();
  }, [matchId]);

  // Analiz tab: varsayılan seçili oyuncu
  useEffect(() => {
    if (data && !selectedPuuid) {
      const allP = [...(data.teams?.[0]?.players || []), ...(data.teams?.[1]?.players || [])];
      const me = searchedPuuid ? allP.find(p => p.puuid === searchedPuuid) : allP[0];
      if (me) setSelectedPuuid(me.puuid);
    }
  }, [data, searchedPuuid, selectedPuuid]);

  if (loading) return (
    <div className="glass rounded-xl p-10 text-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-500">Maç detayları yükleniyor...</p>
    </div>
  );

  if (!data || data.error) return (
    <div className="glass rounded-xl p-8 text-center">
      <p className="text-sm text-red-400 mb-4">Maç detayı yüklenemedi</p>
      <button onClick={onBack} className="text-sm text-blue-400 hover:underline cursor-pointer">← Geri Dön</button>
    </div>
  );

  const t1 = data.teams[0];
  const t2 = data.teams[1];
  const obj1 = t1?.info?.objectives || {};
  const obj2 = t2?.info?.objectives || {};
  const laneAnalysis = data.laneAnalysis || [];

  const sortByRole = (players) => {
    if (!players) return [];
    const roleIdx = (p) => { const i = ROLES_ORDER.indexOf(p.role); return i >= 0 ? i : 99; };
    return [...players].sort((a, b) => roleIdx(a) - roleIdx(b));
  };
  const bluePlayers = sortByRole(t1?.players);
  const redPlayers = sortByRole(t2?.players);
  const analysisMap = {};
  laneAnalysis.forEach((a) => { analysisMap[a.role] = a; });
  const allPlayers = [...(t1?.players || []), ...(t2?.players || [])];
  const maxDmg = Math.max(...allPlayers.map(p => p.damage), 1);
  const maxDmgTaken = Math.max(...allPlayers.map(p => p.damageTaken || 0), 1);

  const selectedPlayer = allPlayers.find(p => p.puuid === selectedPuuid);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#1b2230]/50">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={18} /> Geri Dön
        </button>
        <div className="text-center">
          <p className="text-lg text-gray-200 font-semibold">{data.queueType}</p>
          <p className="text-sm text-gray-500">{fmtDur(data.duration)}</p>
        </div>
        <div className="w-28" />
      </div>

      {/* SKOR */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-6">
          <div className="flex-1 text-left">
            <span className={`text-2xl font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t1?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
            <span className="text-base text-gray-400 ml-3">
              {t1?.info?.totalKills} / {t1?.players?.reduce((s, p) => s + p.deaths, 0)} / {t1?.players?.reduce((s, p) => s + p.assists, 0)}
            </span>
          </div>
          <div className="w-72">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base text-blue-400 font-bold">{t1?.info?.totalKills}</span>
              <span className="text-sm text-gray-500">Total Kill</span>
              <span className="text-base text-red-400 font-bold">{t2?.info?.totalKills}</span>
            </div>
            <CompBar v1={t1?.info?.totalKills || 0} v2={t2?.info?.totalKills || 0} h="h-2.5" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{fmtGold(t1?.info?.totalGold || 0)} gold</span>
              <span className="text-xs text-gray-500">{fmtGold(t2?.info?.totalGold || 0)} gold</span>
            </div>
          </div>
          <div className="flex-1 text-right">
            <span className="text-base text-gray-400 mr-3">
              {t2?.info?.totalKills} / {t2?.players?.reduce((s, p) => s + p.deaths, 0)} / {t2?.players?.reduce((s, p) => s + p.assists, 0)}
            </span>
            <span className={`text-2xl font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t2?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
          </div>
        </div>
      </div>

      {/* OBJECTIVES + BANS */}
      <div className="px-6 pb-5 flex items-center justify-between border-b border-[#1b2230]/30 pt-1">
        <div className="flex items-center gap-5">
          <ObjGroup obj={obj1} />
          <BanGroup bans={t1?.info?.bans} />
        </div>
        <div className="flex items-center gap-5">
          <BanGroup bans={t2?.info?.bans} />
          <ObjGroup obj={obj2} />
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#1b2230]/30">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5" : "text-gray-500 hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-[1fr_90px_1fr] border-b border-[#1b2230]/30">
            <div className={`px-5 py-2.5 ${t1?.info?.win ? "bg-blue-500/5" : "bg-red-500/5"}`}>
              <span className={`text-sm font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t1?.info?.win ? "Zafer" : "Yenilgi"} (Mavi)
              </span>
            </div>
            <div className="flex items-center justify-center bg-[#0d1117]/50">
              <span className="text-xs text-gray-600">VS</span>
            </div>
            <div className={`px-5 py-2.5 text-right ${t2?.info?.win ? "bg-blue-500/5" : "bg-red-500/5"}`}>
              <span className={`text-sm font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t2?.info?.win ? "Zafer" : "Yenilgi"} (Kırmızı)
              </span>
            </div>
          </div>

          {bluePlayers.map((bp, i) => {
            const rp = redPlayers[i];
            const analysis = bp?.role ? analysisMap[bp.role] : null;
            return (
              <div key={bp.puuid} className="grid grid-cols-[1fr_90px_1fr] border-b border-[#1b2230]/15 last:border-b-0">
                <PlayerRow p={bp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} side="blue" />
                <VerdictBadge analysis={analysis} />
                {rp ? <PlayerRow p={rp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} side="red" /> : <div />}
              </div>
            );
          })}
        </>
      )}

      {/* DAMAGE TAB */}
      {tab === "damage" && (
        <div className="p-6 space-y-8">
          {/* Takım hasar karşılaştırma */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Takım Karşılaştırma</h3>
            {[
              { label: "Toplam Gold", v1: t1?.info?.totalGold || 0, v2: t2?.info?.totalGold || 0, fmt: fmtGold },
              { label: "Toplam Kill", v1: t1?.info?.totalKills || 0, v2: t2?.info?.totalKills || 0 },
              { label: "Toplam Hasar", v1: t1?.players?.reduce((s, p) => s + p.damage, 0) || 0, v2: t2?.players?.reduce((s, p) => s + p.damage, 0) || 0, fmt: fmtDmg },
              { label: "Görüş Skoru", v1: t1?.players?.reduce((s, p) => s + (p.visionScore || 0), 0) || 0, v2: t2?.players?.reduce((s, p) => s + (p.visionScore || 0), 0) || 0 },
              { label: "Kule Hasarı", v1: t1?.players?.reduce((s, p) => s + (p.towerDamage || 0), 0) || 0, v2: t2?.players?.reduce((s, p) => s + (p.towerDamage || 0), 0) || 0, fmt: fmtDmg },
            ].map((m) => {
              const fmt = m.fmt || ((v) => v);
              return (
                <div key={m.label} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-blue-400 font-semibold">{fmt(m.v1)}</span>
                    <span className="text-xs text-gray-500">{m.label}</span>
                    <span className="text-sm text-red-400 font-semibold">{fmt(m.v2)}</span>
                  </div>
                  <CompBar v1={m.v1} v2={m.v2} h="h-2.5" />
                </div>
              );
            })}
          </div>

          {/* Hasar Dağılımı — Karşılıklı */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Hasar Dağılımı</h3>
            <div className="space-y-3">
              {bluePlayers.map((bp, i) => {
                const rp = redPlayers[i];
                const bpPhys = bp.physicalDamage || 0, bpMagic = bp.magicDamage || 0, bpTrue = bp.trueDamage || 0;
                const bpTotal = Math.max(bpPhys + bpMagic + bpTrue, 1);
                const bpPct = ((bp.damage || 0) / maxDmg) * 100;

                const rpPhys = rp?.physicalDamage || 0, rpMagic = rp?.magicDamage || 0, rpTrue = rp?.trueDamage || 0;
                const rpTotal = rp ? Math.max(rpPhys + rpMagic + rpTrue, 1) : 1;
                const rpPct = rp ? ((rp.damage || 0) / maxDmg) * 100 : 0;

                return (
                  <div key={bp.puuid} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
                    {/* Mavi taraf — sağdan sola */}
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-400 w-12 text-right font-mono">{fmtDmg(bp.damage || 0)}</span>
                      <div className="flex-1 flex justify-end">
                        <div className="h-4 rounded-l-full overflow-hidden flex justify-end" style={{ width: `${bpPct}%`, minWidth: "4px" }}>
                          <div className="h-full bg-gray-400" style={{ width: `${(bpTrue / bpTotal) * 100}%` }} />
                          <div className="h-full bg-blue-500" style={{ width: `${(bpMagic / bpTotal) * 100}%` }} />
                          <div className="h-full bg-orange-500" style={{ width: `${(bpPhys / bpTotal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    {/* Ortada şampiyonlar */}
                    <div className="flex items-center justify-center gap-1.5">
                      <img src={bp.champion.image} alt="" width={30} height={30} className="rounded-lg ring-1 ring-blue-500/40" />
                      <span className="text-[10px] text-gray-600">vs</span>
                      {rp && <img src={rp.champion.image} alt="" width={30} height={30} className="rounded-lg ring-1 ring-red-500/40" />}
                    </div>
                    {/* Kırmızı taraf — soldan sağa */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="h-4 rounded-r-full overflow-hidden flex" style={{ width: `${rpPct}%`, minWidth: rp ? "4px" : "0" }}>
                          <div className="h-full bg-orange-500" style={{ width: `${(rpPhys / rpTotal) * 100}%` }} />
                          <div className="h-full bg-blue-500" style={{ width: `${(rpMagic / rpTotal) * 100}%` }} />
                          <div className="h-full bg-gray-400" style={{ width: `${(rpTrue / rpTotal) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-12 text-left font-mono">{rp ? fmtDmg(rp.damage || 0) : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#1b2230]/20">
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Fiziksel</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Büyü</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />Gerçek</span>
            </div>
          </div>
        </div>
      )}

      {/* STATS TAB — Karşılıklı */}
      {tab === "stats" && (
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">Detaylı İstatistikler</h3>
          <StatsTable bluePlayers={bluePlayers} redPlayers={redPlayers} allPlayers={allPlayers} t1={t1} />
        </div>
      )}

      {/* ANALYSIS TAB */}
      {tab === "analysis" && (
        <div className="p-6">
          {/* Oyuncu Seçici */}
          <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
            {allPlayers.map((p) => {
              const isBlue = t1?.players?.some(tp => tp.puuid === p.puuid);
              const isSelected = p.puuid === selectedPuuid;
              return (
                <button key={p.puuid} onClick={() => setSelectedPuuid(p.puuid)}
                  className={`relative rounded-xl overflow-hidden transition-all cursor-pointer ${isSelected ? "ring-2 ring-blue-400 scale-110" : "opacity-60 hover:opacity-100"}`}>
                  <img src={p.champion.image} alt={p.champion.name} width={44} height={44} className="rounded-xl" />
                  {p.matchRank && (
                    <span className={`absolute -top-0.5 -left-0.5 text-[9px] font-bold px-1 rounded-br-lg rounded-tl-lg ${
                      p.matchRank === 1 ? "bg-yellow-500 text-black" : p.matchRank <= 3 ? "bg-emerald-500/90 text-white" : p.matchRank >= 8 ? "bg-red-500/80 text-white" : "bg-gray-600/80 text-gray-200"
                    }`}>{p.matchRank}</span>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isBlue ? "bg-blue-500" : "bg-red-500"}`} />
                </button>
              );
            })}
          </div>

          {selectedPlayer && <AnalysisPanel player={selectedPlayer} allPlayers={allPlayers} t1={t1} duration={data.duration} />}
        </div>
      )}
    </div>
  );
}

/* ===== KARŞILAŞTIRMA BARI ===== */
function CompBar({ v1, v2, h = "h-2" }) {
  const total = Math.max(v1 + v2, 1);
  return (
    <div className={`${h} rounded-full overflow-hidden flex`}>
      <div className="h-full bg-blue-500" style={{ width: `${(v1 / total) * 100}%` }} />
      <div className="h-full bg-red-500" style={{ width: `${(v2 / total) * 100}%` }} />
    </div>
  );
}

/* ===== OBJEKTİF ===== */
function ObjGroup({ obj }) {
  if (!obj || Object.keys(obj).length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      {OBJECTIVES.map((it) => {
        const val = obj[it.key];
        if (!val || val.kills === 0) return null;
        return (
          <div key={it.key} className="flex items-center gap-1" title={`${it.label}: ${val.kills}`}>
            {it.icon ? <img src={it.icon} alt={it.label} width={22} height={22} className="opacity-85" /> : <span className="text-base">👾</span>}
            <span className="text-sm text-gray-200 font-semibold">{val.kills}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ===== BAN ===== */
function BanGroup({ bans }) {
  if (!bans || bans.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 mr-0.5">Bans:</span>
      {bans.map((b, i) => b.image
        ? <img key={i} src={b.image} alt="" width={28} height={28} className="rounded opacity-65" />
        : <div key={i} className="w-7 h-7 rounded bg-[#1b2230]" />
      )}
    </div>
  );
}

/* ===== VERDICT BADGE ===== */
function VerdictBadge({ analysis }) {
  if (!analysis) return <div className="w-[90px] flex items-center justify-center bg-[#0d1117]/30" />;
  const { verdict, highlights } = analysis;
  const cfg = {
    blue_dominant: { color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/25", icon: "◀◀", label: "Baskın" },
    blue_ahead:    { color: "text-blue-400", bg: "bg-blue-500/8",  border: "border-blue-500/15", icon: "◀",  label: "Önde" },
    even:          { color: "text-gray-400", bg: "bg-[#0d1117]/30",border: "border-[#1b2230]/20",icon: "=",  label: "Dengeli" },
    red_ahead:     { color: "text-red-400",  bg: "bg-red-500/8",   border: "border-red-500/15",  icon: "▶",  label: "Önde" },
    red_dominant:  { color: "text-red-300",  bg: "bg-red-500/15",  border: "border-red-500/25",  icon: "▶▶", label: "Baskın" },
  }[verdict] || { color: "text-gray-400", bg: "bg-[#0d1117]/30", border: "border-[#1b2230]/20", icon: "=", label: "Dengeli" };

  return (
    <div className={`w-[90px] flex flex-col items-center justify-center ${cfg.bg} border-x ${cfg.border} py-2`}>
      <span className={`text-base font-bold ${cfg.color}`}>{cfg.icon}</span>
      <span className={`text-xs ${cfg.color} font-bold`}>{cfg.label}</span>
      {highlights.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {highlights.slice(0, 2).map((h, i) => (
            <p key={i} className={`text-[9px] text-center leading-snug font-semibold ${cfg.color}`}>{h}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== OYUNCU SATIRI ===== */
function PlayerRow({ p, maxDmg, maxDmgTaken, side }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const rank = formatRank(p.tier, p.rankDivision);
  const multiKill = p.pentaKills > 0 ? "PENTA" : p.quadraKills > 0 ? "QUADRA" : p.tripleKills > 0 ? "TRIPLE" : null;
  const mirrored = side === "red";

  const rankBg = p.matchRank === 1 ? "bg-yellow-500 text-black"
    : p.matchRank <= 3 ? "bg-emerald-500/90 text-white"
    : p.matchRank >= 8 ? "bg-red-500/80 text-white"
    : "bg-gray-600/80 text-gray-200";

  return (
    <div className={`px-4 py-3 hover:bg-white/[0.02] transition-colors ${mirrored ? "pl-3" : ""}`}>
      <div className={`flex items-center gap-2.5 ${mirrored ? "flex-row-reverse" : ""}`}>
        {/* Sıralama */}
        {p.matchRank && (
          <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 ${rankBg}`}>
            {p.matchRank}
          </span>
        )}

        {/* Champ + Spells + Runes */}
        <div className={`flex items-center gap-1.5 flex-shrink-0 ${mirrored ? "flex-row-reverse" : ""}`}>
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={p.champion.image} alt="" width={44} height={44} className="rounded-lg" />
              <span className={`absolute -bottom-0.5 ${mirrored ? "-left-0.5" : "-right-0.5"} bg-[#0d1117] text-[9px] text-gray-300 font-bold px-1 rounded`}>{p.champLevel}</span>
            </div>
            <div className="flex gap-0.5">
              {p.spells[0] && <HoverImg src={p.spells[0].image} size={18} className="rounded-sm" tooltip={<p className="text-xs text-white">{p.spells[0].name}</p>} />}
              {p.spells[1] && <HoverImg src={p.spells[1].image} size={18} className="rounded-sm" tooltip={<p className="text-xs text-white">{p.spells[1].name}</p>} />}
            </div>
          </div>
          <RuneTooltip runes={p.runes} keystoneSize={22} subTreeSize={16} />
        </div>

        {/* İsim + Rank */}
        <div className={`flex-1 min-w-0 ${mirrored ? "text-right" : ""}`}>
          <p className="text-sm text-gray-100 font-medium truncate">{p.summonerName}<span className="text-gray-600 text-[10px] ml-0.5">#{p.tagLine}</span></p>
          <div className={`flex items-center gap-1 ${mirrored ? "justify-end" : ""}`}>
            {!mirrored && p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={16} height={16} />}
            <span className="text-[10px] text-gray-500">{rank}</span>
            {mirrored && p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={16} height={16} />}
          </div>
        </div>

        {/* KDA */}
        <div className="text-center flex-shrink-0 w-24">
          <p className="text-base font-semibold">
            <span className="text-emerald-400">{p.kills}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-yellow-500/80">{p.assists}</span>
          </p>
          <p className={`text-[10px] font-bold ${kdaColor(p.kda)}`}>
            {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(2)}:1`}
          </p>
          {multiKill && <span className={`text-[8px] px-1.5 py-px rounded-full font-bold ${multiKill === "PENTA" ? "bg-red-500/20 text-red-400" : multiKill === "QUADRA" ? "bg-purple-500/20 text-purple-400" : "bg-yellow-500/20 text-yellow-400"}`}>{multiKill}</span>}
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {p.items.map((item, i) => <ItemTooltip key={i} item={item} size={28} />)}
        </div>
      </div>

      {/* Alt stat satırı */}
      <div className={`flex items-center gap-4 mt-2 ${mirrored ? "flex-row-reverse" : ""} ${mirrored ? "pr-[50px]" : "pl-[56px]"}`}>
        <span className="text-[10px] text-gray-500">{p.cs} CS · {p.csPerMin}/d</span>
        <span className="text-[10px] text-gray-500">{fmtGold(p.gold)} gold</span>
        <span className="text-[10px] text-gray-500">{p.killParticipation}%</span>
        <span className="text-[10px] text-yellow-600/80">{p.visionScore} 👁</span>
        <div className="flex-1 min-w-[80px]">
          <div className={`flex items-center gap-1 ${mirrored ? "flex-row-reverse" : ""}`}>
            <span className={`text-[10px] text-gray-400 w-10 ${mirrored ? "text-left" : "text-right"}`}>{fmtDmg(p.damage)}</span>
            <div className={`flex-1 h-1.5 bg-[#1b2230] rounded-full overflow-hidden ${mirrored ? "flex justify-end" : ""}`}>
              <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${dmgPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== İSTATİSTİK TABLOSU — Karşılıklı ===== */
const STAT_COLS = [
  { k: "damagePerMinute", l: "DPM", fmt: (v) => Math.round(v) },
  { k: "goldPerMinute", l: "GPM", fmt: (v) => Math.round(v) },
  { k: "killParticipation", l: "KP", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "visionScorePerMin", l: "VS/dk", fmt: (v) => v.toFixed(1) },
  { k: "teamDamagePct", l: "Hasar%", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "damageTakenPct", l: "Tank%", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "soloKills", l: "Solo", fmt: (v) => v },
  { k: "turretPlatesTaken", l: "Plaka", fmt: (v) => v },
  { k: "laneMinions10", l: "CS@10", fmt: (v) => v },
  { k: "controlWardsPlaced", l: "CW", fmt: (v) => v },
];

function StatsTable({ bluePlayers, redPlayers, allPlayers }) {
  // Her stat için max değer
  const maxVals = {};
  STAT_COLS.forEach(col => {
    maxVals[col.k] = Math.max(...allPlayers.map(p => p.challenges?.[col.k] ?? 0));
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Mavi Takım */}
      <div>
        <div className="text-sm font-bold text-blue-400 mb-3 px-1">Mavi Takım</div>
        <div className="bg-blue-500/[0.03] rounded-xl overflow-hidden border border-blue-500/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-500/10">
                <th className="text-left text-gray-500 py-2.5 px-3">Oyuncu</th>
                {STAT_COLS.map(col => (
                  <th key={col.k} className="text-center text-gray-500 py-2.5 px-1 text-[11px]">{col.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bluePlayers.map(p => (
                <StatsRow key={p.puuid} p={p} maxVals={maxVals} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Kırmızı Takım */}
      <div>
        <div className="text-sm font-bold text-red-400 mb-3 px-1">Kırmızı Takım</div>
        <div className="bg-red-500/[0.03] rounded-xl overflow-hidden border border-red-500/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-red-500/10">
                <th className="text-left text-gray-500 py-2.5 px-3">Oyuncu</th>
                {STAT_COLS.map(col => (
                  <th key={col.k} className="text-center text-gray-500 py-2.5 px-1 text-[11px]">{col.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {redPlayers.map(p => (
                <StatsRow key={p.puuid} p={p} maxVals={maxVals} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatsRow({ p, maxVals }) {
  const c = p.challenges || {};
  return (
    <tr className="border-b border-[#1b2230]/10 last:border-b-0 hover:bg-white/[0.02]">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <img src={p.champion.image} alt="" width={24} height={24} className="rounded-md" />
          <span className="text-gray-300 truncate max-w-[100px] text-xs font-medium">{p.summonerName}</span>
        </div>
      </td>
      {STAT_COLS.map(col => {
        const val = c[col.k] ?? 0;
        const isMax = val === maxVals[col.k] && val > 0;
        return (
          <td key={col.k} className={`text-center py-2.5 px-1 font-mono text-xs ${isMax ? "text-emerald-400 font-bold" : "text-gray-400"}`}>
            {col.fmt(val)}
          </td>
        );
      })}
    </tr>
  );
}

/* ===== ANALİZ PANELİ ===== */
function AnalysisPanel({ player, allPlayers, t1, duration }) {
  const p = player;
  const isBlue = t1?.players?.some(tp => tp.puuid === p.puuid);
  const itemGroups = useMemo(() => groupItemsByRecall(p.itemTimeline || []), [p.puuid]);
  const skillOrder = p.skillOrder || [];

  // Skill order → 18 level grid
  const skillGrid = useMemo(() => {
    const grid = { Q: [], W: [], E: [], R: [] };
    skillOrder.forEach(s => {
      if (grid[s.skillKey]) {
        grid[s.skillKey].push(s.level);
      }
    });
    return grid;
  }, [skillOrder]);

  const maxLevel = Math.min(Math.max(p.champLevel || 18, ...skillOrder.map(s => s.level)), 18);

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6">
      {/* Sol — Oyuncu Bilgisi + Item Timeline */}
      <div className="space-y-6">
        {/* Oyuncu Özet */}
        <div className={`p-5 rounded-xl border ${isBlue ? "bg-blue-500/[0.04] border-blue-500/15" : "bg-red-500/[0.04] border-red-500/15"}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={p.champion.image} alt="" width={56} height={56} className="rounded-xl" />
              {p.matchRank && (
                <span className={`absolute -top-1 -left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                  p.matchRank === 1 ? "bg-yellow-500 text-black" : p.matchRank <= 3 ? "bg-emerald-500 text-white" : p.matchRank >= 8 ? "bg-red-500 text-white" : "bg-gray-600 text-white"
                }`}>{p.matchRank === 1 ? "MVP" : `#${p.matchRank}`}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-gray-100">{p.summonerName}<span className="text-gray-600 text-xs ml-1">#{p.tagLine}</span></p>
              <div className="flex items-center gap-2 mt-1">
                {p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={18} height={18} />}
                <span className="text-xs text-gray-500">{formatRank(p.tier, p.rankDivision)}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                <span className="text-emerald-400">{p.kills}</span>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-red-400">{p.deaths}</span>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-yellow-500/80">{p.assists}</span>
              </p>
              <p className={`text-sm font-bold ${kdaColor(p.kda)}`}>
                {p.kda === "Perfect" ? "Perfect KDA" : `${p.kda.toFixed(2)}:1 KDA`}
              </p>
            </div>
            <div className="text-right text-sm text-gray-400 space-y-0.5">
              <p>{p.cs} CS ({p.csPerMin}/dk)</p>
              <p>{fmtGold(p.gold)} gold</p>
              <p>{p.killParticipation}% KP</p>
            </div>
          </div>
          {/* ELW Score Bar */}
          {p.elwScore != null && (
            <div className="mt-4 pt-3 border-t border-[#1b2230]/30">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">ELW Score</span>
                <div className="flex-1 h-2 bg-[#1b2230] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.elwScore >= 7 ? "bg-emerald-500" : p.elwScore >= 5 ? "bg-blue-500" : p.elwScore >= 3 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${p.elwScore * 10}%` }} />
                </div>
                <span className={`text-sm font-bold ${p.elwScore >= 7 ? "text-emerald-400" : p.elwScore >= 5 ? "text-blue-400" : p.elwScore >= 3 ? "text-yellow-400" : "text-red-400"}`}>
                  {p.elwScore.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Item Timeline */}
        <div>
          <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Eşya Geçmişi</h4>
          {itemGroups.length > 0 ? (
            <div className="space-y-2.5">
              {itemGroups.map((g, gi) => (
                <div key={gi} className="flex items-center gap-3 bg-[#0d1117]/40 rounded-lg px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-mono w-12 flex-shrink-0">{fmtTime(g.timestamp)}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {g.items.map((item, ii) => (
                      <div key={ii} className="relative group">
                        <img src={item.image} alt={item.name} width={32} height={32} className="rounded-md border border-[#2a3441]/50" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl whitespace-nowrap text-center">
                            <p className="text-xs text-white font-medium">{item.name}</p>
                            <p className="text-[10px] text-yellow-500">{item.gold} gold</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic">Eşya geçmişi verisi bulunamadı</p>
          )}
        </div>

        {/* Rozetler */}
        {p.badges?.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Rozetler</h4>
            <div className="flex flex-wrap gap-2">
              {p.badges.map((b, i) => {
                const tierColors = {
                  challenger: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
                  grandmaster: "bg-red-500/15 text-red-400 border-red-500/30",
                  diamond: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                  gold: "bg-yellow-600/15 text-yellow-500 border-yellow-600/30",
                  silver: "bg-gray-400/15 text-gray-400 border-gray-400/30",
                };
                return (
                  <span key={i} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${tierColors[b.tier] || tierColors.silver}`}
                    title={b.desc}>
                    {b.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sağ — Skill Order + Runes */}
      <div className="space-y-6">
        {/* Skill Order */}
        <div>
          <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Yetenek Sırası</h4>
          {skillOrder.length > 0 ? (
            <div className="bg-[#0d1117]/40 rounded-xl p-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-8" />
                    {Array.from({ length: maxLevel }, (_, i) => (
                      <th key={i} className="text-[10px] text-gray-600 font-medium text-center w-7 pb-1.5">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["Q", "W", "E", "R"].map(skill => (
                    <tr key={skill}>
                      <td className="pr-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SKILL_COLORS[skill]}`}>{skill}</span>
                      </td>
                      {Array.from({ length: maxLevel }, (_, i) => {
                        const level = i + 1;
                        const isLeveled = skillGrid[skill]?.includes(level);
                        return (
                          <td key={i} className="text-center py-0.5">
                            {isLeveled ? (
                              <span className={`inline-block w-5 h-5 rounded text-[10px] font-bold leading-5 ${SKILL_COLORS[skill]}`}>{skill}</span>
                            ) : (
                              <span className="inline-block w-5 h-5 rounded bg-[#1b2230]/30" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic">Yetenek sırası verisi bulunamadı</p>
          )}
        </div>

        {/* Runes */}
        {p.runes && (
          <div>
            <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Rünler</h4>
            <div className="bg-[#0d1117]/40 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-5">
                {/* Primary */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {p.runes.primaryTree?.icon && <img src={p.runes.primaryTree.icon} alt="" width={24} height={24} />}
                    <span className="text-xs font-semibold text-gray-200">{p.runes.primaryTree?.name}</span>
                  </div>
                  <div className="space-y-2">
                    {p.runes.primaryPerks?.map((rune, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img src={rune.icon} alt="" width={i === 0 ? 32 : 26} height={i === 0 ? 32 : 26}
                          className={`rounded flex-shrink-0 ${i === 0 ? "ring-1 ring-yellow-500/50" : ""}`} />
                        <span className={`${i === 0 ? "text-xs font-semibold text-white" : "text-[11px] text-gray-300"}`}>{rune.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Secondary */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {p.runes.subTree?.icon && <img src={p.runes.subTree.icon} alt="" width={24} height={24} />}
                    <span className="text-xs font-semibold text-gray-200">{p.runes.subTree?.name}</span>
                  </div>
                  <div className="space-y-2">
                    {p.runes.secondaryPerks?.map((rune, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img src={rune.icon} alt="" width={26} height={26} className="rounded flex-shrink-0" />
                        <span className="text-[11px] text-gray-300">{rune.name}</span>
                      </div>
                    ))}
                  </div>
                  {p.runes.statShards?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#1b2230]/40 space-y-1.5">
                      {p.runes.statShards.map((s, i) => (
                        <p key={i} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? "bg-red-400" : i === 1 ? "bg-purple-400" : "bg-green-400"}`} />
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
