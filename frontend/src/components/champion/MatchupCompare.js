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
/* Kaybeden tarafin sayisi: ikincil ama OKUNUR. rgb(120,128,145) splash zemininde
   kayboluyordu — panelin arkasinda %16 opaklikta iki splash var, koyu gri onlara
   karisiyor. Ton acildi, ayrica sayilara golge veriliyor. */
const NEUTRAL = "rgb(186,193,207)";
/* Splash zemini uzerindeki her sayi/etiket bu golgeyi tasir. */
const SHADOW = "drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]";

const splashUrl = (id) => `${DD_ASSETS}/cdn/img/champion/splash/${id}_0.jpg`;

/** Ortalama K/D/A → tek sayı. Ölüm 0 ise (imkânsız ama) bölme patlamasın. */
const kdaRatio = (k) => (k ? +(((k.k ?? 0) + (k.a ?? 0)) / Math.max(k.d ?? 0, 0.1)).toFixed(2) : null);

/*
  Satır tanımları — MUTLAK kafa-kafaya.

  Bir dönem barlar "her şampiyonun kendi ortalamasından sapması" ile çiziliyordu.
  Kullanıcı reddetti ve haklıydı: bu sayfanın sorusu "Yuumi genel Yuumi'ye göre nasıl"
  değil, "Yuumi ile Swain koridorda karşılaşınca ne oluyor". Sapmayla çizince Swain
  16.4k hasar vururken bar 10.1k'lık Yuumi'ye gidiyordu ("Swain kendi normalinin
  altında" diye) — bakan biri haklı olarak güler. Bar artık ekrandaki iki sayıyı
  kıyaslar, başka hiçbir şeyi.

  `full` YALNIZ simetrik (@15) metrikler için: değerler tanım gereği birbirinin
  negatifi (+408 / −408), dolayısıyla "payda içindeki pay" hesaplanamaz. Onun
  yerine baskınlık = fark / full, yani "tam bar" sayılan eşik. Eşikler koridor
  fazında BÜYÜK sayılan farklara göre seçildi: 1000 gold / 1200 tecrübe / 20 minyon.
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
    { label: "Şampiyon hasarı", a: us?.dmg, b: them?.dmg, fmt: k },
    /*
      Emilen hasar TARAFSIZ çizilir (mavi/kırmızı DEĞİL) — yön bilgi taşır, renk hüküm
      vermez. "Çok emmek iyidir" bu metrikte tanımsız: Swain'in işi öne geçip hasar
      yemek, Yuumi'nin işi hiç yememek. Birini "önde" ilan etmek yanlış olur.
    */
    { label: "Emilen hasar", a: us?.taken, b: them?.taken, neutral: true, fmt: k },
    /*
      İYİLEŞTİRME İKİYE AYRILDI — ölçümle bulundu (1.200 maç, maç başına ortalama):
        Swain  totalHeal 12.817 · müttefiğe 6      → hepsi KENDİNE
        Yuumi  totalHeal  9.933 · müttefiğe 8.467  → üstüne 8.525 kalkan
        Aatrox totalHeal 16.591 · müttefiğe 0      → hepsi KENDİNE
      `challenges.effectiveHealAndShielding` yalnız MÜTTEFİĞE olanı sayıyor; tek satırda
      gösterilince Swain "0.0k" görünüyordu ve iki şampiyon kıyaslanamıyordu.
    */
    { label: "Müttefiğe iyileştirme + kalkan", a: us?.hs, b: them?.hs, fmt: k },
    { label: "Kendine iyileştirme", a: us?.healSelf, b: them?.healSelf, fmt: k },
    /*
      CC TEK SATIR. Bir ara "CC süresi" + "Sabitleme" diye ikiye ayrılmıştı; kullanıcı
      birleştirilmesini istedi. Bilgi kaybı var ama kabul edildi: `timeCCingOthers`
      yavaşlatmayı da sayar, sersemletme/kök ayrı sayılmaz.
      Yavaşlatmanın sayıldığı KANITLI: Yuumi'nin sabitlemesi 0.0 olduğu hâlde CC
      süresi 20 sn — o 20 saniyenin tamamı Q yavaşlatmasından geliyor.
    */
    { label: "CC süresi", a: us?.cc, b: them?.cc, fmt: (v) => `${v} sn` },
    { label: "Gold farkı @15", a: l?.gd15, b: ol?.gd15, full: 1000, fmt: sgn },
    { label: "Tecrübe farkı @15", a: l?.xpd15, b: ol?.xpd15, full: 1200, fmt: sgn },
    { label: "Minyon farkı @15", a: l?.csd15, b: ol?.csd15, full: 20, fmt: sgn },
  ];

  // İki tarafı da olmayan satır BASILMAZ — tek taraflı kıyas yanıltıcı olur.
  // İkisi de SIFIR olan satır da basılmaz (iki büyücünün "Sabitleme 0"ı gürültü);
  // işaretli @15 satırları muaf — orada 0 "denk" demektir.
  return rows.filter((r) => r.a != null && r.b != null && (r.full || r.a !== 0 || r.b !== 0));
}

