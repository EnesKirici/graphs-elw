"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Eye, Swords, Shield, Info, User, Users } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDur(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + "k" : g; }
function fmtDmg(d) { return d >= 1000 ? (d / 1000).toFixed(1) + "k" : d; }
function fmtTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function kdaColor(kda) {
  // Site geneli ile tutarlı: iyi yeşil, orta nötr gri, kötü kırmızı (mavi/altın yok).
  if (kda === "Perfect" || kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-gray-300";
  return "text-red-400";
}
function rankBadgeUrl(tier) { return tier ? `/ranks/badges/${tier.toLowerCase()}.webp` : null; }
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
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
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

function flipVerdict(verdict) {
  if (!verdict) return verdict;
  if (verdict.startsWith("blue_")) return verdict.replace("blue_", "red_");
  if (verdict.startsWith("red_")) return verdict.replace("red_", "blue_");
  return verdict;
}

const ROLES_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const OBJECTIVES = [
  { key: "baron", label: "Baron", icon: "/objectives/baron.webp" },
  { key: "dragon", label: "Dragon", icon: "/objectives/dragon.webp" },
  { key: "tower", label: "Kule", icon: "/objectives/tower.webp" },
  { key: "inhibitor", label: "İnhibitör", icon: "/objectives/inhibitor.webp" },
  { key: "riftHerald", label: "Alamet", icon: "/objectives/riftHerald.webp" },
  { key: "horde", label: "Voidgrub", icon: null },
];

const TABS = [
  { key: "overview", label: "Genel Bakış" },
  { key: "damage", label: "Hasar & Alınan Hasar" },
  { key: "stats", label: "İstatistikler" },
  { key: "analysis", label: "Analiz" },
];

const SKILL_COLORS = {
  Q: "bg-blue-500 text-white",
  W: "bg-teal-500 text-white",
  E: "bg-emerald-500 text-white",
  R: "bg-amber-500 text-white",
};

/* ===== RANK BADGE ===== */
function RankBadge({ rank, size = "sm" }) {
  if (!rank) return null;
  const isMvp = rank === 1;
  const sizeClasses = size === "lg"
    ? "w-7 h-7 text-xs"
    : "w-6 h-6 text-[11px]";

  if (isMvp) {
    return (
      <span className={`mvp-glow ${sizeClasses} flex items-center justify-center rounded-lg flex-shrink-0 border border-[#c8aa6e]/60`}>
        <span className="mvp-text font-bold">{rank}</span>
      </span>
    );
  }

  const bg = rank <= 3
    ? "bg-emerald-500 text-white border-emerald-400/50 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
    : rank >= 8
    ? "bg-red-500 text-white border-red-400/50 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
    : "bg-gray-600/80 text-gray-200 border-gray-500/30";

  return (
    <span className={`${sizeClasses} font-bold flex items-center justify-center rounded-lg flex-shrink-0 border ${bg}`}>
      {rank}
    </span>
  );
}

/* ===== ANA BİLEŞEN ===== */
export default function MatchDetail({ matchId, puuid: searchedPuuid, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [selectedPuuid, setSelectedPuuid] = useState(null);
  const [damageTab, setDamageTab] = useState("dealt");
  const [scoringMode, setScoringMode] = useState(null); // null = henüz yüklenmedi, default'u data'dan al

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}`);
        setData(await res.json());
      } catch { setData(null); }
      setLoading(false);
    })();
  }, [matchId]);

  useEffect(() => {
    if (data && !selectedPuuid) {
      const allP = [...(data.teams?.[0]?.players || []), ...(data.teams?.[1]?.players || [])];
      const me = searchedPuuid ? allP.find(p => p.puuid === searchedPuuid) : allP[0];
      if (me) setSelectedPuuid(me.puuid);
    }
    if (data && scoringMode === null) {
      setScoringMode(data.defaultScoringMode || "individual");
    }
  }, [data, searchedPuuid, selectedPuuid, scoringMode]);

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

  // Takım sıralaması — aranan oyuncu her zaman sol (mavi) tarafta
  const swapped = !!searchedPuuid && data.teams[1]?.players?.some(p => p.puuid === searchedPuuid);
  const t1 = swapped ? data.teams[1] : data.teams[0];
  const t2 = swapped ? data.teams[0] : data.teams[1];
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

  // LaneAnalysis — swapped ise yönleri çevir
  const analysisMap = {};
  laneAnalysis.forEach((a) => {
    if (!swapped) {
      analysisMap[a.role] = a;
    } else {
      analysisMap[a.role] = {
        ...a,
        verdict: flipVerdict(a.verdict),
        highlights: (a.highlights || []).map(h => {
          if (h.charAt(0) === "+") return "-" + h.slice(1);
          if (h.charAt(0) === "-") return "+" + h.slice(1);
          const vs = h.match(/^(.+?): (.+?) vs (.+?)$/);
          if (vs) return `${vs[1]}: ${vs[3]} vs ${vs[2]}`;
          return h;
        }),
        score: -(a.score || 0),
      };
    }
  });

  const isTeamMode = scoringMode === "team";
  // Oyuncu verilerini aktif moda göre override et
  const applyMode = (players) => players?.map(p => ({
    ...p,
    _elwScore: isTeamMode ? (p.elwScoreTeam ?? p.elwScore) : p.elwScore,
    _matchRank: isTeamMode ? (p.matchRankTeam ?? p.matchRank) : p.matchRank,
  }));
  const allPlayersRaw = [...(t1?.players || []), ...(t2?.players || [])];
  const allPlayers = applyMode(allPlayersRaw);
  const maxDmg = Math.max(...allPlayers.map(p => p.damage), 1);
  const maxDmgTaken = Math.max(...allPlayers.map(p => p.damageTaken || 0), 1);
  const selectedPlayer = allPlayers.find(p => p.puuid === selectedPuuid);

  // bluePlayers/redPlayers'ı da mode'lu hale getir
  const bluePlayersM = applyMode(bluePlayers);
  const redPlayersM = applyMode(redPlayers);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-edge/50">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-100 transition-colors cursor-pointer">
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
      <div className="px-6 pb-5 flex items-center justify-between border-b border-edge/30 pt-1">
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
      <div className="flex border-b border-edge/30">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5" : "text-gray-500 hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SCORING MODE BAR — Bireysel / Takım Katkısı */}
      <ScoringModeBar scoringMode={scoringMode} setScoringMode={setScoringMode} />

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-[1fr_90px_1fr] border-b border-edge/30">
            <div className={`px-5 py-2.5 ${t1?.info?.win ? "bg-blue-500/8" : "bg-red-500/8"}`}>
              <span className={`text-sm font-bold ${t1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t1?.info?.win ? "Zafer" : "Yenilgi"} (Mavi)
              </span>
            </div>
            <div className="flex items-center justify-center bg-card/50 relative">
              <LaneGuideButton />
            </div>
            <div className={`px-5 py-2.5 text-right ${t2?.info?.win ? "bg-blue-500/8" : "bg-red-500/8"}`}>
              <span className={`text-sm font-bold ${t2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
                {t2?.info?.win ? "Zafer" : "Yenilgi"} (Kırmızı)
              </span>
            </div>
          </div>

          {bluePlayersM.map((bp, i) => {
            const rp = redPlayersM[i];
            const analysis = bp?.role ? analysisMap[bp.role] : null;
            return (
              <div key={bp.puuid + '-' + i} className="grid grid-cols-[1fr_90px_1fr] border-b border-edge/15 last:border-b-0">
                <PlayerRow p={bp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} side="blue" allPlayers={allPlayers} duration={data.duration} />
                <VerdictBadge analysis={analysis} />
                {rp ? <PlayerRow p={rp} maxDmg={maxDmg} maxDmgTaken={maxDmgTaken} side="red" allPlayers={allPlayers} duration={data.duration} /> : <div />}
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
              { label: "Alınan Hasar", v1: t1?.players?.reduce((s, p) => s + (p.damageTaken || 0), 0) || 0, v2: t2?.players?.reduce((s, p) => s + (p.damageTaken || 0), 0) || 0, fmt: fmtDmg },
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

          {/* Alt Tab: Verilen / Alınan Hasar */}
          <div>
            <div className="flex items-center gap-1 mb-4">
              <button onClick={() => setDamageTab("dealt")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${damageTab === "dealt" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "text-gray-500 hover:text-gray-300 border border-transparent"}`}>
                <Swords size={14} /> Verilen Hasar
              </button>
              <button onClick={() => setDamageTab("taken")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${damageTab === "taken" ? "bg-red-500/15 text-red-400 border border-red-500/30" : "text-gray-500 hover:text-gray-300 border border-transparent"}`}>
                <Shield size={14} /> Alınan Hasar
              </button>
            </div>

            <DamageDistribution
              bluePlayers={bluePlayersM}
              redPlayers={redPlayersM}
              allPlayers={allPlayers}
              maxDmg={damageTab === "dealt" ? maxDmg : maxDmgTaken}
              mode={damageTab}
            />
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {tab === "stats" && (
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">Detaylı İstatistikler</h3>
          <PlateWarSummary bluePlayers={bluePlayersM} redPlayers={redPlayersM} />
          <StatsTable bluePlayers={bluePlayersM} redPlayers={redPlayersM} allPlayers={allPlayers} />
        </div>
      )}

      {/* ANALYSIS TAB */}
      {tab === "analysis" && (
        <div className="p-6">
          <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
            {allPlayers.map((p, idx) => {
              const isBlue = t1?.players?.some(tp => tp.puuid === p.puuid);
              const isSelected = p.puuid === selectedPuuid;
              const rank = p._matchRank;
              const sc = p._elwScore ?? 5;
              const isTopRainbow = sc >= 8.5 && rank === 1;
              const isTopGlow = sc >= 8.5 && !isTopRainbow;
              const clr = isTopRainbow ? "bg-card border border-[#c8aa6e]/40" : isTopGlow ? "bg-card border border-emerald-500/40" : sc >= 5 ? "bg-emerald-500" : sc >= 3 ? "bg-gray-500" : "bg-red-500";
              return (
                <React.Fragment key={p.puuid + '-' + idx}>
                  {idx === 5 && <div className="w-4" />}
                  <button onClick={() => setSelectedPuuid(p.puuid)}
                    className={`relative rounded-xl transition-all cursor-pointer ${isSelected ? "ring-2 ring-blue-400 scale-110" : "opacity-60 hover:opacity-100"}`}>
                    <img src={p.champion.image} alt={p.champion.name} width={44} height={44} className="rounded-xl" />
                    {rank && (
                      <span className={`absolute -top-0.5 -left-0.5 text-[9px] font-bold px-1 rounded-br-lg rounded-tl-lg ${
                        rank === 1 ? "mvp-glow border-[#c8aa6e]/60" : rank <= 3 ? "bg-emerald-500/90 text-white" : rank >= 8 ? "bg-red-500/80 text-white" : "bg-gray-600/80 text-gray-200"
                      }`}>{rank === 1 ? <span className="mvp-text">{rank}</span> : rank}</span>
                    )}
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isBlue ? "bg-blue-500" : "bg-red-500"}`} />
                    <span className={`block text-[10px] font-bold mt-0.5 px-1 py-0.5 rounded-md text-center ${clr} ${!isTopRainbow && !isTopGlow ? "text-white" : ""}`}>
                      {isTopRainbow ? <span className="elw-rainbow-text">{sc.toFixed(1)}</span> : isTopGlow ? <span className="perf-shimmer-text perf-shimmer-emerald">{sc.toFixed(1)}</span> : sc.toFixed(1)}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          {selectedPlayer && <AnalysisPanel player={selectedPlayer} t1={t1} />}
        </div>
      )}
    </div>
  );
}

