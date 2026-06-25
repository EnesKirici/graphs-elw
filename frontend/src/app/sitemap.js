// /sitemap.xml — Search Console'a gönderilecek statik (public) rotalar.
// Dinamik sayfalar (summoner/şampiyon/canlı maç) kullanıcı-üretimi/sonsuz → dahil edilmez.
const BASE = "https://elwgraphs.elw.com.tr";

export default function sitemap() {
  const now = new Date();
  const routes = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/champions", priority: 0.8, changeFrequency: "daily" },
    { path: "/tier-list", priority: 0.8, changeFrequency: "daily" },
    { path: "/leaderboard", priority: 0.8, changeFrequency: "daily" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
