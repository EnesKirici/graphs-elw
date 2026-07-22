"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, PieChart, Gem } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";
import { scoreColor } from "./scoreColor";
import MatchDetailsTab from "./MatchDetailsTab";

const DETAIL_TABS = [
  { key: "general", label: "Genel", icon: LayoutGrid },
  { key: "details", label: "Detaylar", icon: PieChart },
  { key: "runes", label: "Rünler", icon: Gem },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + "k" : g; }
function fmtDmg(d) { return d >= 1000 ? (d / 1000).toFixed(1) + "k" : d; }
function fmtDur(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

function formatRank(tier, div, lp) {
  if (!tier) return "";
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  // Master+ tek bölüm → LP göster ("Master 302 LP"). Altı → bölüm yeter ("Diamond II").
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier)) {
    return lp != null ? `${name} ${lp} LP` : name;
  }
  return `${name} ${div || ""}`.trim();
}
function rankBadgeUrl(tier) { return tier ? `/ranks/badges/${tier.toLowerCase()}.webp` : null; }
// Rank etiketi — rozetin yanına: Master+ → yalnız LP ("302 LP"); Diamond ve altı → tam ad + bölüm ("Diamond II").
function rankShort(tier, div, lp) {
  if (!tier) return "";
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier)) return lp != null ? `${lp} LP` : name;
  return `${name} ${div || ""}`.trim();
}
function kdaColor(k) {
  if (k === "Perfect" || k >= 4) return "text-sky-300";
  if (k >= 2.5) return "text-blue-400";
  if (k >= 1.5) return "text-gray-300";
  return "text-red-400";
}

