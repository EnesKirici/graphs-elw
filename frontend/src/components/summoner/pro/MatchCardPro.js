"use client";

import { useState } from "react";
import { ChevronDown, ArrowUp, ArrowUpRight, ArrowRight, ArrowDownRight, ArrowDown } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";
import RuneTooltip from "@/components/shared/RuneTooltip";
import Tooltip from "@/components/shared/Tooltip";
import { scoreColor } from "./scoreColor";
import ElwScoreModal from "./ElwScoreModal";

// perfLabel.color → yön oku + renk (oynayış yorumu). Yeşilsiz palet.
const PERF_ARROW = {
  emerald: { Icon: ArrowUp,        cls: "text-sky-300" },
  blue:    { Icon: ArrowUpRight,   cls: "text-blue-400" },
  gray:    { Icon: ArrowRight,     cls: "text-gray-400" },
  yellow:  { Icon: ArrowDownRight, cls: "text-amber-400" },
  red:     { Icon: ArrowDown,      cls: "text-red-400" },
};

const ROLE_ICON = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
};
const ROLE_TR = {
  TOP: "Üst", JUNGLE: "Orman", MIDDLE: "Orta", BOTTOM: "Alt", UTILITY: "Destek",
};
const TIER_ORDER = { challenger: 0, grandmaster: 1, master: 2, diamond: 3, emerald: 4, gold: 5, silver: 6 };

