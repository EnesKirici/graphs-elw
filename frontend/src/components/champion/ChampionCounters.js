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
  /*
    Şerit hangi yüzünde? State BURADA, MatchupStrip'in içinde değil: sol/sağ ray
    "uyumlular" sekmesindeyken çıkmamalı (o sekmede kıyas paneli değişmiyor,
    seçici anlamsız oluyor — kullanıcı bildirdi).
  */
  const [face, setFace] = useState("rakip");
  const data = counters?.byPosition?.[role];

  /*
    SOL RAY. Kullanıcı: "yukarıdan karakteri seçiyorum ama altındaki analitikler
    çok altta kalıyor". Şerit ekrandan TAMAMEN çıkınca kıyas panelinin soluna
    dikey bir seçici giriyor → aşağıdayken yukarı çıkmadan rakip değişir.

    NEDEN `sticky` DEĞİL `fixed`: sayfanın ortak sarmalayıcısında
    (`div.dpm-scope … overflow-hidden`) overflow gizli. `overflow: hidden` olan bir
    ATA, position:sticky'yi öldürür — kutu kaydırma kabı olur ama kendisi kaymaz,
    yapışkan çocuk sayfayla birlikte akıp gider. (Ölçüldü: sticky hesaplanıyordu
    ama top −145 → −485 diye kayıyordu.) O sarmalayıcı bütün sayfalarda ortak,
    dokunmak istemedim → ray `fixed`, yatay konumu panelin ölçülen sol kenarından.

    Görünürlük koşulu: şerit tamamen yukarıda kalmış + kıyas paneli hâlâ ekranda
    (yoksa ray SSS bölümünün üstünde asılı kalırdı) + ekran 1440px+ (konteyner
    max-w-7xl = 1280px; ray için iki yanda pay gerekiyor).
  */
  const stripRef = useRef(null);
  const panelRef = useRef(null);
  const [rail, setRail] = useState({ show: false, left: 0 });
  const railSon = useRef({ show: false, left: 0 });

  useEffect(() => {
    const hesapla = () => {
      const strip = stripRef.current;
      const panel = panelRef.current;
      if (!strip || !panel) return;
      const s = strip.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      /*
        ESKİDEN `s.bottom < 8` idi — yani şerit SON PİKSELİNE kadar çıkmadan ray
        gelmiyordu. Kullanıcı "yeteri kadar scroll attığımı düşünüyorum, hâlâ
        çıkmadı" dedi; ekran görüntüsünde şeridin alt ~165px'i hâlâ görünüyordu.
        Artık ORAN'a bakılıyor: şeridin görünen kısmı yarıdan azsa ray gelir.
      */
      const gorunen = Math.max(0, Math.min(s.bottom, window.innerHeight) - Math.max(s.top, 0));
      const oran = s.height > 0 ? gorunen / s.height : 0;
      /*
        Ray SAĞDA: tıklayınca değişen taraf panelin sağı (rakip). Seçiciyi
        değiştirdiği şeyin yanına koymak göz hareketini yarıya indiriyor.
        "Uyumlular" sekmesindeyken hiç çıkmaz — orada kıyas paneli değişmiyor.
      */
      const show = face === "rakip" && oran < 0.5 && p.bottom > 340 && window.innerWidth >= 1440;
      const left = Math.round(p.right + 14);
      // Her scroll olayında setState ETME — yalnız değer değişince.
      if (show !== railSon.current.show || Math.abs(left - railSon.current.left) > 1) {
        railSon.current = { show, left };
        setRail(railSon.current);
      }
    };
    hesapla();
    window.addEventListener("scroll", hesapla, { passive: true });
    window.addEventListener("resize", hesapla);
    return () => {
      window.removeEventListener("scroll", hesapla);
      window.removeEventListener("resize", hesapla);
    };
  }, [role, face]);

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
              onClick={() => { trackEvent("counter_rolu_degisti", { rol: p.position }); setRole(p.position); setPickedId(null); setFace("rakip"); }}
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
                   duos={duoList}
          mateLabel={role === "BOTTOM" ? "support" : "ADC"}
          version={version}
          face={face}
          setFace={setFace}
        />
      )}
      </div>

      {/* 2) Seçili eşleşmenin kafa-kafaya kıyası — şeridin "ne kadar" sorusunun
             ardından "neden" sorusunu yanıtlar. */}
      {/*
        Sekmeye göre ALT BÖLÜM değişir.

        Eskiden altta HER ZAMAN kıyas paneli duruyordu; "Uyumlular"a basınca üstte
        eşler, altta hâlâ bir RAKİP kıyası kalıyordu (Yuumi vs Senna) — kullanıcı
        "altındaki yer çok saçma kalıyor" dedi ve haklıydı: iki bölüm farklı
        soruların cevabıydı. Sinerjinin karşılığı kafa-kafaya kıyas değil, sıralı
        bir liste → tablo.
      */}
      {face === "uyum" ? (
        <DuoTable duos={duoList} champName={champName} mateLabel={role === "BOTTOM" ? "support" : "ADC"} version={version} />
      ) : (
      <div ref={panelRef}>
        <div
          className={`fixed top-24 z-30 w-[62px] flex flex-col gap-1.5 transition-all duration-300 ease-out ${
            rail.show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          }`}
          style={{ left: rail.left }}
          aria-hidden={!rail.show}
        >
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

        <MatchupCompare
          champId={champId}
          champName={champName}
          champImage={champImage}
          m={picked}
          version={version}
          role={role}
        />
      </div>
      )}

      {/*
        3) Rehber metinleri — kıyas panelinin SOL/SAĞ dilini sürdürür:
           solda sayfanın şampiyonu, sağda seçili rakip. Eskiden eşleşme notu
           kıyas panelinin İÇİNDE, genel metin ise apayrı bir kartta duruyordu;
           ikisi aynı soruyu ("nasıl oynanır") yanıtladığı hâlde sayfanın iki
           ayrı yerine dağılmıştı (kullanıcı "kötü yerleştirmişsin" dedi).
           Yan yana koyunca "ben nasıl oynarım / ona karşı nasıl oynarım"
           karşılaştırması doğrudan okunuyor.
      */}
      {face === "rakip" && (guide?.play || (picked && guide?.vs?.[picked.id])) && (
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
  good, bad, champName, pickedId, onPick, duos = [], mateLabel = "eş", version, face, setFace,
}) {
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
        {/*
          grid-cols-1 ŞART. Çıplak `grid` otomatik sütun kullanır ve sütun İÇERİĞE
          göre büyür: 52 kartlık uyumlular şeridi kutuyu 5224px'e çıkarıyordu
          (ölçüldü: clientWidth === scrollWidth === 5224) → `overflow-x-auto` hiç
          devreye girmiyor, başlık x=−3659'a kaçıyordu. grid-cols-1 =
          `repeat(1, minmax(0,1fr))`; minmax(0,…) içeriğin sütunu şişirmesini keser.
        */}
        <div
          className={`grid grid-cols-1 transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* ÖN YÜZ — rakipler */}
          <div
            className={`col-start-1 row-start-1 min-w-0 [backface-visibility:hidden] ${flipped ? "invisible" : ""}`}
            aria-hidden={flipped}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-edge/50">
              <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
                Rahat rakipler
              </span>
              <span className="text-[11px] text-gray-500 hidden sm:block">{champName} kazanma oranı</span>
              <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_BAD }}>
                Zorlu rakipler
              </span>
            </div>

            <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
              {good.map((m) => <StripCard key={`g-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} />)}
              {good.length > 0 && bad.length > 0 && (
                <div className="shrink-0 self-stretch w-px bg-edge/60 mx-1.5" aria-hidden />
              )}
              {bad.map((m) => <StripCard key={`b-${m.id}`} m={m} picked={m.id === pickedId} onPick={onPick} />)}
            </div>
          </div>

          {/* ARKA YÜZ — sinerji. Rakiplik DEĞİL: aynı takımdaki eş. */}
          <div
            className={`col-start-1 row-start-1 min-w-0 [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? "" : "invisible"}`}
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

