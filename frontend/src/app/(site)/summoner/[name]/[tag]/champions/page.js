import { fetchApi } from "@/lib/api";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { cleanRiotPart, needsCleaning, summonerPath } from "@/lib/riotId";
import ProfileHeader from "@/components/summoner/ProfileHeader";
import AllChampionsContent from "@/components/summoner/AllChampionsContent";
import { regionLabel } from "@/lib/region";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  const dn = cleanRiotPart(decodeURIComponent(name));
  const dt = cleanRiotPart(decodeURIComponent(tag));
  return {
    title: `${dn}#${dt} — Şampiyonlar`,
    description: `${dn}#${dt} bu sezon oynadığı tüm şampiyon istatistikleri.`,
  };
}

export default async function ChampionsPage({ params }) {
  const { name, tag } = await params;
  const rawName = decodeURIComponent(name);
  const rawTag = decodeURIComponent(tag);

  // Yapıştırmadan gelen görünmez karakterler → temiz adrese yönlendir (bkz lib/riotId).
  if (needsCleaning(rawName, rawTag)) {
    permanentRedirect(summonerPath(rawName, rawTag, "/champions"));
  }

  const dn = rawName;
  const dt = rawTag;

  let data = null;
  try {
    data = await fetchApi(`/summoner/search?name=${encodeURIComponent(dn)}&tag=${encodeURIComponent(dt)}`);
  } catch (e) {}

  if (!data || !data.profile) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Oyuncu Bulunamadı</h1>
        <p className="text-gray-500">{dn}#{dt}</p>
        <Link href="/" className="inline-block mt-6 text-sm text-blue-400 hover:underline">← Ana Sayfa</Link>
      </div>
    );
  }

  const { profile } = data;
  const recentStats = data.recentStats || {};
  const bannerChamp = data.bannerChampion || recentStats?.mostPlayedChampion?.id || (data.masteries?.[0]?.championName);
  const bannerSkins = data.bannerSkins || [0];

  return (
    <div className="dpm-scope soft-scope min-h-screen">
      <ProfileHeader
        profile={profile}
        data={data}
        recentStats={recentStats}
        bannerChamp={bannerChamp}
        bannerSkins={bannerSkins}
        activeTab="champions"
      />

      {/* ===== CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AllChampionsContent
          seasonChampions={data.seasonChampions || {}}
          region={regionLabel(profile.platform)}
        />
      </div>
    </div>
  );
}
