"use client";

import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { scoreColor } from "@/components/summoner/pro/scoreColor";

/*
  KAFA-KAFAYA KIYAS — solda sayfanın şampiyonu, sağda seçili rakip.

  Neden var: şerit "Talon karşısında %27.8 kazanıyorsun" der ama NEDENİNİ söylemez.
  Bu tablo nedeni gösterir — koridor fazında kim önde (@15 gold/cs/xp), kim daha çok
  hasar vuruyor, kim daha çok ölüyor.

  VERİ GERÇEK, aynadan türetilmiş DEĞİL: champion_matchups her eşleşmeyi iki yönlü
  saklıyor (A-vs-B ve B-vs-A ayrı satır), backend rakip satırını da gönderiyor (`opp`).
  Yalnız @15 farkları tanım gereği simetriktir (+408 / -408) — orada bar boyları eşit
  çıkar, anlamı RENK taşır.

  Barlar: uzunluk |değer| / iki taraftan büyüğü. Renk sitenin dilinde — mavi iyi,
  kırmızı kötü (scoreColor, profil ve şerit ile aynı).
*/

const COL_GOOD = scoreColor(9);
const COL_BAD = scoreColor(2);

/** Ortalama K/D/A → tek sayı. Ölüm 0 ise (imkânsız ama) bölme patlamasın. */
const kdaRatio = (k) => (k ? +(((k.k ?? 0) + (k.a ?? 0)) / Math.max(k.d ?? 0, 0.1)).toFixed(2) : null);

/**
 * Tablo satırları. `mirrored` = değer tanım gereği simetrik (@15 farkları) → bar
 * boyları eşit, ayrım renkte. `fmt` görüntüleme, `raw` karşılaştırma içindir.
 */
function buildRows(m) {
  const us = m.stats;
  const them = m.opp?.stats;
  const l = m.lane15;
  const ol = m.opp?.lane15;

  const rows = [
    {
      label: "KDA",
      a: kdaRatio(us?.kda),
      b: kdaRatio(them?.kda),
      fmt: (v) => v.toFixed(2),
      sub: us?.kda && them?.kda
        ? `${us.kda.k}/${us.kda.d}/${us.kda.a} — ${them.kda.k}/${them.kda.d}/${them.kda.a}`
        : null,
    },
    { label: "Gold farkı @15", a: l?.gd15, b: ol?.gd15, mirrored: true, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) },
    { label: "Tecrübe farkı @15", a: l?.xpd15, b: ol?.xpd15, mirrored: true, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) },
    { label: "Minyon farkı @15", a: l?.csd15, b: ol?.csd15, mirrored: true, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) },
    { label: "Katılım", a: us?.kp, b: them?.kp, fmt: (v) => `%${v}` },
    { label: "Şampiyon hasarı", a: us?.dmg, b: them?.dmg, fmt: (v) => `${(v / 1000).toFixed(1)}k` },
  ];

  // İki tarafı da olmayan satır BASILMAZ — tek taraflı kıyas yanıltıcı olur.
  return rows.filter((r) => r.a != null && r.b != null);
}

