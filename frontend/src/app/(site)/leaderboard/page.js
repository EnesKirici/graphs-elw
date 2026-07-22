import { getPublicSettings } from "@/lib/api";
import { getSeoOverrides, mergeSeo } from "@/lib/seo";
import LeaderboardClassic from "@/components/leaderboard/LeaderboardClassic";
import LeaderboardPro from "@/components/leaderboard/pro/LeaderboardPro";

// Admin → Ayarlar → SEO'dan title/description deploy'suz ezilebilir.
export async function generateMetadata() {
  const seo = await getSeoOverrides();
  return mergeSeo({
    title: "LoL Sıralama — TR Challenger & Grandmaster",
    description:
      "Türkiye (TR1) League of Legends sıralaması: Challenger, Grandmaster ve Master oyuncular. LP, kazanma oranı, en çok oynanan şampiyonlar ve koridor dağılımı canlı listede.",
    keywords: ["lol sıralama", "challenger tr", "lol leaderboard", "en iyi lol oyuncuları", "league of graphs", "lol graph", "tr1 challenger"],
    alternates: { canonical: "/leaderboard" },
    openGraph: {
      title: "LoL Sıralama — TR Challenger & Grandmaster",
      description: "TR1 Challenger, Grandmaster ve Master oyuncularının canlı sıralaması — LP, WR ve şampiyon havuzu.",
      url: "https://elwgraphs.elw.com.tr/leaderboard",
      type: "website",
    },
  }, seo.leaderboard);
}

export default async function LeaderboardPage() {
  const settings = await getPublicSettings();
  const design = settings?.profile_design === "pro" ? "pro" : "classic";

  return design === "pro" ? <LeaderboardPro /> : <LeaderboardClassic />;
}
