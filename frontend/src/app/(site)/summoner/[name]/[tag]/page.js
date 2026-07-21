import { fetchApi, getPublicSettings } from "@/lib/api";
import { regionLabel } from "@/lib/region";
import Link from "next/link";
import ChampionPool from "@/components/summoner/ChampionPool";
import RankCard from "@/components/summoner/RankCard";
import StatsCard from "@/components/summoner/StatsCard";
import RoleRadar from "@/components/summoner/RoleRadar";
import SummonerContent from "@/components/summoner/SummonerContent";
import SummonerContentPro from "@/components/summoner/pro/SummonerContentPro";
import ChallengesCard from "@/components/summoner/ChallengesCard";
import DuoPartnersCard from "@/components/summoner/DuoPartnersCard";
import ProfileHeader from "@/components/summoner/ProfileHeader";
import CoupleFX from "@/components/summoner/CoupleFX";
import { getCoupleProfile } from "@/lib/coupleProfiles";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);
  const id = `${dn}#${dt}`;
  const description = `${id} League of Legends oyuncu profili: maç geçmişi, ELW Score performans puanı, LP grafiği, şampiyon istatistikleri, rol analizi ve duo partnerleri.`;
  return {
    title: `${id} — LoL Profili`,
    description,
    keywords: [dn, id, "lol profil", "maç geçmişi", "elw score", "lol graph", "op.gg"],
    alternates: { canonical: `/summoner/${encodeURIComponent(dn)}/${encodeURIComponent(dt)}` },
    openGraph: {
      title: `${id} — LoL Oyuncu Profili`,
      description,
      type: "profile",
    },
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
        <h1 className="text-xl font-bold text-white mb-2">Şu An Yoğunluk Var</h1>
        <p className="text-gray-400 mb-1">Çok fazla istek aldığımız için profil şu anda getirilemiyor.</p>
        <p className="text-gray-500 text-sm">Birkaç dakika içinde tekrar deneyebilirsiniz.</p>
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
  const region = regionLabel(profile.platform);

  // Banner: en çok oynanan şampiyonun rastgele skin centered splash'ı
  const bannerChamp = data.bannerChampion || recentStats?.mostPlayedChampion?.id || (masteries[0]?.championName);
  const bannerSkins = data.bannerSkins || [0];

  // Admin ayarına göre tasarım seç: "pro" (dpm-stili sabit koyu) veya "classic".
  const settings = await getPublicSettings();
  const design = settings?.profile_design === "pro" ? "pro" : "classic";

  // Özel "couple" profili mi? (kalpli tema + partner bağlantısı)
  const couple = getCoupleProfile(profile.gameName, profile.tagLine);

  return (
    <div className={design === "pro" ? "dpm-scope min-h-screen" : undefined}>
      {couple && <CoupleFX />}
      <ProfileHeader
        profile={profile}
        data={data}
        recentStats={recentStats}
        bannerChamp={bannerChamp}
        bannerSkins={bannerSkins}
        activeTab="overview"
        couple={couple}
      />

      {/* ===== CONTENT ===== */}
      <div className="max-w-[1180px] mx-auto px-6 py-6">
        {design === "pro" ? (
          <SummonerContentPro
            data={data}
            profile={profile}
            region={region}
            initialMatches={recentMatches}
            puuid={profile.puuid}
          />
        ) : (
          <SummonerContent
            rankCard={
              <RankCard solo={solo} flex={flex} winrateTimeline={data.winrateTimeline} region={region} />
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
                <ChampionPool seasonChampions={data.seasonChampions || {}} masteries={masteries} gameName={profile.gameName} tagLine={profile.tagLine} region={region} />
                {/* Koridorlar — kendi kartında */}
                <RoleRadar seasonRoles={data.seasonRoles} />
                <ChallengesCard challenges={data.challengeAverages} />
                <DuoPartnersCard duoPartners={data.duoPartners} />
              </>
            }
            initialMatches={recentMatches}
            puuid={profile.puuid}
          />
        )}
      </div>
    </div>
  );
}
