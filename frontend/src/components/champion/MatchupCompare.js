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
  Satır tanımları.

  `full` YALNIZ simetrik (@15) metrikler için: değerler tanım gereği birbirinin
  negatifi (+408 / −408), dolayısıyla "payda içindeki pay" hesaplanamaz. Onun
  yerine baskınlık = fark / full, yani "tam bar" sayılan eşik. Eşikler koridor
  fazında BÜYÜK sayılan farklara göre seçildi: 1000 gold / 1200 tecrübe / 20 minyon
  (bu kadar fark koridoru kazanmış saymak için fazlasıyla yeter).

  `ba` / `bb` = iki tarafın KENDİ ortalaması (backend baseline / opp.base). Bar bunlara
  göre çizilir; gerekçe aşağıda CompareRow'da.
*/
function buildRows(m, baseline) {
  const us = m.stats;
  const them = m.opp?.stats;
  const l = m.lane15;
  const ol = m.opp?.lane15;
  const bs = baseline?.stats;          // bizim normalimiz
  const bl = baseline?.lane15;
  const os = m.opp?.base?.stats;       // rakibin normali
  const olb = m.opp?.base?.lane15;

  const rows = [
    {
      label: "KDA",
      a: kdaRatio(us?.kda),
      b: kdaRatio(them?.kda),
      ba: kdaRatio(bs?.kda),
      bb: kdaRatio(os?.kda),
      fmt: (v) => v.toFixed(2),
      sub: us?.kda && them?.kda
        ? `${us.kda.k}/${us.kda.d}/${us.kda.a} — ${them.kda.k}/${them.kda.d}/${them.kda.a}`
        : null,
    },
    { label: "Katılım", a: us?.kp, b: them?.kp, ba: bs?.kp, bb: os?.kp, fmt: (v) => `%${v}` },
    {
      label: "Şampiyon hasarı",
      a: us?.dmg, b: them?.dmg, ba: bs?.dmg, bb: os?.dmg,
      fmt: (v) => `${(v / 1000).toFixed(1)}k`,
    },
    /*
      ROL EKSENLERİ — hasar vurmak tek iş değil.

      Kullanıcı bildirdi: "Yuumi peeler, can/kalkan basar, tanklamaz; Rell tanklayan
      bir karakter." Üstteki eksenlerin hiçbiri bunu görmüyordu: Rell'in emdiği hasar
      da Yuumi'nin bastığı kalkan da tabloya girmiyordu, ikisi de yalnız "az hasar
      vuran" olarak okunuyordu.
    */
    /*
      Emilen hasar TARAFSIZ çizilir (mavi/kırmızı DEĞİL). "Çok emmek iyidir" bu metrikte
      TANIMSIZ: tank için işini yapmak, enchanter için kapılmak demek. Yuumi-Rell'de bar
      Yuumi'ye doğru maviydi — oysa Yuumi'nin normalinden %14 fazla hasar yemesi onun
      lehine bir şey değil. Yön yine bilgi taşır ("kendi normaline göre kim daha çok
      emiyor"), ama hüküm vermez.
    */
    { label: "Emilen hasar", a: us?.taken, b: them?.taken, ba: bs?.taken, bb: os?.taken, neutral: true, fmt: (v) => `${(v / 1000).toFixed(1)}k` },
    { label: "İyileştirme + kalkan", a: us?.hs, b: them?.hs, ba: bs?.hs, bb: os?.hs, fmt: (v) => `${(v / 1000).toFixed(1)}k` },
    { label: "CC süresi", a: us?.cc, b: them?.cc, ba: bs?.cc, bb: os?.cc, fmt: (v) => `${v} sn` },
    { label: "Gold farkı @15", a: l?.gd15, b: ol?.gd15, ba: bl?.gd15, bb: olb?.gd15, full: 1000, fmt: sgn },
    { label: "Tecrübe farkı @15", a: l?.xpd15, b: ol?.xpd15, ba: bl?.xpd15, bb: olb?.xpd15, full: 1200, fmt: sgn },
    { label: "Minyon farkı @15", a: l?.csd15, b: ol?.csd15, ba: bl?.csd15, bb: olb?.csd15, full: 20, fmt: sgn },
  ];

  // İki tarafı da olmayan satır BASILMAZ — tek taraflı kıyas yanıltıcı olur.
  // İkisi de SIFIR olan satır da basılmaz: iki büyücünün "CC süresi 0 sn"si bilgi
  // değil gürültüdür (işaretli @15 satırları hariç — orada 0 "denk" demektir).
  return rows.filter((r) => r.a != null && r.b != null && (r.full || r.a !== 0 || r.b !== 0));
}

