/*
  Şampiyon Uyumluluk Sayfası (SEO)
  URL: /champions/[id]/duos   (örnek: /champions/Yuumi/duos)

  Neden AYRI ROUTE: "yuumi duo", "yuumi ile en iyi adc", "hangi support ile
  oynanır" aramaları counter sorgularından farklı bir niyet. Counter sayfasının
  içinde bir sekme olarak dururken kendi URL'i, başlığı ve açıklaması yoktu →
  arama motoru için görünmezdi. Kendi route'u olan crawlable bir sayfa oldu.

  Veri kaynağı counter ucuyla AYNI (`/champions/{id}/counters` → duos) — ayrı bir
  uç açmaya gerek yok, aynı yanıtın içinde zaten geliyor.
*/

import { fetchApi } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChampionHero from "@/components/champion/ChampionHero";
import ChampionBg from "@/components/champion/ChampionBg";
import ChampionDuos from "@/components/champion/ChampionDuos";
import { primaryAlias } from "@/lib/championAliases";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";

const POS_SEO = {
  TOP: "Üst Koridor", JUNGLE: "Orman", MIDDLE: "Orta Koridor",
  BOTTOM: "ADC", UTILITY: "Destek", SUPPORT: "Destek",
};

/** Sayfanın öznesi alt koridorda mı? Duo verisi yalnız ADC+Support için var. */
const botRolu = (pos) => pos === "BOTTOM" || pos === "UTILITY" || pos === "SUPPORT";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}/counters`).catch(() => null);
  const champ = data?.champion;
  if (!champ) {
    return { title: `${id} Duo`, description: `${id} ile en uyumlu şampiyonlar.` };
  }

  const name = champ.name;
  const primary = data?.counters?.primaryPosition;
  const es = primary === "BOTTOM" ? "Support" : "ADC";
  const patch = data?.counters?.patches?.[0];
  const alias = primaryAlias(id);
  const aliasPart = alias ? ` (${alias})` : "";

  return {
    title: `${name}${aliasPart} Duo — En Uyumlu ${es}${patch ? ` ${patch}` : ""}`,
    description:
      `${name}${aliasPart} ile en uyumlu ${es} şampiyonları: aynı takımda oynandığında ` +
      `kazanma oranı, koridor farkları ve maç sayısı. ${patch ? `Patch ${patch}, ` : ""}` +
      `Emerald+ dereceli maç verileriyle.`,
    keywords: [
      `${name} duo`, `${name} ile en iyi ${es}`, `${name} uyumlu şampiyonlar`,
      `${name} best duo`, `${name} sinerji`, alias ? `${alias} duo` : null,
      name, "lol duo", "lol best duo", "bot lane duo",
    ].filter(Boolean),
    alternates: { canonical: `/champions/${id}/duos` },
    openGraph: {
      title: `${name}${aliasPart} Duo — En Uyumlu Eşler`,
      url: `https://elwgraphs.com/champions/${id}/duos`,
      type: "article",
      images: champ.splash ? [{ url: champ.splash, alt: `${name} duo rehberi` }] : undefined,
    },
  };
}

export default async function ChampionDuosPage({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}/counters`).catch(() => null);
  if (!data?.champion) notFound();

  const champ = data.champion;
  const counters = data.counters;
  const primary = counters?.primaryPosition;
  const posInfo = counters?.positions?.[0];

  return (
    <div className="dpm-scope soft-scope min-h-screen relative overflow-hidden">
      <ChampionBg splash={champ.splash} />
      <div className="relative z-10">
        <ChampionHero
          champ={champ}
          id={id}
          activeCrumb="Uyumlular"
          headingSuffix="Duo"
          grade={posInfo?.grade}
          stats={posInfo}
        />

        <div className={CHAMP_TABBAR_WRAP}>
          <div className={CHAMP_TABBAR_INNER}>
            <Link href={`/champions/${id}`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Genel</Link>
            <Link href={`/champions/${id}?tab=detail`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Detay</Link>
            <Link href={`/champions/${id}/counter`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Counter</Link>
            <span className={`${CHAMP_TAB} ${CHAMP_TAB_ACTIVE}`}>Uyumlular</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          {botRolu(primary) ? (
            <ChampionDuos
              champName={champ.name}
              duos={data.duos}
              role={primary}
              version={data.version}
            />
          ) : (
            /* Duo verisi yalnız alt koridor için toplanıyor (ADC+Support ikilisi).
               Orta/üst/orman şampiyonunda sayfa boş kalmasın — neden boş olduğunu söyle. */
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-sm text-gray-200 font-medium">
                {champ.name} için uyumluluk verisi toplanmıyor
              </p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-lg mx-auto">
                Uyumluluk (duo) istatistikleri yalnız <span className="text-gray-300">alt koridor</span> için
                tutuluyor: ADC ve support aynı koridoru paylaştığı için o ikilinin birlikte kazanma
                oranı anlamlı bir sinyal. {champ.name} birincil olarak{" "}
                {POS_SEO[primary] || "başka bir koridorda"} oynanıyor.
              </p>
              <Link href={`/champions/${id}/counter`} className="inline-block mt-4 text-xs text-blue-300 hover:text-blue-200">
                {champ.name} counter listesine git ›
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
