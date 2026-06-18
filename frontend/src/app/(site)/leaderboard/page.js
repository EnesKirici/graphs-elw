import { getPublicSettings } from "@/lib/api";
import LeaderboardClassic from "@/components/leaderboard/LeaderboardClassic";
import LeaderboardPro from "@/components/leaderboard/pro/LeaderboardPro";

export const metadata = {
  title: "Sıralama",
  description: "Bölge bazlı en iyi League of Legends oyuncularının sıralaması.",
};

export default async function LeaderboardPage() {
  const settings = await getPublicSettings();
  const design = settings?.profile_design === "pro" ? "pro" : "classic";

  return design === "pro" ? <LeaderboardPro /> : <LeaderboardClassic />;
}
