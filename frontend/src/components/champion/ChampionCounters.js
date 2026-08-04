"use client";

import { useState } from "react";
import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { DD_ASSETS, DD_CDN } from "@/lib/ddragon";
import { scoreColor } from "@/components/summoner/pro/scoreColor";
import MatchupCompare from "@/components/champion/MatchupCompare";

/*
  Counter sayfası — TEK okuma katmanı: splash şeritleri.

  Soldan sağa renk spektrumu akar: sol uç en mavi (bizim en rahat eşleşmemiz),
  sağ uç en kırmızı (en zorlu rakip). Kartın rengi ve konumu aynı bilgiyi iki kez
  anlatır, sayıyı okumadan da anlaşılır. Detay (KDA/katılım/hasar/@15) kartın
  ÜZERİNE gelince açılır.

  NOT: altta ayrıca iki barlı liste ("Zorlu Rakipler" / "Rahat Eşleşmeler") vardı;
  aynı eşleşmeleri ikinci kez gösterdiği için hem sayfayı uzatıyor hem karıştırıyordu
  (kullanıcı bildirdi). Kaldırıldı — bilgi hover'a taşındı. Yan fayda: sayfa 20 yerine
  10 büyük dikey görsel çekiyor (loading art'lar Riot CDN'inden geliyor ve sayfanın
  asıl yavaşlama sebebiydi).

  Renk mantığı profil sayfasıyla AYNI (scoreColor): kırmızı → mor (~%50) → mavi.
  İlk render (server) birincil rolü gösterir → SSR HTML'de gerçek içerik (crawlable).
*/

// WR% → renk. scoreColor 0-10 alır; WR'nin ~%42-58 bandını tüm spektruma yayarız.
const wrColor = (wr) => scoreColor(5.5 + (wr - 50) * 0.5);

// Şerit başlıklarının rengi — uç değerlerin renkleriyle birebir aynı olsun.
const COL_GOOD = wrColor(58);
const COL_BAD = wrColor(42);

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};

// Dikey karakter görseli (loading art, 308x560) — kare ikondan çok daha "canlı" bir kart verir.
// DD_ASSETS = kendi aynamız: Riot CDN'inden bu görsel 0.6-1.2sn geliyordu ve şeritlerde
// 20 tane var; aynadan same-origin gelince sayfa açılışı saniyeler kısalıyor.
const loadingArt = (id) => `${DD_ASSETS}/cdn/img/champion/loading/${id}_0.jpg`;
const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };

/*
  Ayna henüz o şampiyonu indirmediyse (yeni şampiyon / assets:sync sonrası ilk tur)
  Riot CDN'ine düş — görsel kaybolmasın. Tek seferlik: fallback'in kendisi de
  başarısız olursa kart görselsiz kalır ama düzen bozulmaz.
*/
const artFallback = (id) => (e) => {
  const el = e.currentTarget;
  if (el.dataset.fellBack) { el.style.visibility = "hidden"; return; }
  el.dataset.fellBack = "1";
  el.src = `${DD_CDN}/cdn/img/champion/loading/${id}_0.jpg`;
};

const STRIP = 5; // şeritte her yönde kaç kart

