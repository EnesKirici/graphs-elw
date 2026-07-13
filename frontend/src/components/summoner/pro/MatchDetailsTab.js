"use client";

import { useState, useEffect, useMemo } from "react";
import { Swords, Eye, BarChart3, Package, Zap, MessageSquare, Sparkles, Info, Shield } from "lucide-react";
import ItemTooltip from "@/components/shared/ItemTooltip";

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

// Yetenek harf renkleri (görseldeki palet): Q mavi, W turuncu, E mor, R kırmızı.
const SKILL_STYLE = {
  Q: { box: "bg-blue-500", text: "text-blue-300" },
  W: { box: "bg-orange-500", text: "text-orange-300" },
  E: { box: "bg-purple-500", text: "text-purple-300" },
  R: { box: "bg-red-500", text: "text-red-300" },
};

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

// Recall bazlı item gruplama (ardışık satın almalar tek bloğa)
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
    const url = (s) => s ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${s.image.full}` : null;
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

/* ===== Plaka Savaşı — takım bağlamı (bireysel değil; takımın toplam plakası + aranan oyuncunun payı) =====
   Plaka yalnız 3 dış kulede ve ilk 14 dk var; her dış kule 5 plaka → takım başına maks 15. */
function PlateWar({ blue, red, meP }) {
  const dist = (players) =>
    (players || [])
      .map((p) => ({ puuid: p.puuid, name: p.summonerName, img: p.champion?.image, plates: p.challenges?.turretPlatesTaken ?? 0 }))
      .filter((p) => p.plates > 0)
      .sort((a, b) => b.plates - a.plates);

  const b = dist(blue);
  const r = dist(red);
  const bt = b.reduce((s, p) => s + p.plates, 0);
  const rt = r.reduce((s, p) => s + p.plates, 0);
  if (bt === 0 && rt === 0) return null; // erken biten maç / veri yok
  const total = Math.max(bt + rt, 1);

  const me = [...b, ...r].find((p) => p.puuid === meP);
  const myTeamTotal = (blue || []).some((p) => p.puuid === meP) ? bt : rt;
  const myShare = me && myTeamTotal > 0 ? Math.round((me.plates / myTeamTotal) * 100) : null;

  const Chips = ({ players, align }) => (
    <div className={`flex flex-wrap gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
      {players.map((p, i) => (
        <div
          key={i}
          title={`${p.name}: ${p.plates} plaka`}
          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 border ${
            p.puuid === meP
              ? "border-[var(--dpm-accent,#60a5fa)] bg-[var(--dpm-accent,#60a5fa)]/10"
              : "border-edge/40 bg-card/60"
          }`}
        >
          <img src={p.img} alt="" width={18} height={18} className="rounded" />
          <span className="text-[11px] font-bold text-gray-300">{p.plates}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card icon={Shield} title="Plaka Savaşı">
      <div className="flex items-center justify-between mb-2 text-[12px]">
        <span className="font-bold text-blue-400">Mavi {bt}</span>
        {myShare != null && (
          <span className="text-[11px] text-gray-500">
            Senin payın: <b className="text-gray-200">%{myShare}</b> <span className="text-gray-600">({me.plates} plaka)</span>
          </span>
        )}
        <span className="font-bold text-red-400">{rt} Kırmızı</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex mb-3">
        <div className="h-full bg-blue-500" style={{ width: `${(bt / total) * 100}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${(rt / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Chips players={b} align="left" />
        <Chips players={r} align="right" />
      </div>
      <p className="text-[10px] text-gray-600 mt-3 text-center">ilk 14 dk · sadece dış kuleler · takım başına maks 15 plaka</p>
    </Card>
  );
}

/* ===== Build Order ===== */
function BuildOrder({ itemTimeline }) {
  const groups = useMemo(() => groupItemsByRecall(itemTimeline), [itemTimeline]);
  if (!groups.length) {
    return <p className="text-[12px] text-gray-600 text-center py-3">Eşya sırası verisi yok (eski maç olabilir).</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-3">
      {groups.map((g, gi) => (
        <div key={gi} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-soft/25 border border-edge/30 px-2.5 py-2">
            <div className="flex items-center gap-1">
              {g.items.map((it, i) => <ItemTooltip key={i} item={it} size={34} />)}
            </div>
            <span className="text-[11px] text-gray-400 font-semibold">{gi === 0 ? "Başlangıç" : mmFromSec(g.timestamp)}</span>
          </div>
          {gi < groups.length - 1 && <span className="text-gray-600 text-lg leading-none">›</span>}
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
    <div className="space-y-1.5 overflow-x-auto pb-1">
      {["Q", "W", "E", "R"].map((key) => {
        const st = SKILL_STYLE[key];
        const icon = abilityIcons?.[key.toLowerCase()];
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="relative flex-shrink-0 w-8 h-8">
              {icon
                ? <img src={icon} alt={key} width={32} height={32} className="rounded-md border border-edge/60" />
                : <span className={`w-8 h-8 rounded-md flex items-center justify-center text-[14px] font-bold bg-soft ${st.text}`}>{key}</span>}
              <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded ${st.box} text-white`}>{key}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: cols }).map((_, i) => {
                const up = skillOrder[i];
                const here = up && up.skillKey === key;
                return (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${here ? `${st.box} text-white` : "bg-edge/50"}`}
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
  );
}

/* ===== Spell Casted (Q/W/E/R + D/F kaç kez) — Match-V5 spellXCasts ===== */
function SpellCasts({ p, abilityIcons }) {
  const sc = p.spellCasts;    // { q, w, e, r }
  const su = p.summonerCasts; // { d, f }
  const Cell = ({ img, fallback, fb, count }) => (
    <div className="flex flex-col items-center gap-1.5">
      {img
        ? <img src={img} alt="" width={36} height={36} className="rounded-md border border-edge/60" />
        : <span className={`w-9 h-9 rounded-md flex items-center justify-center text-[13px] font-bold bg-soft ${fb || "text-gray-300"}`}>{fallback}</span>}
      <span className="text-[16px] font-bold text-gray-100 tabular-nums leading-none">{count != null ? count : "—"}</span>
      <span className="text-[10px] text-gray-500">kez</span>
    </div>
  );
  if (!sc) {
    return (
      <div className="space-y-3">
        <div className="flex items-end justify-center gap-3 opacity-40 pointer-events-none">
          {["Q", "W", "E", "R"].map((k) => (
            <Cell key={k} img={abilityIcons?.[k.toLowerCase()]} fallback={k} fb={SKILL_STYLE[k].text} count={null} />
          ))}
          <span className="self-stretch w-px bg-edge mx-1.5" />
          <Cell img={p.spells?.[0]?.image} fallback="D" count={null} />
          <Cell img={p.spells?.[1]?.image} fallback="F" count={null} />
        </div>
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
  return (
    <div className="flex items-end justify-center gap-3 flex-wrap">
      {[["Q", sc.q], ["W", sc.w], ["E", sc.e], ["R", sc.r]].map(([k, v]) => (
        <Cell key={k} img={abilityIcons?.[k.toLowerCase()]} fallback={k} fb={SKILL_STYLE[k].text} count={v ?? 0} />
      ))}
      {su && (
        <>
          <span className="self-stretch w-px bg-edge mx-1.5" />
          <Cell img={p.spells?.[0]?.image} fallback="D" count={su.d ?? 0} />
          <Cell img={p.spells?.[1]?.image} fallback="F" count={su.f ?? 0} />
        </>
      )}
    </div>
  );
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
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-y-4 gap-x-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col items-center text-center">
          <img src={`/pings/${PING_ICONS[k] || "generic"}.png`} alt={PING_LABELS[k] || k} title={PING_LABELS[k] || k} width={26} height={26} className="mb-1" />
          <span className="text-[18px] font-bold text-gray-100 tabular-nums leading-none">{v}</span>
          <span className="text-[10px] text-gray-500 mt-1">{PING_LABELS[k] || k}</span>
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

      {/* Plaka Savaşı — takım payı bağlamı */}
      <PlateWar blue={blue} red={red} meP={searchedPuuid} />

      {/* Build Order */}
      <Card icon={Package} title="Eşya Sırası (Build Order)" bodyClass="p-5">
        <BuildOrder itemTimeline={p.itemTimeline} />
      </Card>

      {/* Skill Order */}
      <Card icon={Sparkles} title="Yetenek Sırası (Skill Order)" bodyClass="p-5">
        <SkillOrder skillOrder={p.skillOrder} abilityIcons={abilityIcons} />
      </Card>

      {/* Spell Casted + Pings yan yana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={Zap} title="Yetenek Kullanımı (Spell Casted)" bodyClass="p-5">
          <SpellCasts p={p} abilityIcons={abilityIcons} />
        </Card>
        <Card icon={MessageSquare} title="Pingler">
          <Pings pings={p.pings} />
        </Card>
      </div>
    </div>
  );
}
