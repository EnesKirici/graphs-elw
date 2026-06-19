"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";
import Tooltip from "@/components/shared/Tooltip";

const ROLE_ICON = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
};
const ROLE_TR = {
  TOP: "Üst", JUNGLE: "Orman", MIDDLE: "Orta", BOTTOM: "Alt", UTILITY: "Destek",
};
const TIER_ORDER = { challenger: 0, grandmaster: 1, master: 2, diamond: 3, emerald: 4, gold: 5, silver: 6 };

// Takım kalitesi → nokta + yazı rengi (kutusuz; "kare" artefaktı olmasın).
const TQ_DOT = {
  great: "#34d399", good: "#34d399", avg: "#94a3b8", bad: "#f87171", terrible: "#f87171",
};
const TQ_TEXT = {
  great: "text-emerald-400", good: "text-emerald-400",
  avg: "text-gray-400", bad: "text-red-400", terrible: "text-red-400",
};

// Rozet renkleri — SADECE üst tier'lar (challenger/grandmaster/master) kendi
// renginde; diğerleri okunur gri.
const BADGE_TIER = {
  challenger:  { grad: "linear-gradient(90deg,#f0e6d2,#c8aa6e,#78c8e6,#c8aa6e,#f0e6d2)", bd: "border-[#c8aa6e]/45", bg: "bg-[#c8aa6e]/12" },
  grandmaster: { grad: "linear-gradient(90deg,#cd3737,#ff6b6b,#cd3737)", bd: "border-[#cd3737]/40", bg: "bg-[#cd3737]/12" },
  master:      { color: "#b072e6", bd: "border-[#9d5bd2]/40", bg: "bg-[#9d5bd2]/12" },
};

function fmtDur(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function fmtDmg(d) { return d >= 1000 ? `${(d / 1000).toFixed(1)}k` : d; }

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
  if (k === "Perfect" || k >= 4) return "text-emerald-400";
  if (k >= 3) return "text-blue-400";
  if (k >= 2) return "text-gray-200";
  return "text-red-400";
}

// ELW skoru → renk (anlamlı skala; skor satırın odak noktası).
function scoreColor(s) {
  if (s == null) return "#6b7280";
  if (s >= 7) return "#34d399"; // emerald
  if (s >= 5) return "#60a5fa"; // blue
  if (s >= 3.5) return "#fbbf24"; // amber
  return "#f87171"; // red
}

function placement(rank, win) {
  if (rank === 1) return win ? "MVP" : "ACE";
  return `${rank}.`;
}

const ROLE_ICON_MAP = ROLE_ICON;

// Şampiyon portresi + sol-altta kendi lane (rol) ikonu + sağ-altta sinerji eşi
// (ormancı/duo) — eşin de kendi rol ikonu var. Level rozeti YOK.
function ChampPortrait({ champ, corner, size, cornerSize, role, cornerRole, roleSize = 16 }) {
  if (!champ) return <div className="rounded-lg bg-edge flex-shrink-0" style={{ width: size, height: size }} />;
  const roleIcon = role && ROLE_ICON_MAP[role];
  const cornerRoleIcon = cornerRole && ROLE_ICON_MAP[cornerRole];
  const cornerRoleSize = Math.max(11, Math.round(cornerSize * 0.6));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <img src={champ.image} alt={champ.name} width={size} height={size} className="rounded-lg" title={champ.name} />
      {roleIcon && (
        <img src={roleIcon} alt={role} width={roleSize} height={roleSize}
          className="absolute -bottom-1 -left-1 bg-card rounded p-px ring-1 ring-edge" />
      )}
      {corner && (
        <span className="absolute -bottom-1.5 -right-1.5 block" style={{ width: cornerSize, height: cornerSize }}>
          <img src={corner.image} alt={corner.name} width={cornerSize} height={cornerSize}
            title={`Eş: ${corner.name}${cornerRole ? ` · ${ROLE_TR[cornerRole] || ""}` : ""}`}
            className="rounded-md ring-2 ring-card block w-full h-full" />
          {cornerRoleIcon && (
            <img src={cornerRoleIcon} alt={cornerRole}
              width={cornerRoleSize} height={cornerRoleSize}
              className="absolute -bottom-1 -left-1 bg-card rounded-sm p-px ring-1 ring-edge" />
          )}
        </span>
      )}
    </div>
  );
}