export default function ChampionCounters({ champName, champImage, champId, counters, version, duos, guide }) {
  const positions = counters?.positions || [];
  const [role, setRole] = useState(counters?.primaryPosition || positions[0]?.position);
  // Kıyas tablosunda gösterilen eşleşme. null = "varsayılanı kullan" (en zorlu rakip):
  // rol değişince seçim otomatik sıfırlansın diye id yerine null tutuluyor.
  const [pickedId, setPickedId] = useState(null);
  const data = counters?.byPosition?.[role];

  if (!positions.length || !data) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-200 font-medium">Henüz yeterli matchup verisi yok</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-md mx-auto">
          {champName} için karşı koridor eşleşmeleri (rakip başına en az 10 maç) birikince
          buradaki counter listeleri otomatik dolacak. <span className="text-gray-400">Düşük örneklem — veriler toplanma aşamasında.</span>
        </p>
      </div>
    );
  }

  // Şerit: sol = en rahat (mavi), sağ = en zorlu (kırmızı). Zorlu liste ters çevrilir ki
  // en uç değer en sağda kalsın → renk spektrumu soldan sağa kesintisiz aksın.
  const stripGood = (data.strongInto || []).slice(0, STRIP);
  const stripBad = (data.counters || []).slice(0, STRIP).reverse();

  // Kıyas tablosunun konusu. Varsayılan = EN ZORLU rakip: sayfaya "X counter" diye
  // gelen ziyaretçinin ilk sorusu "beni kim yeniyor" — tablo o soruyla açılsın.
  const stripAll = [...stripGood, ...stripBad];
  const picked = stripAll.find((x) => x.id === pickedId)
    || (data.counters || [])[0]
    || stripAll[0]
    || null;

  return (
    <div className="space-y-4">
      {/* Rol filtresi */}
      {positions.length > 1 && (
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-1.5 flex-wrap">
          {positions.map((p) => (
            <button
              key={p.position}
              onClick={() => { setRole(p.position); setPickedId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === p.position ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <img src={ROLE_ICON[p.position]} alt={ROLE_LABELS[p.position]} width={16} height={16} className={role === p.position ? "" : "opacity-70"} />
              {ROLE_LABELS[p.position] || p.position}
            </button>
          ))}
        </div>
      )}

      {/* 1) Splash şeridi — tek bakışta özet. Kart TIKLANINCA altındaki kıyas
             tablosunu değiştirir (başka sayfaya GİTMEZ). */}
      {(stripGood.length > 0 || stripBad.length > 0) && (
        <MatchupStrip
          good={stripGood}
          bad={stripBad}
          champName={champName}
          pickedId={picked?.id}
          onPick={setPickedId}
        />
      )}

      {/* 2) Seçili eşleşmenin kafa-kafaya kıyası — şeridin "ne kadar" sorusunun
             ardından "neden" sorusunu yanıtlar. */}
      <MatchupCompare
        champId={champId}
        champName={champName}
        champImage={champImage}
        m={picked}
        version={version}
        guide={guide}
      />

      {/* 3) Genel oynanış rehberi (elle yazılır, admin panelinden). */}
      {guide?.play && (
        <div className="glass rounded-xl px-4 sm:px-6 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: COL_GOOD }}>
            {champName} nasıl oynanır?
          </p>
          <p className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-line">{guide.play}</p>
        </div>
      )}

      {/* 4) Alt koridor 2v2: karşı SUPPORT etkisi + aynı takım sinerjisi.
             Aynı koridor düellosu (ADC↔ADC) hikâyenin yarısı; bir Nautilus/Blitzcrank
             eşleşmesi karşı ADC kadar belirleyici olabiliyor. */}
      <BotLaneSection
        data={data}
        duos={duos}
        role={role}
        champName={champName}
        version={version}
      />
    </div>
  );
}

/* Yatay splash şeridi: sol uç en rahat (mavi) → sağ uç en zorlu (kırmızı). */
function MatchupStrip({
  good, bad, champName, heading, subtitle, footer, pickedId, onPick,
  goodLabel = "Rahat eşleşmeler", badLabel = "Zorlu rakipler",
}) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      {heading && (
        <div className="px-5 pt-3.5 pb-2.5">
          <h3 className="text-sm font-semibold text-gray-100">{heading}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed max-w-2xl">{subtitle}</p>}
        </div>
      )}

      {(good.length > 0 || bad.length > 0) && (
        <>
          {/* Şeridin iki ucunu adlandıran başlıklar. 11px'ken şeridin kendisinin yanında
              kayboluyordu (kullanıcı bildirdi); bunlar okuma yönünü veren etiketler,
              dipnot değil → gövde metninden büyük. */}
          <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-b border-edge/50 ${heading ? "border-t border-edge/30" : ""}`}>
            <span className="text-sm md:text-base font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
              {goodLabel}
            </span>
            <span className="text-[11px] text-gray-500 hidden sm:block">{champName} kazanma oranı</span>
            <span className="text-sm md:text-base font-bold tracking-wide uppercase" style={{ color: COL_BAD }}>
              {badLabel}
            </span>
          </div>

          <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
            {good.map((m) => <StripCard key={`g-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} />)}
            {good.length > 0 && bad.length > 0 && (
              <div className="shrink-0 self-stretch w-px bg-edge/60 mx-1.5" aria-hidden />
            )}
            {bad.map((m) => <StripCard key={`b-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} />)}
          </div>
        </>
      )}

      {footer}
    </div>
  );
}

/*
  Alt koridor 2v2 bölümü. İki farklı ilişkiyi TEK kartta birleştirir:
   - KARŞI takımın support'u → rakiplik (champion_matchups çapraz satırları)
   - AYNI takımın support'u  → sinerji (champion_duo_stats, shrinkage WR)
  Bunlar karıştırılmamalı: biri "kime karşı zorlanır", diğeri "kiminle güçlü".
*/
function BotLaneSection({ data, duos, role, champName, version }) {
  const isBot = role === "BOTTOM" || role === "UTILITY" || role === "SUPPORT";
  if (!isBot) return null;

  const crossPos = data?.crossPosition;
  const oppLabel = crossPos === "BOTTOM" ? "ADC" : "support";
  const mateLabel = role === "BOTTOM" ? "support" : "ADC";
  const duoList = (role === "BOTTOM" ? duos?.asAdc : duos?.asSupport) || [];

  const good = (data?.crossStrong || []).slice(0, STRIP);
  const bad = (data?.crossCounters || []).slice(0, STRIP).reverse();

  if (!good.length && !bad.length && !duoList.length) return null;

  const footer = duoList.length ? (
    <div className="border-t border-edge/40 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: COL_GOOD }}>
        {champName} Best Duos
        <span className="font-normal normal-case tracking-normal text-gray-400"> — aynı takımdaki en iyi {mateLabel} eşleri</span>
      </p>
      <div className="flex gap-2 overflow-x-auto">
        {duoList.map((d) => <DuoCard key={d.champion} d={d} version={version} />)}
      </div>
    </div>
  ) : null;

  return (
    <MatchupStrip
      good={good}
      bad={bad}
      champName={champName}
      heading={`Alt Koridor — ${crossPos === "BOTTOM" ? "Karşı ADC" : "Karşı Support"} Etkisi`}
      subtitle={`Alt koridor 2v2 oynanır: karşı ${oppLabel} de doğrudan rakiptir ve eşleşmeyi karşı ADC kadar belirleyebilir. Oranlar ${champName} tarafının o ${oppLabel} karşısındaki kazanma yüzdesidir.`}
      goodLabel={`Rahat karşı ${oppLabel}`}
      badLabel={`Zorlu karşı ${oppLabel}`}
      footer={footer}
    />
  );
}

/* Sinerji kartı — rakip değil, aynı takımdaki partner. */
function DuoCard({ d, version }) {
  const col = wrColor(d.adjWr);
  return (
    <Link
      href={`/champions/${d.champion}`}
      title={`${d.name} ile ${d.games} maç · gözlenen %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
      className="flex items-center gap-2 shrink-0 rounded-lg border border-edge/60 bg-black/25 pl-1.5 pr-3 py-1.5 hover:border-white/25 transition-colors"
    >
      <img
        src={champIcon(version, d.champion)}
        alt={d.name}
        width={30}
        height={30}
        className="rounded-md border border-edge"
        onError={hideOnError}
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-gray-200 truncate max-w-[100px]">{d.name}</div>
        <div className="text-[10px] tabular-nums" style={{ color: col }}>
          %{d.adjWr} <span className="text-gray-400">· {d.games} maç</span>
        </div>
      </div>
    </Link>
  );
}

/* Tek kart: dikey karakter görseli + kazanma oranı + maç sayısı (+ koridor etiketi). */
function StripCard({ m, picked, onPick }) {
  const col = wrColor(m.winRate);
  const lane = laneTag(m);

  return (
    /*
      LINK DEĞİL, DÜĞME. Eskiden karta tıklayınca rakibin counter sayfasına gidiliyordu;
      tıklama anında sayfa geçişi başlarken kart hem yukarı kalkıyor hem saydamlaşıyor,
      altındaki splash görseli sızıyordu ve bozuk duruyordu (kullanıcı bildirdi).
      Artık tıklama SAYFADA KALIR: alttaki kıyas tablosunun konusunu seçer. Rakibin
      sayfasına giden iç link kıyas tablosunun başlığında duruyor (SEO kaybı yok).

      bg-black: kartın kendi yüzeyi OPAK olmalı. Panel `.glass` ve kullanıcı "saydam
      kartlar" tercihini açtığında %52'ye kadar iniyor — yarı saydam bir kart yüzeyi
      arkasındaki splash'i geçiriyordu.
    */
    <button
      type="button"
      onClick={() => onPick?.(m.id)}
      aria-pressed={picked}
      title={`${m.name} — ${m.games} maç · kıyas için seç`}
      className={`group relative flex-1 min-w-[92px] max-w-[150px] shrink-0 rounded-lg overflow-hidden border bg-black text-left cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[var(--m)] hover:shadow-[0_10px_28px_-10px_var(--m)] ${
        picked ? "border-[var(--m)] -translate-y-1 shadow-[0_8px_24px_-10px_var(--m)]" : "border-edge/60"
      }`}
      style={{ "--m": col }}
    >
      {/* Üstte durumu tek bakışta veren renk şeridi — hover'da kalınlaşır */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-20 transition-all duration-300 group-hover:h-[5px]"
        style={{ backgroundColor: col }}
      />

      {/* Yükseklik loading art'ın dikey oranına (308x560) yakın tutulur — yatay bir
          kutuya sıkıştırılırsa karakterin yüzü kırpılıyor. */}
      <div className="relative h-[186px] overflow-hidden bg-black/40">
        <img
          src={loadingArt(m.id)}
          alt={m.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          onError={artFallback(m.id)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

        {/* İsim, alttan gelen şeride yer açmak için yukarı kayar */}
        <span className="absolute bottom-1.5 inset-x-0 px-1.5 text-center text-[11px] font-semibold text-white/95 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out group-hover:-translate-y-[52px]">
          {m.name}
        </span>

        {/*
          Head-to-head detayı (KDA / katılım / hasar / @15).

          ESKİDEN: kartı TAMAMEN kaplayan siyah panel fade-in oluyordu — şampiyon
          görseli kayboluyor, "kart arkaya dönüyor" hissi veriyordu (kullanıcı bu
          davranışın kaldırılmasını istedi). ŞİMDİ: alttan yukarı kayan ince şerit.
          Görsel görünür kalır, bilgi de kaybolmaz.
        */}
        {m.stats && (
          <div
            className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-black/88 backdrop-blur-[2px] border-t px-1.5 py-1.5 space-y-0.5"
            style={{ borderColor: col }}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[8px] text-gray-500 uppercase tracking-wide">KDA</span>
              <span className="text-[10px] font-bold text-gray-100 tabular-nums">
                {m.stats.kda.k}/{m.stats.kda.d}/{m.stats.kda.a}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[8px] text-gray-500 uppercase tracking-wide">KP</span>
              <span className="text-[10px] font-bold text-gray-100 tabular-nums">%{m.stats.kp}</span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[8px] text-gray-500 uppercase tracking-wide">Hasar</span>
              <span className="text-[10px] font-bold text-gray-100 tabular-nums">{(m.stats.dmg / 1000).toFixed(1)}k</span>
            </div>
            {m.lane15 && (
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[8px] text-gray-500 uppercase tracking-wide">15. dk</span>
                <span className={`text-[10px] font-bold tabular-nums ${m.lane15.gd15 >= 0 ? "text-blue-300" : "text-red-400"}`}>
                  {m.lane15.gd15 >= 0 ? "+" : ""}{m.lane15.gd15}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Maç sayısı 9px/gray-500'de okunmuyordu (kullanıcı bildirdi) — örneklem
          büyüklüğü oranın ne kadar güvenilir olduğunu söyleyen ASIL bilgi, dipnot değil. */}
      <div className="px-1.5 py-1.5 text-center">
        <div className="text-sm font-bold tabular-nums leading-none" style={{ color: col }}>%{m.winRate}</div>
        <div className="text-[11px] font-medium text-gray-300 tabular-nums mt-1">{m.games} maç</div>
        {lane && (
          <div className={`mt-1 text-[10px] font-semibold rounded px-1 py-0.5 border ${lane.cls}`}>{lane.text}</div>
        )}
      </div>
    </button>
  );
}

/*
  Koridor etiketi. @15 verisi (gold farkı) varsa onu gösterir — koridor fazının kimin
  lehine geçtiği, kazanma oranından bağımsız bir bilgidir. Veri yoksa ve örneklem
  düşükse dürüst bir "az veri" uyarısı verilir; ikisi de yoksa etiket basılmaz
  (uydurma rozet yok). @15 ileriye dönük dolduğu için başlangıçta çoğu kartta boştur.
*/
function laneTag(m) {
  const n = m.lane15?.n ?? 0;
  if (n >= 5) {
    const gd = m.lane15.gd15;
    if (gd >= 150) return { text: "koridor önde", cls: "bg-blue-500/20 text-blue-200 border-blue-400/30" };
    if (gd <= -150) return { text: "koridor geride", cls: "bg-red-500/20 text-red-200 border-red-400/30" };
    // "Dengeli" bilgi taşımıyor ve neredeyse her kartta çıkıp şeridi gürültüye
    // boğuyordu → etiket basılmaz, kart temiz kalır.
    return null;
  }
  // "az veri" bir UYARI: bu orana temkinli yaklaş demek. bg-white/5 + gray-500 ile
  // neredeyse görünmezdi (kullanıcı bildirdi) → soluk amber, uyarı gibi okunsun.
  if (m.games < 20) return { text: "az veri", cls: "bg-amber-400/15 text-amber-200/90 border-amber-400/25" };
  return null;
}

