import { fetchApi } from "@/lib/api";
import Link from "next/link";
import ChampionPool from "@/components/summoner/ChampionPool";
import RankCard from "@/components/summoner/RankCard";
import StatsCard from "@/components/summoner/StatsCard";
import RoleRadar from "@/components/summoner/RoleRadar";
import SummonerContent from "@/components/summoner/SummonerContent";
import ChallengesCard from "@/components/summoner/ChallengesCard";
import DuoPartnersCard from "@/components/summoner/DuoPartnersCard";
import ProfileHeader from "@/components/summoner/ProfileHeader";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);
  return {
    title: `${dn}#${dt} — Oyuncu Profili`,
    description: `${dn}#${dt} League of Legends oyuncu profili, maç geçmişi, ELW Score ve istatistikler.`,
  };
}

export default async function SummonerPage({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);

  let data = null;
  try {
    data = await fetchApi(`/summoner/search?name=${encodeURIComponent(dn)}&tag=${encodeURIComponent(dt)}`);
  } catch (e) {}

  // Rate limit: profil hiç yüklenemedi
  if (data?.rateLimited && !data?.profile) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Sunucu Yoğunluğu</h1>
        <p className="text-gray-400 mb-1">Riot API istek limiti aşıldı.</p>
        <p className="text-gray-500 text-sm">Lütfen birkaç dakika sonra tekrar deneyin.</p>
        <Link href="/" className="inline-block mt-6 text-sm text-blue-400 hover:underline">← Ana Sayfa</Link>
      </div>
    );
  }

  if (!data) {
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

  const { profile, ranked, masteries } = data;
  const recentMatches = data.recentMatches || [];
  const recentStats = data.recentStats || {};
  const solo = ranked?.solo;
  const flex = ranked?.flex;

  // Banner: en çok oynanan şampiyonun rastgele skin centered splash'ı
  const bannerChamp = data.bannerChampion || recentStats?.mostPlayedChampion?.id || (masteries[0]?.championName);
  const bannerSkins = data.bannerSkins || [0];

  return (
    <div>
      <ProfileHeader
        profile={profile}
        data={data}
        recentStats={recentStats}
        bannerChamp={bannerChamp}
        bannerSkins={bannerSkins}
        activeTab="overview"
      />

      {/* ===== CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <SummonerContent
          rankCard={
            <RankCard solo={solo} flex={flex} winrateTimeline={data.winrateTimeline} />
          }
          sideColumn={
            <>
              {/* Kompakt İstatistikler + kişilik rozetleri */}
              <StatsCard
                seasonChampions={data.seasonChampions || {}}
                solo={solo}
                flex={flex}
                totalSeasonMatches={data.totalSeasonMatches || 0}
                personalityBadges={data.personalityBadges || []}
              />
              {/* En Çok Oynanan — sidebar üstünde, ilk açılışta görünür */}
              <ChampionPool seasonChampions={data.seasonChampions || {}} masteries={masteries} gameName={profile.gameName} tagLine={profile.tagLine} />
              {/* Koridorlar — kendi kartında */}
              <RoleRadar seasonRoles={data.seasonRoles} />
              <ChallengesCard challenges={data.challengeAverages} />
              <DuoPartnersCard duoPartners={data.duoPartners} />
            </>
          }
          initialMatches={recentMatches}
          puuid={profile.puuid}
        />
      </div>
    </div>
  );
}
