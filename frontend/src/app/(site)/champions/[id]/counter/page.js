/*
  Şampiyon Counter Sayfası (SEO)
  URL: /champions/[id]/counter   (örnek: /champions/Aatrox/counter)

  "aatrox counter" / "aatrox ct" aramalarını hedefler. Kendi page.js'i + kendi
  generateMetadata'sı + sitemap kaydı olan GERÇEK crawlable route (JS sekmesi değil).
  Tek sayfa iki terimi de yakalar (başlık + anahtar kelime + içerik) — ayrı /ct URL'i
  YOK (duplicate content). params async (Next 16) → await.

  2026-08-03 SEO REVİZYONU (Search Console verisiyle):
   - Sayfalar gösterim alıyordu ama TIK yoktu (Locke 365/0, Graves 307/0). Üç sebep:
   1) Classic (Jade_*) varyantlarının counter sayfası GERÇEK şampiyonunkiyle neredeyse
      aynı başlığa sahipti ("Warwick Counter (Warwick CT)...") ve içi BOŞTU. Google
      "ww ct" aramasında boş olanı gösterebiliyordu → artık noindex + kullanıcıyı
      gerçek sayfaya yönlendiren bir kart.
   2) Başlık 90 karakterdi, arama sonucunda kesiliyordu → ~50 karaktere indirildi.
   3) Aramalar KISALTMA ile yapılıyor ("ww ct" 151, "kata ct" 135, "naut ct", "mf ct").
      Takma adlar artık başlıkta, açıklamada, H1 altında ve SSS'te GÖRÜNÜR halde.
*/

import { fetchApi } from "@/lib/api";
import { getSeoOverrides, applySeoTemplate } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChampionHero from "@/components/champion/ChampionHero";
import ChampionBg from "@/components/champion/ChampionBg";
import ChampionCounters from "@/components/champion/ChampionCounters";
import CounterFaq, { buildCounterFaq, faqJsonLd } from "@/components/champion/CounterFaq";
import { primaryAlias, aliasesOf, counterKeywords } from "@/lib/championAliases";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";

// SEO metinlerinde kullanılan rol adları.
const POS_SEO = {
  TOP:     { short: "Top",     long: "Üst Koridor" },
  JUNGLE:  { short: "Jungle",  long: "Orman" },
  MIDDLE:  { short: "Mid",     long: "Orta Koridor" },
  BOTTOM:  { short: "ADC",     long: "Alt Koridor" },
  UTILITY: { short: "Support", long: "Destek" },
  SUPPORT: { short: "Support", long: "Destek" },
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}/counters`).catch(() => null);
  const champ = data?.champion;
  if (!champ) {
    return {
      title: `${id} Counter`,
      description: `${id} counter — kime karşı güçlü, kime karşı zayıf.`,
    };
  }
  const name = champ.name;

  // Classic (Jade_*) varyantı: dereceli maç verisi toplanmıyor → sayfa boş kalır.
  // Boş sayfayı indexletmek hem tarama bütçesi harcıyor hem de gerçek şampiyonun
  // counter sayfasıyla yarışıyordu. noindex + follow (iç linkler taranmaya devam).
  if (champ.isClassic) {
    const realId = id.replace(/^Jade_/, "");
    return {
      title: `${name} Classic — Counter Verisi Yok`,
      description: `${name} Classic, LoL Classic özel moduna ait varyanttır; dereceli maç verisi toplanmadığı için counter listesi bulunmuyor. Normal ${name} counter listesi için şampiyon sayfasına gidin.`,
      robots: { index: false, follow: true },
      alternates: { canonical: `/champions/${realId}/counter` },
    };
  }

  const patch = data?.counters?.patches?.[0];
  const primary = data?.counters?.primaryPosition;
  const posShort = primary ? POS_SEO[primary]?.short || primary : null;
  const posLong = primary ? POS_SEO[primary]?.long || primary : null;
  const alias = primaryAlias(id);
  const aliasPart = alias ? ` (${alias})` : "";

  // ~50 karakter hedefi: Google ~60'ta kesiyor ve "| ElwGraphs" eki 12 karakter alıyor.
  // Takma ad başlıkta çünkü sorguların çoğu kısaltmayla geliyor ("ww ct").
  const suffix = [posShort, patch].filter(Boolean).join(" ");
  let title = `${name}${aliasPart} Counter & CT${suffix ? ` — ${suffix}` : ""}`;
  let description =
    `${name}${aliasPart} counter: kime karşı zayıf, kime karşı güçlü? ` +
    `${posLong ? `${posLong} rolünde ` : ""}${patch ? `Patch ${patch} ` : ""}` +
    `gerçek maç verileriyle kazanma oranları, KDA ve koridor avantajı.`;

  // Admin SEO şablon ezmeleri (varsa)
  const seo = await getSeoOverrides();
  const vars = { name, position: posShort || "", patch: patch || "", alias: alias || "" };
  title = applySeoTemplate(seo.champion_counter?.title, vars) || title;
  description = applySeoTemplate(seo.champion_counter?.description, vars) || description;

  return {
    title,
    description,
    keywords: [
      // isim + tüm takma adlar × (counter|ct|ct X|counter X|counters)
      ...counterKeywords(id, name),
      `${name} nasıl yenilir`, `${name} matchup`, `${name} zayıf`,
      posShort ? `${name} ${posShort.toLowerCase()} counter` : null,
      name, "lol counter", "lol ct", "matchup", "league of legends counter",
    ].filter(Boolean),
    alternates: { canonical: `/champions/${id}/counter` },
    openGraph: {
      title: `${name}${aliasPart} Counter — Matchup Rehberi`,
      description,
      url: `https://elwgraphs.com/champions/${id}/counter`,
      type: "article",
      images: champ.splash ? [{ url: champ.splash, alt: `${name} counter rehberi` }] : undefined,
    },
    // Görselin arama/paylaşım sonuçlarında ÇIKMASI için og:image tek başına yetmiyor;
    // Twitter/X ve bazı toplayıcılar ayrı kart tipi istiyor. summary_large_image =
    // küçük köşe ikonu değil, geniş görsel.
    twitter: champ.splash
      ? { card: "summary_large_image", title, description, images: [champ.splash] }
      : undefined,
  };
}

