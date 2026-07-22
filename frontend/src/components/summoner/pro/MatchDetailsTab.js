"use client";

import { useState, useEffect, useMemo } from "react";
import { Swords, Eye, BarChart3, Package, Zap, MessageSquare, Sparkles, Info } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";
import { DD_ASSETS } from "@/lib/ddragon";

/*
  Maç detayı "Detaylar" sekmesi — Porofessor/op.gg "Details" düzeni (Image #7'ye sadık):
  Oyuncu seçici (5v5) → Koridor / Wards / Global Stats 3 kutu → Build Order → Skill Order
  (yetenek ikonlu) → Spell Casted + Pings yan yana.

  Veri kaynakları (frontend player objesi): skillOrder, itemTimeline, challenges, wardsPlaced/Killed,
  csPerMin, damage, gold. Yetenek ikonları Data Dragon champion json'undan çekilir.
  Backend bekleyen alanlar (gelince otomatik dolar): spellCasts {q,w,e,r}, summonerCasts {d,f},
  pings {...}, @15 koridor farkları. Bkz. BACKEND_NOTES_match_details.md.
*/

const ROLES_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

// Q/W/E/R tek solid stil — rengarenk kutu yok, tema accent'i + nötr rozet.
const SKILL_BOX = "bg-[var(--dpm-accent,#60a5fa)] text-white";
const SKILL_BADGE = "bg-base border border-edge text-gray-200";

function fmtGold(g) { return g >= 1000 ? (g / 1000).toFixed(1) + "k" : Math.round(g); }
function fmtDmg(d) { return d >= 1000 ? (d / 1000).toFixed(1) + "k" : Math.round(d); }
function mmFromSec(s) { return `${Math.floor(s / 60)} dk`; }

function ch(p, ...keys) {
  const c = p?.challenges || {};
  for (const k of keys) if (c[k] != null) return c[k];
  return 0;
}

function sortByRole(players) {
  const idx = (p) => { const i = ROLES_ORDER.indexOf(p.role); return i >= 0 ? i : 99; };
  return [...players].sort((a, b) => idx(a) - idx(b));
}

// Recall bazlı item gruplama (ardışık satın almalar tek bloğa).
// 45sn eşiği: 90sn iki ayrı base dönüşünü tek gruba birleştiriyordu (dk23+dk24 vakası).
function groupItemsByRecall(items) {
  if (!items || !items.length) return [];
  const groups = [];
  let current = { timestamp: items[0].timestamp, items: [items[0]] };
  for (let i = 1; i < items.length; i++) {
    if (items[i].timestamp - current.items[current.items.length - 1].timestamp < 45) {
      current.items.push(items[i]);
    } else {
      groups.push(current);
      current = { timestamp: items[i].timestamp, items: [items[i]] };
    }
  }
  groups.push(current);
  return groups;
}

