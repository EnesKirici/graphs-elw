"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDur(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + "k" : g; }
function fmtDmg(d) { return d >= 1000 ? (d / 1000).toFixed(1) + "k" : d; }

function getKdaColor(kda) {
  if (kda === "Perfect" || kda >= 5) return "text-yellow-400";
  if (kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-blue-400";
  return "text-gray-400";
}

function rankBadgeUrl(tier) {
  return tier ? `/ranks/badges/${tier.toLowerCase()}.png` : null;
}

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

const ROLES_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/* ===== ANA BİLEŞEN ===== */
export default function MatchDetail({ matchId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}`);
        setData(await res.json());
      } catch { setData(null); }
      setLoading(false);
    })();
  }, [matchId]);

  if (loading) return (
    <div className="glass rounded-xl p-8 text-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Maç detayları yükleniyor...</p>
    </div>
  );

  if (!data || data.error) return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-sm text-red-400 mb-3">Maç detayı yüklenemedi</p>
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

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* ===== HEADER ===== */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-[#1b2230]/50">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={16} /> Geri Dön
        </button>
        <div className="text-center">
          <p className="text-base text-gray-200 font-semibold">{data.queueType}</p>
          <p className="text-xs text-gray-500">{fmtDur(data.duration)}</p>
        </div>
        <div className="w-24" />
      </div>

      {/* ===== SKOR ===== */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 text-left">
            <span className={`text-xl font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t1?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
            <span className="text-sm text-gray-400 ml-2">
              {t1?.info?.totalKills} / {t1?.players?.reduce((s, p) => s + p.deaths, 0)} / {t1?.players?.reduce((s, p) => s + p.assists, 0)}
            </span>
          </div>

          {/* Kill bar — daha geniş */}
          <div className="w-64">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-blue-400 font-bold">{t1?.info?.totalKills}</span>
              <span className="text-xs text-gray-500">Total Kill</span>
              <span className="text-sm text-red-400 font-bold">{t2?.info?.totalKills}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500" style={{ width: `${(t1?.info?.totalKills || 0) / Math.max((t1?.info?.totalKills || 0) + (t2?.info?.totalKills || 0), 1) * 100}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${(t2?.info?.totalKills || 0) / Math.max((t1?.info?.totalKills || 0) + (t2?.info?.totalKills || 0), 1) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-gray-500">{fmtGold(t1?.info?.totalGold || 0)} gold</span>
              <span className="text-[10px] text-gray-600">Total Gold</span>
              <span className="text-[11px] text-gray-500">{fmtGold(t2?.info?.totalGold || 0)} gold</span>
            </div>
          </div>

          <div className="flex-1 text-right">
            <span className="text-sm text-gray-400 mr-2">
              {t2?.info?.totalKills} / {t2?.players?.reduce((s, p) => s + p.deaths, 0)} / {t2?.players?.reduce((s, p) => s + p.assists, 0)}
            </span>
            <span className={`text-xl font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t2?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
          </div>
        </div>
      </div>

      {/* ===== OBJECTIVES + BANS — büyütülmüş ===== */}
      <div className="px-5 pb-4 flex items-center justify-between border-b border-[#1b2230]/30 pt-1">
        <div className="flex items-center gap-4">
          <ObjectiveGroup obj={obj1} />
          <BanGroup bans={t1?.info?.bans} />
        </div>
        <div className="flex items-center gap-4">
          <BanGroup bans={t2?.info?.bans} />
          <ObjectiveGroup obj={obj2} />
        </div>
      </div>

      {/* ===== TAKIM BAŞLIKLARI ===== */}
      <div className="grid grid-cols-[1fr_96px_1fr] border-b border-[#1b2230]/30">
        <div className={`px-4 py-2.5 ${t1?.info?.win ? "bg-blue-500/5" : "bg-red-500/5"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t1?.info?.win ? "Zafer" : "Yenilgi"} (Mavi)
            </span>
            <span className="text-[10px] text-gray-500">{fmtGold(t1?.info?.totalGold || 0)} gold</span>
          </div>
        </div>
        <div className="flex items-center justify-center bg-[#0d1117]/50">
          <span className="text-[9px] text-gray-600">VS</span>
        </div>
        <div className={`px-4 py-2.5 ${t2?.info?.win ? "bg-blue-500/5" : "bg-red-500/5"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{fmtGold(t2?.info?.totalGold || 0)} gold</span>
            <span className={`text-xs font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {t2?.info?.win ? "Zafer" : "Yenilgi"} (Kırmızı)
            </span>
          </div>
        </div>
      </div>

      {/* ===== OYUNCULAR — YAN YANA ===== */}
      {bluePlayers.map((bp, i) => {
        const rp = redPlayers[i];
        const analysis = bp?.role ? analysisMap[bp.role] : null;
        return (
          <div key={bp.puuid} className="grid grid-cols-[1fr_96px_1fr] border-b border-[#1b2230]/15 last:border-b-0">
            <PlayerRowLeft p={bp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} />
            <LaneVerdictBadge analysis={analysis} />
            {rp ? (
              <PlayerRowRight p={rp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} />
            ) : (
              <div />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== OBJECTIVE İKONLARI — büyütülmüş ===== */
const OBJECTIVES = [
  { key: "baron",      label: "Baron",      icon: "/objectives/baron.png" },
  { key: "dragon",     label: "Dragon",     icon: "/objectives/dragon.png" },
  { key: "tower",      label: "Kule",       icon: "/objectives/tower.png" },
  { key: "inhibitor",  label: "İnhibitör",  icon: "/objectives/inhibitor.png" },
  { key: "riftHerald", label: "Alamet",     icon: "/objectives/riftHerald.png" },
  { key: "horde",      label: "Voidgrub",   icon: null },
];

function ObjectiveIcon({ item, count }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <div className="flex items-center gap-1">
      <div
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className="cursor-help"
      >
        {item.icon ? (
          <img src={item.icon} alt={item.label} width={22} height={22} className="opacity-85" />
        ) : (
          <span className="text-sm text-gray-400">👾</span>
        )}
      </div>
      <span className="text-xs text-gray-200 font-semibold">{count}</span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3.5 py-2.5 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
            <p className="text-sm text-white font-semibold">{item.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{count}x alındı</p>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

function ObjectiveGroup({ obj }) {
  if (!obj || Object.keys(obj).length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      {OBJECTIVES.map((it) => {
        const val = obj[it.key];
        if (!val || val.kills === 0) return null;
        return <ObjectiveIcon key={it.key} item={it} count={val.kills} />;
      })}
    </div>
  );
}

/* ===== BAN İKONLARI — büyütülmüş ===== */
function BanGroup({ bans }) {
  if (!bans || bans.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 mr-0.5">Bans:</span>
      {bans.map((b, i) => (
        b.image ? (
          <img key={i} src={b.image} alt="" width={26} height={26} className="rounded opacity-65" />
        ) : (
          <div key={i} className="w-[26px] h-[26px] rounded bg-[#1b2230]" />
        )
      ))}
    </div>
  );
}

/* ===== LANE VERDICT BADGE — belirgin ===== */
function LaneVerdictBadge({ analysis }) {
  if (!analysis) {
    return <div className="w-[96px] flex items-center justify-center bg-[#0d1117]/30" />;
  }

  const { verdict, highlights, factors } = analysis;

  const verdictConfig = {
    blue_dominant: { color: "text-blue-300",  bg: "bg-blue-500/15", border: "border-blue-500/25", icon: "◀◀", label: "Baskın" },
    blue_ahead:    { color: "text-blue-400",  bg: "bg-blue-500/8",  border: "border-blue-500/15", icon: "◀",  label: "Önde" },
    even:          { color: "text-gray-400",  bg: "bg-[#0d1117]/30",border: "border-[#1b2230]/20",icon: "=",  label: "Dengeli" },
    red_ahead:     { color: "text-red-400",   bg: "bg-red-500/8",   border: "border-red-500/15",  icon: "▶",  label: "Önde" },
    red_dominant:  { color: "text-red-300",   bg: "bg-red-500/15",  border: "border-red-500/25",  icon: "▶▶", label: "Baskın" },
  };

  const cfg = verdictConfig[verdict] || verdictConfig.even;

  return (
    <div className={`w-[96px] flex flex-col items-center justify-center ${cfg.bg} border-x ${cfg.border} py-2`}>
      <span className={`text-sm font-bold ${cfg.color}`}>{cfg.icon}</span>
      <span className={`text-[11px] ${cfg.color} mt-0.5 font-bold`}>{cfg.label}</span>
      {highlights.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {highlights.slice(0, 3).map((h, i) => (
            <p key={i} className={`text-[9px] text-center leading-snug font-semibold ${cfg.color}`}>{h}</p>
          ))}
        </div>
      )}
      {factors && factors.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-[#1b2230]/40 w-full space-y-0.5 px-1">
          {factors.slice(0, 3).map((f, i) => (
            <p key={i} className={`text-[9px] text-center leading-snug ${f.value > 0 ? "text-blue-400" : "text-red-400"}`}>
              {f.metric}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== SOL OYUNCU (MAVİ — normal layout) ===== */
function PlayerRowLeft({ p, maxDmg, maxDmgTaken }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const dmgTakenPct = ((p.damageTaken || 0) / maxDmgTaken) * 100;
  const rank = formatRank(p.tier, p.rankDivision);
  const multiKill = getMultiKill(p);

  return (
    <div className="px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-2">
        {/* Şampiyon + Spells + Runes — büyütülmüş */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={p.champion.image} alt="" width={42} height={42} className="rounded-lg" />
              <span className="absolute -bottom-0.5 -right-0.5 bg-[#0d1117] text-[8px] text-gray-300 font-bold px-0.5 rounded">{p.champLevel}</span>
            </div>
            <div className="flex gap-0.5">
              {p.spells[0] && <HoverImg src={p.spells[0].image} size={18} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[0].name}</p>} />}
              {p.spells[1] && <HoverImg src={p.spells[1].image} size={18} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[1].name}</p>} />}
            </div>
          </div>
          <RuneTooltip runes={p.runes} keystoneSize={22} subTreeSize={16} />
        </div>

        {/* İsim + Rank */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-gray-100 font-medium truncate">{p.summonerName}<span className="text-gray-600 text-[10px] ml-0.5">#{p.tagLine}</span></p>
          <div className="flex items-center gap-1">
            {p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={16} height={16} />}
            <span className="text-[10px] text-gray-500">{rank}</span>
          </div>
        </div>

        {/* KDA — daha merkezi */}
        <div className="text-center flex-shrink-0 w-24">
          <p className="text-[15px] font-semibold">
            <span className="text-emerald-400">{p.kills}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-yellow-500/80">{p.assists}</span>
          </p>
          <p className={`text-[10px] font-bold ${getKdaColor(p.kda)}`}>
            {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(2)}:1`}
          </p>
          {multiKill && <MultiKillBadge type={multiKill} />}
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {p.items.map((item, i) => <ItemTooltip key={i} item={item} size={26} />)}
        </div>
      </div>

      {/* Alt satır */}
      <StatsRow p={p} dmgPct={dmgPct} dmgTakenPct={dmgTakenPct} />
    </div>
  );
}

/* ===== SAĞ OYUNCU (KIRMIZI — ayna layout, sola yakın) ===== */
function PlayerRowRight({ p, maxDmg, maxDmgTaken }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const dmgTakenPct = ((p.damageTaken || 0) / maxDmgTaken) * 100;
  const rank = formatRank(p.tier, p.rankDivision);
  const multiKill = getMultiKill(p);

  return (
    <div className="pl-2 pr-3 py-2.5 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-2 flex-row-reverse">
        {/* Şampiyon + Spells + Runes (sağda) — büyütülmüş */}
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-row-reverse">
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={p.champion.image} alt="" width={42} height={42} className="rounded-lg" />
              <span className="absolute -bottom-0.5 -left-0.5 bg-[#0d1117] text-[8px] text-gray-300 font-bold px-0.5 rounded">{p.champLevel}</span>
            </div>
            <div className="flex gap-0.5">
              {p.spells[0] && <HoverImg src={p.spells[0].image} size={18} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[0].name}</p>} />}
              {p.spells[1] && <HoverImg src={p.spells[1].image} size={18} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[1].name}</p>} />}
            </div>
          </div>
          <RuneTooltip runes={p.runes} keystoneSize={22} subTreeSize={16} />
        </div>

        {/* İsim + Rank (sağa hizalı) */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[13px] text-gray-100 font-medium truncate"><span className="text-gray-600 text-[10px] mr-0.5">#{p.tagLine}</span>{p.summonerName}</p>
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[10px] text-gray-500">{rank}</span>
            {p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={16} height={16} />}
          </div>
        </div>

        {/* KDA — daha merkezi */}
        <div className="text-center flex-shrink-0 w-24">
          <p className="text-[15px] font-semibold">
            <span className="text-emerald-400">{p.kills}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-yellow-500/80">{p.assists}</span>
          </p>
          <p className={`text-[10px] font-bold ${getKdaColor(p.kda)}`}>
            {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(2)}:1`}
          </p>
          {multiKill && <MultiKillBadge type={multiKill} />}
        </div>

        {/* Items (solda) */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {p.items.map((item, i) => <ItemTooltip key={i} item={item} size={26} />)}
        </div>
      </div>

      {/* Alt satır (sağa hizalı) */}
      <StatsRow p={p} dmgPct={dmgPct} dmgTakenPct={dmgTakenPct} mirrored />
    </div>
  );
}

/* ===== ALT STAT SATIRI ===== */
function StatsRow({ p, dmgPct, dmgTakenPct, mirrored }) {
  const visionEl = (
    <div className="flex items-center gap-1">
      <svg width="12" height="12" viewBox="0 0 16 16" className="text-yellow-600 flex-shrink-0">
        <path fill="currentColor" d="M8 2C4.5 2 1.5 5 0 8c1.5 3 4.5 6 8 6s6.5-3 8-6c-1.5-3-4.5-6-8-6zm0 9.5c-1.93 0-3.5-1.57-3.5-3.5S6.07 4.5 8 4.5s3.5 1.57 3.5 3.5S9.93 11.5 8 11.5zm0-5.5C6.9 6 6 6.9 6 8s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
      <span className="text-[10px] text-yellow-600/80 font-medium">{p.visionScore}</span>
      <span className="text-[9px] text-gray-600">({p.wardsPlaced})</span>
    </div>
  );

  const dmgBars = (
    <div className="flex-1 min-w-[80px]">
      <div className={`flex items-center gap-1 ${mirrored ? "flex-row-reverse" : ""}`}>
        <span className={`text-[10px] text-gray-400 w-9 ${mirrored ? "text-left" : "text-right"}`}>{fmtDmg(p.damage)}</span>
        <div className={`flex-1 h-1 bg-[#1b2230] rounded-full overflow-hidden ${mirrored ? "flex justify-end" : ""}`}>
          <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${dmgPct}%` }} />
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-0.5 ${mirrored ? "flex-row-reverse" : ""}`}>
        <span className={`text-[9px] text-gray-600 w-9 ${mirrored ? "text-left" : "text-right"}`}>{fmtDmg(p.damageTaken || 0)}</span>
        <div className={`flex-1 h-0.5 bg-[#1b2230] rounded-full overflow-hidden ${mirrored ? "flex justify-end" : ""}`}>
          <div className="h-full bg-gray-500/40 rounded-full" style={{ width: `${dmgTakenPct}%` }} />
        </div>
      </div>
    </div>
  );

  const textStats = (
    <>
      <span className="text-[10px] text-gray-500">{p.cs} CS · {p.csPerMin}/d</span>
      <span className="text-[10px] text-gray-500">{fmtGold(p.gold)} gold</span>
      <span className="text-[10px] text-gray-500">{p.killParticipation}%</span>
      {visionEl}
    </>
  );

  if (mirrored) {
    // Sağ taraf: hasar barları solda (verdict'e yakın), text statlar sağda
    return (
      <div className="flex items-center gap-3 mt-1.5 pr-[48px]">
        {dmgBars}
        {textStats}
      </div>
    );
  }

  // Sol taraf: text statlar solda, hasar barları sağda (verdict'e yakın)
  return (
    <div className="flex items-center gap-3 mt-1.5 pl-[58px]">
      {textStats}
      {dmgBars}
    </div>
  );
}

/* ===== MULTI-KILL ===== */
function getMultiKill(p) {
  if (p.pentaKills > 0) return "PENTA";
  if (p.quadraKills > 0) return "QUADRA";
  if (p.tripleKills > 0) return "TRIPLE";
  return null;
}

function MultiKillBadge({ type }) {
  const colors = {
    PENTA: "bg-red-500/20 text-red-400",
    QUADRA: "bg-purple-500/20 text-purple-400",
    TRIPLE: "bg-yellow-500/20 text-yellow-400",
  };
  return <span className={`text-[8px] px-1.5 py-px rounded-full font-bold ${colors[type]}`}>{type}</span>;
}
