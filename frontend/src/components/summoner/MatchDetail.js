"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import ReactDOM from "react-dom";

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

/* ===== Portal Tooltip ===== */
function Tooltip({ anchorEl, children }) {
  if (!anchorEl || typeof window === "undefined") return null;
  const rect = anchorEl.getBoundingClientRect();
  return ReactDOM.createPortal(
    <div className="fixed z-[9999] pointer-events-none"
      style={{ top: `${rect.top - 8}px`, left: `${rect.left + rect.width / 2}px`, transform: "translate(-50%, -100%)" }}>
      {children}
    </div>, document.body
  );
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

function ItemIcon({ item, size = 30 }) {
  const [a, setA] = useState(null);
  if (!item) return <div style={{ width: size, height: size }} className="rounded bg-[#1b2230]" />;
  return (
    <>
      <img src={item.image} alt={item.name} width={size} height={size} className="rounded cursor-pointer"
        onMouseEnter={(e) => setA(e.currentTarget)} onMouseLeave={() => setA(null)} />
      {a && (
        <Tooltip anchorEl={a}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-white">{item.name}</p>
              {item.gold > 0 && <span className="text-[11px] text-yellow-500 font-mono">{item.gold}g</span>}
            </div>
            {item.desc?.stats?.length > 0 && (
              <div className="mb-1.5">{item.desc.stats.map((s, j) => <p key={j} className="text-[11px] text-blue-300">{s}</p>)}</div>
            )}
            {item.desc?.passives?.length > 0 && (
              <div className="space-y-1 border-t border-[#1b2230] pt-1.5">
                {item.desc.passives.map((p, j) => (
                  <div key={j}><p className="text-[11px] font-semibold text-yellow-400">{p.name}</p><p className="text-[10px] text-gray-400">{p.desc}</p></div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

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

  return (
    <div className="space-y-3">
      {/* ===== HEADER ===== */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Üst bar */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1b2230]/50">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={16} /> Geri Dön
          </button>
          <div className="text-center">
            <p className="text-sm text-gray-300 font-medium">{data.queueType}</p>
            <p className="text-xs text-gray-500">{fmtDur(data.duration)}</p>
          </div>
          <div className="w-20" />
        </div>

        {/* Skor karşılaştırma */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Sol takım */}
            <div className="flex-1 text-left">
              <span className={`text-lg font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t1?.info?.win ? "Zafer" : "Yenilgi"}
              </span>
              <span className="text-sm text-gray-400 ml-2">
                {t1?.info?.totalKills} / {t1?.players?.reduce((s, p) => s + p.deaths, 0)} / {t1?.players?.reduce((s, p) => s + p.assists, 0)}
              </span>
            </div>

            {/* Kill bar */}
            <div className="w-48">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-400 font-bold">{t1?.info?.totalKills}</span>
                <span className="text-[10px] text-gray-600">Total Kill</span>
                <span className="text-xs text-red-400 font-bold">{t2?.info?.totalKills}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: `${(t1?.info?.totalKills || 0) / Math.max((t1?.info?.totalKills || 0) + (t2?.info?.totalKills || 0), 1) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(t2?.info?.totalKills || 0) / Math.max((t1?.info?.totalKills || 0) + (t2?.info?.totalKills || 0), 1) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-500">{fmtGold(t1?.info?.totalGold || 0)} gold</span>
                <span className="text-[10px] text-gray-600">Total Gold</span>
                <span className="text-[10px] text-gray-500">{fmtGold(t2?.info?.totalGold || 0)} gold</span>
              </div>
            </div>

            {/* Sağ takım */}
            <div className="flex-1 text-right">
              <span className="text-sm text-gray-400 mr-2">
                {t2?.info?.totalKills} / {t2?.players?.reduce((s, p) => s + p.deaths, 0)} / {t2?.players?.reduce((s, p) => s + p.assists, 0)}
              </span>
              <span className={`text-lg font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t2?.info?.win ? "Zafer" : "Yenilgi"}
              </span>
            </div>
          </div>
        </div>

        {/* Objectives + Bans */}
        <div className="px-4 pb-3 flex items-center justify-between border-t border-[#1b2230]/30 pt-2">
          {/* Sol objectives */}
          <div className="flex items-center gap-3">
            <ObjectiveGroup obj={obj1} />
            <BanGroup bans={t1?.info?.bans} />
          </div>
          {/* Sağ objectives */}
          <div className="flex items-center gap-3">
            <BanGroup bans={t2?.info?.bans} />
            <ObjectiveGroup obj={obj2} />
          </div>
        </div>
      </div>

      {/* ===== İKİ TAKIM YAN YANA ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TeamPanel team={t1} color="blue" />
        <TeamPanel team={t2} color="red" />
      </div>
    </div>
  );
}

/* ===== OBJECTIVE İKONLARI ===== */
function ObjectiveGroup({ obj }) {
  if (!obj || Object.keys(obj).length === 0) return null;
  const items = [
    { key: "baron", label: "Baron", emoji: "🟣" },
    { key: "dragon", label: "Dragon", emoji: "🐉" },
    { key: "tower", label: "Kule", emoji: "🏰" },
    { key: "inhibitor", label: "İnhibitör", emoji: "💎" },
    { key: "riftHerald", label: "Alamet", emoji: "👁" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it) => {
        const val = obj[it.key];
        if (!val || val.kills === 0) return null;
        return (
          <div key={it.key} className="flex items-center gap-0.5" title={it.label}>
            <span className="text-xs">{it.emoji}</span>
            <span className="text-[11px] text-gray-300 font-medium">{val.kills}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ===== BAN İKONLARI ===== */
function BanGroup({ bans }) {
  if (!bans || bans.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[9px] text-gray-600 mr-1">Bans:</span>
      {bans.map((b, i) => (
        b.image ? (
          <img key={i} src={b.image} alt="" width={20} height={20} className="rounded-sm opacity-60" />
        ) : (
          <div key={i} className="w-5 h-5 rounded-sm bg-[#1b2230]" />
        )
      ))}
    </div>
  );
}

/* ===== TAKIM PANELİ ===== */
function TeamPanel({ team, color }) {
  if (!team) return null;
  const isWin = team.info?.win;
  const border = isWin ? "border-emerald-500/30" : "border-red-500/30";
  const headerBg = color === "blue" ? "bg-blue-500/5" : "bg-red-500/5";
  const label = `${isWin ? "Zafer" : "Yenilgi"} (${color === "blue" ? "Mavi" : "Kırmızı"} Takım)`;

  const allDmg = team.players.map(p => p.damage);
  const maxDmg = Math.max(...allDmg, 1);

  return (
    <div className={`glass rounded-xl border ${border} overflow-hidden`}>
      <div className={`px-4 py-2.5 ${headerBg} flex items-center justify-between`}>
        <span className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>{label}</span>
        <span className="text-[10px] text-gray-500">{fmtGold(team.info?.totalGold || 0)} gold</span>
      </div>

      <div className="divide-y divide-[#1b2230]/20">
        {team.players.map((p) => (
          <PlayerRow key={p.puuid} p={p} maxDmg={maxDmg} />
        ))}
      </div>
    </div>
  );
}

/* ===== OYUNCU SATIRI ===== */
function PlayerRow({ p, maxDmg }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const rank = formatRank(p.tier, p.rankDivision);

  return (
    <div className="px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
      {/* Üst satır: Şampiyon + İsim + KDA + Items */}
      <div className="flex items-center gap-2">
        {/* Şampiyon + Spells + Runes */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={p.champion.image} alt="" width={36} height={36} className="rounded-lg" />
              <span className="absolute -bottom-0.5 -right-0.5 bg-[#0d1117] text-[8px] text-gray-300 font-bold px-0.5 rounded">{p.champLevel}</span>
            </div>
            <div className="flex gap-0.5">
              {p.spells[0] && <HoverImg src={p.spells[0].image} size={14} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[0].name}</p>} />}
              {p.spells[1] && <HoverImg src={p.spells[1].image} size={14} className="rounded-sm" tooltip={<p className="text-[11px] text-white">{p.spells[1].name}</p>} />}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            {p.runes?.keystone?.icon && <HoverImg src={p.runes.keystone.icon} size={18} className="rounded-full" tooltip={<p className="text-[11px] text-white">{p.runes.keystone.name}</p>} />}
            {p.runes?.subTree?.icon && <img src={p.runes.subTree.icon} alt="" width={14} height={14} className="rounded-full opacity-60" />}
          </div>
        </div>

        {/* İsim + Rank */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-100 font-medium truncate">{p.summonerName}<span className="text-gray-600 text-[10px] ml-0.5">#{p.tagLine}</span></p>
          <div className="flex items-center gap-1">
            {p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={14} height={14} />}
            <span className="text-[10px] text-gray-500">{rank}</span>
          </div>
        </div>

        {/* KDA */}
        <div className="text-center flex-shrink-0 w-20">
          <p className="text-sm">
            <span className="text-emerald-400">{p.kills}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-yellow-500/80">{p.assists}</span>
          </p>
          <p className={`text-[10px] font-bold ${getKdaColor(p.kda)}`}>
            {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(2)}:1`}
          </p>
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {p.items.map((item, i) => <ItemIcon key={i} item={item} size={26} />)}
        </div>
      </div>

      {/* Alt satır: Stats */}
      <div className="flex items-center gap-4 mt-1.5 pl-[52px]">
        <span className="text-[10px] text-gray-500">{p.cs} CS · {p.csPerMin}/d</span>
        <span className="text-[10px] text-gray-500">{fmtGold(p.gold)} gold</span>
        <span className="text-[10px] text-gray-500">{p.killParticipation}% Kills P.</span>
        <span className="text-[10px] text-gray-500">Vision: {p.visionScore}</span>
        {/* Hasar barı */}
        <div className="flex items-center gap-1 flex-1">
          <span className="text-[10px] text-gray-400">{fmtDmg(p.damage)}</span>
          <div className="flex-1 h-1 bg-[#1b2230] rounded-full overflow-hidden">
            <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${dmgPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