function PlayerRow({ p, isMe, maxDmg, isMvp, isAce }) {
  const rank = formatRank(p.tier, p.rankDivision, p.leaguePoints);
  const sc = p.elwScore;
  const dmgPct = maxDmg > 0 ? ((p.damage || 0) / maxDmg) * 100 : 0;
  const mk = p.pentaKills > 0 ? "PENTA" : p.quadraKills > 0 ? "QUADRA" : p.tripleKills > 0 ? "TRIPLE" : null;
  const scGlow = isMvp || isAce || (sc != null && sc >= 9);
  const rowHL = isMvp ? "shadow-[inset_3px_0_0_0_#fbbf24aa]" : isAce ? "shadow-[inset_3px_0_0_0_#22d3eeaa]" : "";
  const badgeLabel = isMvp ? "MVP" : isAce ? "ACE" : p.matchRank;
  const badgeCls = isMvp ? "text-amber-400" : isAce ? "text-cyan-300" : p.matchRank <= 3 ? "text-blue-400" : p.matchRank >= 8 ? "text-red-400" : "text-gray-500";

  const kdaEl = (
    <>
      {p.kills}<span className="text-gray-600">/</span><span className="text-red-400">{p.deaths}</span><span className="text-gray-600">/</span>{p.assists}
    </>
  );
  const csEl = p.role === "UTILITY"
    ? `${(p.challenges?.visionScorePerMin ?? 0).toFixed(1)} vizyon`
    : `${p.csPerMin} cs/dk`;

  return (
    <>
      {/* ── MOBİL (<640): 2-satır kompakt — sabit kolonlar 366px'e sığmıyordu (rank/KDA çakışıyordu).
          Sol: sıra+şampiyon · orta: isim/rank + KDA·CS·KP (dikey) · sağ: eşyalar 4+3 grid + ELW. */}
      <div className={`sm:hidden flex items-center gap-2 px-2.5 py-2 ${isMe ? "bg-cyan-500/[0.07]" : ""} ${rowHL} hover:bg-hover transition-colors`}>
        <span className={`w-4 text-center text-[10px] font-bold flex-shrink-0 ${badgeCls}`}>{badgeLabel}</span>
        <div className="relative flex-shrink-0">
          <img src={p.champion.image} alt="" width={34} height={34} className="rounded-md" />
          <span className="absolute -bottom-1 -right-1 text-[8px] bg-card text-gray-300 px-0.5 rounded border border-edge font-mono">{p.champLevel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 leading-tight">
            {p.tier && <img src={rankBadgeUrl(p.tier)} alt="" title={rank} width={15} height={15} className="flex-shrink-0" />}
            <p className={`text-[12px] truncate ${p.isBot ? "text-gray-500 italic" : isMe ? "text-cyan-300 font-semibold" : "text-gray-100"}`}>
              {p.summonerName}
            </p>
          </div>
          {/* KP mobilde çıkarıldı (dar satırda kesiliyordu; KP Detaylar sekmesinde var) */}
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
            <span className="text-gray-200 font-medium">{kdaEl}</span>
            <span className="text-gray-600"> · </span>{csEl}
          </p>
        </div>
        {/* eşyalar 4+3 grid (kompakt, yatay yer yarıya iner) */}
        <div className="grid grid-cols-4 gap-[2px] flex-shrink-0">
          {(p.items || []).slice(0, 7).map((item, i) => <ItemTooltip key={i} item={item} size={18} />)}
        </div>
        <span className="w-8 text-right text-[15px] font-extrabold flex-shrink-0 tabular-nums"
          style={{ color: scoreColor(sc), textShadow: scGlow ? `0 0 9px ${scoreColor(sc)}` : undefined }}>
          {sc != null ? sc.toFixed(1) : "—"}
        </span>
      </div>

      {/* ── MASAÜSTÜ (sm+): tek satır — mevcut düzen ── */}
      <div className={`hidden sm:flex items-center gap-2.5 px-5 py-2.5 ${isMe ? "bg-cyan-500/[0.07]" : ""} ${rowHL} hover:bg-hover transition-colors`}>
        {/* Sıra / MVP / ACE */}
        <span className={`w-8 text-center text-[11px] font-bold flex-shrink-0 ${badgeCls}`}>
          {badgeLabel}
        </span>

        {/* Şampiyon + lvl */}
        <div className="relative flex-shrink-0">
          <img src={p.champion.image} alt="" width={40} height={40} className="rounded-md" />
          <span className="absolute -bottom-1 -right-1 text-[9px] bg-card text-gray-300 px-0.5 rounded border border-edge font-mono">{p.champLevel}</span>
        </div>

        {/* Spell + Rune */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          {p.spells?.[0]?.image && <img src={p.spells[0].image} alt="" width={19} height={19} className="rounded-sm" title={p.spells[0].name} />}
          {p.spells?.[1]?.image && <img src={p.spells[1].image} alt="" width={19} height={19} className="rounded-sm" title={p.spells[1].name} />}
        </div>
        <div className="flex-shrink-0">
          <RuneTooltip runes={p.runes} keystoneSize={21} subTreeSize={15} />
        </div>

        {/* İsim + rank — küçülebilir (flex-shrink yok = satır taşmasını bu emer, skor kırpılmaz) */}
        <div className="w-[122px] min-w-0">
          <p className={`text-[13px] truncate leading-tight ${p.isBot ? "text-gray-500 italic" : isMe ? "text-cyan-300 font-semibold" : "text-gray-100"}`}>
            {p.summonerName}
          </p>
          <div className="flex items-center gap-1.5 leading-tight mt-0.5">
            {p.tier ? (
              <>
                <img src={rankBadgeUrl(p.tier)} alt={p.tier} title={rank} width={22} height={22} className="flex-shrink-0" />
                <span className="text-[11px] text-gray-300 font-semibold whitespace-nowrap">
                  {p.isBot ? "BOT" : rankShort(p.tier, p.rankDivision, p.leaguePoints)}
                </span>
              </>
            ) : (
              <span className="text-[11px] text-gray-500">{p.isBot ? "BOT" : "—"}</span>
            )}
          </div>
        </div>

        {/* KDA */}
        <div className="w-[70px] text-center flex-shrink-0">
          <p className="text-[13px] text-gray-100 leading-tight">{kdaEl}</p>
          <p className={`text-[11px] font-semibold leading-tight ${kdaColor(p.kda)}`}>
            {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(1)}`}
            {mk && <span className="ml-1 text-[9px] font-bold text-amber-400">{{ TRIPLE: "Triple Kill", QUADRA: "Quadra Kill", PENTA: "Penta Kill" }[mk]}</span>}
          </p>
        </div>

        {/* CS / KP — destek rolünde CS yerine vizyon */}
        <div className="w-[64px] text-center text-[11px] text-gray-400 flex-shrink-0 leading-tight">
          <p>{csEl}</p>
          <p>{p.killParticipation}% KP</p>
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(p.items || []).slice(0, 7).map((item, i) => <ItemTooltip key={i} item={item} size={26} />)}
        </div>

        {/* Hasar barı */}
        <div className="flex-1 min-w-[40px] hidden lg:block">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-red-400/80 font-mono w-10 text-right">{fmtDmg(p.damage)}</span>
            <div className="flex-1 h-2 bg-edge rounded-full overflow-hidden">
              <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${dmgPct}%` }} />
            </div>
          </div>
        </div>

        {/* ELW */}
        <span className="w-12 pr-0.5 text-right text-[16px] font-extrabold flex-shrink-0 tabular-nums"
          style={{ color: scoreColor(sc), textShadow: scGlow ? `0 0 9px ${scoreColor(sc)}` : undefined }}>
          {sc != null ? sc.toFixed(1) : "—"}
        </span>
      </div>
    </>
  );
}

