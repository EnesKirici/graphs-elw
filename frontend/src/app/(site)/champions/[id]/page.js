/*
  Şampiyon Detay Sayfası
  URL: /champions/[id]  (örnek: /champions/Yasuo)

  op.gg tarzı tab yapısı (Genel · Rünler · Eşyalar · Detay + Counter) ChampionView'da.
  params async (Next 16) → await.
*/

import { Suspense } from "react";
import { fetchApi } from "@/lib/api";
import { getSeoOverrides, applySeoTemplate } from "@/lib/seo";
import { notFound } from "next/navigation";
import ChampionHero from "@/components/champion/ChampionHero";
import ChampionBg from "@/components/champion/ChampionBg";
import ChampionView from "@/components/champion/ChampionView";

// SEO metinlerinde kullanılan rol adları ("Bot" yok: BOTTOM = ADC).
const POS_SEO = {
  TOP:     { short: "Top",     long: "Üst Koridor" },
  JUNGLE:  { short: "Jungle",  long: "Orman" },
  MIDDLE:  { short: "Mid",     long: "Orta Koridor" },
  BOTTOM:  { short: "ADC",     long: "Alt Koridor" },
  SUPPORT: { short: "Support", long: "Destek" },
};

// Dinamik metadata — şampiyon verisinden zengin SEO (aynı fetch component'te de var → Next dedupe eder).
export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}`).catch(() => null);
  const champ = data?.champion;
  if (!champ) {
    return { title: id, description: `${id} — League of Legends şampiyon bilgileri.` };
  }
  const name = champ.name;

  // Classic (Jade) varyantı: build/tier verisi yok → "Build, Rünler" başlığı yanıltıcı olur.
  // Yeteneklere ve "ne değişti"ye odaklı, indekslenebilir kendine özgü SEO döndür.
  if (champ.isClassic) {
    return {
      title: `${name} Classic — Yetenekler ve Değişiklikler`,
      description: `${name} Classic varyantı (${champ.title}): yetenekleri, temel istatistikleri ve normal sürüme göre ne değiştiği. League of Legends özel mod şampiyonu.`,
      keywords: [`${name} classic`, `${name} jade`, name, champ.title, "lol classic mod", "league of legends"],
      alternates: { canonical: `/champions/${id}` },
      openGraph: {
        title: `${name} Classic — ${champ.title}`,
        description: `${name} Classic varyantının yetenekleri ve normal sürümden farkları.`,
        url: `https://elwgraphs.com/champions/${id}`,
        type: "article",
        images: champ.splash ? [{ url: champ.splash, alt: `${name} Classic` }] : undefined,
      },
    };
  }

  const mainPos = data?.build?.positions?.[0];
  const patch = data?.build?.patches?.[0];
  const posShort = mainPos ? (POS_SEO[mainPos.position]?.short || mainPos.position) : null;
  const suffix = [posShort, patch ? `Patch ${patch}` : null].filter(Boolean).join(", ");

  let title = `${name} Build, Rünler ve İstatistikler${suffix ? ` — ${suffix}` : ""}`;
  let description = mainPos
    ? `${name} (${champ.title}) ${patch ? `Patch ${patch} ` : ""}${posShort} rehberi: %${mainPos.winRate} kazanma oranlı build, rün dizilimi, eşya sırası, sihirdar büyüleri ve güncel maç istatistikleri.`
    : `${name} (${champ.title}) için güncel build, rün önerileri, yetenek sırası, eşya dizilimi, tier sıralaması ve maç istatistikleri. En iyi ${name} rehberi.`;

  const seo = await getSeoOverrides();
  const vars = {
    name,
    title: champ.title,
    position: posShort || "",
    patch: patch || "",
    winrate: mainPos ? `%${mainPos.winRate}` : "",
  };
  title = applySeoTemplate(seo.champion_detail?.title, vars) || title;
  description = applySeoTemplate(seo.champion_detail?.description, vars) || description;

  return {
    title,
    description,
    keywords: [name, `${name} build`, `${name} rünler`, `${name} rün dizilimi`, champ.title, ...(champ.tags || []), "lol", "lol champions", "league of legends"],
    alternates: { canonical: `/champions/${id}` },
    openGraph: {
      title: `${name} — ${champ.title}`,
      description,
      url: `https://elwgraphs.com/champions/${id}`,
      type: "article",
      images: champ.splash ? [{ url: champ.splash, alt: name }] : undefined,
    },
  };
}

// Gerçek build verisinden indekslenebilir özet metni (SSR, "ince içerik" olmasın diye benzersiz).
function buildSeoSummary(champ, build) {
  const positions = build?.positions;
  if (!positions?.length) return null;
  const main = positions[0];
  const patch = build.patches?.[0];
  const mainName = POS_SEO[main.position]?.long || main.position;
  let text = `${champ.name}, ${patch ? `${patch} yamasında` : "güncel metada"} en çok ${mainName} rolünde oynanıyor (rol payı %${main.share}) ve bu rolde kazanma oranı %${main.winRate}.`;
  const second = positions[1];
  if (second && second.share >= 15) {
    const secondName = POS_SEO[second.position]?.long || second.position;
    text += ` İkincil rolü ${secondName} (rol payı %${second.share}, kazanma oranı %${second.winRate}).`;
  }
  text += ` Aşağıdaki rün, eşya ve sihirdar büyüsü önerileri gerçek maç verilerinden derlenir ve her yamada güncellenir.`;
  return text;
}

export default async function ChampionDetailPage({ params }) {
  const { id } = await params;
  const [data, runesResp] = await Promise.all([
    fetchApi(`/champions/${id}`).catch(() => null), // geçersiz isim → API 404 → notFound()
    fetchApi("/runes").catch(() => null),
  ]);
  if (!data?.champion) notFound();
  const champ = data.champion;
  const runesData = runesResp?.runes || [];
  const seoSummary = buildSeoSummary(champ, data.build);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://elwgraphs.com/" },
      { "@type": "ListItem", position: 2, name: "Şampiyonlar", item: "https://elwgraphs.com/champions" },
      { "@type": "ListItem", position: 3, name: champ.name, item: `https://elwgraphs.com/champions/${id}` },
    ],
  };

  return (
    <div className="dpm-scope soft-scope min-h-screen relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {/* Karakter = sayfa arka planı (sınırlı banner yok) */}
      <ChampionBg splash={champ.splash} />

      <div className="relative z-10">
        <ChampionHero champ={champ} id={id} />
        {/* Suspense: ChampionView useSearchParams kullanır (?tab= kalıcılığı) */}
        <Suspense fallback={null}>
          <ChampionView
            id={id}
            champ={champ}
            version={data.version}
            runesData={runesData}
            build={data.build}
            duos={data.duos}
            seoSummary={seoSummary}
          />
        </Suspense>
      </div>
    </div>
  );
}