/* ===== HOVER BADGE (rozet hover popup) ===== */
function HoverBadge({ label, desc, className }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <span className={`text-xs px-3 py-1.5 rounded-lg border font-medium cursor-help ${className}`}
        onMouseEnter={e => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}>
        {label}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[200px] text-center">
            <p className="text-xs text-white font-medium mb-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== ANALİZ ROZET (tier gradient destekli) ===== */
const ANALYSIS_TIER_STYLES = {
  challenger:  { gradient: "linear-gradient(90deg, #f0e6d2, #c8aa6e, #78c8e6, #c8aa6e, #f0e6d2)", bg: "bg-gradient-to-r from-[#c8aa6e]/20 via-[#78c8e6]/15 to-[#c8aa6e]/20", border: "border-[#c8aa6e]/50", glow: "0 0 8px rgba(200,170,110,0.3)", shimmer: true },
  grandmaster: { gradient: "linear-gradient(90deg, #cd3737, #ff6b6b, #cd3737)", bg: "bg-gradient-to-r from-[#1a0505]/40 via-[#cd3737]/15 to-[#1a0505]/40", border: "border-[#cd3737]/40", glow: "0 0 6px rgba(205,55,55,0.25)", shimmer: true },
  diamond:     { gradient: "linear-gradient(90deg, #4a9bd9, #78c8e6, #576ece)", bg: "bg-gradient-to-r from-[#576ece]/12 to-[#4a9bd9]/8", border: "border-[#4a9bd9]/30" },
  emerald:     { text: "text-[#2d9e6e]", bg: "bg-[#2d9e6e]/10", border: "border-[#2d9e6e]/25" },
  gold:        { text: "text-[#c89b3c]", bg: "bg-[#c89b3c]/8",  border: "border-[#c89b3c]/20" },
  silver:      { text: "text-[#80939e]", bg: "bg-[#80939e]/6",  border: "border-[#80939e]/15" },
};

function AnalysisBadge({ badge }) {
  const [anchor, setAnchor] = useState(null);
  const s = ANALYSIS_TIER_STYLES[badge.tier] || ANALYSIS_TIER_STYLES.silver;
  const hasGrad = !!s.gradient;

  return (
    <>
      <span
        onMouseEnter={e => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-help ${s.bg} ${s.border} ${!hasGrad ? (s.text || "") : ""}`}
        style={hasGrad ? { boxShadow: s.glow || undefined } : undefined}
      >
        <span
          className={hasGrad ? "bg-clip-text text-transparent font-bold" : ""}
          style={hasGrad ? { backgroundImage: s.gradient, backgroundSize: s.shimmer ? "300% 100%" : undefined, animation: s.shimmer ? "perfTextShimmer 3s ease-in-out infinite" : undefined } : undefined}
        >
          {badge.label}
        </span>
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[220px]">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold ${hasGrad ? "bg-clip-text text-transparent" : (s.text || "")}`} style={hasGrad ? { backgroundImage: s.gradient } : undefined}>{badge.label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${s.bg} ${s.border} ${!hasGrad ? (s.text || "") : "text-gray-300"}`}>{badge.tier}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{badge.desc}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== SKOR MODU BAR ===== */
function ScoringModeBar({ scoringMode, setScoringMode }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="px-6 py-2 flex items-center justify-between bg-card/30 border-b border-edge/20">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-600">Sıralama:</span>
        <div className="flex items-center gap-0.5 bg-card/60 rounded-lg p-0.5">
          <button onClick={() => setScoringMode("individual")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${scoringMode === "individual" ? "bg-blue-500/20 text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            <User size={11} /> Bireysel
          </button>
          <button onClick={() => setScoringMode("team")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${scoringMode === "team" ? "bg-purple-500/20 text-purple-400" : "text-gray-500 hover:text-gray-300"}`}>
            <Users size={11} /> Takım Katkısı
          </button>
        </div>
      </div>
      <div className="relative">
        <button onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
          <Info size={12} /> ELW Score nedir?
        </button>
        {showInfo && (
          <div className="absolute right-0 top-full mt-1 z-50 w-80 tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl p-4 shadow-2xl shadow-black/90">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-gray-200">ELW Score</h4>
              <button onClick={() => setShowInfo(false)} className="text-gray-600 hover:text-gray-400 cursor-pointer text-xs">✕</button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
              Maçtaki 10 oyuncuyu 9 farklı metrikle (KDA, Hasar/dk, Gold/dk, Kill Katılımı, Görüş, Kule Hasarı, Objektif Hasarı, Tank Katkısı, İyileştirme) karşılaştırarak 0-10 arası puan verir.
            </p>
            <div className="space-y-2 mb-3">
              <div className="flex items-start gap-2">
                <User size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-blue-400 font-semibold">Bireysel Performans</p>
                  <p className="text-[10px] text-gray-500">KDA, hasar ve gold gibi kişisel carry metriklerine daha fazla ağırlık verir. Solo/Duo maçlarda varsayılan.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-purple-400 font-semibold">Takım Katkısı</p>
                  <p className="text-[10px] text-gray-500">Kill katılımı, görüş kontrolü ve tank katkısı gibi takım odaklı metriklere daha fazla ağırlık verir. Flex maçlarda varsayılan.</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 border-t border-edge/30 pt-2">
              Her koridor için ağırlıklar farklıdır. Örneğin destek için görüş skoru daha önemli, ADC için hasar/dk daha önemlidir.
            </p>
          </div>
        )}
      </div>
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
        : <div key={i} className="w-7 h-7 rounded bg-edge" />
      )}
    </div>
  );
}