function TeamBlock({ team, searchedPuuid, maxDmg, mvpPuuid, acePuuid }) {
  const isWin = team?.info?.win;
  const deaths = team?.players?.reduce((s, p) => s + p.deaths, 0) || 0;
  const assists = team?.players?.reduce((s, p) => s + p.assists, 0) || 0;
  return (
    <div className={`rounded-lg overflow-hidden border ${isWin ? "border-blue-500/25" : "border-red-500/25"}`}>
      <div className={`px-3 sm:px-5 py-2 flex items-center justify-between ${isWin ? "bg-blue-500/10" : "bg-red-500/10"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-bold ${isWin ? "text-blue-400" : "text-red-400"}`}>{isWin ? "Zafer" : "Yenilgi"}</span>
          <span className="text-[11px] text-gray-500">{team?.info?.totalKills}/{deaths}/{assists}</span>
        </div>
        <span className="text-[11px] text-gray-500">{fmtGold(team?.info?.totalGold || 0)} gold</span>
      </div>
      <div className="divide-y divide-edge/15">
        {team?.players?.map((p, i) => <PlayerRow key={p.puuid + i} p={p} isMe={p.puuid === searchedPuuid} maxDmg={maxDmg} isMvp={p.puuid === mvpPuuid} isAce={p.puuid === acePuuid} />)}
      </div>
    </div>
  );
}

/*
  Pro accordion maç detayı — sıfırdan, dar merkez kolona sığacak kompakt yerleşim.
  Eski MatchDetail'in 2-kolon aynalı düzeni dar alanda bozuluyordu; bu sürüm
  takım-bazlı tek-kolon (op.gg tarzı) satırlarla temiz durur.
*/
// Açılan maç detaylarını bellekte tut — kart kapatılıp tekrar açılınca yeniden fetch
// etmesin (accordion kapanınca component unmount oluyor). matchId → maç detayı verisi.
const detailCache = new Map();

export default function MatchDetailPro({ matchId, puuid }) {
  const [data, setData] = useState(() => detailCache.get(matchId) ?? null);
  const [loading, setLoading] = useState(() => !detailCache.has(matchId));
  const [tab, setTab] = useState("general");

  useEffect(() => {
    // Daha önce yüklendiyse cache'ten ver, ağ isteği yapma
    if (detailCache.has(matchId)) {
      setData(detailCache.get(matchId));
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}`);
        const d = await res.json();
        detailCache.set(matchId, d);
        if (active) setData(d);
      } catch {
        if (active) setData(null);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [matchId]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-[11px] text-gray-500">Maç detayı yükleniyor...</p>
      </div>
    );
  }
  if (!data || data.error || !data.teams) {
    return <p className="py-6 text-center text-[11px] text-red-400">Maç detayı yüklenemedi.</p>;
  }

  const swapped = !!puuid && data.teams[1]?.players?.some((p) => p.puuid === puuid);
  const t1 = swapped ? data.teams[1] : data.teams[0];
  const t2 = swapped ? data.teams[0] : data.teams[1];
  const allP = [...(t1?.players || []), ...(t2?.players || [])];
  const maxDmg = Math.max(...allP.map((p) => p.damage || 0), 1);

  // MVP = kazanan takımın en iyisi, ACE = kaybeden takımın en iyisi (op.gg gibi)
  const bestOf = (t) => (t?.players?.length ? t.players.reduce((b, p) => (p.matchRank < b.matchRank ? p : b)) : null);
  const winT = data.teams.find((t) => t?.info?.win);
  const loseT = data.teams.find((t) => t && !t.info?.win);
  const mvpPuuid = bestOf(winT)?.puuid;
  const acePuuid = bestOf(loseT)?.puuid;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-gray-400 font-medium">{data.queueType}</span>
        <span className="text-[10px] text-gray-600">{fmtDur(data.duration)}</span>
      </div>

      {/* Sekme çubuğu — Genel / Detaylar / Rünler */}
      <div className="flex items-center gap-1 rounded-lg bg-card/40 border border-edge/40 p-0.5">
        {DETAIL_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                active ? "bg-soft text-gray-100 shadow-sm" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon size={13} className={active ? "text-[var(--dpm-accent,#60a5fa)]" : ""} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* GENEL — mevcut takım tabloları */}
      {tab === "general" && (
        <>
          <TeamBlock team={t1} searchedPuuid={puuid} maxDmg={maxDmg} mvpPuuid={mvpPuuid} acePuuid={acePuuid} />
          <TeamBlock team={t2} searchedPuuid={puuid} maxDmg={maxDmg} mvpPuuid={mvpPuuid} acePuuid={acePuuid} />
        </>
      )}

      {/* DETAYLAR — tek oyuncu odaklı (skill/build order, kıyas, rozetler) */}
      {tab === "details" && (
        <MatchDetailsTab t1={t1} t2={t2} searchedPuuid={puuid} duration={data.duration} />
      )}

      {/* RÜNLER — oyuncu başına rün sayfası */}
      {tab === "runes" && <RunesTab t1={t1} t2={t2} searchedPuuid={puuid} />}
    </div>
  );
}

/* ===== Rünler sekmesi — her oyuncunun tam rün sayfası satırda açık (hover gerekmez) ===== */
// Eski cache'lerde statShards düz string; yeni backend {name, icon} objesi gönderiyor.
const shardName = (s) => (typeof s === "string" ? s : s?.name || "");
const shardIcon = (s) => (typeof s === "object" && s ? s.icon : null);

function RuneIcon({ rune, size = 26, ring = false, dim = false }) {
  if (!rune?.icon) {
    return <span style={{ width: size, height: size }} className="rounded-full bg-edge/40 flex-shrink-0" />;
  }
  return (
    <img
      src={rune.icon}
      alt={rune.name}
      title={rune.name}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 ${ring ? "ring-2 ring-amber-400/60 bg-black/40" : ""} ${dim ? "opacity-70" : ""}`}
    />
  );
}

