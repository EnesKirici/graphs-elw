/*
  Şampiyon Counter Sayfası (SEO)
  URL: /champions/[id]/counter   (örnek: /champions/Aatrox/counter)

  "aatrox counter" / "aatrox ct" aramalarını hedefler. Kendi page.js'i + kendi
  generateMetadata'sı + sitemap kaydı olan GERÇEK crawlable route (JS sekmesi değil).
  Tek sayfa iki terimi de yakalar (başlık + anahtar kelime + içerik) — ayrı /ct URL'i
  YOK (duplicate content). params async (Next 16) → await.
*/

import { fetchApi } from "@/lib/api";
import { getSeoOverrides, applySeoTemplate } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChampionHero from "@/components/champion/ChampionHero";
import ChampionBg from "@/components/champion/ChampionBg";
import ChampionCounters from "@/components/champion/ChampionCounters";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";

// SEO metinlerinde kullanılan rol adları.
const POS_SEO = {
  TOP:     { short: "Top",     long: "Üst Koridor" },
  JUNGLE:  { short: "Jungle",  long: "Orman" },
  MIDDLE:  { short: "Mid",     long: "Orta Koridor" },
  BOTTOM:  { short: "Bot",     long: "Alt Koridor" },
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
  const patch = data?.counters?.patches?.[0];
  const primary = data?.counters?.primaryPosition;
  const posShort = primary ? POS_SEO[primary]?.short || primary : null;
  const suffix = [posShort, patch ? `Patch ${patch}` : null].filter(Boolean).join(", ");

  let title = `${name} Counter (${name} CT) — Kime Karşı Güçlü/Zayıf${suffix ? ` — ${suffix}` : ""}`;
  let description = `${name} counter rehberi: ${name}'ya karşı en iyi şampiyonlar ve ${name}'nın güçlü/zayıf eşleşmeleri. ${patch ? `Patch ${patch} ` : ""}gerçek maç verileriyle matchup kazanma oranları — ${name} nasıl yenilir, kimlerle güçlü.`;

  // Admin SEO şablon ezmeleri (varsa)
  const seo = await getSeoOverrides();
  const vars = { name, position: posShort || "", patch: patch || "" };
  title = applySeoTemplate(seo.champion_counter?.title, vars) || title;
  description = applySeoTemplate(seo.champion_counter?.description, vars) || description;

  return {
    title,
    description,
    keywords: [
      `${name} counter`, `${name} ct`, `${name} counters`, `${name} karşı`,
      `${name} nasıl yenilir`, `${name} matchup`, `${name} zayıf`, name,
      "lol counter", "lol ct", "matchup", "league of legends counter",
    ],
    alternates: { canonical: `/champions/${id}/counter` },
    openGraph: {
      title: `${name} Counter — Matchup Rehberi`,
      description,
      url: `https://elwgraphs.com/champions/${id}/counter`,
      type: "article",
      images: champ.splash ? [{ url: champ.splash, alt: name }] : undefined,
    },
  };
}

// Veriyle beslenen, her şampiyonda benzersiz SEO özeti (ince içerik olmaması için).
function buildCounterSeo(name, counters) {
  const primary = counters?.primaryPosition;
  const data = primary && counters?.byPosition?.[primary];
  if (!data) return null;
  const posLong = POS_SEO[primary]?.long || primary;
  const patch = counters.patches?.[0];
  const topCounter = data.counters?.[0];
  const topStrong = data.strongInto?.[0];

  let text = `${name} counter (${name} CT) sayfası: ${posLong} rolünde ${name}'ya karşı en iyi seçimler ve ${name}'nın zorlandığı eşleşmeler${patch ? `, ${patch} yaması verileriyle` : ""}.`;
  if (topCounter) {
    text += ` ${name}'yı en çok zorlayan şampiyon ${topCounter.name} (${name} bu eşleşmede %${topCounter.winRate} kazanıyor).`;
  }
  if (topStrong) {
    text += ` ${name} ise ${topStrong.name}'a karşı güçlü (%${topStrong.winRate}).`;
  }
  text += ` Tüm matchup kazanma oranları gerçek maç verilerinden derlenir ve her yamada güncellenir.`;
  return text;
}

export default async function ChampionCounterPage({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}/counters`).catch(() => null);
  if (!data?.champion) notFound();

  const champ = data.champion;
  const counters = data.counters;
  const primary = counters?.primaryPosition;
  const posLong = primary ? POS_SEO[primary]?.long || primary : "";
  const seoText = buildCounterSeo(champ.name, counters);

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
    <div className="dpm-scope min-h-screen relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ChampionBg splash={champ.splash} />

      <div className="relative z-10">
        <ChampionHero champ={champ} id={id} activeCrumb="Counter" />

        {/* Alt-çizgi tab — ana sayfayla AYNI (Genel/Detay link, Counter aktif) */}
        <div className={CHAMP_TABBAR_WRAP}>
          <div className={CHAMP_TABBAR_INNER}>
            <Link href={`/champions/${id}`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Genel</Link>
            <Link href={`/champions/${id}?tab=detail`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Detay</Link>
            <span className={`${CHAMP_TAB} ${CHAMP_TAB_ACTIVE}`}>Counter</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <h2 className="text-lg font-bold text-white mb-1">
            {champ.name} Counter{posLong ? ` — ${posLong}` : ""}
          </h2>
          {seoText && (
            <p className="text-xs text-gray-400 leading-relaxed mb-5 max-w-3xl">{seoText}</p>
          )}
          <ChampionCounters champName={champ.name} counters={counters} version={data.version} />
        </div>
      </div>
    </div>
  );
}
