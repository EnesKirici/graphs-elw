"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Flame, Snowflake, Users } from "lucide-react";
import { miniCrestUrl, tierLabel, tierColor } from "@/components/summoner/pro/rankUtils";
import BadgeChip from "@/components/shared/BadgeChip";
import Tooltip from "@/components/shared/Tooltip";
import ScoreDial from "@/components/shared/ScoreDial";
import RoleRadar from "@/components/summoner/RoleRadar";

const ROLE_FILE = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "bot", UTILITY: "support" };
const ROLE_TR = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Destek" };
const WIN = "#3b82f6"; // site mavisi (galibiyet)
const LOSS = "#ef4444"; // kırmızı (mağlubiyet)

// Seri parçacık doğuş noktaları — ikon ÜZERİNE yayılmış (left%/top%) + yatay sürüklenme.
// Tek merkez yerine farklı noktalar → alevin/kar tanesinin çizgilerinden çıkma hissi.
const STREAK_PARTS = [
  { x: 36, y: 42, dx: -3 },
  { x: 52, y: 26, dx: 0 },
  { x: 66, y: 44, dx: 3 },
  { x: 44, y: 60, dx: -2 },
  { x: 58, y: 56, dx: 2 },
  { x: 50, y: 72, dx: 0 },
];

function roleIcon(role) {
  const f = ROLE_FILE[(role || "").toUpperCase()];
  return f ? `/roles/${f}.webp` : null;
}
function splashUrl(id) {
  return id ? `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg` : null;
}
function computeStreak(games) {
  if (!games?.length) return null;
  const first = games[0].win;
  let n = 0;
  for (const g of games) {
    if (g.win === first) n++;
    else break;
  }
  if (n < 2) return null;
  return { win: first, count: n };
}

/* KDA — ölüm sayısı kırmızı */
function Kda({ g }) {
  return (
    <span className="text-[13px] tabular-nums">
      <span className="text-gray-100 font-medium">{g.kills}</span>
      <span className="text-gray-500"> / </span>
      <span className="text-red-400 font-semibold">{g.deaths}</span>
      <span className="text-gray-500"> / </span>
      <span className="text-gray-100 font-medium">{g.assists}</span>
    </span>
  );
}

// Koridor durumu: main / çift koridor / otofill
function laneStatus(role, roleStats) {
  const stats = roleStats || [];
  if (!role) return null;
  const top = stats[0];
  const played = stats.find((r) => r.role === role);
  if (stats.length && top && role === top.role) return { label: `${ROLE_TR[role] || role} Main`, marker: "main" };
  if (!played || played.games === 0) return { label: "Otofill", marker: "fill" };
  return { label: ROLE_TR[role] || role, marker: "dual" }; // oynuyor ama main değil
}

/* Galibiyet/mağlubiyet serisi — solid çip + alev (galibiyet) / kar tanesi (mağlubiyet) ikonu.
   3+ seride parçacıklı efekt: alevden yükselen kıvılcımlar / buz tozu. */
function StreakBadge({ streak }) {
  if (!streak) return null;
  const Icon = streak.win ? Flame : Snowflake;
  const animated = streak.count >= 3;
  const iconColor = streak.win ? "text-amber-400" : "text-cyan-300";
  const pClass = streak.win ? "ember" : "frost";
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-white tabular-nums bg-black/55 border border-white/15 backdrop-blur-sm">
      {streak.count}
      <span className="relative inline-flex">
        {animated && (
          <span className="streak-fx" aria-hidden="true">
            {STREAK_PARTS.map((pt, n) => (
              <i
                key={n}
                className={pClass}
                style={{ left: `${pt.x}%`, top: `${pt.y}%`, "--dx": `${pt.dx}px`, animationDelay: `${n * 0.12}s` }}
              />
            ))}
          </span>
        )}
        <Icon size={13} strokeWidth={2.5} className={`relative ${iconColor}`} />
      </span>
    </span>
  );
}

