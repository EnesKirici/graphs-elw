import { fetchApi, getPublicSettings } from "@/lib/api";
import { getSeoOverrides, mergeSeo } from "@/lib/seo";
import ChampionGrid from "@/components/champion/ChampionGrid";

// Admin → Ayarlar → SEO'dan title/description deploy'suz ezilebilir.
export async function generateMetadata() {
  const seo = await getSeoOverrides();
  return mergeSeo({
    title: "Tüm LoL Şampiyonları — Build, Rün ve İstatistik",
    description:
      "League of Legends'ın tüm şampiyonları tek listede: yetenekler, build önerileri, rünler, tier sıralaması ve istatistikler. Aradığın LoL karakterini bul ve incele.",
    keywords: ["lol şampiyonlar", "lol champions", "champions lol", "lol karakterleri", "şampiyon listesi", "lol graph", "league of legends şampiyonlar"],
    alternates: { canonical: "/champions" },
    openGraph: {
      title: "Tüm LoL Şampiyonları — Build, Rün ve İstatistik",
      description: "Tüm League of Legends şampiyonları: yetenekler, build'ler, rünler ve tier sıralaması.",
      url: "https://elwgraphs.com/champions",
      type: "website",
    },
  }, seo.champions);
}

export default async function ChampionsPage() {
  let data = null;
  try {
    data = await fetchApi("/champions");
  } catch {}

  const champions = data?.champions || [];
  // Başlık sayacı gerçek şampiyonları göstersin (Classic varyantlar sekmede ayrı sayılır).
  const realCount = champions.filter((c) => !c.isClassic).length;

  // Profil sayfasıyla AYNI zemin: pro tasarımda dpm-scope (navy), classic'te arka plan görseli.
  const settings = await getPublicSettings();
  const design = settings?.profile_design === "pro" ? "pro" : "classic";

  return (
    <div className={design === "pro" ? "dpm-scope soft-scope min-h-screen" : undefined}>
    {/* max-w-7xl mx-auto px-6 py-6 — tier list'teki SAYFA KAPSAYICISIYLA birebir
        aynı (2026-07-31). Önce burada eski ".content" sınıfı vardı (max-width
        1320px, padding 26px) — tier list'in Tailwind kapsayıcısından (1280px,
        24px) farklıydı, bu yüzden iki sayfanın panel/kart hizası tutmuyordu. */}
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>
          <span className="dot-mark" />Tüm Şampiyonlar
        </h2>
        {realCount > 0 && (
          <span className="tag">{realCount} şampiyon · Patch {data?.version}</span>
        )}
      </div>

      {champions.length === 0 ? (
        <div className="card pad">
          <p className="dim" style={{ fontSize: 13 }}>Şampiyon listesi şu anda yüklenemedi. Kısa süre sonra tekrar deneyin.</p>
        </div>
      ) : (
        <ChampionGrid champions={champions} showSearch={true} />
      )}
    </div>
    </div>
  );
}
