import Link from "next/link";
import RefreshButton from "@/components/summoner/RefreshButton";
import ProfileBadge from "@/components/summoner/ProfileBadge";
import BadgeInfoTooltip from "@/components/summoner/BadgeInfoTooltip";
import BannerImage from "@/components/summoner/BannerImage";
import RateLimitBanner from "@/components/summoner/RateLimitBanner";

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

const TABS = [
  { key: "overview", label: "Genel Bakış", href: "" },
  { key: "champions", label: "Şampiyonlar", href: "/champions" },
];

/**
 * Profil banner + tab navigasyonu.
 * Hem genel bakış (overview) hem şampiyonlar sayfasında kullanılır.
 */
export default function ProfileHeader({
  profile,
  data,
  recentStats,
  bannerChamp,
  bannerSkins,
  activeTab = "overview",
}) {
  const basePath = `/summoner/${encodeURIComponent(profile.gameName)}/${encodeURIComponent(profile.tagLine)}`;

  return (
    <>
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
              {/* Level badge */}
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-300 font-bold bg-[#060a10]/80 backdrop-blur-sm px-1.5 py-px rounded">
                {profile.summonerLevel}
              </span>
              {/* Bölge bayrağı */}
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
              {/* Top rozetler */}
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

      {/* ===== TAB NAVİGASYONU ===== */}
      <div className="max-w-7xl mx-auto px-6 border-b border-[#1b2230]/30">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`${basePath}${tab.href}`}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t" />
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* ===== RATE LIMIT BANNER ===== */}
      {data.rateLimited && <RateLimitBanner />}
    </>
  );
}
