"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { DD_ASSETS, DD_CDN } from "@/lib/ddragon";
import { scoreColor } from "@/components/summoner/pro/scoreColor";
import MatchupCompare from "@/components/champion/MatchupCompare";
import { trackEvent } from "@/lib/analytics";

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

  /*
    SOL RAY. Kullanıcı: "yukarıdan karakteri seçiyorum ama altındaki analitikler
    çok altta kalıyor". Şerit ekrandan TAMAMEN çıkınca kıyas panelinin soluna
    dikey bir seçici kayarak giriyor → aşağıdayken yukarı çıkmadan rakip değişir.
    IntersectionObserver eşik 0: "tamamen çıktı" = isIntersecting false.
    Sayfa konteyneri max-w-7xl (1280px); ray için iki yanda ~72px pay gerekiyor
    → yalnız 1440px+ ekranlarda gösterilir, dar ekranda düzeni bozmaz.
  */
  const stripRef = useRef(null);
  const [railOn, setRailOn] = useState(false);
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setRailOn(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [role]);

  // ⚠ Buradan SONRA erken return var; hook'ların hepsi YUKARIDA kalmalı
  //   (koşullu çağrılan hook React'te sıra bozar).

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
  /*
    Sinerji listesi (aynı takımdaki en iyi eş) — şeridin ARKA YÜZÜNDE.
    Eskiden ayrı bir "Alt Koridor — Karşı ADC Etkisi" bölümünün dibinde küçük
    pill'ler hâlinde duruyordu; kullanıcı o bölümü "saçma olmuş, anlaşılmıyor"
    diye kaldırttı. Bilgi kaybolmasın diye buraya taşındı: aynı kartın arkasına
    dönen bir sekme, aynı görsel dille (splash kartları).
  */
  const duoList = (role === "BOTTOM" ? duos?.asAdc : duos?.asSupport) || [];

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
              onClick={() => { trackEvent("counter_rolu_degisti", { rol: p.position }); setRole(p.position); setPickedId(null); }}
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
      <div ref={stripRef}>
      {(stripGood.length > 0 || stripBad.length > 0) && (
        <MatchupStrip
          good={stripGood}
          bad={stripBad}
          champName={champName}
          pickedId={picked?.id}
          onPick={(id) => {
            // Kıyas tablosu bu sayfanın en pahalı parçası — gerçekten
            // seçiliyor mu, yoksa kartlar salt görsel mi kalıyor?
            if (id) trackEvent("counter_kiyasi_secildi", { rakip: id, rol: role });
            setPickedId(id);
          }}
          baseline={data.baseline}
          duos={duoList}
          mateLabel={role === "BOTTOM" ? "support" : "ADC"}
          version={version}
        />
      )}
      </div>

      {/* 2) Seçili eşleşmenin kafa-kafaya kıyası — şeridin "ne kadar" sorusunun
             ardından "neden" sorusunu yanıtlar. */}
      <div className="relative">
        {/*
          Ray, panelin SOLUNDA ve panel yüksekliği boyunca yapışkan. `absolute`
          kapsayıcı + içeride `sticky`: absolute kutu panel kadar uzun olduğu için
          sticky çocuk o aralık boyunca ekranda kalır.
        */}
        <div
          className={`absolute inset-y-0 right-full mr-3 hidden min-[1440px]:block transition-all duration-300 ease-out ${
            railOn ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
          }`}
          aria-hidden={!railOn}
        >
          <div className="sticky top-24 flex flex-col gap-1.5">
            {stripAll.map((m) => (
              <RailPick
                key={m.id}
                m={m}
                version={version}
                picked={m.id === picked?.id}
                onPick={setPickedId}
              />
            ))}
          </div>
        </div>

        <MatchupCompare
          champId={champId}
          champName={champName}
          champImage={champImage}
          m={picked}
          version={version}
          guide={guide}
        />
      </div>

      {/*
        3) Rehber metinleri — kıyas panelinin SOL/SAĞ dilini sürdürür:
           solda sayfanın şampiyonu, sağda seçili rakip. Eskiden eşleşme notu
           kıyas panelinin İÇİNDE, genel metin ise apayrı bir kartta duruyordu;
           ikisi aynı soruyu ("nasıl oynanır") yanıtladığı hâlde sayfanın iki
           ayrı yerine dağılmıştı (kullanıcı "kötü yerleştirmişsin" dedi).
           Yan yana koyunca "ben nasıl oynarım / ona karşı nasıl oynarım"
           karşılaştırması doğrudan okunuyor.
      */}
      {(guide?.play || (picked && guide?.vs?.[picked.id])) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {guide?.play && (
            <GuideCard title={`${champName} nasıl oynanır?`} color={COL_GOOD} text={guide.play} />
          )}
          {picked && guide?.vs?.[picked.id] && (
            <GuideCard
              title={`${picked.name} karşısında nasıl oynanır?`}
              color={COL_BAD}
              text={guide.vs[picked.id]}
            />
          )}
        </div>
      )}

    </div>
  );
}