/*
  Veriyle beslenen, her şampiyonda benzersiz SEO özeti (ince içerik olmaması için).
  TÜRKÇE EK NOTU: şampiyon adları yabancı olduğundan "-'ya/-'yı" ekleri sık yanlış
  düşüyor (Warwick'ya ❌). Cümleler ek gerektirmeyecek biçimde kuruldu.
*/
function buildCounterSeo(name, alias, counters) {
  const primary = counters?.primaryPosition;
  const data = primary && counters?.byPosition?.[primary];
  if (!data) return null;
  const posLong = POS_SEO[primary]?.long || primary;
  const patch = counters.patches?.[0];
  const topCounter = data.counters?.[0];
  const topStrong = data.strongInto?.[0];

  let text =
    `${name}${alias ? ` (kısaca ${alias})` : ""} counter listesi: ${posLong} rolünde ` +
    `${name} karşısında en avantajlı şampiyonlar ve ${name} tarafının üstün olduğu eşleşmeler` +
    `${patch ? `, ${patch} yaması verileriyle` : ""}.`;
  if (topCounter) {
    text += ` En zorlu rakip ${topCounter.name} — bu eşleşmede ${name} tarafı %${topCounter.winRate} kazanıyor (${topCounter.games} maç).`;
  }
  if (topStrong) {
    text += ` En rahat eşleşme ise ${topStrong.name} (%${topStrong.winRate}).`;
  }
  text += ` Tüm oranlar Emerald+ dereceli maçlardan derlenir ve her yamada güncellenir.`;
  return text;
}