// Rozet: üst tier renkli, diğerleri okunur gri. Hover'da zengin tooltip (açıklama).
function BadgeChip({ badge }) {
  const [anchor, setAnchor] = useState(null);
  const t = BADGE_TIER[badge.tier];
  const labelEl = t?.grad
    ? <span className="bg-clip-text text-transparent" style={{ backgroundImage: t.grad }}>{badge.label}</span>
    : t
      ? <span style={{ color: t.color }}>{badge.label}</span>
      : badge.label;
  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={t
          ? `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-default whitespace-nowrap ${t.bg} ${t.bd}`
          : "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-300 bg-soft border border-edge/60 cursor-default whitespace-nowrap"}
      >
        {labelEl}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">{labelEl}</span>
              <span className="text-[9px] text-gray-500 capitalize bg-edge px-1.5 py-0.5 rounded">{badge.tier}</span>
            </div>
            {badge.desc && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{badge.desc}</p>}
          </div>
        </Tooltip>
      )}
    </>
  );
}

// ELW skor halkası — hover'da zengin tooltip (skor + bar + KDA/CS/hasar + takım + açıklama)
function ScoreBlock({ m }) {
  const [anchor, setAnchor] = useState(null);
  const score = m.ranking.elwScore;
  const sColor = scoreColor(score);
  const fill = Math.max(0, Math.min(1, (score ?? 0) / 10));
  const r = 25, circ = 2 * Math.PI * r;
  const place = m.ranking?.rank ? placement(m.ranking.rank, m.win) : null;
  const isMvp = m.ranking?.rank === 1 && m.win;
  const isAce = m.ranking?.rank === 1 && !m.win;
  const tq = m.teamQuality;
  const perf = m.perfLabel;

  return (
    <div className="flex flex-col items-center w-[64px] leading-tight cursor-help"
      onMouseEnter={(e) => setAnchor(e.currentTarget)} onMouseLeave={() => setAnchor(null)}>
      {place && (
        <span className={`text-[10px] font-bold mb-0.5 ${isMvp ? "mvp-text" : isAce ? "text-cyan-300" : "text-gray-500"}`}>{place}</span>
      )}
      <div className="relative w-[56px] h-[56px] flex items-center justify-center">
        <svg width="56" height="56" className="-rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--c-edge)" strokeWidth="4.5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={sColor} strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - fill)} />
        </svg>
        <span className="absolute text-[18px] font-extrabold tabular-nums" style={{ color: sColor }}>
          {score != null ? score.toFixed(1) : "—"}
        </span>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl px-4 py-3 shadow-2xl shadow-black/90 w-56">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-500 font-medium">ELW Score</span>
              {score != null && <span className="text-xl font-bold" style={{ color: sColor }}>{score.toFixed(1)}</span>}
            </div>
            {score != null && (
              <div className="h-1.5 rounded-full bg-edge overflow-hidden mb-2.5">
                <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: sColor }} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-2 mb-2.5 text-center">
              <div>
                <p className="text-[9px] text-gray-600">KDA</p>
                <p className="text-[11px] text-gray-200 font-semibold">{m.kills}/{m.deaths}/{m.assists}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-600">CS</p>
                <p className="text-[11px] text-gray-200 font-semibold">{m.cs}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-600">Hasar</p>
                <p className="text-[11px] text-gray-200 font-semibold">{m.damage != null ? fmtDmg(m.damage) : "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {place && (
                <span className="text-[10px] text-gray-300 bg-edge px-1.5 py-0.5 rounded font-medium">
                  {place === "MVP" || place === "ACE" ? place : `${place} sıra`}
                </span>
              )}
              {tq && (
                <span className={`text-[10px] font-semibold ${TQ_TEXT[tq.key] || "text-gray-400"}`}>
                  {tq.label}{tq.diff != null ? ` (${tq.diff > 0 ? "+" : ""}${tq.diff})` : ""}
                </span>
              )}
            </div>
            {perf?.desc && <p className="text-[10px] text-gray-500 leading-relaxed mt-2">{perf.desc}</p>}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// Takım kalitesi etiketi (KDA altında) — hover'da zengin tooltip (güç farkı + açıklama)
function TeamQualityTag({ tq }) {
  const [anchor, setAnchor] = useState(null);
  const color = TQ_DOT[tq.key] || "#94a3b8";
  const diff = tq.diff ?? 0;
  return (
    <>
      <div
        className="flex items-center justify-center gap-1 mt-1 cursor-help"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className={`text-[10px] font-semibold ${TQ_TEXT[tq.key] || "text-gray-400"}`}>{tq.label}</span>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2.5 shadow-2xl shadow-black/90 w-56">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className={`text-xs font-bold ${TQ_TEXT[tq.key] || "text-gray-300"}`}>{tq.label}</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Takım arkadaşlarının (sen hariç) ortalama ELW'si, rakip takımınkinden{" "}
              <b className="text-gray-100">{Math.abs(diff)} puan {diff >= 0 ? "yüksek" : "düşük"}</b>.
            </p>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Lobi ne kadar zorsa skorun o kadar değerlidir.
            </p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

// Koridor farm kıyası "X vs Y cs" — hover'da zengin tooltip (sen / rakip / fark)
function LaneCsCompare({ m }) {
  const [anchor, setAnchor] = useState(null);
  const oppCs = m.cs - m.csDiff;
  const ahead = m.csDiff > 0, behind = m.csDiff < 0;
  return (
    <>
      <span
        className="text-[10px] font-medium tabular-nums whitespace-nowrap cursor-help"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <span className={ahead ? "text-emerald-400 font-bold" : behind ? "text-red-400 font-bold" : "text-gray-200 font-bold"}>{m.cs}</span>
        <span className="text-gray-600 font-normal"> vs </span>
        <span className="text-gray-400">{oppCs}</span>
        <span className="text-gray-600 font-normal"> cs</span>
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2.5 shadow-2xl shadow-black/90 w-44">
            <p className="text-[11px] text-gray-500 font-medium mb-1.5">Koridor farm kıyası</p>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Sen</span>
              <span className="font-bold text-gray-100 tabular-nums">{m.cs} CS</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-0.5">
              <span className="text-gray-400">Rakip</span>
              <span className="font-bold text-gray-100 tabular-nums">{oppCs} CS</span>
            </div>
            <div className="h-px bg-edge my-1.5" />
            <p className={`text-[11px] font-semibold ${ahead ? "text-emerald-400" : behind ? "text-red-400" : "text-gray-400"}`}>
              {ahead ? `${m.csDiff} CS öndesin` : behind ? `${-m.csDiff} CS geridesin` : "Eşitsiniz"}
            </p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

export default function MatchCardPro({ match: m, expanded }) {
  const remake = m.duration < 300;
  const resTxt = remake ? "Remake" : m.win ? "Zafer" : "Yenilgi";
  const resClr = remake ? "res-remake" : m.win ? "res-win" : "res-loss";
  const rowAccent = remake ? "dpm-row-remake" : m.win ? "dpm-row-win" : "dpm-row-loss";
  const rowBg = remake ? "row-remake" : m.win ? "row-win" : "row-loss";
  const badges = [...(m.badges || [])].sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
  const tq = m.teamQuality;

  return (
    <div className={`${rowAccent} ${rowBg} hover:bg-hover transition-colors`}>
      <div className="flex items-center gap-2.5 px-3.5 py-2">
        {/* 1) ŞAMPİYON (kendi lane ikonu + sinerji eşi köşede, eşin rol ikonuyla) + SPELL + RUNE */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ChampPortrait champ={m.champion} corner={m.laneDuo} cornerRole={m.laneDuo?.role || m.partnerRole}
            size={50} cornerSize={26} role={m.role} roleSize={17} />
          <div className="flex flex-col gap-1">
            {m.spells?.[0]?.image && <img src={m.spells[0].image} alt="" width={21} height={21} className="rounded" title={m.spells[0].name} />}
            {m.spells?.[1]?.image && <img src={m.spells[1].image} alt="" width={21} height={21} className="rounded" title={m.spells[1].name} />}
          </div>
          <RuneTooltip runes={m.runes} keystoneSize={21} subTreeSize={21} />
        </div>

        {/* 2) SONUÇ + queue/LP + süre·zaman */}
        <div className="w-[74px] flex-shrink-0 leading-tight">
          <p className={`text-[13px] font-bold ${resClr}`}>{resTxt}</p>
          {m.lpChange != null ? (
            <p className={`text-[11px] font-bold ${m.lpChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {m.lpChange > 0 ? "+" : ""}{m.lpChange} LP
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">{m.queueType || ""}</p>
          )}
          <p className="text-[10px] text-gray-500 mt-0.5" suppressHydrationWarning>
            {fmtDur(m.duration)} · {timeAgo(m.gameCreation)}
          </p>
        </div>

        {/* 3) KDA (k/d/a) + ALTINDA takım kalitesi (iyi/kötü takım) */}
        <div className="w-[96px] flex-shrink-0 text-center border-l border-edge/40 pl-2.5">
          <p className="text-[15px] font-bold text-gray-50 leading-tight">
            {m.kills}<span className="text-gray-500 font-normal"> / </span><span className="text-red-400">{m.deaths}</span><span className="text-gray-500 font-normal"> / </span>{m.assists}
          </p>
          {!remake && tq && <TeamQualityTag tq={tq} />}
        </div>

        {/* 4) KDA oranı + CS/dk + KP — kişisel stat bloğu (CS farkı koridor rakibine taşındı) */}
        <div className="w-[84px] flex-shrink-0 text-center border-l border-edge/40 pl-2.5 leading-tight">
          <p className={`text-[11px] font-mono font-bold ${remake ? "text-gray-500" : kdaColor(m.kda)}`}>
            {remake ? "-" : typeof m.kda === "number" ? `${m.kda.toFixed(2)} KDA` : `${m.kda} KDA`}
          </p>
          <p className="text-[11px] text-gray-300 mt-0.5 whitespace-nowrap">
            {m.csPerMin != null ? m.csPerMin : (m.cs ?? "-")}<span className="text-gray-500"> CS/dk</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 whitespace-nowrap">
            {m.kp != null ? m.kp : "-"}<span className="text-gray-500">% KP</span>
          </p>
        </div>

        {/* 5) ITEMS */}
        <div className="flex-shrink-0 border-l border-edge/40 pl-2.5">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (m.items[i]
              ? <ItemTooltip key={i} item={m.items[i]} size={24} />
              : <div key={i} className="w-[24px] h-[24px] rounded bg-edge" />))}
          </div>
          <div className="flex gap-0.5 mt-0.5">
            {[3, 4, 5].map((i) => (m.items[i]
              ? <ItemTooltip key={i} item={m.items[i]} size={24} />
              : <div key={i} className="w-[24px] h-[24px] rounded bg-edge" />))}
            {m.items[6]
              ? <ItemTooltip item={m.items[6]} size={24} />
              : <div className="w-[24px] h-[24px] rounded-full bg-edge" />}
          </div>
        </div>

        {/* 6) MATCHUP — koridor rakibi + farm kıyası (senin CS'in vs rakibin CS'i) */}
        {m.laneOpponent && (
          <div className="hidden md:flex flex-col items-center gap-1 leading-none flex-shrink-0 border-l border-edge/40 pl-2.5">
            <span className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider">Karşı</span>
            <ChampPortrait champ={m.laneOpponent} corner={m.enemyDuo} cornerRole={m.enemyDuo?.role || m.partnerRole}
              size={44} cornerSize={22} role={m.laneOpponent?.role || m.role} roleSize={15} />
            {!remake && m.csDiff != null && m.cs != null ? (
              <LaneCsCompare m={m} />
            ) : (
              <span className="h-[14px]" />
            )}
          </div>
        )}

        {/* 7) ELW SKOR — sağa yaslı odak nokta (hover'da tooltip) */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {!remake && m.ranking
            ? <ScoreBlock m={m} />
            : <div className="w-[64px] flex-shrink-0" />}
          <ChevronDown size={16} className={`text-gray-500 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Rozetler — alt şerit: üst tier renkli, diğerleri okunur gri (max 4) */}
      {!remake && badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-3.5 pb-2 -mt-0.5">
          {badges.slice(0, 4).map((b) => <BadgeChip key={b.key} badge={b} />)}
          {badges.length > 4 && <MoreBadges badges={badges.slice(4)} />}
        </div>
      )}
    </div>
  );
}

// "+N" — hover'da kalan rozetlerin listesi (açıklamalı)
function MoreBadges({ badges }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className="text-[10px] text-gray-500 font-medium cursor-default hover:text-gray-300"
      >
        +{badges.length}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 space-y-1 max-w-[240px]">
            {badges.map((b) => {
              const t = BADGE_TIER[b.tier];
              return (
                <div key={b.key} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold flex-shrink-0" style={t && !t.grad ? { color: t.color } : undefined}>
                    {t?.grad ? <span className="bg-clip-text text-transparent" style={{ backgroundImage: t.grad }}>{b.label}</span> : b.label}
                  </span>
                  {b.desc && <span className="text-[9px] text-gray-500">{b.desc}</span>}
                </div>
              );
            })}
          </div>
        </Tooltip>
      )}
    </>
  );
}
