import Link from "next/link";
import RefreshButton from "@/components/summoner/RefreshButton";
import LiveGameButton from "@/components/live/LiveGameButton";
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
  couple = null,
}) {
  const basePath = `/summoner/${encodeURIComponent(profile.gameName)}/${encodeURIComponent(profile.tagLine)}`;

  return (
    <>
      {/* ===== BANNER ===== */}
      <div className="relative h-36 md:h-44 overflow-hidden">
        {bannerChamp && (
          <BannerImage champion={bannerChamp} skins={bannerSkins} />
        )}
        {/* Banner perdesi HER İKİ temada koyu (scrim) — üstündeki açık renk
            metin/rozetler okunsun. Light'ta bg-base açılırsa beyaz perde olup
            içerik kayboluyordu. */}
        <div className="absolute inset-0 bg-gradient-to-t from-scrim via-scrim/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-scrim/50 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-[1180px] mx-auto px-6 pb-5 flex items-end gap-4">
            <div className="relative">
              <img
                src={profile.profileIcon} alt=""
                width={84} height={84}
                className="rounded-xl border-2 border-edge shadow-2xl"
              />
              {/* Level badge — koyu scrim üstünde, sabit açık renk */}
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold bg-scrim/80 backdrop-blur-sm px-1.5 py-px rounded">
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
                <span className="text-white/55 text-base font-normal ml-1">#{profile.tagLine}</span>
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {couple && (
                  <Link
                    href={`/summoner/${encodeURIComponent(couple.partnerName)}/${encodeURIComponent(couple.partnerTag)}`}
                    className="couple-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    title={`${couple.partnerName} ile couple — profiline git`}
                  >
                    <span className="couple-badge-heart">♥</span>
                    {couple.partnerName}
                    <span className="opacity-80">ile couple</span>
                  </Link>
                )}
                {(() => {
                  const mainRole = data.seasonRoles?.mainRole || recentStats?.mainRole;
                  if (!mainRole) return null;
                  const roleIcons = { Top: "/roles/top.webp", Jungle: "/roles/jungle.webp", Mid: "/roles/mid.webp", ADC: "/roles/bot.webp", Support: "/roles/support.webp" };
                  const parts = mainRole.replace(" Main", "").split("/");
                  return (
                    <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">
                      {parts.map((role, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {roleIcons[role] && <img src={roleIcons[role]} alt="" width={16} height={16} />}
                          {i < parts.length - 1 && <span className="text-white/50">/</span>}
                        </span>
                      ))}
                      <span className="text-xs font-medium">{mainRole}</span>
                    </span>
                  );
                })()}
                <RefreshButton puuid={profile.puuid} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TAB NAVİGASYONU ===== */}
      {/* oncanvas-bar full-width DIŞ sarmalayıcıda: arka plan görseli + perde
          kapalıyken banner'la birleşik tam-genişlik koyu şerit olur. */}
      <div className="oncanvas-bar border-b border-edge/30">
        <div className="max-w-[1180px] mx-auto px-6 flex items-center gap-0">
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
          <LiveGameButton
            puuid={profile.puuid}
            name={profile.gameName}
            tag={profile.tagLine}
            className="ml-auto self-center"
          />
        </div>
      </div>

      {/* ===== RATE LIMIT BANNER ===== */}
      {data.rateLimited && <RateLimitBanner />}
    </>
  );
}
