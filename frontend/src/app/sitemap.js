// /sitemap.xml — statik sayfalar + TÜM şampiyon detay sayfaları.
// "x build / x rün" sorgularının ineceği sayfalar şampiyon detaylarıdır (~171 adet,
// sonlu liste) → sitemap'in asıl değerli kısmı. Summoner/canlı maç sayfaları
// kullanıcı-üretimi/sonsuz olduğu için dahil edilmez.
// Not: lastModified bilerek yok — her isteğe "şimdi" damgalamak Google'a
// "her şey her gün değişti" sinyali verir ve sitemap güvenilirliğini düşürür.
const BASE = "https://elwgraphs.elw.com.tr";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default async function sitemap() {
  const statics = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/champions", priority: 0.9, changeFrequency: "daily" },
    { path: "/tier-list", priority: 0.8, changeFrequency: "daily" },
    { path: "/leaderboard", priority: 0.8, changeFrequency: "daily" },
    { path: "/iletisim", priority: 0.4, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ].map((r) => ({
    url: `${BASE}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Şampiyon listesi API'den; API o an yanıt vermezse statik kısım yine servis edilir.
  let champions = [];
  try {
    const res = await fetch(`${API_BASE}/champions`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      champions = (data.champions || []).map((c) => ({
        url: `${BASE}/champions/${c.id}`,
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    }
  } catch {
    // API erişilemedi — sitemap şampiyonsuz döner, bir sonraki revalidate'te tamamlanır
  }

  return [...statics, ...champions];
}