// Stat parçası — mini rün: koyu daire içinde DDragon StatMods ikonu, isim tooltip'te
function ShardIcon({ shard, size = 24 }) {
  const icon = shardIcon(shard);
  const name = shardName(shard);
  if (!icon) {
    return <span title={name} style={{ width: size, height: size }} className="rounded-full bg-edge/40 flex-shrink-0" />;
  }
  return (
    <span
      title={name}
      style={{ width: size, height: size }}
      className="rounded-full bg-soft ring-1 ring-edge/70 flex items-center justify-center flex-shrink-0"
    >
      <img src={icon} alt={name} width={size - 8} height={size - 8} />
    </span>
  );
}

function RuneRow({ p, isMe }) {
  const r = p.runes || {};
  // primaryPerks[0] = keystone (backend tüm seçimleri sırayla gönderiyor)
  const keystone = r.primaryPerks?.[0] ?? r.keystone;
  const primaryMinors = r.primaryPerks?.slice(1) || [];
  const hasRunes = keystone?.icon || r.secondaryPerks?.length;

  return (
    <div className={`flex items-center gap-2.5 sm:gap-4 px-2.5 sm:px-4 py-2.5 ${isMe ? "bg-cyan-500/[0.07]" : ""} hover:bg-hover transition-colors`}>
      {/* Şampiyon + isim */}
      <div className="flex items-center gap-2 w-[120px] sm:w-[160px] min-w-0 flex-shrink-0">
        <img src={p.champion?.image} alt="" width={34} height={34} className="rounded-md flex-shrink-0" />
        <span className={`text-[13px] truncate ${p.isBot ? "text-gray-500 italic" : isMe ? "text-cyan-300 font-semibold" : "text-gray-200"}`}>
          {p.summonerName}
        </span>
      </div>

      {!hasRunes ? (
        <span className="text-[11px] text-gray-600">Rün verisi yok</span>
      ) : (
        <>
          {/* Ana ağaç: ağaç ikonu + keystone (vurgulu) + 3 rün */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <RuneIcon rune={r.primaryTree} size={16} dim />
            <RuneIcon rune={keystone} size={38} ring />
            {primaryMinors.map((perk, i) => <RuneIcon key={i} rune={perk} />)}
          </div>

          <span className="h-8 border-l border-edge/40 hidden sm:block" />

          {/* Yan ağaç: ağaç ikonu + 2 rün */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <RuneIcon rune={r.subTree} size={16} dim />
            {(r.secondaryPerks || []).map((perk, i) => <RuneIcon key={i} rune={perk} />)}
          </div>

          <span className="h-8 border-l border-edge/40 hidden sm:block" />

          {/* Stat parçaları — gerçek shard ikonları (mini rün) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(r.statShards || []).map((s, i) => <ShardIcon key={i} shard={s} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RunesTab({ t1, t2, searchedPuuid }) {
  const Block = ({ team }) => (
    <div className={`rounded-lg overflow-hidden border ${team?.info?.win ? "border-blue-500/25" : "border-red-500/25"}`}>
      <div className={`px-3 sm:px-4 py-1.5 text-[12px] font-bold ${team?.info?.win ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
        {team?.info?.win ? "Zafer" : "Yenilgi"}
      </div>
      <div className="divide-y divide-edge/15">
        {team?.players?.map((p, i) => <RuneRow key={p.puuid + i} p={p} isMe={p.puuid === searchedPuuid} />)}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <Block team={t1} />
      <Block team={t2} />
    </div>
  );
}
