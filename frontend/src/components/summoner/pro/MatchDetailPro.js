"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, PieChart, Gem, Swords } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";
import RuneTip from "@/components/shared/RuneTip";
import Tooltip from "@/components/shared/Tooltip";
import { scoreColor } from "./scoreColor";
import MatchDetailsTab from "./MatchDetailsTab";

const DETAIL_TABS = [
  { key: "general", label: "Genel", icon: LayoutGrid },
  { key: "details", label: "Detaylar", icon: PieChart },
  { key: "lanes", label: "Koridor", icon: Swords },
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
/* Skor — ring'li mini dial (kart başlığındaki büyük dial'ın küçüğü).
   Glow SVG filter'la DEĞİL yuvarlak konteynerde box-shadow ile — drop-shadow
   filter bölgesi kare bloom yapıyordu (eski bilinen sorun). */
function ScoreRing({ score, glow }) {
  const c = scoreColor(score);
  const r = 21;
  const circ = 2 * Math.PI * r;
  const frac = score != null ? Math.max(0.05, Math.min(score / 10, 1)) : 0;
  return (
    <div
      className="relative w-12 h-12 flex-shrink-0 rounded-full"
      style={glow ? { boxShadow: `0 0 12px ${c}55` } : undefined}
    >
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" className="stroke-edge/60" />
        {score != null && (
          <circle
            cx="24" cy="24" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
            stroke={c} strokeDasharray={`${frac * circ} ${circ}`}
          />
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[16px] font-black tracking-tight tabular-nums"
        style={{ color: c }}
      >
        {score != null ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}

/* Eşyalar — 2 satır: 3 eşya + totem üstte, 3 eşya altta (dpm tarzı kompakt blok) */
function ItemGrid({ items, size = 20 }) {
  const it = items || [];
  return (
    <div className="grid grid-cols-4 gap-[2px] flex-shrink-0">
      <ItemTooltip item={it[0]} size={size} />
      <ItemTooltip item={it[1]} size={size} />
      <ItemTooltip item={it[2]} size={size} />
      <ItemTooltip item={it[6]} size={size} />
      <ItemTooltip item={it[3]} size={size} />
      <ItemTooltip item={it[4]} size={size} />
      <ItemTooltip item={it[5]} size={size} />
    </div>
  );
}

function PlayerRow({ p, isMe, maxDmg, isMvp, isAce }) {
  const rank = formatRank(p.tier, p.rankDivision, p.leaguePoints);
  const sc = p.elwScore;
  const dmgPct = maxDmg > 0 ? ((p.damage || 0) / maxDmg) * 100 : 0;
  const isTopDmg = maxDmg > 0 && (p.damage || 0) >= maxDmg;
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
        {/* eşyalar 3+totem / 3 grid (kompakt, yatay yer yarıya iner) */}
        <ItemGrid items={p.items} size={18} />
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

        {/* KDA — oran satırı kaldırıldı (gereksizdi); multikill rozeti varsa altta */}
        <div className="w-[78px] text-center flex-shrink-0">
          <p className="text-[15px] font-semibold text-gray-100 leading-tight">{kdaEl}</p>
          {mk && (
            <p className="text-[9px] font-bold text-amber-400 leading-tight mt-0.5">
              {{ TRIPLE: "Triple Kill", QUADRA: "Quadra Kill", PENTA: "Penta Kill" }[mk]}
            </p>
          )}
        </div>

        {/* CS / KP — destek rolünde CS yerine vizyon */}
        <div className="w-[64px] text-center text-[11px] text-gray-400 flex-shrink-0 leading-tight">
          <p>{csEl}</p>
          <p>{p.killParticipation}% KP</p>
        </div>

        {/* Items — 3 + totem / 3 kompakt blok */}
        <ItemGrid items={p.items} />

        {/* Hasar — değer + pastel geçişli bar (en çok vuran biraz daha canlı) */}
        <div className="flex-1 min-w-[56px] max-w-[104px] ml-auto mr-3">
          <p className={`text-[11px] font-mono text-right leading-none mb-1 ${isTopDmg ? "text-rose-200 font-bold" : "text-rose-300/70"}`}>
            {fmtDmg(p.damage)}
          </p>
          <div className="h-1.5 bg-edge rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${isTopDmg ? "from-rose-400 to-orange-300" : "from-rose-500/35 to-rose-400/65"}`}
              style={{ width: `${dmgPct}%`, boxShadow: isTopDmg ? "0 0 8px rgba(251,113,133,0.45)" : undefined }}
            />
          </div>
        </div>

        {/* ELW — ring'li skor */}
        <ScoreRing score={sc} glow={scGlow} />
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

      {/* KORİDOR — 5 rol verdict (kim önde/baskın, jungle dahil) */}
      {tab === "lanes" && (
        <LanesTab t1={t1} t2={t2} laneAnalysis={data.laneAnalysis || []} swapped={swapped} />
      )}

      {/* RÜNLER — oyuncu başına rün sayfası */}
      {tab === "runes" && <RunesTab t1={t1} t2={t2} searchedPuuid={puuid} />}
    </div>
  );
}

/* ===== KORİDOR sekmesi — 5 rol verdict (kim önde/baskın, jungle dahil) =====
   Veri: LaneAnalysisService::buildAnalysis (data.laneAnalysis) — backend'de zaten hesaplı.
   swapped ise (aranan oyuncu kırmızı takımda) yönleri çevir → Mavi HER ZAMAN senin takımın. */
const LANE_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const LANE_ROLE_TR = { TOP: "Üst", JUNGLE: "Orman", MIDDLE: "Orta", BOTTOM: "Alt", UTILITY: "Destek" };
const LANE_ROLE_ICON = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
};
const VERDICT_CFG = {
  blue_dominant: { cls: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30", icon: "◀◀", label: "Baskın", side: "blue" },
  blue_ahead:    { cls: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "◀",  label: "Önde",  side: "blue" },
  even:          { cls: "text-gray-400", bg: "bg-card/40",     border: "border-edge/30",     icon: "=",  label: "Denk",  side: "even" },
  red_ahead:     { cls: "text-red-400",  bg: "bg-red-500/10",  border: "border-red-500/20",  icon: "▶",  label: "Önde",  side: "red" },
  red_dominant:  { cls: "text-red-300",  bg: "bg-red-500/15",  border: "border-red-500/30",  icon: "▶▶", label: "Baskın", side: "red" },
};
function flipVerdictPro(v) {
  if (!v) return v;
  if (v.startsWith("blue_")) return v.replace("blue_", "red_");
  if (v.startsWith("red_")) return v.replace("red_", "blue_");
  return v;
}
// "Metrik: X vs Y" ve "+N/-N" highlight'larını swapped'ta çevir (mavi↔kırmızı perspektifi).
function flipHighlights(hs) {
  return (hs || []).map((h) => {
    if (h.charAt(0) === "+") return "-" + h.slice(1);
    if (h.charAt(0) === "-") return "+" + h.slice(1);
    const vs = h.match(/^(.+?): (.+?) vs (.+?)$/);
    if (vs) return `${vs[1]}: ${vs[3]} vs ${vs[2]}`;
    return h;
  });
}

function LaneVerdict({ analysis }) {
  const [anchor, setAnchor] = useState(null);
  const cfg = VERDICT_CFG[analysis?.verdict] || VERDICT_CFG.even;
  const score = analysis?.score;
  return (
    <>
      <div
        className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border} cursor-help min-w-[70px]`}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <span className={`text-sm font-bold leading-none ${cfg.cls}`}>{cfg.icon}</span>
        <span className={`text-[10px] font-bold mt-0.5 ${cfg.cls}`}>{cfg.label}</span>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl px-4 py-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{analysis?.label} Koridor</span>
              <span className={`text-sm font-bold ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
            </div>
            {typeof score === "number" && (
              <p className="text-center text-[10px] text-gray-400 mb-2">
                Skor: <span className={score > 0 ? "text-blue-400 font-bold" : score < 0 ? "text-red-400 font-bold" : "text-gray-400"}>
                  {score > 0 ? `Mavi +${score}` : score < 0 ? `Kırmızı +${Math.abs(score)}` : "0"}
                </span>
              </p>
            )}
            {analysis?.highlights?.length > 0 && (
              <div className="space-y-0.5">
                {analysis.highlights.map((h, i) => (
                  <p key={i} className="text-[10px] text-gray-300 text-center">{h}</p>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

// Koridordaki bir şampiyon — portre + isim + KDA (align='right' → sağ takım, aynalı).
function LaneChamp({ p, align }) {
  if (!p) return <div className="flex-1" />;
  const right = align === "right";
  return (
    <div className={`flex items-center gap-2 flex-1 min-w-0 ${right ? "flex-row-reverse" : ""}`}>
      <img src={p.champion?.image} alt="" width={36} height={36} className="rounded-md flex-shrink-0" title={p.champion?.name} />
      <div className={`min-w-0 ${right ? "text-right" : ""}`}>
        <p className="text-[12px] text-gray-200 font-medium truncate">{p.champion?.name}</p>
        <p className="text-[10px] text-gray-500 tabular-nums">
          {p.kills}<span className="text-gray-700">/</span><span className="text-red-400/80">{p.deaths}</span><span className="text-gray-700">/</span>{p.assists}
        </p>
      </div>
    </div>
  );
}

// Tek stat için ortadan iki yana "halat çekme" barı — büyük dilim önde olanın.
function StatBar({ label, blue, red, fmt }) {
  const b = Math.max(0, blue || 0), r = Math.max(0, red || 0);
  const total = b + r;
  const bluePct = total > 0 ? (b / total) * 100 : 50;
  const f = fmt || ((x) => x);
  return (
    <div className="grid grid-cols-[2.3rem_2rem_1fr_2rem] items-center gap-1">
      <span className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-[10px] text-right tabular-nums ${b > r ? "text-blue-300 font-semibold" : "text-gray-500"}`}>{f(b)}</span>
      <div className="h-1.5 rounded-full overflow-hidden bg-edge/50 flex">
        <div className="h-full bg-blue-500/70" style={{ width: `${bluePct}%` }} />
        <div className="h-full bg-red-500/70" style={{ width: `${100 - bluePct}%` }} />
      </div>
      <span className={`text-[10px] tabular-nums ${r > b ? "text-red-300 font-semibold" : "text-gray-500"}`}>{f(r)}</span>
    </div>
  );
}

const laneKda = (p) => (p ? (p.kills + p.assists) / Math.max(p.deaths, 1) : 0);

// Tek koridor satırı — üst: şampiyon(mavi) · rol+verdict · şampiyon(kırmızı);
// alt: KDA/CS/Altın/Hasar kafa-kafaya barları.
function LaneRow({ role, bp, rp, analysis }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-card/30 border border-edge/30">
      <div className="flex items-center gap-2 mb-2">
        <LaneChamp p={bp} align="left" />
        <div className="flex flex-col items-center flex-shrink-0 gap-0.5 w-[88px]">
          <img src={LANE_ROLE_ICON[role]} alt={role} width={13} height={13} className="opacity-60" title={LANE_ROLE_TR[role]} />
          <LaneVerdict analysis={analysis} />
        </div>
        <LaneChamp p={rp} align="right" />
      </div>
      <div className="space-y-1">
        <StatBar label="KDA"   blue={laneKda(bp)} red={laneKda(rp)} fmt={(x) => x.toFixed(1)} />
        <StatBar label="CS"    blue={bp?.cs}      red={rp?.cs} />
        <StatBar label="Altın" blue={bp?.gold}    red={rp?.gold}    fmt={fmtGold} />
        <StatBar label="Hasar" blue={bp?.damage}  red={rp?.damage}  fmt={fmtDmg} />
      </div>
    </div>
  );
}

function LanesTab({ t1, t2, laneAnalysis, swapped }) {
  const byRole = (players) => {
    const m = {};
    (players || []).forEach((p) => { if (p.role) m[p.role] = p; });
    return m;
  };
  const blue = byRole(t1?.players);
  const red = byRole(t2?.players);

  const analysisMap = {};
  (laneAnalysis || []).forEach((a) => {
    analysisMap[a.role] = swapped
      ? { ...a, verdict: flipVerdictPro(a.verdict), highlights: flipHighlights(a.highlights), score: -(a.score || 0) }
      : a;
  });

  let ahead = 0, even = 0, behind = 0;
  LANE_ROLES.forEach((r) => {
    const side = (VERDICT_CFG[analysisMap[r]?.verdict] || VERDICT_CFG.even).side;
    if (side === "blue") ahead++; else if (side === "red") behind++; else even++;
  });

  return (
    <div className="space-y-2">
      {/* Özet — kaç koridor önde/denk/geride */}
      <div className="flex items-center justify-center gap-3 py-2 rounded-lg bg-card/40 border border-edge/40 text-[11px] font-semibold">
        <span className="text-blue-400">{ahead} koridor önde</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400">{even} denk</span>
        <span className="text-gray-600">·</span>
        <span className="text-red-400">{behind} geride</span>
      </div>

      {/* 5 rol satırı — Mavi (senin takımın) sol · verdict orta · Kırmızı sağ */}
      {LANE_ROLES.map((role) => {
        const bp = blue[role], rp = red[role];
        if (!bp && !rp) return null;
        return <LaneRow key={role} role={role} bp={bp} rp={rp} analysis={analysisMap[role]} />;
      })}

      <p className="text-[10px] text-gray-600 text-center pt-1 leading-relaxed">
        <span className="text-blue-400 font-medium">Mavi</span> = senin takımın. Barlar KDA/CS/Altın/Hasar; verdict 9 metriğin ağırlıklı toplamı (Rozet & Skor → Koridor Analizi).
      </p>
    </div>
  );
}

/* ===== Rünler sekmesi — her oyuncunun tam rün sayfası satırda açık (hover gerekmez) ===== */
// Eski cache'lerde statShards düz string; yeni backend {name, icon} objesi gönderiyor.
const shardName = (s) => (typeof s === "string" ? s : s?.name || "");
const shardIcon = (s) => (typeof s === "object" && s ? s.icon : null);

// Stat parçası — mini rün: koyu daire içinde DDragon StatMods ikonu, isim şık tooltip'te
function ShardIcon({ shard, size = 24 }) {
  const [anchor, setAnchor] = useState(null);
  const icon = shardIcon(shard);
  const name = shardName(shard);
  if (!icon) {
    return <span title={name} style={{ width: size, height: size }} className="rounded-full bg-edge/40 flex-shrink-0" />;
  }
  return (
    <>
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-soft ring-1 ring-edge/70 flex items-center justify-center flex-shrink-0 cursor-help"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <img src={icon} alt={name} width={size - 8} height={size - 8} />
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0e131b] border border-edge rounded-lg px-2.5 py-1.5 shadow-2xl shadow-black/90 whitespace-nowrap">
            <p className="text-[11px] font-semibold text-gray-100">{name}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* 2026-07-31: mobilde tek satırda isim + TÜM rün grupları (flex-shrink-0,
   hiçbiri küçülmüyordu) sığmıyor, kart overflow-hidden olduğu için sağ taraf
   sessizce KIRPILIYORDU (kullanıcı: "rünlerde kırpılmış içeride kalmış").
   Çözüm: dar ekranda isim kendi satırına çıkar, rün grupları ALTTA kendi
   satırında — hâlâ sığmazsa (çok küçük telefon) o satır artık dürüstçe yatay
   kaydırılır (.no-scrollbar — site genelinde .lb-tiers'la aynı desen),
   sessiz kırpma yerine. Masaüstünde (sm+) eski tek-satır düzeni AYNEN kalıyor. */
function RuneRow({ p, isMe }) {
  const r = p.runes || {};
  // primaryPerks[0] = keystone (backend tüm seçimleri sırayla gönderiyor)
  const keystone = r.primaryPerks?.[0] ?? r.keystone;
  const primaryMinors = r.primaryPerks?.slice(1) || [];
  const hasRunes = keystone?.icon || r.secondaryPerks?.length;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2.5 sm:px-4 py-2.5 ${isMe ? "bg-cyan-500/[0.07]" : ""} hover:bg-hover transition-colors`}>
      {/* Şampiyon + isim */}
      <div className="flex items-center gap-2 sm:w-[160px] min-w-0 flex-shrink-0">
        <img src={p.champion?.image} alt="" width={34} height={34} className="rounded-md flex-shrink-0" />
        <span className={`text-[13px] truncate ${p.isBot ? "text-gray-500 italic" : isMe ? "text-cyan-300 font-semibold" : "text-gray-200"}`}>
          {p.summonerName}
        </span>
      </div>

      {!hasRunes ? (
        <span className="text-[11px] text-gray-600">Rün verisi yok</span>
      ) : (
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar -mx-2.5 px-2.5 sm:mx-0 sm:px-0">
          {/* Ana ağaç: ağaç ikonu + keystone (vurgulu) + 3 rün */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <RuneTip rune={r.primaryTree} size={16} dim />
            <RuneTip rune={keystone} size={38} ring />
            {primaryMinors.map((perk, i) => <RuneTip key={i} rune={perk} />)}
          </div>

          <span className="h-8 border-l border-edge/40 hidden sm:block flex-shrink-0" />

          {/* Yan ağaç: ağaç ikonu + 2 rün */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <RuneTip rune={r.subTree} size={16} dim />
            {(r.secondaryPerks || []).map((perk, i) => <RuneTip key={i} rune={perk} />)}
          </div>

          <span className="h-8 border-l border-edge/40 hidden sm:block flex-shrink-0" />

          {/* Stat parçaları — gerçek shard ikonları (mini rün) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(r.statShards || []).map((s, i) => <ShardIcon key={i} shard={s} />)}
          </div>
        </div>
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
