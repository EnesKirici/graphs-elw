// /robots.txt — admin paneli indekslenmesin; sitemap'i işaret et.
const BASE = "https://elwgraphs.com";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