const k = (v) => `${(v / 1000).toFixed(1)}k`;
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
        {/*
          KARARTMA KATMANI. Splash'ler %16 opaklıkta bile sayıları yutuyordu: açık
          saçlı/aydınlık bir splash'in (Rell) üstünde açık gri rakam okunmuyor, ve
          hangi bölgenin aydınlık olduğu ŞAMPİYONA GÖRE değişiyor — yani metin rengini
          ayarlamak çözmez, zemini sabitlemek gerekir. Gölge (drop-shadow) tek başına
          yetmedi; kullanıcı iki turda da sayıların kaybolduğunu gördü.
        */}
        <div className="absolute inset-0 bg-black/45" />
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

        <p className={`text-center text-[11px] text-gray-400 py-2.5 border-b border-edge/30 ${SHADOW}`}>
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
  /*
    Baskınlık −1..+1. Pozitif = SOL (sayfanın şampiyonu) daha yüksek.

    GAIN: ham göreli fark (a−b)/(a+b) gerçek veride çok küçük çıkıyor — katılım
    %38'e karşı %43 yalnızca 0.06 eder, yani barın %3'ü; ekranda fark GÖRÜNMÜYORDU.
    3 ile çarpıp kırpınca "tam bar" = %33 göreli fark; bu metriklerde %33'lük bir
    açık zaten ezici. Sıralama ve işaret değişmez, yalnız ölçek okunur hâle gelir.

    Simetrik (@15) metriklerde bu formül tanımsız (değerler birbirinin negatifi)
    → baskınlık = değer / eşik.
  */
  const GAIN = 3;
  const off = r.full
    ? clamp(r.a / r.full, -1, 1)
    : (r.a + r.b === 0 ? 0 : clamp(((r.a - r.b) / (r.a + r.b)) * GAIN, -1, 1));

  const pct = Math.abs(off) * 50;      // izin verilen en uzun bar = yarım genişlik
  /*
    RENK = TARAF, kazanan değil. Eskiden yalnız önde olan taraf renkliydi, diğeri
    griydi; kullanıcı "KDA/katılımda sağ taraf neden beyaz?" diye sordu — gri sayı
    "önemsiz" gibi okunuyor, oysa iki sayı da aynı derecede veri. Artık SOL hep mavi
    (sayfanın şampiyonu), SAĞ hep kırmızı (rakip); kimin önde olduğunu BAR söylüyor.
    Tek istisna `neutral` satırlar (Emilen hasar): orada "önde" diye bir şey yok.
  */
  const col = r.neutral || off === 0 ? NEUTRAL : off > 0 ? COL_GOOD : COL_BAD;
  const colA = r.neutral ? NEUTRAL : COL_GOOD;
  const colB = r.neutral ? NEUTRAL : COL_BAD;

  return (
    <div>
      <p className={`text-center text-xs sm:text-[13px] text-gray-200 font-medium mb-1.5 ${SHADOW}`}>{r.label}</p>
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className="w-16 sm:w-20 text-right shrink-0"
          style={{ color: colA }}
        >
          {/* text-base DEĞİL text-[1rem]: bu projede --color-base tanımlı olduğu için
              "text-base" boyut değil RENK (sayfa zemini rgb(10,12,17)) uyguluyor.
              Sınıf eskiden de buradaydı ama aynı elemandaki inline style onu eziyordu;
              sayı + "norm." notu iki span'e ayrılınca renk açığa çıktı ve sayılar
              zemine karışıp GÖRÜNMEZ oldu. Ölçümle bulundu (computed color). */}
          <span className={`block text-[1rem] sm:text-lg font-bold tabular-nums ${SHADOW}`}>{r.fmt(r.a)}</span>
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
          className="w-16 sm:w-20 text-left shrink-0"
          style={{ color: colB }}
        >
          {/* text-base DEĞİL text-[1rem]: bu projede --color-base tanımlı olduğu için
              "text-base" boyut değil RENK (sayfa zemini rgb(10,12,17)) uyguluyor.
              Sınıf eskiden de buradaydı ama aynı elemandaki inline style onu eziyordu;
              sayı + "norm." notu iki span'e ayrılınca renk açığa çıktı ve sayılar
              zemine karışıp GÖRÜNMEZ oldu. Ölçümle bulundu (computed color). */}
          <span className={`block text-[1rem] sm:text-lg font-bold tabular-nums ${SHADOW}`}>{r.fmt(r.b)}</span>
        </span>
      </div>
      {r.sub && <p className={`text-center text-[10px] text-gray-400 tabular-nums mt-1 ${SHADOW}`}>{r.sub}</p>}
    </div>
  );
}

