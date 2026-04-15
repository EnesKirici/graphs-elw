import { fetchApi } from "@/lib/api";
import Link from "next/link";
import RoleRadar from "@/components/summoner/RoleRadar";
import ChampionPool from "@/components/summoner/ChampionPool";
import WinrateSection from "@/components/summoner/WinrateSection";
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



function getWrColor(wr) {
  if (wr >= 51) return "text-emerald-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}


// SVG circular progress — analytics gösterge
function CircleProgress({ value, max, label, display, color = "#3b82f6", size = 110 }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDash = circumference * progress;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1b2230" strokeWidth="5" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          transform="rotate(-90 48 48)"
          className="transition-all duration-1000"
        />
        <text x="48" y="50" textAnchor="middle" dominantBaseline="middle"
          className="fill-white font-bold" style={{ fontSize: '16px' }}>
          {display}
        </text>
      </svg>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// Rank görselleri — local dosyalar (public/ranks/)
function rankBadgeUrl(tier) {
  return `/ranks/badges/${tier.toLowerCase()}.webp`;
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
          leftColumn={
            <>
              <RankCard title="Solo/Duo" data={solo} winrateTimeline={data.winrateTimeline?.solo} defaultOpen />
              <RankCard title="Flex" data={flex} winrateTimeline={data.winrateTimeline?.flex} />
              <ChampionPool seasonChampions={data.seasonChampions || {}} masteries={masteries} gameName={profile.gameName} tagLine={profile.tagLine} />
              <RoleRadar seasonRoles={data.seasonRoles} />
              <ChallengesCard challenges={data.challengeAverages} />
              <DuoPartnersCard duoPartners={data.duoPartners} />
            </>
          }
          initialMatches={recentMatches}
          puuid={profile.puuid}
          totalSeasonMatches={data.totalSeasonMatches || 0}
          seasonChampionsAll={data.seasonChampions?.all || []}
          solo={solo}
        />
      </div>
    </div>
  );
}

/* ===== RANK KARTI ===== */
function RankCard({ title, data, winrateTimeline, defaultOpen }) {
  if (!data) {
    return (
      <div className="glass rounded-xl p-4 text-center">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-xs text-gray-600">Unranked</p>
      </div>
    );
  }

  const tierName = data.tier.charAt(0) + data.tier.slice(1).toLowerCase();

  const isSolo = !!defaultOpen;
  const badgeSize = isSolo ? 96 : 68;

  return (
    <div className={`glass rounded-xl ${isSolo ? "p-5" : "p-4"}`}>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>

      <div className="flex items-center gap-4">
        <img src={rankBadgeUrl(data.tier)} alt={data.tier} width={badgeSize} height={badgeSize} className="flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-white">{tierName} {data.rank}</p>
            {data.freshBlood && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Yeni Yükseldi</span>}
            {data.veteran && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium">Deneyimli</span>}
          </div>
          <p className="text-xs text-gray-400">{data.lp} LP</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-emerald-400">{data.wins} Win</span>
            <span className="text-xs text-gray-600">/</span>
            <span className="text-xs text-red-400">{data.losses} Lose</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className={`text-xl font-bold ${getWrColor(data.winRate)}`}>{data.winRate}%</p>
          <p className="text-[10px] text-gray-500">Win Rate</p>
        </div>
      </div>

      {/* W/L bar */}
      <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${data.winRate}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - data.winRate}%` }} />
      </div>

      {/* Winrate geçmişi — açılır/kapanır */}
      {winrateTimeline?.timeline?.length >= 2 && (
        <WinrateSection timeline={winrateTimeline.timeline} defaultOpen={defaultOpen} />
      )}
    </div>
  );
}


