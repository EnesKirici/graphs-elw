"use client";

import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { DD_ASSETS } from "@/lib/ddragon";
import { scoreColor } from "@/components/summoner/pro/scoreColor";

/*
  KAFA-KAFAYA KIYAS — solda sayfanın şampiyonu, sağda seçili rakip.

  Neden var: şerit "Talon karşısında %27.8 kazanıyorsun" der ama NEDENİNİ söylemez.
  Bu panel nedeni gösterir — kim daha çok hasar vuruyor, kim daha çok ölüyor,
  koridor fazında kim önde.

  VERİ GERÇEK, aynadan türetilmiş DEĞİL: champion_matchups her eşleşmeyi iki yönlü
  saklıyor (A-vs-B ve B-vs-A ayrı satır), backend rakip satırını da gönderiyor (`opp`).

  BAR: her metrik için TEK çizgi. Merkez = berabere; baskın olan tarafa doğru uzar.
  Yön ve renk aynı şeyi söyler → sayıya bakmadan da okunur. Renk dili sayfanın
  öznesine göre: MAVİ = sayfanın şampiyonu önde, KIRMIZI = rakip önde.
*/

const COL_GOOD = scoreColor(9);
const COL_BAD = scoreColor(2);
const NEUTRAL = "rgb(120,128,145)";

const splashUrl = (id) => `${DD_ASSETS}/cdn/img/champion/splash/${id}_0.jpg`;

/** Ortalama K/D/A → tek sayı. Ölüm 0 ise (imkânsız ama) bölme patlamasın. */
const kdaRatio = (k) => (k ? +(((k.k ?? 0) + (k.a ?? 0)) / Math.max(k.d ?? 0, 0.1)).toFixed(2) : null);

/*
  Satır tanımları.

  `full` YALNIZ simetrik (@15) metrikler için: değerler tanım gereği birbirinin
  negatifi (+408 / −408), dolayısıyla "payda içindeki pay" hesaplanamaz. Onun
  yerine baskınlık = fark / full, yani "tam bar" sayılan eşik. Eşikler koridor
  fazında BÜYÜK sayılan farklara göre seçildi: 1000 gold / 1200 tecrübe / 20 minyon
  (bu kadar fark koridoru kazanmış saymak için fazlasıyla yeter).
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
    { label: "Katılım", a: us?.kp, b: them?.kp, fmt: (v) => `%${v}` },
    { label: "Şampiyon hasarı", a: us?.dmg, b: them?.dmg, fmt: (v) => `${(v / 1000).toFixed(1)}k` },
    { label: "Gold farkı @15", a: l?.gd15, b: ol?.gd15, full: 1000, fmt: sgn },
    { label: "Tecrübe farkı @15", a: l?.xpd15, b: ol?.xpd15, full: 1200, fmt: sgn },
    { label: "Minyon farkı @15", a: l?.csd15, b: ol?.csd15, full: 20, fmt: sgn },
  ];

  // İki tarafı da olmayan satır BASILMAZ — tek taraflı kıyas yanıltıcı olur.
  return rows.filter((r) => r.a != null && r.b != null);
}

const sgn = (v) => (v > 0 ? `+${v}` : `${v}`);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function MatchupCompare({ champId, champName, champImage, m, version }) {
  if (!m) return null;

  const rows = buildRows(m);
  const oppWr = +(100 - m.winRate).toFixed(1);
  const nStats = m.stats?.n ?? 0;
  const n15 = m.lane15?.n ?? 0;

  return (
    <div className="glass rounded-xl overflow-hidden relative">
      {/*
        Arka plan: iki şampiyonun splash'i kendi tarafında, çok kısık opaklıkta ve
        merkeze doğru maskeli — panelin kime ait olduğunu okumadan anlatır.
        CSS background (img değil): DEKORATİF, ekran okuyucuya ve arama motoruna
        anlamlı içerik değil. Ayna (DD_ASSETS) kullanılır, Riot CDN'i değil.
      */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 w-1/2 opacity-[0.16] bg-cover"
          style={{
            backgroundImage: `url(${splashUrl(champId)})`,
            backgroundPosition: "center 20%",
            maskImage: "linear-gradient(to right, black 0%, transparent 92%)",
            WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 92%)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/2 opacity-[0.16] bg-cover"
          style={{
            backgroundImage: `url(${splashUrl(m.id)})`,
            backgroundPosition: "center 20%",
            maskImage: "linear-gradient(to left, black 0%, transparent 92%)",
            WebkitMaskImage: "linear-gradient(to left, black 0%, transparent 92%)",
          }}
        />
      </div>

      <div className="relative">
        {/* Başlık: iki taraf karşılıklı */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-edge/50">
          <Side name={champName} id={champId} image={champImage} version={version} wr={m.winRate} />
          <div className="shrink-0 w-10 h-10 rounded-full border border-edge bg-black/50 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-gray-400">
            VS
          </div>
          <Side name={m.name} id={m.id} version={version} wr={oppWr} align="right" link />
        </div>

        <p className="text-center text-[11px] text-gray-400 py-2.5 border-b border-edge/30">
          {m.games} maçlık eşleşme
          {nStats > 0 && <> · KDA/hasar {nStats} maçtan</>}
          {n15 > 0 && <> · koridor farkları {n15} maçtan</>}
        </p>

        {rows.length > 0 ? (
          <div className="px-4 sm:px-8 py-5 space-y-4">
            {rows.map((r) => <CompareRow key={r.label} r={r} />)}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-xs text-gray-400">
            Bu eşleşmenin ayrıntılı kıyas verisi (KDA / koridor farkları) henüz birikmedi —
            kazanma oranı {m.games} maçtan hesaplandı.
          </p>
        )}
      </div>
    </div>
  );
}