const sgn = (v) => (v > 0 ? `+${v}` : `${v}`);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function MatchupCompare({ champId, champName, champImage, m, version, baseline }) {
  if (!m) return null;

  const rows = buildRows(m, baseline);
  const oppWr = +(100 - m.winRate).toFixed(1);
  const nStats = m.stats?.n ?? 0;
  const n15 = m.lane15?.n ?? 0;
  // Barların anlamı: en az bir satırda iki tarafın da normali biliniyorsa "sapma" modundayız.
  const relative = rows.some((r) => r.ba != null && r.bb != null);

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
            {/*
              Barın ne ölçtüğünü SÖYLEMEK zorundayız: büyük sayı ile barın yönü
              çelişebiliyor (Yuumi −274 gold geride ama kendi normalinin 240 önünde).
              Açıklama olmadan bu "hata" gibi okunur.
            */}
            {relative && (
              <p className={`text-center text-[11px] text-gray-400 leading-relaxed -mt-1 mb-1 ${SHADOW}`}>
                Barlar mutlak sayıyı değil, her şampiyonun{" "}
                <span className="text-gray-100 font-medium">kendi ortalamasından sapmasını</span> gösterir —
                minyon almayan bir destekle tanklayan bir destek aynı cetvelle ölçülemez.
              </p>
            )}
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
/*
  Bir tarafın KENDİ normalinden sapması, −1..+1 ölçeğinde.

  İşaretli (@15) metriklerde sapma bir FARK'tır (gold/cs), "tam bar" eşiği `full`.
  Pozitif ölçekli metriklerde (KDA/hasar/katılım) sapma bir ORAN'dır: 0 = normali,
  +0.2 = normalinin %20 üstü.
*/
function deviation(v, base, full) {
  if (base == null) return null;                 // normal bilinmiyor → sapma hesaplanamaz
  if (full) return (v - base) / full;
  return base === 0 ? 0 : v / base - 1;
}

function CompareRow({ r }) {
  /*
    Baskınlık −1..+1. Pozitif = SOL (sayfanın şampiyonu) önde.

    NEDEN SAPMA, MUTLAK DEĞİL (2026-08-05): mutlak sayı büyük ölçüde şampiyonun
    SINIFINI ölçüyor, eşleşmeyi değil. Yuumi minyon almaz ve kendini rakibe iliştirir;
    @15 gold farkı TÜM rakiplerine karşı ortalama −514'tür. Rell tanklar, ortalaması
    −154. Bu ikisini aynı cetvele koyunca Yuumi her rakibe karşı "geride" çıkıyordu —
    rakibin bununla ilgisi yok. Ölçülen örnek: Yuumi-vs-Rell gd15 = −274, yani Yuumi
    kendi normalinden 240 gold ÖNDE; eski bar bunu Rell lehine tam kırmızı çiziyordu.

    Sapma yoksa (yeni şampiyon, az veri) eski mutlak davranışa düşülür — bar hiç
    olmamasından iyidir, yalnız açıklaması "normaline göre" olmaz.

    GAIN: ham göreli fark gerçek veride çok küçük çıkıyor (katılım %38'e karşı %43 =
    barın %3'ü, ekranda GÖRÜNMÜYORDU). Oran metriklerinde 3 ile çarpılır → "tam bar"
    = %33 göreli fark, ki bu zaten ezici üstünlük. @15'te sapmalar zaten `full`
    ölçeğinde olduğu için ek kazanç uygulanmaz.
  */
  const GAIN = 3;
  const da = deviation(r.a, r.ba, r.full);
  const db = deviation(r.b, r.bb, r.full);
  const relative = da != null && db != null;

  let off;
  if (relative) {
    off = clamp((da - db) * (r.full ? 1 : GAIN), -1, 1);
  } else if (r.full) {
    off = clamp(r.a / r.full, -1, 1);                                     // simetrik metrik: fark / eşik
  } else {
    off = r.a + r.b === 0 ? 0 : clamp(((r.a - r.b) / (r.a + r.b)) * GAIN, -1, 1);
  }

  const pct = Math.abs(off) * 50;      // izin verilen en uzun bar = yarım genişlik
  // r.neutral: yönü göster, hüküm verme (bkz. "Emilen hasar" gerekçesi).
  const col = r.neutral || off === 0 ? NEUTRAL : off > 0 ? COL_GOOD : COL_BAD;
  const colA = r.neutral ? NEUTRAL : off > 0 ? COL_GOOD : NEUTRAL;
  const colB = r.neutral ? NEUTRAL : off < 0 ? COL_BAD : NEUTRAL;

  return (
    <div>
      <p className={`text-center text-xs sm:text-[13px] text-gray-200 font-medium mb-1.5 ${SHADOW}`}>{r.label}</p>
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className="w-16 sm:w-20 text-right shrink-0"
          style={{ color: colA }}
        >
          <span className={`block text-base sm:text-lg font-bold tabular-nums ${SHADOW}`}>{r.fmt(r.a)}</span>
          <NormNote dev={da} full={r.full} base={r.ba} value={r.a} fmt={r.fmt} />
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
          <span className={`block text-base sm:text-lg font-bold tabular-nums ${SHADOW}`}>{r.fmt(r.b)}</span>
          <NormNote dev={db} full={r.full} base={r.bb} value={r.b} fmt={r.fmt} />
        </span>
      </div>
      {r.sub && <p className={`text-center text-[10px] text-gray-400 tabular-nums mt-1 ${SHADOW}`}>{r.sub}</p>}
    </div>
  );
}

/*
  Sayının altındaki küçük not: "normaline göre +240".

  Büyük sayı KONKRE olanı (gerçekte ne oldu), bu not ise barın NEDEN o yöne gittiğini
  söyler. İkisi çelişebilir ve çelişmesi doğrudur: Yuumi −274 gold geride ama kendi
  ortalamasının 240 gold önünde. Not olmadan bar "yanlış" görünürdü.
*/
function NormNote({ dev, full, base, value, fmt }) {
  if (dev == null || base == null) return null;

  // Sapma metriğin kendi biriminde okunur: @15'te ham fark, oranlarda yüzde.
  const text = full ? sgn(Math.round(value - base)) : `%${sgn(Math.round(dev * 100))}`;
  const dead = Math.abs(dev) < (full ? 0.03 : 0.02);

  return (
    <span
      className={`block text-[10px] leading-tight tabular-nums mt-0.5 ${SHADOW} ${dead ? "text-gray-500" : "text-gray-300"}`}
      title={`Kendi ortalaması: ${fmt(base)} — bu eşleşmede ${text}`}
    >
      norm. {text}
    </span>
  );
}