export default function MatchupCompare({ champId, champName, champImage, m, version, guide }) {
  if (!m) return null;

  const rows = buildRows(m);
  const oppWr = +(100 - m.winRate).toFixed(1);
  const vsText = guide?.vs?.[m.id];

  // Kıyasın dayandığı örneklem: KDA/hasar paydası (n_stats) maç sayısından AYRI olabilir
  // (prune edilmiş maçlarda ham detay yok) — hangi sayıya baktığımız açık yazılır.
  const nStats = m.stats?.n ?? 0;
  const n15 = m.lane15?.n ?? 0;

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Başlık: iki taraf karşılıklı */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-edge/50">
        <Side name={champName} id={champId} image={champImage} version={version} wr={m.winRate} align="left" />
        <div className="shrink-0 text-center px-1">
          <div className="w-9 h-9 rounded-full border border-edge bg-black/40 flex items-center justify-center text-[10px] font-bold text-gray-400">
            VS
          </div>
        </div>
        <Side name={m.name} id={m.id} version={version} wr={oppWr} align="right" link />
      </div>

      <p className="text-center text-[11px] text-gray-500 py-2.5 border-b border-edge/30">
        {m.games} maçlık eşleşme
        {nStats > 0 && <> · KDA/hasar {nStats} maçtan</>}
        {n15 > 0 && <> · koridor farkları {n15} maçtan</>}
      </p>

      {rows.length > 0 ? (
        <div className="px-3 sm:px-5 py-3.5 space-y-2">
          {rows.map((r) => <CompareRow key={r.label} r={r} />)}
        </div>
      ) : (
        <p className="px-5 py-6 text-center text-xs text-gray-500">
          Bu eşleşmenin ayrıntılı kıyas verisi (KDA / koridor farkları) henüz birikmedi —
          kazanma oranı {m.games} maçtan hesaplandı.
        </p>
      )}

      {/* Elle yazılan eşleşme notu. Sayılar "ne oluyor"u söyler, bu "ne yapmalısın"ı. */}
      {vsText && (
        <div className="border-t border-edge/40 px-4 sm:px-6 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: COL_BAD }}>
            {m.name} karşısında nasıl oynanır?
          </p>
          <p className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-line">{vsText}</p>
        </div>
      )}
    </div>
  );
}

/* Başlıktaki tek taraf: ikon + ad + kazanma oranı. Rakip tarafı kendi sayfasına link. */
function Side({ name, id, image, version, wr, align, link }) {
  const col = scoreColor(5.5 + (wr - 50) * 0.5);
  const right = align === "right";
  const icon = image || champIcon(version, id);

  const body = (
    <div className={`flex items-center gap-2.5 min-w-0 ${right ? "flex-row-reverse text-right" : ""}`}>
      <img
        src={icon}
        alt={name}
        width={48}
        height={48}
        className="rounded-lg border-2 shrink-0"
        style={{ borderColor: col }}
      />
      <div className="min-w-0">
        <div className="text-sm sm:text-base font-bold text-gray-100 truncate">{name}</div>
        <div className="text-sm font-bold tabular-nums" style={{ color: col }}>%{wr}</div>
      </div>
    </div>
  );

  if (!link) return <div className="flex-1 min-w-0">{body}</div>;

  return (
    <Link href={`/champions/${id}/counter`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity" title={`${name} counter sayfası`}>
      {body}
    </Link>
  );
}

/* Tek kıyas satırı: sol bar — değer — etiket — değer — sağ bar. */
function CompareRow({ r }) {
  const max = Math.max(Math.abs(r.a), Math.abs(r.b)) || 1;
  const wA = (Math.abs(r.a) / max) * 100;
  const wB = (Math.abs(r.b) / max) * 100;
  // Listedeki her metrikte BÜYÜK olan iyidir — @15 farklarında da öyle, çünkü
  // değer işaretli (+408 önde, -408 geride). Eşitlikte iki taraf da nötr gri.
  const equal = r.a === r.b;
  const aBetter = r.a > r.b;
  const NEUTRAL = "rgb(107,114,128)";
  const colA = equal ? NEUTRAL : aBetter ? COL_GOOD : COL_BAD;
  const colB = equal ? NEUTRAL : aBetter ? COL_BAD : COL_GOOD;

  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* sol bar — merkeze doğru dolar */}
        <div className="flex-1 flex justify-end h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${wA}%`, backgroundColor: colA }} />
        </div>
        <span className="w-14 sm:w-16 text-right text-xs font-bold tabular-nums shrink-0" style={{ color: colA }}>
          {r.fmt(r.a)}
        </span>
        <span className="w-24 sm:w-36 text-center text-[10px] sm:text-[11px] text-gray-400 shrink-0 leading-tight">
          {r.label}
        </span>
        <span className="w-14 sm:w-16 text-left text-xs font-bold tabular-nums shrink-0" style={{ color: colB }}>
          {r.fmt(r.b)}
        </span>
        <div className="flex-1 flex justify-start h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${wB}%`, backgroundColor: colB }} />
        </div>
      </div>
      {r.sub && <p className="text-center text-[9px] text-gray-400 tabular-nums mt-0.5">{r.sub}</p>}
    </div>
  );
}
