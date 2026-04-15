import { fetchApi } from "@/lib/api";
import Link from "next/link";
import RoleRadar from "@/components/summoner/RoleRadar";
import ChampionPool from "@/components/summoner/ChampionPool";
import WinrateSection from "@/components/summoner/WinrateSection";
import SummonerContent from "@/components/summoner/SummonerContent";
import RefreshButton from "@/components/summoner/RefreshButton";
import ProfileBadge from "@/components/summoner/ProfileBadge";
import BadgeInfoTooltip from "@/components/summoner/BadgeInfoTooltip";
import BannerImage from "@/components/summoner/BannerImage";
import ChallengesCard from "@/components/summoner/ChallengesCard";
import DuoPartnersCard from "@/components/summoner/DuoPartnersCard";
import RateLimitBanner from "@/components/summoner/RateLimitBanner";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);
  return {
    title: `${dn}#${dt} — Oyuncu Profili`,
    description: `${dn}#${dt} League of Legends oyuncu profili, maç geçmişi, ELW Score ve istatistikler.`,
  };
}

function platformToCountry(platform) {
  const map = {
    tr1: "tr", euw1: "eu", eun1: "eu", na1: "us",
    kr: "kr", jp1: "jp", br1: "br", la1: "mx", la2: "ar",
    oc1: "au", ru: "ru", ph2: "ph", sg2: "sg",
    th2: "th", tw2: "tw", vn2: "vn",
  };
  return map[(platform || "").toLowerCase()] || "un";
}

function platformLabel(platform) {
  const map = {
    tr1: "Türkiye", euw1: "EU West", eun1: "EU Nordic", na1: "North America",
    kr: "Korea", jp1: "Japan", br1: "Brazil", oc1: "Oceania", ru: "Russia",
  };
  return map[(platform || "").toLowerCase()] || platform;
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
      {/* ===== BANNER ===== */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        {bannerChamp && (
          <BannerImage champion={bannerChamp} skins={bannerSkins} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060a10]/50 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-4">
            <div className="relative">
              <img
                src={profile.profileIcon} alt=""
                width={84} height={84}
                className="rounded-xl border-2 border-[#1b2230] shadow-2xl"
              />
              {/* Level badge — minimal */}
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-300 font-bold bg-[#060a10]/80 backdrop-blur-sm px-1.5 py-px rounded">
                {profile.summonerLevel}
              </span>
              {/* Bölge bayrağı — sağ üst */}
              <img
                src={`https://flagcdn.com/24x18/${platformToCountry(profile.platform)}.png`}
                alt={platformLabel(profile.platform)}
                title={platformLabel(profile.platform)}
                width={20} height={15}
                className="absolute -top-1.5 -right-1.5 rounded-sm shadow-lg"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg">
                {profile.gameName}
                <span className="text-gray-400 text-base font-normal ml-1">#{profile.tagLine}</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {(() => {
                  const mainRole = data.seasonRoles?.mainRole || recentStats?.mainRole;
                  if (!mainRole) return null;
                  const roleIcons = { Top: "/roles/top.webp", Jungle: "/roles/jungle.webp", Mid: "/roles/mid.webp", ADC: "/roles/bot.webp", Support: "/roles/support.webp" };
                  const parts = mainRole.replace(" Main", "").split("/");
                  return (
                    <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-gray-200 px-2.5 py-1 rounded-full">
                      {parts.map((role, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {roleIcons[role] && <img src={roleIcons[role]} alt="" width={16} height={16} />}
                          {i < parts.length - 1 && <span className="text-gray-500">/</span>}
                        </span>
                      ))}
                      <span className="text-xs font-medium">{mainRole}</span>
                    </span>
                  );
                })()}
                <RefreshButton puuid={profile.puuid} />
              </div>
              {/* Top rozetler — banner'da */}
              {recentStats?.frequentBadges?.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {recentStats.frequentBadges.slice(0, 4).map((b) => (
                    <ProfileBadge key={b.key} badge={b} totalGames={recentStats.totalGames} />
                  ))}
                  <BadgeInfoTooltip />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== BREADCRUMB ===== */}
      <div className="max-w-7xl mx-auto px-6 py-2.5 border-b border-[#1b2230]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-300">{profile.gameName}#{profile.tagLine}</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Ana Sayfa
          </Link>
        </div>
      </div>

      {/* ===== RATE LIMIT BANNER (sadece admin) ===== */}
      {data.rateLimited && <RateLimitBanner />}

      {/* ===== CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <SummonerContent
          leftColumn={
            <>
              <RankCard title="Solo/Duo" data={solo} winrateTimeline={data.winrateTimeline?.solo} defaultOpen />
              <RankCard title="Flex" data={flex} winrateTimeline={data.winrateTimeline?.flex} />
              <ChampionPool seasonChampions={data.seasonChampions || {}} masteries={masteries} />
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