/*
  UYUMLULAR TABLOSU — şeridin altındaki bölüm.

  Sinerji sorusu ("kiminle iyi gidiyorum") sıralı bir listedir; kafa-kafaya kıyas
  paneli buraya uymuyordu. Tablo sıralamayı, örneklemi ve oranı aynı anda okutur.

  İKİ ORAN AYNI SATIRDA: gözlenen (ham) ve örneklem-duyarlı. 10 maçlık %52.7 ile
  465 maçlık %52.7 aynı şey değil; sıralama İKİNCİSİNE göre yapılır ve çubuk da
  onu çizer. Ham oran yanında küçük kalır ki "veriyi sakladık" izlenimi olmasın.
*/
function DuoTable({ duos, champName, mateLabel, version }) {
  if (!duos?.length) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 py-3.5 border-b border-edge/50">
        <h3 className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
          {champName} ile en iyi {mateLabel} eşleri
        </h3>
        <span className="text-[11px] text-gray-500">{duos.length} eş · aynı takımda kazanma oranı</span>
      </div>

      {/* Uzun liste (50+) kartı sayfa boyu uzatmasın → kendi kaydırması. */}
      <div className="max-h-[520px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <tr className="text-[10px] uppercase tracking-wider text-gray-500">
              <th className="text-left font-medium pl-4 pr-2 py-2 w-8">#</th>
              <th className="text-left font-medium py-2">{mateLabel}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">maç</th>
              <th className="text-left font-medium px-3 py-2 w-[38%]">kazanma oranı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/25">
            {duos.map((d, i) => {
              const col = wrColor(d.adjWr);
              // Çubuk %42-58 bandını tüm genişliğe yayar — WR'ler dar bir aralıkta
              // toplandığı için 0-100 ölçeğinde hepsi aynı uzunlukta görünürdü.
              const dolu = Math.max(4, Math.min(100, ((d.adjWr - 42) / 16) * 100));
              return (
                <tr key={d.champion} className="hover:bg-hover transition-colors">
                  <td className="pl-4 pr-2 py-2 text-[11px] text-gray-500 tabular-nums">{i + 1}</td>
                  <td className="py-2">
                    <Link href={`/champions/${d.champion}`} className="flex items-center gap-2.5 group">
                      <img
                        src={champIcon(version, d.champion)}
                        alt={d.name}
                        width={28}
                        height={28}
                        className="rounded-md border border-edge/60 shrink-0"
                        onError={hideOnError}
                      />
                      <span className="text-xs font-semibold text-gray-100 group-hover:text-white truncate">{d.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{d.games}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden min-w-[60px]">
                        <div className="h-full rounded-full" style={{ width: `${dolu}%`, backgroundColor: col }} />
                      </div>
                      <span className="text-sm font-bold tabular-nums w-12 text-right" style={{ color: col }}>%{d.adjWr}</span>
                      <span
                        className="text-[10px] text-gray-500 tabular-nums w-10 text-right hidden sm:block"
                        title={`Gözlenen oran %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
                      >
                        %{d.winRate}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        width={44}
        height={44}
        className={`rounded-md transition-transform duration-200 group-hover:scale-105 ${picked ? "" : "opacity-75 group-hover:opacity-100"}`}
        onError={hideOnError}
      />
      <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color: col }}>%{Math.round(m.winRate)}</span>
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
  Kart etiketi — artık YALNIZ "az veri" uyarısı.

  Eskiden burada "koridor rahat / koridor zor" da vardı ve kartın kendi kazanma
  oranıyla ÇELİŞİYORDU: Rell kartı %37.3 (Yuumi'nin en zorlu rakibi) yazarken
  altında "koridor rahat" çıkıyordu — çünkü etiket @15 gold farkını Yuumi'nin
  KENDİ ortalamasına göre okuyordu. Kullanıcı bunu bildirdi.

  Mutlağa çevirmek de çözmüyor: Yuumi her rakibe karşı gold'da geride, o zaman
  etiket tüm kartlarda aynı çıkıyor ve hiçbir şey söylemiyor (ilk şikâyet buydu).
  Yani bu etiket destek rollerinde iki yönde de bilgi taşımıyor → kaldırıldı.
  Kartta zaten kazanma oranı + renk var; üçüncü, arada çelişen bir sinyal gürültü.
*/
function laneTag(m) {
  // "az veri" bir UYARI: bu orana temkinli yaklaş demek. bg-white/5 + gray-500 ile
  // neredeyse görünmezdi (kullanıcı bildirdi) → soluk amber, uyarı gibi okunsun.
  if (m.games < 20) return { text: "az veri", cls: "bg-amber-400/15 text-amber-200/90 border-amber-400/25" };
  return null;
}