// Data Dragon champion json'undan Q/W/E/R yetenek ikon URL'leri (cache'li).
const champSpellCache = new Map();
async function fetchAbilityIcons(championImageUrl) {
  const m = championImageUrl?.match(/cdn\/([\d.]+)\/img\/champion\/(.+)\.png/);
  if (!m) return null;
  const [, version, champId] = m;
  const key = `${version}:${champId}`;
  if (champSpellCache.has(key)) return champSpellCache.get(key);
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/tr_TR/champion/${champId}.json`);
    const json = await res.json();
    const cd = json.data?.[champId];
    const sp = cd?.spells || [];
    const url = (s) => s ? `${DD_ASSETS}/cdn/${version}/img/spell/${s.image.full}` : null;
    const result = { q: url(sp[0]), w: url(sp[1]), e: url(sp[2]), r: url(sp[3]) };
    champSpellCache.set(key, result);
    return result;
  } catch { return null; }
}

/* ===== Başlıklı kart ===== */
function Card({ icon: Icon, title, children, className = "", bodyClass = "p-4" }) {
  return (
    <div className={`rounded-xl border border-edge/50 bg-card/40 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-edge/40 bg-soft/30">
        {Icon && <Icon size={15} className="text-gray-500" />}
        <span className="text-[12px] font-bold tracking-wider text-gray-300 uppercase">{title}</span>
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

/* ===== Tek istatistik (değer büyük üstte, etiket küçük altta — sola yaslı) ===== */
function StatCell({ value, label, color, big }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className={`${big ? "text-[24px]" : "text-[20px]"} font-bold leading-none tabular-nums`} style={color ? { color } : undefined}>{value}</span>
      <span className="text-[11px] text-gray-500 mt-1.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ===== Oyuncu seçici (5v5 + VS) ===== */
function PlayerPicker({ blue, red, selectedPuuid, onSelect }) {
  const Side = ({ players }) => (
    <div className="flex items-center gap-1.5">
      {players.map((p) => {
        const sel = p.puuid === selectedPuuid;
        return (
          <button
            key={p.puuid}
            onClick={() => onSelect(p.puuid)}
            title={`${p.summonerName} · ${p.champion?.name || ""}`}
            className={`relative rounded-lg transition-all cursor-pointer ${sel ? "ring-2 ring-[var(--dpm-accent,#60a5fa)] scale-110 z-10" : "opacity-45 hover:opacity-90"}`}
          >
            <img src={p.champion?.image} alt="" width={46} height={46} className="rounded-lg" />
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      <Side players={blue} />
      <span className="text-[14px] font-bold text-gray-600 px-1 italic">VS</span>
      <Side players={red} />
    </div>
  );
}

/* ===== Build Order — satın alma + satış (✕) kronolojisi, recall gruplu ===== */
function BuildOrder({ itemTimeline }) {
  const groups = useMemo(() => groupItemsByRecall(itemTimeline), [itemTimeline]);
  if (!groups.length) {
    return <p className="text-[12px] text-gray-600 text-center py-3">Eşya sırası verisi yok (eski maç olabilir).</p>;
  }
  return (
    <div className="flex flex-wrap items-start gap-x-1 gap-y-3">
      {groups.map((g, gi) => (
        <div key={gi} className="flex items-start gap-1">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-[3px] rounded-md bg-soft/30 p-1">
              {g.items.map((it, i) =>
                it.type === "sell" ? (
                  <div key={i} className="relative">
                    <ItemTooltip item={it} size={26} imgClass="opacity-40 saturate-0" />
                    <span className="absolute inset-0 flex items-center justify-center text-red-500 font-extrabold text-[14px] pointer-events-none drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]">✕</span>
                  </div>
                ) : (
                  <ItemTooltip key={i} item={it} size={26} />
                )
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-medium leading-none">
              {gi === 0 ? "Başlangıç" : mmFromSec(g.timestamp)}
            </span>
          </div>
          {gi < groups.length - 1 && <span className="text-gray-600/70 text-[13px] leading-none mt-2">›</span>}
        </div>
      ))}
    </div>
  );
}

/* ===== Skill Order (yetenek ikonlu satırlar + numaralı kareler) ===== */
function SkillOrder({ skillOrder, abilityIcons }) {
  if (!skillOrder || !skillOrder.length) {
    return <p className="text-[12px] text-gray-600 text-center py-3">Yetenek sırası verisi yok (eski maç olabilir).</p>;
  }
  const cols = Math.max(skillOrder.length, 18);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="space-y-1.5 w-fit mx-auto">
        {["Q", "W", "E", "R"].map((key) => {
          const icon = abilityIcons?.[key.toLowerCase()];
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="relative flex-shrink-0 w-7 h-7">
                {icon
                  ? <img src={icon} alt={key} width={28} height={28} className="rounded-md border border-edge/60" />
                  : <span className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-bold bg-soft text-gray-300">{key}</span>}
                <span className={`absolute -bottom-1 -right-1 text-[8px] font-bold px-0.5 rounded ${SKILL_BADGE}`}>{key}</span>
              </div>
              <div className="flex gap-[3px]">
                {Array.from({ length: cols }).map((_, i) => {
                  const up = skillOrder[i];
                  const here = up && up.skillKey === key;
                  return (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${here ? SKILL_BOX : "bg-edge/50"}`}
                    >
                      {here ? i + 1 : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Spell Casted (Q/W/E/R + D/F kaç kez) — 6 sabit hücreli grid,
   ikon köşesinde nötr harf rozeti, sayı altta. Mobilde 3'lü iki satır. ===== */
function SpellCasts({ p, abilityIcons }) {
  const sc = p.spellCasts;    // { q, w, e, r }
  const su = p.summonerCasts; // { d, f }
  // Hücre: 40px ikon kutusu + altında sayı (tek satır düzeni için kompakt)
  const Cell = ({ img, label, badge, count }) => (
    <div className="flex flex-col items-center w-12">
      <div className="relative h-10 flex items-center justify-center mb-2">
        {img
          ? <img src={img} alt={label} title={label} width={40} height={40} className="rounded-lg border border-edge/60" />
          : <span className="w-10 h-10 rounded-lg flex items-center justify-center text-[15px] font-bold bg-soft text-gray-300">{label}</span>}
        {badge && (
          <span className={`absolute -bottom-1.5 -right-1.5 text-[9px] font-bold px-1 py-px rounded ${SKILL_BADGE}`}>{label}</span>
        )}
      </div>
      <span className="text-[16px] font-bold text-gray-100 tabular-nums leading-none">{count != null ? count : "—"}</span>
    </div>
  );
  // TEK SATIR: Q W E R | ayraç | D F — hepsi yan yana, dikey ortalı
  const grid = (withCounts) => (
    <div className="h-full py-1 flex items-center justify-center gap-2">
      {["q", "w", "e", "r"].map((k) => (
        <Cell key={k} img={abilityIcons?.[k]} label={k.toUpperCase()} badge
          count={withCounts ? (sc?.[k] ?? 0) : null} />
      ))}
      <span className="h-10 border-l border-edge/50 mx-1.5" />
      <Cell img={p.spells?.[0]?.image} label="D" count={withCounts ? (su?.d ?? 0) : null} />
      <Cell img={p.spells?.[1]?.image} label="F" count={withCounts ? (su?.f ?? 0) : null} />
    </div>
  );
  if (!sc) {
    return (
      <div className="space-y-3">
        <div className="opacity-40 pointer-events-none">{grid(false)}</div>
        <div className="flex items-start gap-2 border-t border-edge/40 pt-3">
          <Info size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Yetenek ve sihirdar büyüsü kullanım sayıları <span className="text-gray-400">Riot Match-V5</span>'te mevcut;
            backend <span className="text-gray-400">spellXCasts</span> + <span className="text-gray-400">summonerXCasts</span> alanlarını gönderince burada dolacak.
          </p>
        </div>
      </div>
    );
  }
  return grid(true);
}

/* ===== Pings ===== */
const PING_LABELS = {
  onMyWayPings: "Yoldayım", enemyMissingPings: "Kayıp", assistMePings: "Yardım",
  needVisionPings: "Görüş", getBackPings: "Geri Çekil", pushPings: "İt",
  allInPings: "Saldır", holdPings: "Bekle", dangerPings: "Tehlike",
  commandPings: "Komut", enemyVisionPings: "Düşman Görüş", visionClearedPings: "Görüş Temiz",
  baitPings: "Yem", basicPings: "Temel",
};
// Ping görselleri — gerçek oyun ikonları (Community Dragon ux/minimap/pings, public/pings/'e indirildi).
const PING_ICONS = {
  onMyWayPings: "omw", enemyMissingPings: "missing", assistMePings: "assist",
  needVisionPings: "needvision", getBackPings: "getback", pushPings: "push",
  allInPings: "allin", holdPings: "hold", dangerPings: "danger",
  commandPings: "generic", enemyVisionPings: "enemyvision", visionClearedPings: "cleared",
  baitPings: "bait", basicPings: "generic",
};
function Pings({ pings }) {
  const entries = pings ? Object.entries(pings).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  if (!entries.length) {
    return (
      <div className="flex items-start gap-2 py-2">
        <Info size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Ping verisi Riot'ta mevcut; backend <span className="text-gray-400">pings</span> alanlarını gönderince burada dolacak.
        </p>
      </div>
    );
  }
  return (
    <div className="h-full py-1 flex flex-wrap content-center items-center justify-center gap-1 gap-y-5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col items-center text-center w-14">
          <div className="h-10 flex items-center justify-center mb-2">
            <img src={`/pings/${PING_ICONS[k] || "generic"}.png`} alt={PING_LABELS[k] || k} title={PING_LABELS[k] || k} width={30} height={30} />
          </div>
          <span className="text-[16px] font-bold text-gray-100 tabular-nums leading-none">{v}</span>
          <span className="text-[10px] text-gray-500 leading-tight mt-1 truncate w-full">{PING_LABELS[k] || k}</span>
        </div>
      ))}
    </div>
  );
}

/* ===== ANA: Detaylar sekmesi ===== */
export default function MatchDetailsTab({ t1, t2, searchedPuuid, duration }) {
  const blue = useMemo(() => sortByRole(t1?.players || []), [t1]);
  const red = useMemo(() => sortByRole(t2?.players || []), [t2]);
  const allP = useMemo(() => [...(t1?.players || []), ...(t2?.players || [])], [t1, t2]);

  const defaultPuuid = useMemo(() => {
    const me = searchedPuuid && allP.find((p) => p.puuid === searchedPuuid);
    return (me || allP[0])?.puuid || null;
  }, [allP, searchedPuuid]);

  const [selPuuid, setSelPuuid] = useState(defaultPuuid);
  const p = allP.find((x) => x.puuid === selPuuid) || allP.find((x) => x.puuid === defaultPuuid);

  const [abilityIcons, setAbilityIcons] = useState(null);
  useEffect(() => {
    let active = true;
    setAbilityIcons(null);
    if (p?.champion?.image) {
      fetchAbilityIcons(p.champion.image).then((r) => { if (active) setAbilityIcons(r); });
    }
    return () => { active = false; };
  }, [p?.champion?.image]);

  if (!p) return <p className="py-6 text-center text-[12px] text-gray-500">Oyuncu verisi yok.</p>;

  const minutes = duration ? Math.max(duration / 60, 1) : 1;
  const dpm = ch(p, "damagePerMinute") || Math.round((p.damage || 0) / minutes);
  const gpm = ch(p, "goldPerMinute") || Math.round((p.gold || 0) / minutes);
  const vspm = ch(p, "visionScorePerMin", "visionScorePerMinute") || ((p.visionScore || 0) / minutes);
  // NOT: detail-full challenges KISA adlarla gelir (laneMinions10, csAdvantage). Eski uzun adlar fallback.
  const cs10 = Math.round(ch(p, "laneMinions10", "laneMinionsFirst10Minutes"));
  const csAdv = Math.round(ch(p, "csAdvantage", "maxCsAdvantageOnLaneOpponent"));

  return (
    <div className="space-y-4 px-1 py-2">
      {/* Oyuncu seçici */}
      <div className="rounded-xl border border-edge/50 bg-card/40 px-4 py-4">
        <PlayerPicker blue={blue} red={red} selectedPuuid={p.puuid} onSelect={setSelPuuid} />
      </div>

      {/* 3 kutu: Koridor / Wards / Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon={Swords} title="Koridor">
          <div className="flex items-end justify-between gap-2">
            <StatCell value={cs10} label="CS @10" />
            <StatCell value={`${csAdv > 0 ? "+" : ""}${csAdv}`} label="Maks CS farkı" />
            <StatCell value={ch(p, "firstBloodKill") ? "Evet" : "—"} label="İlk Kan" />
          </div>
        </Card>
        <Card icon={Eye} title="Görüş & Ward">
          <div className="flex items-end justify-between gap-2">
            <StatCell value={p.wardsPlaced ?? 0} label="Dikilen" />
            <StatCell value={p.wardsKilled ?? 0} label="Yıkılan" />
            <StatCell value={ch(p, "controlWardsPlaced")} label="Kontrol" />
          </div>
        </Card>
        <Card icon={BarChart3} title="Global Stats">
          <div className="flex items-end justify-between gap-2">
            <StatCell value={p.csPerMin ?? 0} label="CS/dk" />
            <StatCell value={(+vspm).toFixed(1)} label="VS/dk" />
            <StatCell value={fmtDmg(dpm)} label="DMG/dk" />
            <StatCell value={fmtGold(gpm)} label="Gold/dk" />
          </div>
        </Card>
      </div>

      {/* Build Order */}
      <Card icon={Package} title="Eşya Sırası (Build Order)" bodyClass="p-5">
        <BuildOrder itemTimeline={p.itemTimeline} />
      </Card>

      {/* Skill Order */}
      <Card icon={Sparkles} title="Yetenek Sırası (Skill Order)" bodyClass="p-5">
        <SkillOrder skillOrder={p.skillOrder} abilityIcons={abilityIcons} />
      </Card>

      {/* Spell Casted + Pings yan yana — ikisi de 3 kolonlu grid, eşit ritim */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={Zap} title="Yetenek Kullanımı (Spell Casted)" bodyClass="p-5 h-[calc(100%-41px)]">
          <SpellCasts p={p} abilityIcons={abilityIcons} />
        </Card>
        <Card icon={MessageSquare} title="Pingler" bodyClass="p-5 h-[calc(100%-41px)]">
          <Pings pings={p.pings} />
        </Card>
      </div>
    </div>
  );
}