export default async function ChampionCounterPage({ params }) {
  const { id } = await params;

  const data = await fetchApi(`/champions/${id}/counters`).catch(() => null);
  if (!data?.champion) notFound();

  const champ = data.champion;
  const counters = data.counters;

  // Classic varyantı: veri yok. Google'dan buraya düşen kullanıcıyı boş sayfada
  // bırakmak yerine gerçek şampiyonun counter sayfasına yönlendir.
  if (champ.isClassic) {
    const realId = id.replace(/^Jade_/, "");
    return (
      <div className="dpm-scope soft-scope min-h-screen relative overflow-hidden">
        <ChampionBg splash={champ.splash} />
        <div className="relative z-10">
          <ChampionHero champ={champ} id={id} activeCrumb="Counter" headingSuffix="Classic" subtitle="LoL Classic özel mod varyantı" />
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-sm text-gray-200 font-medium">
                Bu sayfa {champ.name} Classic varyantına ait — counter verisi yok
              </p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                LoL Classic özel mod şampiyonlarının dereceli maçları toplanmadığı için
                matchup istatistiği üretilmiyor.
              </p>
              <Link
                href={`/champions/${realId}/counter`}
                className="inline-block mt-5 px-4 py-2 rounded-lg bg-blue-500/15 text-blue-200 border border-blue-400/25 text-sm font-medium hover:bg-blue-500/25 transition-colors"
              >
                Normal {champ.name} counter listesine git →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const primary = counters?.primaryPosition;
  const posLong = primary ? POS_SEO[primary]?.long || primary : "";
  const patch = counters?.patches?.[0];
  const alias = primaryAlias(id);
  const allAliases = aliasesOf(id);
  const seoText = buildCounterSeo(champ.name, alias, counters);
  const faq = buildCounterFaq({ name: champ.name, alias, counters, id });

  // Takma ad + rol + patch ÇİP olarak basılır (H1'in yanına italik metin değil).
  // Takma adın GÖRÜNÜR olması şart: sorguların çoğu kısaltmayla geliyor ("ww ct").
  // Eskiden tek satır italik metindi ve 5xl başlığın yanında hizasız duruyordu.
  // posLong BİLEREK YOK: hero zaten şampiyonun oynadığı koridorları çip olarak
  // basıyor, buraya bir de "Orman" eklemek aynı çipi iki kez gösteriyordu.
  const heroChips = [
    patch ? `Patch ${patch}` : null,
    allAliases.length ? `${allAliases.join(" / ")} olarak da aranır` : null,
  ].filter(Boolean);

  /*
    SAYFANIN BİRİNCİL GÖRSELİ — "locke ct" gibi bir aramada sonucun yanında
    şampiyonun görselinin çıkabilmesi için. og:image sosyal paylaşım içindir;
    arama motoru sayfanın ana görselini `primaryImageOfPage` ile ÖĞRENİR.
    ImageObject ayrıca Google Görseller'de bağlamı (caption) taşır.
    Not: bu YALNIZCA uygunluk sağlar — görselin gösterilip gösterilmeyeceğine
    Google karar verir, garanti yoktur.
  */
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `https://elwgraphs.com/champions/${id}/counter`,
    name: `${champ.name} Counter`,
    description: seoText || undefined,
    inLanguage: "tr-TR",
    primaryImageOfPage: {
      "@type": "ImageObject",
      contentUrl: champ.splash,
      url: champ.splash,
      caption: `${champ.name} counter — ${posLong ? `${posLong} ` : ""}eşleşme rehberi`,
      representativeOfPage: true,
    },
    about: { "@type": "Thing", name: champ.name, image: champ.image },
    isPartOf: { "@type": "WebSite", name: "ElwGraphs", url: "https://elwgraphs.com" },
  };

  // Arama kırıntısı: Home › Şampiyonlar › Kai'Sa › Counter
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://elwgraphs.com/" },
      { "@type": "ListItem", position: 2, name: "Şampiyonlar", item: "https://elwgraphs.com/champions" },
      { "@type": "ListItem", position: 3, name: champ.name, item: `https://elwgraphs.com/champions/${id}` },
      { "@type": "ListItem", position: 4, name: "Counter", item: `https://elwgraphs.com/champions/${id}/counter` },
    ],
  };

  return (
    <div className="dpm-scope soft-scope min-h-screen relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faq.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />
      )}
      <ChampionBg splash={champ.splash} />

      <div className="relative z-10">
        {/* Hero SADE tutulur: ikon + H1 + unvan + çipler.
            seoText bir ara hero'nun sağındaki boş alana konmuştu; kullanıcı "kimse
            okumaz, hizası bozuk" dedi ve haklıydı — orada başlıkla yarışıyor, göz
            asıl içeriğe (şerit) gitmeden önce bir metin duvarına çarpıyordu. Metin
            sayfanın DİBİNE, SSS'in yanına alındı: arama motoru yine okur, ziyaretçi
            önce veriyi görür. */}
        <ChampionHero
          champ={champ}
          id={id}
          activeCrumb="Counter"
          headingSuffix="Counter"
          extraChips={heroChips}
          grade={counters?.positions?.[0]?.grade}
          stats={counters?.positions?.[0]}
        />

        {/* Alt-çizgi tab — ana sayfayla AYNI (Genel/Detay link, Counter aktif) */}
        <div className={CHAMP_TABBAR_WRAP}>
          <div className={CHAMP_TABBAR_INNER}>
            <Link href={`/champions/${id}`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Genel</Link>
            <Link href={`/champions/${id}?tab=detail`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Detay</Link>
            <span className={`${CHAMP_TAB} ${CHAMP_TAB_ACTIVE}`}>Counter</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <ChampionCounters
            champName={champ.name}
            champImage={champ.image}
            champId={id}
            counters={counters}
            version={data.version}
            duos={data.duos}
            guide={data.guide}
          />
          <CounterFaq faq={faq} />

          {/* Özet + yöntem — sayfanın DİBİ.
              İki ayrı yerde duruyordu (hero'nun sağında ve şeridin altında); ikisi de
              göz akışını kesiyordu ve kullanıcı ikisini de "kimse okumaz, kötü duruyor"
              diye işaretledi. Tek bir blokta, SSS'in ardında toplandı: içeriği arayan
              okur, aramayan takılmaz. Metin SİLİNMEDİ — sayfanın benzersiz SEO gövdesi
              burası (ince içerik cezasından koruyan kısım). */}
          <section className="glass rounded-xl px-5 sm:px-6 py-5 mt-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-2">Bu sayfadaki veriler</h2>
            {seoText && <p className="text-xs text-gray-400 leading-relaxed">{seoText}</p>}
            <p className="text-[11px] text-gray-500 leading-relaxed mt-3">
              Yüzdeler {champ.name} tarafının o eşleşmedeki kazanma oranıdır (kalanı rakibin).
              Rakip başına en az 10 maç. Sıralama yalnız orana değil maç sayısına da göre
              ağırlıklandırılır — az örneklemli uç oranlar listeyi yanıltmaz. Karta gelince
              eşleşmenin KDA / katılım / hasar özeti açılır; karta tıklayınca altındaki
              kafa-kafaya kıyas tablosu o eşleşmeye geçer.
              Emerald+ · Patch {(counters?.patches || []).join(" + ")}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