/* Başlıktaki tek taraf: ikon + ad + kazanma oranı. Rakip tarafı kendi sayfasına link. */
function Side({ name, id, image, version, wr, align, link }) {
  const col = scoreColor(5.5 + (wr - 50) * 0.5);
  const right = align === "right";
  const icon = image || champIcon(version, id);

  const body = (
    <div className={`flex items-center gap-3 min-w-0 ${right ? "flex-row-reverse text-right" : ""}`}>
      <img
        src={icon}
        alt={name}
        width={52}
        height={52}
        className="rounded-lg border-2 shrink-0"
        style={{ borderColor: col }}
      />
      <div className="min-w-0">
        {/* text-base KULLANMA: bu projede --color-base (sayfa zemini) tanımlı ve
            Tailwind'in "base" boyut adıyla çakışıyor → boyut değil RENK uyguluyor. */}
        <div className="text-[15px] sm:text-lg font-bold text-white truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{name}</div>
        <div className="text-sm sm:text-[15px] font-bold tabular-nums" style={{ color: col }}>%{wr}</div>
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

/*
  Tek metrik: üstte etiket, altta [sol değer] [tek bar] [sağ değer].
  Bar merkezden başlar, baskın tarafa uzar. Kaybeden tarafın sayısı gri kalır —
  hangi tarafın önde olduğu tek bakışta okunur.
*/
function CompareRow({ r }) {
  // Baskınlık −1..+1. Pozitif = SOL (sayfanın şampiyonu) önde.
  const off = r.full
    ? clamp(r.a / r.full, -1, 1)                                   // simetrik metrik: fark / eşik
    : (r.a + r.b === 0 ? 0 : (r.a - r.b) / (r.a + r.b));           // normal metrik: göreli üstünlük

  const pct = Math.abs(off) * 50;      // izin verilen en uzun bar = yarım genişlik
  const col = off === 0 ? NEUTRAL : off > 0 ? COL_GOOD : COL_BAD;

  return (
    <div>
      <p className="text-center text-xs sm:text-[13px] text-gray-300 font-medium mb-1.5">{r.label}</p>
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className="w-16 sm:w-20 text-right text-base sm:text-lg font-bold tabular-nums shrink-0"
          style={{ color: off > 0 ? COL_GOOD : NEUTRAL }}
        >
          {r.fmt(r.a)}
        </span>

        <div className="relative flex-1 h-2.5 rounded-full bg-white/[0.07] overflow-hidden">
          {/* merkez işareti — beraberliğin nerede olduğu görünsün */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 -translate-x-1/2 z-10" />
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
            style={{
              left: off > 0 ? `${50 - pct}%` : "50%",
              width: `${pct}%`,
              backgroundColor: col,
            }}
          />
        </div>

        <span
          className="w-16 sm:w-20 text-left text-base sm:text-lg font-bold tabular-nums shrink-0"
          style={{ color: off < 0 ? COL_BAD : NEUTRAL }}
        >
          {r.fmt(r.b)}
        </span>
      </div>
      {r.sub && <p className="text-center text-[10px] text-gray-500 tabular-nums mt-1">{r.sub}</p>}
    </div>
  );
}