/* Koridor simgesi (orta satır) + main/çift/otofill işareti + sezon koridor hover'ı */
function RoleBadge({ role, roleStats }) {
  const [anchor, setAnchor] = useState(null);
  if (!role) return null;
  const icon = roleIcon(role);
  const stats = roleStats || [];
  const st = laneStatus(role, stats);
  return (
    <span className="relative inline-flex" onMouseEnter={(e) => setAnchor(e.currentTarget)} onMouseLeave={() => setAnchor(null)}>
      <span className="w-9 h-9 rounded-md bg-black/45 border border-white/15 flex items-center justify-center">
        {icon && <img src={icon} alt="" width={24} height={24} />}
      </span>
      {st?.marker === "fill" ? (
        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 border border-black/50 flex items-center justify-center text-[8px] font-bold leading-none text-black">F</span>
      ) : st ? (
        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-black/50 flex items-center justify-center text-[8px] leading-none text-white">✓</span>
      ) : null}
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 w-44">
            <div className="text-[11px] font-bold text-gray-200 mb-1.5">
              {st?.marker === "main" ? st.label : st?.marker === "fill" ? "Otofill — bu koridoru oynamıyor" : `Koridor: ${ROLE_TR[role] || role}`}
            </div>
            {stats.length > 0 ? (
              <div className="space-y-1">
                {stats.slice(0, 5).map((r) => (
                  <div key={r.role} className="flex items-center gap-1.5 text-[11px]">
                    {roleIcon(r.role) && <img src={roleIcon(r.role)} alt="" width={13} height={13} className="opacity-70" />}
                    <span className="text-gray-300 w-10">{ROLE_TR[r.role] || r.label || r.role}</span>
                    <span className="text-gray-500">{r.games}M</span>
                    <span className="ml-auto text-gray-400">%{r.winRate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500">Sezon koridor verisi yok.</div>
            )}
          </div>
        </Tooltip>
      )}
    </span>
  );
}

// Kırık resimleri gizle (mock/eksik ikon olduğunda layout patlamasın)
const hideOnError = (e) => {
  e.currentTarget.style.display = "none";
};

/* Rün kümesi + hover */
function RunesCluster({ runes }) {
  const [anchor, setAnchor] = useState(null);
  if (!runes) return null;
  return (
    <span className="relative inline-flex items-center gap-1" onMouseEnter={(e) => setAnchor(e.currentTarget)} onMouseLeave={() => setAnchor(null)}>
      {runes.keystone?.icon && <img src={runes.keystone.icon} alt="" width={30} height={30} className="rounded-full bg-black/40" onError={hideOnError} />}
      {runes.secondary?.icon && <img src={runes.secondary.icon} alt="" width={20} height={20} className="opacity-85" onError={hideOnError} />}
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 w-48">
            <div className="flex items-center gap-2 mb-1.5">
              {runes.keystone?.icon && <img src={runes.keystone.icon} alt="" width={26} height={26} onError={hideOnError} />}
              <div>
                <div className="text-[12px] font-bold text-gray-100">{runes.keystone?.name || "Keystone"}</div>
                <div className="text-[10px] text-gray-500">
                  {runes.primary?.name}
                  {runes.secondary?.name ? ` + ${runes.secondary.name}` : ""}
                </div>
              </div>
            </div>
            {runes.all?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-edge/60">
                {runes.all.map((r, i) => (r?.icon ? <img key={i} src={r.icon} alt="" title={r.name} width={18} height={18} className={r.isTree ? "opacity-60" : ""} onError={hideOnError} /> : null))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </span>
  );
}

/* Kompakt ana-koridor etiketi (ELW skoru altında) */
function LaneTag({ role, roleStats }) {
  const st = laneStatus(role, roleStats);
  if (!st) return null;
  const icon = roleIcon(role);
  return (
    <div className="flex items-center gap-1">
      <span className="relative inline-flex">
        {icon && <img src={icon} alt="" width={16} height={16} className="opacity-85" />}
        {st.marker === "fill" ? (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border border-black/50 flex items-center justify-center text-[7px] font-bold leading-none text-black">F</span>
        ) : (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-black/50 flex items-center justify-center text-[7px] leading-none text-white">✓</span>
        )}
      </span>
      <span className="text-[10px] font-semibold text-gray-300">{st.label}</span>
    </div>
  );
}

/* Premade (duo/trio) rozeti — DOLU renkli pill + Users ikonu (belirgin, neon değil) */
function PremadeChip({ premade }) {
  if (!premade) return null;
  const label = premade.size === 2 ? "Duo" : premade.size === 3 ? "Trio" : `${premade.size}'li`;
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white border shadow-sm"
      style={{ background: `${premade.color}e6`, borderColor: premade.color }}
      title="Birlikte oynuyor (son maçlardan tespit edildi)"
    >
      <Users size={11} strokeWidth={2.6} />
      {label}
    </span>
  );
}

export default function LivePlayerCard({ participant: p, enrichment, loading, isEnemy, premade, flipSignal }) {
  // Bu kartın KENDİ flip durumu. Tek tık çevirir; "Tümünü çevir" yalnızca VS butonuyla yapılır.
  const [flipped, setFlipped] = useState(false);
  const lastSignalRef = useRef(flipSignal?.v ?? 0);

  // VS butonu sinyali (flipSignal) geldiğinde bu kart hedefe snap eder — hepsi aynı target'a.
  useEffect(() => {
    const v = flipSignal?.v ?? 0;
    if (v !== lastSignalRef.current) {
      lastSignalRef.current = v;
      setFlipped(!!flipSignal?.target);
    }
  }, [flipSignal]);

  const solo = p.rank?.solo;
  const stat = enrichment?.championStat;
  const rs = enrichment?.recentStats;
  const games = enrichment?.recentGames || [];
  // Karşılaştırmalar = son 24 saatte oynanan maçlar (zaman damgası yoksa dahil et — mock)
  const DAY_MS = 24 * 60 * 60 * 1000;
  const games24 = games.filter((g) => g.gameCreation == null || g.gameCreation >= Date.now() - DAY_MS);
  // "Gününde" — kolay alınmaz. Birlikte:
  //   1) Genel ELW ortalaması (son 10 maç dial'i) > 7.0
  //   2) Son 24 saatte: 3+ maç ELW ≥ 7.0  VEYA  4+ maç ELW ≥ 6.5
  //      (daha çok maç oynandıkça bar düşer — tolerans). Sayı bazlı olduğu için
  //      tek bir kötü maç rozeti düşürmez.
  const scored24 = games24.filter((g) => g.elwScore != null);
  const hi70 = scored24.filter((g) => g.elwScore >= 7.0).length;
  const hi65 = scored24.filter((g) => g.elwScore >= 6.5).length;
  const inForm =
    enrichment?.elwAverage != null &&
    enrichment.elwAverage > 7.0 &&
    (hi70 >= 3 || hi65 >= 4);
  // En yüksek (en sık) 3 rozet — fazlası kart önyüzünde kayıyordu (kullanıcı geri bildirimi).
  const badges = (enrichment?.playstyleBadges || []).slice(0, 3);
  // Bağlamsal etiketler (LabelEngine) — OTP/Main'i Karşıda/Bad CSer… renkli (admin'den yönetilir).
  const liveLabels = enrichment?.liveLabels || [];
  const streak = computeStreak(games);
  const splash = splashUrl(p.champion?.id);
  const roleStats = rs?.roleStats || [];
  const rankColor = solo?.tier ? tierColor(solo.tier) : null;

  // Kart gölgesi: rank renginde ÇOK MİNİMAL dıştan-içe ışıma + (premade ise) iç-çerçeve ring.
  const faceShadow = [
    rankColor ? `inset 0 0 24px -8px ${rankColor}80` : null,
    premade ? `inset 0 0 0 2px ${premade.color}` : null,
  ].filter(Boolean).join(", ") || undefined;

  const faceBase = "absolute inset-0 flex flex-col bg-card border border-edge rounded-xl overflow-hidden";

  return (
    <div style={{ perspective: 1400 }} className="h-[480px]">
      <div
        onClick={() => setFlipped((f) => !f)}
        className="relative w-full h-full cursor-pointer rounded-xl"
        style={{ transformStyle: "preserve-3d", transition: "transform 0.4s", transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        {/* ───────── ÖN YÜZ ───────── */}
        <div
          className={faceBase}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", boxShadow: faceShadow }}
        >
          {splash && <img src={splash} alt="" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/20 to-black/95" />

          {/* Seri — sağ üst */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <StreakBadge streak={streak} />
          </div>
          {/* Sol üst: premade rozeti */}
          {premade && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <PremadeChip premade={premade} />
            </div>
          )}

          {/* ÜST: şampiyon adı + bu şampiyon maç/WR — KUTU YOK (splash'i kapatmaz), gölgeyle okunur.
              Mobil (2 kolonlu dar kart): pt-8 → isim, köşedeki Duo/seri rozetlerinin ALTINA iner (çakışmasın) */}
          <div className="relative pt-8 sm:pt-2.5 px-3 text-center">
            <div className="text-lg font-extrabold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate leading-tight">{p.champion?.name}</div>
            {stat && stat.games > 0 ? (
              <div className="mt-0.5 text-[13px] font-semibold text-gray-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tabular-nums">
                {stat.games} maç · <span className={stat.winRate >= 50 ? "text-emerald-300" : "text-rose-300"}>%{stat.winRate} WR</span>
              </div>
            ) : (
              <div className="mt-0.5 text-[12px] text-gray-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{loading ? "yükleniyor…" : "bu şampiyonda yeni"}</div>
            )}
          </div>

          <div className="flex-1 min-h-0" />

          {/* ALT: ortalı içerik */}
          <div className="relative px-3 pb-3 space-y-2 flex flex-col items-center">
            {/* W/L göstergesi (mavi/kırmızı) */}
            {games.length > 0 && (
              <div className="flex items-center justify-center gap-1">
                {games.slice(0, 8).map((g, i) => (
                  <span key={i} title={`${g.kills}/${g.deaths}/${g.assists}`} className="h-2 w-5 rounded-sm" style={{ background: g.win ? WIN : LOSS }} />
                ))}
              </div>
            )}

            {/* Spell (sol) │ Koridor (orta) │ Rün (sağ) — çizgi ayraçlı */}
            <div className="flex items-center w-full">
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {(p.spells || []).slice(0, 2).map((s, i) =>
                  s?.image ? <img key={i} src={s.image} alt={s.name} title={s.name} width={30} height={30} className="rounded-md border border-white/10" /> : null
                )}
              </div>
              <span className="w-px h-8 bg-white/15" />
              <div className="px-2.5">
                <RoleBadge role={p.role} roleStats={roleStats} />
              </div>
              <span className="w-px h-8 bg-white/15" />
              <div className="flex-1 flex items-center justify-center gap-1.5">
                <RunesCluster runes={p.runes} />
              </div>
            </div>

            {/* Sum adı (tıkla → yeni sekmede profil) + Formunda */}
            <div className="flex items-center justify-center gap-1.5 max-w-full">
              {p.summonerName && p.tagLine ? (
                <Link
                  href={`/summoner/${encodeURIComponent(p.summonerName)}/${encodeURIComponent(p.tagLine)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[15px] font-extrabold text-white drop-shadow truncate hover:text-blue-300 hover:underline underline-offset-2 transition-colors"
                  title={`${p.summonerName}#${p.tagLine} — profili yeni sekmede aç`}
                >
                  {p.summonerName}
                </Link>
              ) : (
                <span className="text-[15px] font-extrabold text-white drop-shadow truncate" title={`${p.summonerName}#${p.tagLine}`}>
                  {p.summonerName}
                </span>
              )}
              {inForm && (
                <span
                  className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-amber-300 bg-black/60 border border-amber-400/25 backdrop-blur-sm"
                  title="Bugün gününde — son 24 saatte 3+ maç 7.0+ (veya 4+ maç 6.5+) ve genel ELW ortalaması 7.0 üzeri."
                >
                  <Flame size={9} strokeWidth={2.6} fill="currentColor" />
                  Gününde
                </span>
              )}
            </div>

            {/* Lig / LP / WR / (G-M) — RANK RENGİNDE */}
            {solo?.tier ? (
              <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ color: rankColor }}>
                <img src={miniCrestUrl(solo.tier)} alt="" width={18} height={18} />
                <span className="text-[12px] font-bold">{tierLabel(solo)}</span>
                <span className="text-[11px] font-semibold">{solo.lp} LP</span>
                {solo.winRate != null && <span className="text-[11px]" style={{ opacity: 0.85 }}>%{solo.winRate}</span>}
                {solo.wins != null && <span className="text-[11px]" style={{ opacity: 0.7 }}>({solo.wins}G {solo.losses}M)</span>}
              </div>
            ) : (
              <div className="text-[12px] text-gray-400">Unranked</div>
            )}

            {/* Bağlamsal etiketler (renkli) + oynayış rozetleri */}
            <div className="flex flex-wrap items-center justify-center gap-1 min-h-[20px]">
              {loading && badges.length === 0 && liveLabels.length === 0 && (
                <>
                  <span className="h-4 w-14 rounded bg-white/10 animate-pulse" />
                  <span className="h-4 w-12 rounded bg-white/10 animate-pulse" />
                </>
              )}
              {liveLabels.map((l) => (
                <span
                  key={l.key}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap"
                  style={{ color: l.color, borderColor: `${l.color}55`, background: `${l.color}1a` }}
                >
                  {l.text}
                </span>
              ))}
              {badges.slice(0, 3).map((b) => <BadgeChip key={b.key} badge={b} />)}
            </div>
          </div>
        </div>

        {/* ───────── ARKA YÜZ ───────── */}
        <div
          className={faceBase}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", boxShadow: faceShadow }}
        >
          {/* Splash arka plan (opacity) — içerik üstte okunur kalır */}
          {splash && <img src={splash} alt="" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />}
          <div className="absolute inset-0 bg-black/76" />

          {/* ÜST: radar (sol) + ELW skoru (sağ) — ikiye bölünmüş */}
          <div className="relative z-10 flex items-stretch border-b border-edge/60" style={{ height: 170 }}>
            <div className="flex-1 flex justify-center overflow-hidden">
              {roleStats.length > 0 ? (
                // RoleRadar SVG'si responsive (w-full) — genişliksiz sarmalayıcıda büzülüp küçük
                // görünüyordu. Sabit 260px + minWidth (flex-shrink'e karşı) → eski büyük boyut;
                // scale karta sığdırır, taşan kenar overflow-hidden ile kırpılır.
                <div style={{ width: 260, minWidth: 260, transform: "scale(0.64)", transformOrigin: "top center" }}>
                  <RoleRadar seasonRoles={{ all: roleStats }} filter="all" embedded hideHeading hideLegend />
                </div>
              ) : (
                <div className="text-[11px] text-gray-600 self-center">Koridor verisi yok</div>
              )}
            </div>
            <div className="w-[100px] flex flex-col items-center justify-center gap-1.5 border-l border-edge/60 px-2">
              <ScoreDial score={enrichment?.elwAverage} size={58} />
              <span className="text-[9px] uppercase tracking-wide text-gray-500 text-center leading-tight">ELW Skor</span>
              <LaneTag role={p.role} roleStats={roleStats} />
            </div>
          </div>

          {/* ORTA (scroll): Karşılaştırmalar */}
          <div className="relative z-10 flex-1 overflow-y-auto px-3 pt-2.5 min-h-0">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Karşılaştırmalar</span>
              <span className="text-[9px] text-gray-600">Son 24 saat · {games24.length} maç</span>
            </div>
            <div>
              {games24.slice(0, 4).map((g, i) => (
                <div key={g.matchId || i} className="flex items-center gap-2 py-0.5 border-b border-edge/25 last:border-0">
                  <span className="w-1 h-8 rounded-full" style={{ background: g.win ? WIN : LOSS }} />
                  <img src={g.champion?.image} alt="" width={38} height={38} className="rounded-md" />
                  {roleIcon(g.role) && <img src={roleIcon(g.role)} alt="" width={16} height={16} className="opacity-60" />}
                  <Kda g={g} />
                  <span className="ml-auto"><ScoreDial score={g.elwScore} rank={g.matchRank} win={g.win} size={42} /></span>
                </div>
              ))}
              {games24.length === 0 && <div className="text-[11px] text-gray-600 py-1">Son 24 saatte maç yok.</div>}
            </div>
          </div>

          {/* ALT (kalıcı): rank + rozetler — ön yüzle aynı */}
          <div className="relative z-10 border-t border-edge/60 p-2.5 space-y-1.5 bg-black/30">
            {solo?.tier ? (
              <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ color: rankColor }}>
                <img src={miniCrestUrl(solo.tier)} alt="" width={18} height={18} />
                <span className="text-[12px] font-bold">{tierLabel(solo)}</span>
                <span className="text-[11px] font-semibold">{solo.lp} LP</span>
                {solo.winRate != null && <span className="text-[11px]" style={{ opacity: 0.85 }}>%{solo.winRate}</span>}
                {solo.wins != null && <span className="text-[11px]" style={{ opacity: 0.7 }}>({solo.wins}G {solo.losses}M)</span>}
              </div>
            ) : (
              <div className="text-[12px] text-gray-400 text-center">Unranked</div>
            )}
            {badges.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {badges.slice(0, 4).map((b) => <BadgeChip key={b.key} badge={b} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