/* ===== KORIDOR ANALİZİ KILAVUZ BUTONU ===== */
const LANE_GUIDE_METRICS = [
  { name: "KDA", desc: "(K+A)/D farkı, ±3 normalize" },
  { name: "CS", desc: "CS/dk farkı, ±3 normalize" },
  { name: "Gold", desc: "Toplam gold farkı, ±4000 normalize" },
  { name: "Hasar", desc: "Şampiyonlara verilen hasar farkı, ±8000" },
  { name: "Alınan Hasar", desc: "Fazla hasar almak aktiflik göstergesi, ağırlık rolle değişir" },
  { name: "Kule Hasarı", desc: "Kulelere verilen hasar farkı, ±5000" },
  { name: "Obj. Hasarı", desc: "Objektif hasarı (ejder/baron), ±15000" },
  { name: "Görüş", desc: "Vision score (%60) + ward activity (%40) birleşik" },
  { name: "İyileştirme", desc: "Takım arkadaşlarına heal + kalkan farkı" },
];

const LANE_GUIDE_WEIGHTS = [
  { role: "Top",     vals: [3.0, 2.5, 2.0, 2.5, 1.5, 2.0, 0.5, 1.5, 0.5] },
  { role: "Orman",   vals: [3.0, 1.5, 2.0, 2.0, 1.0, 1.0, 3.5, 2.5, 0.5] },
  { role: "Orta",    vals: [3.0, 2.5, 2.0, 3.0, 0.5, 1.5, 0.5, 1.5, 0.5] },
  { role: "Alt",     vals: [3.0, 3.0, 2.5, 3.5, 0.5, 1.5, 0.5, 1.5, 0.5] },
  { role: "Destek",  vals: [3.0, 0.0, 1.0, 1.0, 2.5, 0.5, 0.5, 3.5, 2.5] },
];

function LaneGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
        title="Koridor analizi nasıl hesaplanır?"
      >
        <Info size={10} /> VS
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-2xl shadow-2xl shadow-black/90 w-[600px] max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-200">Koridor Analizi Nasıl Hesaplanır?</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer">✕</button>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              Her koridor, aynı roldeki iki oyuncuyu <strong className="text-gray-300">9 metrik</strong> üzerinden karşılaştırır. Her metrik <strong className="text-gray-300">-1 ile +1</strong> arası normalize edilir ve rol bazlı ağırlıkla çarpılır. Pozitif skor mavi tarafın üstünlüğünü, negatif skor kırmızının üstünlüğünü gösterir.
            </p>

            {/* Verdict eşikleri */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              {[
                { label: "◀◀ Baskın", range: "> +5", color: "text-blue-300 bg-blue-500/15 border-blue-500/25" },
                { label: "◀ Önde", range: "+2 ~ +5", color: "text-blue-400 bg-blue-500/8 border-blue-500/15" },
                { label: "= Dengeli", range: "-2 ~ +2", color: "text-gray-400 bg-card/50 border-edge/30" },
                { label: "▶ Önde", range: "-2 ~ -5", color: "text-red-400 bg-red-500/8 border-red-500/15" },
                { label: "▶▶ Baskın", range: "< -5", color: "text-red-300 bg-red-500/15 border-red-500/25" },
              ].map(v => (
                <div key={v.label} className={`text-center py-2 rounded-lg border text-[10px] font-bold ${v.color}`}>
                  <p>{v.label}</p>
                  <p className="text-[9px] font-normal opacity-70 mt-0.5">{v.range}</p>
                </div>
              ))}
            </div>

            {/* Metrikler */}
            <h3 className="text-xs font-semibold text-gray-300 mb-2">9 Metrik</h3>
            <div className="space-y-1 mb-5">
              {LANE_GUIDE_METRICS.map(m => (
                <div key={m.name} className="flex items-start gap-2">
                  <span className="text-[10px] text-blue-400 font-semibold w-24 flex-shrink-0">{m.name}</span>
                  <span className="text-[10px] text-gray-500">{m.desc}</span>
                </div>
              ))}
            </div>

            {/* Ağırlık tablosu */}
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Rol Bazlı Ağırlıklar</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-edge/50">
                    <th className="text-left text-gray-500 py-1.5 pr-2">Rol</th>
                    {LANE_GUIDE_METRICS.map(m => (
                      <th key={m.name} className="text-center text-gray-500 py-1.5 px-1">{m.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LANE_GUIDE_WEIGHTS.map(r => (
                    <tr key={r.role} className="border-b border-edge/20">
                      <td className="text-gray-300 font-medium py-1.5 pr-2">{r.role}</td>
                      {r.vals.map((v, i) => (
                        <td key={i} className="text-center py-1.5 px-1">
                          <span className={`${v >= 3.0 ? "text-emerald-400 font-bold" : v >= 2.0 ? "text-blue-400" : v >= 1.0 ? "text-gray-400" : "text-gray-600"}`}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-card/50 border border-edge/30">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                <strong className="text-gray-400">Not:</strong> Koridor analizi sadece 1v1 lane karşılaştırmasıdır. ELW Score ise maçtaki 10 oyuncuya göre z-score normalizasyonu ile hesaplanır — ikisi birbirinden bağımsızdır. Bir oyuncu lane'de dengeli olabilir ama takım katkısı sayesinde yüksek ELW alabilir.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== VERDICT BADGE ===== */
function VerdictBadge({ analysis }) {
  const [anchor, setAnchor] = useState(null);
  if (!analysis) return <div className="w-[90px] flex items-center justify-center bg-card/30" />;
  const { verdict, highlights, factors, score, label: roleLabel } = analysis;
  // color → koyu tooltip için (sabit, dark tonlu). cls → VS kolonu için
  // (tema-duyarlı; light'ta koyu/doygun mavi-kırmızı, "Baskın" belirgin olsun).
  const cfg = {
    blue_dominant: { color: "text-blue-300", cls: "vd-blue-strong", bg: "bg-blue-500/15", border: "border-blue-500/25", icon: "◀◀", label: "Baskın" },
    blue_ahead:    { color: "text-blue-400", cls: "vd-blue",        bg: "bg-blue-500/8",  border: "border-blue-500/15", icon: "◀",  label: "Önde" },
    even:          { color: "text-gray-400", cls: "vd-even",        bg: "bg-card/30",border: "border-edge/20",icon: "=",  label: "Dengeli" },
    red_ahead:     { color: "text-red-400",  cls: "vd-red",         bg: "bg-red-500/8",   border: "border-red-500/15",  icon: "▶",  label: "Önde" },
    red_dominant:  { color: "text-red-300",  cls: "vd-red-strong",  bg: "bg-red-500/15",  border: "border-red-500/25",  icon: "▶▶", label: "Baskın" },
  }[verdict] || { color: "text-gray-400", cls: "vd-even", bg: "bg-card/30", border: "border-edge/20", icon: "=", label: "Dengeli" };

  return (
    <>
      <div
        className={`w-[90px] flex flex-col items-center justify-center ${cfg.bg} border-x ${cfg.border} py-2 cursor-help`}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <span className={`text-base font-bold ${cfg.cls}`}>{cfg.icon}</span>
        <span className={`text-xs ${cfg.cls} font-bold`}>{cfg.label}</span>
        {highlights.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {highlights.slice(0, 2).map((h, i) => (
              <p key={i} className={`text-[9px] text-center leading-snug font-semibold ${cfg.cls}`}>{h}</p>
            ))}
          </div>
        )}
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl px-4 py-3 shadow-2xl shadow-black/90 w-64">
            {/* Başlık */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{roleLabel} Koridor</span>
              <span className={`text-sm font-bold ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
            </div>

            {/* Toplam skor barı — ortadan iki yana */}
            {score != null && (
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] text-blue-400">Mavi</span>
                  <div className="flex-1 h-1.5 rounded-full bg-edge overflow-hidden relative">
                    <div className="absolute inset-0 flex">
                      <div className="w-1/2 flex justify-end">
                        {score > 0 && <div className="h-full bg-blue-500/60 rounded-l-full" style={{ width: `${Math.min(Math.abs(score) / 10 * 100, 100)}%` }} />}
                      </div>
                      <div className="w-1/2">
                        {score < 0 && <div className="h-full bg-red-500/60 rounded-r-full" style={{ width: `${Math.min(Math.abs(score) / 10 * 100, 100)}%` }} />}
                      </div>
                    </div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
                  </div>
                  <span className="text-[9px] text-red-400">Kırmızı</span>
                </div>
                <p className="text-center text-[10px] text-gray-400">
                  Skor: <span className={score > 0 ? "text-blue-400 font-bold" : score < 0 ? "text-red-400 font-bold" : "text-gray-400"}>
                    {score > 0 ? `Mavi +${score}` : score < 0 ? `Kırmızı +${Math.abs(score)}` : "0"}
                  </span>
                  <span className="text-gray-500 ml-1">
                    ({Math.abs(score) > 5 ? "Baskın" : Math.abs(score) > 2 ? "Önde" : "Dengeli"})
                  </span>
                </p>
              </div>
            )}

            {/* En etkili faktörler */}
            {factors && factors.length > 0 && (
              <div className="space-y-1 mb-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Belirleyici Faktörler</p>
                {factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-300">{f.metric}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1.5 rounded-full bg-edge overflow-hidden flex" style={{ justifyContent: f.value < 0 ? "flex-end" : "flex-start" }}>
                        <div className={`h-full rounded-full ${f.value > 0 ? "bg-blue-500" : "bg-red-500"}`} style={{ width: `${Math.min(Math.abs(f.value) / 3 * 100, 100)}%` }} />
                      </div>
                      <span className={`text-[11px] font-bold w-7 text-right ${f.value > 0 ? "text-blue-400" : "text-red-400"}`}>{f.value > 0 ? "+" : ""}{f.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="pt-2 border-t border-edge/50 space-y-0.5">
                {highlights.map((h, i) => (
                  <p key={i} className={`text-[10px] font-medium ${cfg.color}`}>{h}</p>
                ))}
              </div>
            )}

            {/* Kısa açıklama */}
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              9 metrik (KDA, CS, Gold, Hasar, Alınan Hasar, Kule, Objektif, Görüş, İyileştirme) rol ağırlıklarıyla hesaplanır.
            </p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== OYUNCU SATIRI ===== */
function PlayerRow({ p, maxDmg, maxDmgTaken, side, allPlayers, duration }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const dmgTakenPct = ((p.damageTaken || 0) / maxDmgTaken) * 100;
  const rank = formatRank(p.tier, p.rankDivision);
  const multiKill = p.pentaKills > 0 ? "PENTA" : p.quadraKills > 0 ? "QUADRA" : p.tripleKills > 0 ? "TRIPLE" : null;
  const mirrored = side === "red";

  return (
    <div className={`px-4 py-3 hover:bg-hover transition-colors ${mirrored ? "pl-3" : ""}`}>
      <div className={`flex items-center gap-2.5 ${mirrored ? "flex-row-reverse" : ""}`}>
        {/* Sıralama */}
        <RankBadge rank={p._matchRank} />

        {/* Champ + Spells + Runes */}
        <div className={`flex items-center gap-1.5 flex-shrink-0 ${mirrored ? "flex-row-reverse" : ""}`}>
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <img src={p.champion.image} alt="" width={44} height={44} className="rounded-lg" />
              <span className={`absolute -bottom-0.5 ${mirrored ? "-left-0.5" : "-right-0.5"} bg-card text-[9px] text-gray-300 font-bold px-1 rounded`}>{p.champLevel}</span>
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
          <p className={`text-sm font-medium truncate ${p.isBot ? "text-gray-500 italic" : "text-gray-100"}`}>
            {p.summonerName}
            {!p.isBot && p.tagLine && <span className="text-gray-600 text-[10px] ml-0.5">#{p.tagLine}</span>}
          </p>
          <div className={`flex items-center gap-1 ${mirrored ? "justify-end" : ""}`}>
            {p.isBot ? (
              <span className="text-[10px] text-gray-600 bg-gray-500/10 px-1.5 py-0.5 rounded">BOT</span>
            ) : (
              <>
                {!mirrored && p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={18} height={18} />}
                <span className="text-[11.5px] text-gray-400 font-medium">{rank}</span>
                {mirrored && p.tier && <img src={rankBadgeUrl(p.tier)} alt="" width={18} height={18} />}
              </>
            )}
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
          {multiKill && <span className={`text-[8px] px-1.5 py-px rounded-full font-bold ${multiKill === "PENTA" ? "mk-penta" : multiKill === "QUADRA" ? "mk-quadra" : "mk-triple"}`}>{multiKill}</span>}
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {p.items.map((item, i) => <ItemTooltip key={i} item={item} size={28} />)}
        </div>
      </div>

      {/* Alt stat satırı — BÜYÜK */}
      <div className={`flex items-center gap-3 mt-2.5 ${mirrored ? "flex-row-reverse" : ""} ${mirrored ? "pr-[54px]" : "pl-[60px]"}`}>
        <span className="text-xs text-gray-400 font-medium">{p.cs} CS · {p.csPerMin}/d</span>
        <span className="text-xs text-yellow-600/90 font-medium">{fmtGold(p.gold)} gold</span>
        <span className="text-xs text-cyan-500/80 font-medium">{p.killParticipation}% KP</span>
        <span className="text-xs text-amber-500/80 font-medium flex items-center gap-0.5">
          <Eye size={12} className="opacity-70" />{p.visionScore}
        </span>
        {/* ELW Score */}
        {p._elwScore != null && <ElwScoreBadge p={{...p, _duration: duration}} allPlayers={allPlayers} />}
        {/* Verilen + Alınan Hasar Barları */}
        <div className="flex-1 min-w-[100px] space-y-1">
          <div className={`flex items-center gap-1.5 ${mirrored ? "flex-row-reverse" : ""}`}>
            <span className={`text-xs text-red-400/80 font-mono w-11 ${mirrored ? "text-left" : "text-right"}`}>{fmtDmg(p.damage)}</span>
            <div className={`flex-1 h-1.5 bg-edge rounded-full overflow-hidden ${mirrored ? "flex justify-end" : ""}`}>
              <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${dmgPct}%` }} />
            </div>
          </div>
          <div className={`flex items-center gap-1.5 ${mirrored ? "flex-row-reverse" : ""}`}>
            <span className={`text-xs text-blue-400/60 font-mono w-11 ${mirrored ? "text-left" : "text-right"}`}>{fmtDmg(p.damageTaken || 0)}</span>
            <div className={`flex-1 h-1.5 bg-edge rounded-full overflow-hidden ${mirrored ? "flex justify-end" : ""}`}>
              <div className="h-full bg-blue-500/40 rounded-full" style={{ width: `${dmgTakenPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== ELW SCORE BADGE (hover popup) ===== */
function ElwScoreBadge({ p, allPlayers }) {
  const [anchor, setAnchor] = useState(null);
  const sc = p._elwScore;
  const color = sc >= 5 ? "emerald" : sc >= 3 ? "gray" : "red";
  const colorMap = { emerald: "text-emerald-400", gray: "text-gray-300", red: "text-red-400" };
  const hexMap = { emerald: "#10b981", gray: "#9ca3af", red: "#ef4444" };
  const bgMap = { emerald: "bg-emerald-400", gray: "bg-gray-400", red: "bg-red-400" };
  const label = sc >= 8 ? "Olağanüstü" : sc >= 6.5 ? "Çok İyi" : sc >= 5 ? "İyi" : sc >= 3.5 ? "Mücadele" : "Zor Maç";

  // Maçtaki 10 oyuncunun ELW skor barı karşılaştırması
  const sorted = allPlayers ? [...allPlayers].sort((a, b) => (b._elwScore || 0) - (a._elwScore || 0)) : [];
  const maxScore = sorted.length > 0 ? sorted[0]._elwScore || 10 : 10;

  // Dakika başı hasar
  const minutes = p._duration ? Math.max(p._duration / 60, 1) : 1;
  const dpm = Math.round((p.damage || 0) / minutes);
  const vsMin = ((p.visionScore || 0) / minutes).toFixed(1);

  const isRainbow = sc >= 8.5 && p._matchRank === 1;
  const isGlow = sc >= 8.5 && !isRainbow;

  return (
    <>
      <span
        className={`text-xs font-bold flex items-center gap-1 cursor-help ${!isRainbow && !isGlow ? colorMap[color] : ""}`}
        onMouseEnter={e => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <span className="w-5 h-1.5 rounded-full bg-edge overflow-hidden inline-block align-middle">
          <span className={`block h-full rounded-full ${isRainbow ? "elw-rainbow-bar" : bgMap[color]}`} style={{ width: `${sc * 10}%` }} />
        </span>
        <span className={isRainbow ? "elw-rainbow-text" : isGlow ? "perf-shimmer-text perf-shimmer-emerald" : ""}>{sc.toFixed(1)}</span>
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14]/95 backdrop-blur-md border border-[#2a3441]/80 rounded-2xl px-5 py-4 shadow-2xl shadow-black/95 w-[280px]">
            {/* Başlık — Şampiyon + İsim + Skor */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <img src={p.champion?.image} alt="" width={36} height={36} className="rounded-xl ring-1 ring-white/10" />
                <div>
                  <p className="text-[13px] text-white font-semibold leading-tight">{p.summonerName}</p>
                  <p className="text-[10px] text-gray-500">{p.champion?.name}</p>
                </div>
              </div>
              <span className={`text-2xl font-black tracking-tight ${isRainbow ? "elw-rainbow-text" : colorMap[color]}`}>{sc.toFixed(1)}</span>
            </div>

            {/* Skor barı */}
            <div className="h-2 rounded-full bg-edge overflow-hidden mb-1.5">
              <div className={`h-full rounded-full ${isRainbow ? "elw-rainbow-bar" : bgMap[color]}`} style={{ width: `${sc * 10}%` }} />
            </div>
            <div className={`flex items-center gap-2 mb-3 ${isRainbow ? "" : colorMap[color]}`}>
              {p._matchRank && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isRainbow ? "mvp-glow border border-[#c8aa6e]/60" : "bg-edge border border-[#2a3441]/50"}`}>
                  <span className={isRainbow ? "mvp-text" : ""}>#{p._matchRank}</span>
                </span>
              )}
              <span className={`text-[13px] font-bold ${isRainbow ? "elw-rainbow-text" : ""}`}>{label}</span>
            </div>

            {/* Detaylı istatistikler */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 py-2.5 px-3 rounded-xl bg-card/60 border border-edge/30">
              {[
                { lbl: "KDA", val: `${p.kills}/${p.deaths}/${p.assists}`, sub: typeof p.kda === "number" ? p.kda.toFixed(1) : p.kda },
                { lbl: "CS", val: p.cs, sub: `${p.csPerMin}/d` },
                { lbl: "Hasar/dk", val: dpm },
                { lbl: "Görüş/dk", val: vsMin },
                { lbl: "Gold", val: fmtGold(p.gold) },
                { lbl: "KP", val: `${p.killParticipation}%` },
              ].map(s => (
                <div key={s.lbl} className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500">{s.lbl}</span>
                  <span className="text-[11px] text-gray-100 font-semibold">{s.val}{s.sub ? <span className="text-gray-500 text-[9px] ml-0.5">({s.sub})</span> : ""}</span>
                </div>
              ))}
            </div>

            {/* Maçtaki 10 oyuncu skor karşılaştırması */}
            {sorted.length > 0 && (
              <div className="pt-2.5 border-t border-edge/40">
                <p className="text-[9px] text-gray-600 mb-2 uppercase tracking-wider font-medium">Maç Sıralaması</p>
                <div className="space-y-[3px]">
                  {sorted.map((sp, si) => {
                    const isMe = sp.puuid === p.puuid;
                    const spSc = sp._elwScore || 0;
                    const spRainbow = spSc >= 8.5 && si === 0;
                    const spColor = spSc >= 5 ? hexMap.emerald : spSc >= 3 ? hexMap.gray : hexMap.red;
                    return (
                      <div key={sp.puuid + '-' + si} className={`flex items-center gap-1.5 ${isMe ? "opacity-100" : "opacity-40"}`}>
                        <img src={sp.champion?.image} alt="" width={16} height={16} className="rounded" />
                        <div className="flex-1 h-[5px] rounded-full bg-edge overflow-hidden">
                          <div className={`h-full rounded-full ${spRainbow ? "elw-rainbow-bar" : ""}`} style={{ width: `${(spSc / maxScore) * 100}%`, background: spRainbow ? undefined : spColor }} />
                        </div>
                        <span className={`text-[9px] font-mono w-7 text-right ${spRainbow ? "elw-rainbow-text font-bold" : isMe ? "text-white font-bold" : "text-gray-500"}`}>{spSc.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== HASAR DAĞILIMI — Karşılıklı ===== */
function DamageDistribution({ bluePlayers, redPlayers, allPlayers, maxDmg, mode }) {
  const getVal = (p) => mode === "dealt" ? (p.damage || 0) : (p.damageTaken || 0);
  const getPhys = (p) => mode === "dealt" ? (p.physicalDamage || 0) : (p.physicalDamageTaken || p.damageTaken * 0.5 || 0);
  const getMagic = (p) => mode === "dealt" ? (p.magicDamage || 0) : (p.magicDamageTaken || p.damageTaken * 0.3 || 0);
  const getTrue = (p) => mode === "dealt" ? (p.trueDamage || 0) : (p.trueDamageTaken || p.damageTaken * 0.05 || 0);

  return (
    <div>
      <div className="space-y-3">
        {bluePlayers.map((bp, i) => {
          const rp = redPlayers[i];
          const bVal = getVal(bp), bPhys = getPhys(bp), bMagic = getMagic(bp), bTrue = getTrue(bp);
          const bTotal = Math.max(bPhys + bMagic + bTrue, 1);
          const bPct = (bVal / maxDmg) * 100;

          const rVal = rp ? getVal(rp) : 0;
          const rPhys = rp ? getPhys(rp) : 0, rMagic = rp ? getMagic(rp) : 0, rTrue = rp ? getTrue(rp) : 0;
          const rTotal = rp ? Math.max(rPhys + rMagic + rTrue, 1) : 1;
          const rPct = rp ? (rVal / maxDmg) * 100 : 0;

          return (
            <div key={bp.puuid + '-' + i} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
              {/* Mavi taraf */}
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-gray-400 w-12 text-right font-mono">{fmtDmg(bVal)}</span>
                <div className="flex-1 flex justify-end">
                  <div className="h-4 rounded-l-full overflow-hidden flex justify-end" style={{ width: `${bPct}%`, minWidth: "4px" }}>
                    <div className="h-full bg-gray-400" style={{ width: `${(bTrue / bTotal) * 100}%` }} />
                    <div className="h-full bg-blue-500" style={{ width: `${(bMagic / bTotal) * 100}%` }} />
                    <div className="h-full bg-orange-500" style={{ width: `${(bPhys / bTotal) * 100}%` }} />
                  </div>
                </div>
              </div>
              {/* Ortada şampiyonlar */}
              <div className="flex items-center justify-center gap-1.5">
                <img src={bp.champion.image} alt="" width={30} height={30} className="rounded-lg ring-1 ring-blue-500/40" />
                <span className="text-[10px] text-gray-600">vs</span>
                {rp && <img src={rp.champion.image} alt="" width={30} height={30} className="rounded-lg ring-1 ring-red-500/40" />}
              </div>
              {/* Kırmızı taraf */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-4 rounded-r-full overflow-hidden flex" style={{ width: `${rPct}%`, minWidth: rp ? "4px" : "0" }}>
                    <div className="h-full bg-orange-500" style={{ width: `${(rPhys / rTotal) * 100}%` }} />
                    <div className="h-full bg-blue-500" style={{ width: `${(rMagic / rTotal) * 100}%` }} />
                    <div className="h-full bg-gray-400" style={{ width: `${(rTrue / rTotal) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-12 text-left font-mono">{rp ? fmtDmg(rVal) : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-edge/20">
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Fiziksel</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Büyü</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />Gerçek</span>
      </div>
    </div>
  );
}

/* ===== PLAKA SAVAŞI — takım bağlamı (bireysel değil, takımın toplam plakası + pay) ===== */
function PlateWarSummary({ bluePlayers, redPlayers }) {
  const dist = (players) =>
    (players || [])
      .map(p => ({ name: p.summonerName, img: p.champion?.image, plates: p.challenges?.turretPlatesTaken ?? 0 }))
      .filter(p => p.plates > 0)
      .sort((a, b) => b.plates - a.plates);

  const blue = dist(bluePlayers);
  const red = dist(redPlayers);
  const blueTotal = blue.reduce((s, p) => s + p.plates, 0);
  const redTotal = red.reduce((s, p) => s + p.plates, 0);
  // Hiç plaka yoksa (çok erken biten maç / veri yok) bölümü gösterme.
  if (blueTotal === 0 && redTotal === 0) return null;

  const Chips = ({ players, align }) => (
    <div className={`flex flex-wrap gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
      {players.map((p, i) => (
        <div key={i} title={`${p.name}: ${p.plates} plaka`}
          className="flex items-center gap-1 bg-card/60 border border-edge/40 rounded-md px-1.5 py-0.5">
          <img src={p.img} alt="" width={18} height={18} className="rounded" />
          <span className="text-[11px] font-bold text-gray-300">{p.plates}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mb-6 rounded-xl border border-edge/40 bg-card/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Plaka Savaşı</h4>
        <span className="text-[10px] text-gray-600">ilk 14 dk · dış kuleler · takım maks 15</span>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-xl font-bold text-blue-400 w-6 text-center">{blueTotal}</span>
        <div className="flex-1"><CompBar v1={blueTotal} v2={redTotal} h="h-2.5" /></div>
        <span className="text-xl font-bold text-red-400 w-6 text-center">{redTotal}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Chips players={blue} align="left" />
        <Chips players={red} align="right" />
      </div>
    </div>
  );
}

/* ===== İSTATİSTİK TABLOSU — Karşılıklı ===== */
const STAT_COLS = [
  { k: "damagePerMinute", l: "DPM", desc: "Dakika Başı Hasar — Şampiyonlara verilen toplam hasarın dakikaya bölümü", fmt: (v) => Math.round(v) },
  { k: "goldPerMinute", l: "GPM", desc: "Dakika Başı Altın — Kazanılan toplam altının dakikaya bölümü", fmt: (v) => Math.round(v) },
  { k: "killParticipation", l: "KP", desc: "Kill Katılım — Takım killlerinin yüzde kaçında yer aldığı", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "visionScorePerMin", l: "VS/dk", desc: "Görüş Skoru / Dakika — Harita kontrolüne katkı (ward, sweeper)", fmt: (v) => v.toFixed(1) },
  { k: "teamDamagePct", l: "Hasar%", desc: "Takım Hasar Payı — Takımın toplam hasarındaki yüzdesi", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "damageTakenPct", l: "Tank%", desc: "Alınan Hasar Payı — Takımın aldığı toplam hasardaki yüzdesi (tank göstergesi)", fmt: (v) => Math.round(v * 100) + "%" },
  { k: "soloKills", l: "Solo", desc: "Solo Kill — Yardım almadan tek başına öldürmeler", fmt: (v) => v },
  { k: "turretPlatesTaken", l: "Plaka", desc: "Kule Plakası — 14. dakikadan önce kırılan kule plakaları", fmt: (v) => v },
  { k: "laneMinions10", l: "CS@10", desc: "İlk 10dk CS — İlk 10 dakikada öldürülen minyon sayısı", fmt: (v) => v },
  { k: "controlWardsPlaced", l: "CW", desc: "Kontrol Totemi — Yerleştirilen pembe ward sayısı", fmt: (v) => v },
];

function StatHeader({ label, desc }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <th className="text-center py-2.5 px-1 text-[11px] relative">
      <span className="text-gray-500 border-b border-dotted border-gray-600 cursor-help"
        onMouseEnter={e => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}>
        {label}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 w-48 text-center">
            <p className="text-[11px] text-gray-200 font-normal leading-relaxed whitespace-normal">{desc}</p>
          </div>
        </Tooltip>
      )}
    </th>
  );
}

function StatsTable({ bluePlayers, redPlayers, allPlayers }) {
  const maxVals = {};
  STAT_COLS.forEach(col => {
    maxVals[col.k] = Math.max(...allPlayers.map(p => p.challenges?.[col.k] ?? 0));
  });

  const headerCells = STAT_COLS.map(col => (
    <StatHeader key={col.k} label={col.l} desc={col.desc} />
  ));

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="text-sm font-bold text-blue-400 mb-3 px-1">Mavi Takım</div>
        <div className="bg-blue-500/[0.03] rounded-xl overflow-hidden border border-blue-500/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-500/10">
                <th className="text-left text-gray-500 py-2.5 px-3">Oyuncu</th>
                {headerCells}
              </tr>
            </thead>
            <tbody>
              {bluePlayers.map((p, i) => <StatsRow key={p.puuid + '-b' + i} p={p} maxVals={maxVals} />)}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-red-400 mb-3 px-1">Kırmızı Takım</div>
        <div className="bg-red-500/[0.03] rounded-xl overflow-hidden border border-red-500/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-red-500/10">
                <th className="text-left text-gray-500 py-2.5 px-3">Oyuncu</th>
                {headerCells}
              </tr>
            </thead>
            <tbody>
              {redPlayers.map((p, i) => <StatsRow key={p.puuid + '-r' + i} p={p} maxVals={maxVals} />)}
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
    <tr className="border-b border-edge/10 last:border-b-0 hover:bg-hover">
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
function AnalysisPanel({ player, t1 }) {
  const p = player;
  const isBlue = t1?.players?.some(tp => tp.puuid === p.puuid);
  const itemGroups = useMemo(() => groupItemsByRecall(p.itemTimeline || []), [p.puuid]);
  const skillOrder = p.skillOrder || [];

  const skillGrid = useMemo(() => {
    const grid = { Q: [], W: [], E: [], R: [] };
    skillOrder.forEach(s => {
      if (grid[s.skillKey]) grid[s.skillKey].push(s.level);
    });
    return grid;
  }, [skillOrder]);

  const maxLevel = Math.min(Math.max(p.champLevel || 18, ...skillOrder.map(s => s.level)), 18);

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6">
      {/* Sol */}
      <div className="space-y-6">
        {/* Oyuncu Özet */}
        <div className={`p-5 rounded-xl border ${isBlue ? "bg-blue-500/[0.04] border-blue-500/15" : "bg-red-500/[0.04] border-red-500/15"}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={p.champion.image} alt="" width={56} height={56} className="rounded-xl" />
              {p._matchRank && (
                <span className={`absolute -top-1.5 -left-1.5`}>
                  <RankBadge rank={p._matchRank} size="lg" />
                </span>
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
          {p._elwScore != null && (() => {
            const _glowActive = p._elwScore >= 8.5;
            const _glowKey = p._elwScore >= 7 ? "emerald" : p._elwScore >= 5 ? "blue" : p._elwScore >= 3 ? "yellow" : "emerald";
            return (
              <div className="mt-4 pt-3 border-t border-edge/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">ELW Score</span>
                  <div className="flex-1 h-2 bg-edge rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p._elwScore >= 7 ? "bg-emerald-500" : p._elwScore >= 5 ? "bg-blue-500" : p._elwScore >= 3 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${p._elwScore * 10}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${_glowActive ? `perf-shimmer-text perf-shimmer-${_glowKey}` : p._elwScore >= 7 ? "text-emerald-400" : p._elwScore >= 5 ? "text-blue-400" : p._elwScore >= 3 ? "text-yellow-400" : "text-red-400"}`}>
                    {p._elwScore.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Item Timeline */}
        <div>
          <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Eşya Geçmişi</h4>
          {itemGroups.length > 0 ? (
            <div className="space-y-2.5">
              {itemGroups.map((g, gi) => (
                <div key={gi} className="flex items-center gap-3 bg-card/40 rounded-lg px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-mono w-12 flex-shrink-0">{fmtTime(g.timestamp)}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {g.items.map((item, ii) => (
                      <div key={ii} className="relative group">
                        <img src={item.image} alt={item.name} width={32} height={32} className="rounded-md border border-[#2a3441]/50" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl whitespace-nowrap text-center">
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
              {p.badges.map((b, i) => <AnalysisBadge key={i} badge={b} />)}
            </div>
          </div>
        )}
      </div>

      {/* Sağ — Skill Order + Runes */}
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Yetenek Sırası</h4>
          {skillOrder.length > 0 ? (
            <div className="bg-card/40 rounded-xl p-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-9" />
                    {Array.from({ length: maxLevel }, (_, i) => (
                      <th key={i} className="text-[10px] text-gray-600 font-medium text-center w-7 pb-1.5">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["Q", "W", "E", "R"].map(skill => {
                    const abilityData = p.champion.abilities?.[skill];
                    return (
                      <tr key={skill}>
                        <td className="pr-1.5">
                          {abilityData?.image ? (
                            <img src={abilityData.image} alt={abilityData.name || skill} width={24} height={24}
                              className="rounded border border-[#2a3441]/50 min-w-6 min-h-6 object-cover"
                              title={abilityData.name}
                              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "inline-block"; }}
                            />
                          ) : null}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SKILL_COLORS[skill]}`}
                            style={abilityData?.image ? { display: "none" } : undefined}>{skill}</span>
                        </td>
                        {Array.from({ length: maxLevel }, (_, i) => {
                          const level = i + 1;
                          const isLeveled = skillGrid[skill]?.includes(level);
                          return (
                            <td key={i} className="text-center py-0.5">
                              {isLeveled ? (
                                <span className={`inline-block w-5 h-5 rounded text-[10px] font-bold leading-5 ${SKILL_COLORS[skill]}`}>{skill}</span>
                              ) : (
                                <span className="inline-block w-5 h-5 rounded bg-edge/30" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic">Yetenek sırası verisi bulunamadı</p>
          )}
        </div>

        {p.runes && (
          <div>
            <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Rünler</h4>
            <div className="bg-card/40 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-5">
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
                    <div className="mt-3 pt-2 border-t border-edge/40 space-y-1.5">
                      {p.runes.statShards.map((s, i) => {
                        // Eski cache'te string, yeni backend'de {name, icon}
                        const name = typeof s === "string" ? s : s?.name || "";
                        const icon = typeof s === "object" && s ? s.icon : null;
                        return (
                          <p key={i} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            {icon ? (
                              <img src={icon} alt="" width={14} height={14} className="flex-shrink-0" />
                            ) : (
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? "bg-red-400" : i === 1 ? "bg-purple-400" : "bg-green-400"}`} />
                            )}
                            {name}
                          </p>
                        );
                      })}
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