// Takım kalitesi → nokta rengi (tooltip) + yazı rengi. Yeşilsiz: iyi=mavi.
// Gradyan: çok kötü=kırmızı → kötü=turuncu(ara) → ortalama=gri → iyi=mavi(ara) → çok iyi=camgöbeği.
const TQ_DOT = {
  great: "#22d3ee", good: "#60a5fa", avg: "#94a3b8", bad: "#fb923c", terrible: "#ef4444",
};
const TQ_TEXT = {
  great: "text-cyan-300", good: "text-blue-400",
  avg: "text-gray-400", bad: "text-orange-400", terrible: "text-red-400",
};
// Takım kalitesi pill (yumuşak tint + kenar) — k/d/a altında her zaman görünür.
const TQ_PILL = {
  great:    "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  good:     "text-blue-400 bg-blue-500/10 border-blue-500/25",
  avg:      "text-gray-400 bg-gray-500/10 border-gray-500/30",
  bad:      "text-orange-400 bg-orange-500/10 border-orange-500/25",
  terrible: "text-red-400 bg-red-500/10 border-red-500/25",
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

// KDA oranı → renk (yeşilsiz: çok iyi=sky, iyi=mavi, orta=gri, kötü=kırmızı).
function kdaColor(k) {
  if (k === "Perfect" || k >= 4) return "text-sky-300";
  if (k >= 3) return "text-blue-400";
  if (k >= 2) return "text-gray-200";
  return "text-red-400";
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
      {/* Sinerji eşi köşede ana şampiyonun üstünde görünür (absolute → üstte paint). */}
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

// ELW skor dial'ı — dolu koyu daire + renkli ring, ortada skor, altında sıralama rozeti.
// Hover'da zengin tooltip (skor + bar + KDA/CS/hasar + takım + açıklama).
function ScoreBlock({ m }) {
  const [anchor, setAnchor] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const score = m.ranking.elwScore;
  const sColor = scoreColor(score);
  const fill = Math.max(0, Math.min(1, (score ?? 0) / 10));
  const r = 24, circ = 2 * Math.PI * r;
  const rank = m.ranking?.rank;
  const place = rank ? placement(rank, m.win) : null;
  const isMvp = rank === 1 && m.win;
  const isAce = rank === 1 && !m.win;
  const perf = m.perfLabel;
  const pa = perf?.label ? (PERF_ARROW[perf.color] || PERF_ARROW.gray) : null;
  const PerfIcon = pa?.Icon;
  const badgeCls = isMvp
    ? "text-amber-300 border-amber-400/50 bg-[#1c1604]"
    : isAce
      ? "text-cyan-300 border-cyan-400/50 bg-[#04161c]"
      : rank <= 3
        ? "text-sky-300 border-sky-400/40 bg-[#06141c]"
        : "text-gray-300 border-edge bg-[#0c1220]";
  // Yüksek skor/MVP → dial parlar. 2 = güçlü (MVP veya ≥9.5/tam nota yakın), 1 = orta (≥8.5).
  const glowLvl = isMvp || (score != null && score >= 9.5) ? 2 : (score != null && score >= 8.5) ? 1 : 0;

  return (
    <div className="relative flex items-center justify-center w-[58px] h-[66px] flex-shrink-0 cursor-pointer"
      title="ELW skor kırılımını gör"
      onMouseEnter={(e) => setAnchor(e.currentTarget)} onMouseLeave={() => setAnchor(null)}
      onClick={(e) => { e.stopPropagation(); if (m.matchId && m.puuid) { setAnchor(null); setModalOpen(true); } }}>
      {glowLvl > 0 && (
        <span aria-hidden
          className={`absolute top-0 left-0 w-[58px] h-[58px] rounded-full pointer-events-none ${glowLvl === 2 ? "animate-pulse" : ""}`}
          style={{ background: `radial-gradient(circle at center, ${sColor}${glowLvl === 2 ? "80" : "40"} 0%, transparent 68%)`, filter: `blur(${glowLvl === 2 ? 6 : 3}px)` }} />
      )}
      <svg width="58" height="58" className="-rotate-90 absolute top-0 overflow-visible">
        <circle cx="29" cy="29" r={r} fill="var(--c-base)" stroke="var(--c-edge)" strokeWidth="5.5" />
        <circle cx="29" cy="29" r={r} fill="none" stroke={sColor} strokeWidth="5.5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - fill)}
          style={glowLvl ? { filter: `drop-shadow(0 0 ${glowLvl === 2 ? 5 : 3}px ${sColor})` } : undefined} />
      </svg>
      <span className="absolute top-0 w-[58px] h-[58px] flex items-center justify-center text-[18px] font-extrabold tabular-nums"
        style={{ color: sColor, textShadow: glowLvl === 2 ? `0 0 10px ${sColor}` : undefined }}>
        {score != null ? score.toFixed(1) : "—"}
      </span>
      {place && (
        <span className={`absolute bottom-0 px-1.5 py-px rounded-full text-[9px] font-bold leading-none border ${badgeCls}`}>
          {place}
        </span>
      )}
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl px-4 py-3 shadow-2xl shadow-black/90 w-56">
            {/* Oynayış yorumu (perfLabel) — en üstte: yön oku + etiket + sıra + açıklama */}
            {pa && (
              <>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`flex items-center gap-1.5 text-[13px] font-bold ${pa.cls}`}>
                    <PerfIcon size={15} strokeWidth={2.6} className="flex-shrink-0" />
                    {perf.label}
                  </span>
                  {place && (
                    <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">
                      {place === "MVP" || place === "ACE" ? place : `${place} sıra`}
                    </span>
                  )}
                </div>
                {perf.desc && <p className="text-[10px] text-gray-400 leading-relaxed mb-2.5">{perf.desc}</p>}
                <div className="h-px bg-edge mb-2.5" />
              </>
            )}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-500 font-medium">ELW Score</span>
              {score != null && <span className="text-xl font-bold" style={{ color: sColor }}>{score.toFixed(1)}</span>}
            </div>
            {score != null && (
              <div className="h-1.5 rounded-full bg-edge overflow-hidden mb-2.5">
                <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: sColor }} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-2 text-center">
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
          </div>
        </Tooltip>
      )}
      {modalOpen && (
        <ElwScoreModal
          matchId={m.matchId}
          puuid={m.puuid}
          champImage={m.champion?.image}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// Takım gücü barı (tooltip içi) — etiket + 0-10 değer + dolu bar (yumuşak glow).
function TeamBar({ label, val, color }) {
  const pct = Math.max(5, Math.min(100, (val / 10) * 100));
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{val}</span>
      </div>
      <div className="h-1.5 rounded-full bg-edge overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}66` }} />
      </div>
    </div>
  );
}

// Güç farkı oku — güçlü=yukarı sky, zayıf=aşağı kırmızı, denk=sağ gri.
function DiffArrow({ diff }) {
  const Icon = diff < -0.05 ? ArrowDown : diff > 0.05 ? ArrowUp : ArrowRight;
  const cls = diff < -0.05 ? "text-red-400" : diff > 0.05 ? "text-sky-300" : "text-gray-400";
  return <Icon size={15} strokeWidth={2.6} className={`flex-shrink-0 ${cls}`} />;
}

// Takım kalitesi etiketi (KDA altında) — hover'da zengin tooltip (güç farkı + açıklama)
function TeamQualityTag({ tq }) {
  const [anchor, setAnchor] = useState(null);
  const color = TQ_DOT[tq.key] || "#94a3b8";
  const diff = tq.diff ?? 0;
  const teammatesAvg = tq.teammatesAvg, lobbyAvg = tq.lobbyAvg;
  const hasAvg = teammatesAvg != null && lobbyAvg != null;
  return (
    <>
      <div className="flex justify-center mt-1">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border cursor-help whitespace-nowrap ${TQ_PILL[tq.key] || "text-gray-400 bg-gray-500/10 border-gray-500/30"}`}
          onMouseEnter={(e) => setAnchor(e.currentTarget)}
          onMouseLeave={() => setAnchor(null)}
        >
          {tq.label}
        </span>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-xl px-3.5 py-3 shadow-2xl shadow-black/90 w-60">
            {/* Başlık — renkli nokta (glow) + etiket + "takım gücü" */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              <span className={`text-[13px] font-bold ${TQ_TEXT[tq.key] || "text-gray-300"}`}>{tq.label}</span>
              <span className="ml-auto text-[9px] text-gray-600 font-semibold uppercase tracking-wider">Takım gücü</span>
            </div>
            {hasAvg ? (
              <>
                <TeamBar label="Takım arkadaşların" val={teammatesAvg} color="#60a5fa" />
                <TeamBar label="Lobi ortalaması" val={lobbyAvg} color="#94a3b8" />
                <div className="h-px bg-edge/70 my-2.5" />
                {/* DPM tarzı: takım arkadaşların (ben hariç) lobi seviyesinin üstünde mi/altında mı */}
                <div className="flex items-center gap-1.5">
                  <DiffArrow diff={diff} />
                  <span className="text-[11px] text-gray-400">
                    {diff > 0.05 ? (
                      <>Arkadaşların lobi ort.<b className="text-sky-300"> {Math.abs(diff).toFixed(1)} üstünde</b></>
                    ) : diff < -0.05 ? (
                      <>Arkadaşların lobi ort.<b className="text-red-400"> {Math.abs(diff).toFixed(1)} altında</b></>
                    ) : (
                      <>Arkadaşların <b className="text-gray-200">lobi seviyesinde</b></>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Takım arkadaşların lobi ortalamasının <b className="text-gray-100">{Math.abs(diff)} {diff < 0 ? "altında" : "üstünde"}</b>.
              </p>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

// Skor yanı stat bloğu — KDA oranı (renkli) + KP + CS/dk. Değer-önce kompakt, hizalı 2-kolon.
function StatBlock({ m }) {
  const kdaStr = typeof m.kda === "number" ? m.kda.toFixed(2) : (m.kda ?? "-");
  return (
    <div className="grid grid-cols-[auto_auto] gap-x-1.5 items-center text-[10px] leading-tight">
      <span className={`text-right font-bold tabular-nums ${kdaColor(m.kda)}`}>{kdaStr}</span>
      <span className="text-gray-500 font-medium">KDA</span>
      <span className="text-right font-semibold tabular-nums text-gray-300">{m.kp != null ? `${m.kp}%` : "-"}</span>
      <span className="text-gray-500 font-medium">KP</span>
      <span className="text-right font-semibold tabular-nums text-gray-300">{m.csPerMin != null ? m.csPerMin : "-"}</span>
      <span className="text-gray-500 font-medium">CS/dk</span>
    </div>
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
      <div className="flex items-stretch px-3.5 py-2">
        {/* 1) ŞAMPİYON + RUNE — sabit sol kolon (spell'ler eşyaların soluna taşındı) */}
        <div className="flex items-center gap-1.5 flex-shrink-0 basis-[84px]">
          <ChampPortrait champ={m.champion} corner={m.laneDuo} cornerRole={m.laneDuo?.role || m.partnerRole}
            size={50} cornerSize={26} role={m.role} roleSize={17} />
          <RuneTooltip runes={m.runes} keystoneSize={21} subTreeSize={21} />
        </div>

        {/* 2) SONUÇ + queue/LP + süre·zaman */}
        <div className="flex flex-col justify-center flex-shrink-0 basis-[80px] leading-tight border-l border-edge/25 pl-3">
          <p className={`text-[13px] font-bold ${resClr}`}>{resTxt}</p>
          {m.lpChange != null ? (
            <p className={`text-[11px] font-bold ${m.lpChange > 0 ? "text-blue-400" : "text-red-400"}`}>
              {m.lpChange > 0 ? "+" : ""}{m.lpChange} LP
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">{m.queueType || ""}</p>
          )}
          <p className="text-[10px] text-gray-500 mt-0.5" suppressHydrationWarning>
            {fmtDur(m.duration)} · {timeAgo(m.gameCreation)}
          </p>
        </div>

        {/* 3) KDA (k/d/a) + ALTINDA takım kalitesi pill (KP stat bloğunda) */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 basis-[100px] text-center border-l border-edge/25 px-3">
          <p className="text-[15px] font-bold text-gray-50 leading-tight">
            {m.kills}<span className="text-gray-500 font-normal"> / </span><span className="text-red-400">{m.deaths}</span><span className="text-gray-500 font-normal"> / </span>{m.assists}
          </p>
          {!remake && tq && <TeamQualityTag tq={tq} />}
        </div>

        {/* 4) SPELL'LER (eşyaların solunda, üst üste) + ITEMS tek satır */}
        <div className="flex items-center justify-center flex-1 border-l border-edge/25 px-3">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              {m.spells?.[0]?.image && <img src={m.spells[0].image} alt="" width={22} height={22} className="rounded" title={m.spells[0].name} />}
              {m.spells?.[1]?.image && <img src={m.spells[1].image} alt="" width={22} height={22} className="rounded" title={m.spells[1].name} />}
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (m.items[i]
                ? <ItemTooltip key={i} item={m.items[i]} size={26} />
                : <div key={i} className="w-[26px] h-[26px] rounded bg-edge" />))}
              {m.items[6]
                ? <ItemTooltip item={m.items[6]} size={26} />
                : <div className="w-[26px] h-[26px] rounded-full bg-edge" />}
            </div>
          </div>
        </div>

        {/* 5) STAT bloğu — KDA/KP/CS-dk (skorun solunda; mobilde gizli) */}
        <div className="hidden md:flex items-center justify-center flex-shrink-0 basis-[86px] border-l border-edge/25 px-3">
          {!remake && <StatBlock m={m} />}
        </div>

        {/* 6) ELW SKOR dial + aç/kapa — sabit sağ kolon */}
        <div className="flex items-center justify-center gap-1 flex-shrink-0 border-l border-edge/25 pl-3">
          {!remake && m.ranking
            ? <ScoreBlock m={m} />
            : <div className="w-[58px] flex-shrink-0" />}
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