/*
  Yatay splash şeridi: sol uç en rahat (mavi) → sağ uç en zorlu (kırmızı).

  İKİ YÜZLÜ. Ön yüz rakipler, arka yüz "en iyi uyumlular" (aynı takımdaki eş).
  Sinerji eskiden ayrı bir "Alt Koridor — Karşı ADC Etkisi" bölümünün dibinde
  küçük pill'ler hâlindeydi; kullanıcı o bölümü "saçma olmuş, anlaşılmıyor"
  diye kaldırttı ve sinerjinin bu kartın arkasına dönmesini istedi.

  Kartın yüksekliği iki yüzden UZUN olanına göre sabitlenir: ikisi de aynı
  grid hücresinde durur (absolute konumlandırma değil) → dönerken zıplama olmaz.
*/
function MatchupStrip({
  good, bad, champName, pickedId, onPick, baseline, duos = [], mateLabel = "eş", version,
}) {
  const [face, setFace] = useState("rakip");
  const hasDuos = duos.length > 0;
  const flipped = hasDuos && face === "uyum";

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/*
        SEKMELER — bitişik segment kontrolü. Eskiden iki ayrı düğme gibi duruyordu
        ve etiketler uzundu ("{champName} ile en iyi uyumlular"); kullanıcı "yerleri
        belli değil, çok uzun" dedi. Tek çerçeve içinde iki segment: hangisinin
        seçili olduğu dolu zeminden okunuyor, isimler kısaldı.
      */}
      {hasDuos && (
        <div className="px-4 pt-3 pb-2.5 border-b border-edge/30">
          <div className="inline-flex rounded-lg border border-edge/70 bg-black/40 p-0.5">
            <StripTab active={!flipped} color={COL_BAD} onClick={() => setFace("rakip")}>
              Rakipler
            </StripTab>
            <StripTab active={flipped} color={COL_GOOD} onClick={() => setFace("uyum")}>
              Uyumlular
            </StripTab>
          </div>
        </div>
      )}

      {/* perspective dışta, döndürme içte — iç kutu 3B uzayda çevrilir */}
      <div className="[perspective:1600px]">
        <div
          className={`grid transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* ÖN YÜZ — rakipler */}
          <div
            className={`col-start-1 row-start-1 [backface-visibility:hidden] ${flipped ? "invisible" : ""}`}
            aria-hidden={flipped}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-edge/50">
              <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
                Rahat eşleşmeler
              </span>
              <span className="text-[11px] text-gray-500 hidden sm:block">{champName} kazanma oranı</span>
              <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_BAD }}>
                Zorlu rakipler
              </span>
            </div>

            <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
              {good.map((m) => <StripCard key={`g-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} baseline={baseline} />)}
              {good.length > 0 && bad.length > 0 && (
                <div className="shrink-0 self-stretch w-px bg-edge/60 mx-1.5" aria-hidden />
              )}
              {bad.map((m) => <StripCard key={`b-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} baseline={baseline} />)}
            </div>
          </div>

          {/* ARKA YÜZ — sinerji. Rakiplik DEĞİL: aynı takımdaki eş. */}
          <div
            className={`col-start-1 row-start-1 [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? "" : "invisible"}`}
            aria-hidden={!flipped}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-edge/50">
              <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
                En iyi {mateLabel} eşleri
              </span>
              <span className="text-[11px] text-gray-500 hidden sm:block">aynı takımda kazanma oranı</span>
            </div>

            <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
              {duos.map((d) => <DuoStripCard key={d.champion} d={d} version={version} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Şerit sekmesi — seçili olan kendi rengiyle dolu, diğeri sönük. */
function StripTab({ active, color, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-1.5 rounded-[6px] text-xs font-bold tracking-wide transition-colors cursor-pointer ${
        active ? "" : "text-gray-400 hover:text-gray-200"
      }`}
      style={active ? { color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` } : undefined}
    >
      {children}
    </button>
  );
}

/*
  Sol raydaki tek seçim düğmesi — şerit ekrandan çıktığında kıyas panelinin
  solunda beliren dikey liste. Sadece ikon + oran: burası bir ÖZET değil,
  hızlı geçiş kumandası; ayrıntı zaten sağdaki panelde.
*/
function RailPick({ m, version, picked, onPick }) {
  const col = wrColor(m.winRate);

  return (
    <button
      type="button"
      onClick={() => onPick?.(m.id)}
      aria-pressed={picked}
      title={`${m.name} — %${m.winRate} · ${m.games} maç`}
      className={`group relative flex flex-col items-center gap-0.5 rounded-lg border p-1 bg-black/60 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:border-[var(--m)] ${
        picked ? "border-[var(--m)] bg-black/85" : "border-edge/50"
      }`}
      style={{ "--m": col }}
    >
      <img
        src={champIcon(version, m.id)}
        alt={m.name}
        width={34}
        height={34}
        className={`rounded-md transition-transform duration-200 group-hover:scale-105 ${picked ? "" : "opacity-75 group-hover:opacity-100"}`}
        onError={hideOnError}
      />
      <span className="text-[9px] font-bold tabular-nums leading-none" style={{ color: col }}>%{Math.round(m.winRate)}</span>
    </button>
  );
}

/*
  Sinerji kartı — rakip değil, AYNI takımdaki eş. Rakip kartlarıyla aynı görsel
  dilde: iki yüz aynı yükseklikte olsun ve dönüş sırasında kart boyu değişmesin.
  Oran örneklem-duyarlı (adjWr): 3 maçlık %100 en tepeye çıkmasın.
*/
function DuoStripCard({ d, version }) {
  const col = wrColor(d.adjWr);

  return (
    <Link
      href={`/champions/${d.champion}`}
      title={`${d.name} ile ${d.games} maç · gözlenen %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
      className="group relative flex flex-col flex-1 min-w-[92px] max-w-[150px] shrink-0 rounded-lg overflow-hidden border border-edge/60 bg-black transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[var(--m)] hover:shadow-[0_10px_28px_-10px_var(--m)]"
      style={{ "--m": col }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] z-20 transition-all duration-300 group-hover:h-[5px]" style={{ backgroundColor: col }} />

      <div className="relative h-[186px] overflow-hidden bg-black">
        <img
          src={loadingArt(d.champion)}
          alt={`${d.name} — ${d.name} ile uyum`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          onError={artFallback(d.champion)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
        <span className="absolute bottom-1.5 inset-x-0 px-1.5 text-center text-[11px] font-semibold text-white/95 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {d.name}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-1.5 py-1.5 text-center bg-black">
        <div className="text-sm font-bold tabular-nums leading-none" style={{ color: col }}>%{d.adjWr}</div>
        <div className="text-[11px] font-medium text-gray-300 tabular-nums mt-1">{d.games} maç</div>
      </div>
    </Link>
  );
}

/* Tek kart: dikey karakter görseli + kazanma oranı + maç sayısı (+ koridor etiketi). */
function StripCard({ m, picked, onPick, baseline }) {
  const col = wrColor(m.winRate);
  const lane = laneTag(m, baseline);

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
      className={`group relative flex flex-col flex-1 min-w-[92px] max-w-[150px] shrink-0 rounded-lg overflow-hidden border bg-black text-left cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[var(--m)] hover:shadow-[0_10px_28px_-10px_var(--m)] ${
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
      <div className="relative h-[186px] overflow-hidden bg-black">
        <img
          src={loadingArt(m.id)}
          alt={`${m.name} — ${m.name} counter eşleşmesi`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          onError={artFallback(m.id)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

        {/* İsim hover'da SÖNER — çünkü aynı isim aşağıdan gelen şeridin başlığında
            zaten var. Eskiden sabit -52px yukarı kaydırılıyordu; şerit yüksekliği
            satır sayısına göre değiştiği için (3 ya da 4 satır) isim şeridin
            kenarlığının ÜSTÜNE biniyordu (kullanıcı bildirdi). */}
        <span className="absolute bottom-1.5 inset-x-0 px-1.5 text-center text-[11px] font-semibold text-white/95 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-opacity duration-200 group-hover:opacity-0">
          {m.name}
        </span>

        {/*
          Head-to-head detayı (KDA / katılım / hasar / @15).

          ESKİDEN: kartı TAMAMEN kaplayan siyah panel fade-in oluyordu — şampiyon
          görseli kayboluyor, "kart arkaya dönüyor" hissi veriyordu (kullanıcı bu
          davranışın kaldırılmasını istedi). ŞİMDİ: alttan yukarı kayan şerit,
          BAŞLIĞINDA şampiyon adıyla. Görsel görünür kalır, bilgi de kaybolmaz.

          Zemin ALT BÖLÜMLE AYNI (bg-black): eskiden şerit bg-black/88, alt bölüm
          düz siyahtı → aralarında görünür bir dikiş çizgisi oluşuyor ve tam
          kazanma oranının üstünden geçiyordu (kullanıcı bunu işaretledi).
        */}
        {m.stats && (
          <div
            className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-black border-t px-1.5 pt-1 pb-1.5"
            style={{ borderColor: col }}
          >
            <p className="text-[11px] font-semibold text-white text-center truncate mb-1">{m.name}</p>
            <div className="space-y-0.5">
              <StatLine k="KDA" v={`${m.stats.kda.k}/${m.stats.kda.d}/${m.stats.kda.a}`} />
              <StatLine k="KP" v={`%${m.stats.kp}`} />
              <StatLine k="Hasar" v={`${(m.stats.dmg / 1000).toFixed(1)}k`} />
              {m.lane15 && (
                <StatLine
                  k="15. dk"
                  v={`${m.lane15.gd15 >= 0 ? "+" : ""}${m.lane15.gd15}`}
                  cls={m.lane15.gd15 >= 0 ? "text-blue-300" : "text-red-400"}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Maç sayısı 9px/gray-500'de okunmuyordu (kullanıcı bildirdi) — örneklem
          büyüklüğü oranın ne kadar güvenilir olduğunu söyleyen ASIL bilgi, dipnot değil.
          flex-1 + justify-center: kartlar eşit boya gerildiği için (items-stretch) rozeti
          olmayan kartın altında koca bir boşluk kalıyordu; içerik artık ortalanıyor. */}
      <div className="flex-1 flex flex-col justify-center px-1.5 py-1.5 text-center bg-black">
        <div className="text-sm font-bold tabular-nums leading-none" style={{ color: col }}>%{m.winRate}</div>
        <div className="text-[11px] font-medium text-gray-300 tabular-nums mt-1">{m.games} maç</div>
        {lane && (
          <div className={`mt-1 mx-auto text-[10px] font-semibold rounded px-1 py-0.5 border ${lane.cls}`}>{lane.text}</div>
        )}
      </div>
    </button>
  );
}

/* Elle yazılmış rehber metni kartı (nasıl oynanır / X karşısında nasıl oynanır). */
function GuideCard({ title, color, text }) {
  return (
    <div className="glass rounded-xl px-4 sm:px-6 py-4 h-full">
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color }}>{title}</p>
      <p className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

/* Hover şeridindeki tek satır: solda etiket, sağda değer. */
function StatLine({ k, v, cls = "text-gray-100" }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[8px] text-gray-500 uppercase tracking-wide">{k}</span>
      <span className={`text-[10px] font-bold tabular-nums ${cls}`}>{v}</span>
    </div>
  );
}

/*
  Koridor etiketi. @15 gold farkını, şampiyonun KENDİ ortalamasına göre okur.

  Eskiden mutlak eşikti (±150) ve bu bir eşleşme etiketi değil ŞAMPİYON etiketi
  oluyordu: Yuumi'nin tüm rakiplerine karşı ortalaması −514 olduğu için Yuumi'nin
  neredeyse her kartında "koridor geride" yazıyordu; Pyke'ın ortalaması +286 olduğu
  için onda hiç çıkmıyordu (2026-08-05 ölçümü). Rakibin bununla ilgisi yok.

  Şimdi eşik SAPMAYA uygulanıyor → etiket "bu rakip bana normalden zor/kolay geliyor"
  demek oluyor. Sözcükler de ona göre: "önde/geride" değil "rahat/zor" — Yuumi
  Rell karşısında normalinin 240 gold önünde ama hâlâ mutlak olarak geride.

  Veri yoksa ve örneklem düşükse dürüst bir "az veri" uyarısı verilir; ikisi de
  yoksa etiket basılmaz (uydurma rozet yok).
*/
function laneTag(m, baseline) {
  const n = m.lane15?.n ?? 0;
  if (n >= 5) {
    const norm = baseline?.lane15?.gd15;
    // Normal bilinmiyorsa mutlak değere düş (eski davranış) — etiket hiç olmamasından iyi.
    const rel = norm == null ? m.lane15.gd15 : m.lane15.gd15 - norm;
    if (rel >= 150) return { text: "koridor rahat", cls: "bg-blue-500/20 text-blue-200 border-blue-400/30" };
    if (rel <= -150) return { text: "koridor zor", cls: "bg-red-500/20 text-red-200 border-red-400/30" };
    // "Dengeli" bilgi taşımıyor ve neredeyse her kartta çıkıp şeridi gürültüye
    // boğuyordu → etiket basılmaz, kart temiz kalır.
    return null;
  }
  // "az veri" bir UYARI: bu orana temkinli yaklaş demek. bg-white/5 + gray-500 ile
  // neredeyse görünmezdi (kullanıcı bildirdi) → soluk amber, uyarı gibi okunsun.
  if (m.games < 20) return { text: "az veri", cls: "bg-amber-400/15 text-amber-200/90 border-amber-400/25" };
  return null;
}

