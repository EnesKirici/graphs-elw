import { fetchApi } from "@/lib/api";
import Link from "next/link";
import MatchCard from "@/components/summoner/MatchCard";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  return { title: `${decodeURIComponent(name)}#${decodeURIComponent(tag)} - GRAPHS` };
}

function formatPoints(p) {
  if (p >= 1000000) return (p / 1000000).toFixed(1) + "M";
  if (p >= 1000) return (p / 1000).toFixed(1) + "K";
  return p.toString();
}

function getWrColor(wr) {
  if (wr >= 60) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}

function getKdaColor(kda) {
  if (kda === "Perfect" || kda >= 5) return "text-yellow-400";
  if (kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-blue-400";
  return "text-gray-400";
}

// SVG circular progress — analytics gösterge
function CircleProgress({ value, max, label, display, color = "#3b82f6", size = 90 }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDash = circumference * progress;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 80 80">
        {/* Arka plan daire */}
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#1b2230" strokeWidth="5" />
        {/* İlerleme */}
        <circle
          cx="40" cy="40" r={radius}
          fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          transform="rotate(-90 40 40)"
          className="transition-all duration-1000"
        />
        {/* Ortadaki değer */}
        <text x="40" y="42" textAnchor="middle" dominantBaseline="middle"
          className="fill-white text-sm font-bold" style={{ fontSize: '14px' }}>
          {display}
        </text>
      </svg>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

// Rank görselleri — local dosyalar (public/ranks/)
function rankBadgeUrl(tier) {
  return `/ranks/badges/${tier.toLowerCase()}.png`;
}

// Centered splash URL (1280x720)
function centeredSplashUrl(champName) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champName}_0.jpg`;
}

export default async function SummonerPage({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);

  let data = null;
  try {
    data = await fetchApi(`/summoner/search?name=${encodeURIComponent(dn)}&tag=${encodeURIComponent(dt)}`);
  } catch (e) {}

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

  const { profile, ranked, masteries, totalScore } = data;
  const recentMatches = data.recentMatches || [];
  const recentStats = data.recentStats || {};
  const solo = ranked?.solo;
  const flex = ranked?.flex;

  // Banner: en çok oynanan şampiyonun centered splash'ı
  const bannerChamp = recentStats?.mostPlayedChampion?.id || (masteries[0]?.championName);
  const bannerUrl = bannerChamp ? centeredSplashUrl(bannerChamp.replace(/[^a-zA-Z]/g, '')) : null;

  return (
    <div>
      {/* ===== BANNER ===== */}
      <div className="relative h-48 md:h-56 overflow-hidden">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="w-full h-full object-cover object-center" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060a10]/50 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-4">
            <img
              src={profile.profileIcon} alt=""
              width={76} height={76}
              className="rounded-xl border-2 border-[#1b2230] shadow-2xl"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg">
                {profile.gameName}
                <span className="text-gray-400 text-base font-normal ml-1">#{profile.tagLine}</span>
              </h1>
              <p className="text-sm text-blue-400">Level {profile.summonerLevel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BREADCRUMB ===== */}
      <div className="max-w-7xl mx-auto px-6 py-2.5 border-b border-[#1b2230]/30">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-gray-300">{profile.gameName}#{profile.tagLine}</span>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ===== SOL KOLON (4 birim) — Rank + Mastery ===== */}
          <div className="lg:col-span-4 space-y-4">
            {/* Rank kartları */}
            <RankCard title="Solo/Duo" data={solo} />
            <RankCard title="Flex" data={flex} />

            {/* En çok oynanan şampiyonlar */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1b2230]/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">En Çok Oynanan</h3>
                <span className="text-[11px] text-gray-500">{totalScore} puan</span>
              </div>
              <div className="divide-y divide-[#1b2230]/20">
                {masteries.slice(0, 7).map((m, i) => (
                  <Link
                    key={m.championId}
                    href={`/champions/${m.championName.replace(/[^a-zA-Z]/g, '') || m.championId}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <span className="text-[11px] text-gray-600 font-mono w-4 text-right">{i + 1}</span>
                    <img src={m.championImage} alt={m.championName} width={32} height={32} className="rounded-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium group-hover:text-white transition-colors">{m.championName}</p>
                      <p className="text-[10px] text-gray-500">Level {m.championLevel}</p>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{formatPoints(m.championPoints)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ===== SAĞ KOLON (8 birim) — Analytics + Son Maçlar ===== */}
          <div className="lg:col-span-8 space-y-4">

            {/* Analytics panel */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">İstatistikler</h3>

              <div className="flex items-center justify-around">
                {/* Toplam maç */}
                {solo && (
                  <CircleProgress
                    value={solo.games}
                    max={Math.max(solo.games, 100)}
                    label="Toplam Maç"
                    display={solo.games}
                    color="#3b82f6"
                  />
                )}

                {/* Win Rate (Ranked) */}
                {solo && (
                  <CircleProgress
                    value={solo.winRate}
                    max={100}
                    label="Kazanma Oranı"
                    display={`${solo.winRate}%`}
                    color={solo.winRate >= 50 ? "#10b981" : "#ef4444"}
                  />
                )}

                {/* Ort KDA (Son maçlar) */}
                {recentStats?.avgKDA && (
                  <CircleProgress
                    value={typeof recentStats.avgKDA.ratio === 'number' ? recentStats.avgKDA.ratio : 10}
                    max={6}
                    label="Ort. KDA"
                    display={typeof recentStats.avgKDA.ratio === 'number' ? recentStats.avgKDA.ratio.toFixed(1) : '∞'}
                    color={
                      (recentStats.avgKDA.ratio >= 3) ? "#10b981" :
                      (recentStats.avgKDA.ratio >= 2) ? "#3b82f6" : "#ef4444"
                    }
                  />
                )}

                {/* Son maç WR */}
                {recentStats?.winRate !== undefined && (
                  <CircleProgress
                    value={recentStats.winRate}
                    max={100}
                    label={`Son ${recentStats.totalGames || 0} Maç`}
                    display={`${recentStats.winRate || 0}%`}
                    color={recentStats.winRate >= 50 ? "#06b6d4" : "#f59e0b"}
                  />
                )}
              </div>

              {/* Alt satır: KDA detay + W/L */}
              {solo && (
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#1b2230]/30">
                  <div className="text-center">
                    <span className="text-xs text-blue-400 font-medium">{solo.wins}W</span>
                    <span className="text-xs text-gray-600 mx-1">/</span>
                    <span className="text-xs text-red-400 font-medium">{solo.losses}L</span>
                  </div>
                  {recentStats?.avgKDA && (
                    <div className="text-center">
                      <span className="text-xs text-gray-400">
                        {recentStats.avgKDA.kills} / {recentStats.avgKDA.deaths} / {recentStats.avgKDA.assists}
                      </span>
                      <span className="text-[10px] text-gray-600 ml-1">ort.</span>
                    </div>
                  )}
                  {solo.hotStreak && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                      Galibiyet Serisi
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Son Maçlar — geniş alan */}
            {recentMatches.length > 0 && (
              <div className="glass rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1b2230]/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">Son Maçlar</h3>
                  <span className="text-[11px] text-gray-500">{recentMatches.length} maç</span>
                </div>
                <div className="divide-y divide-[#1b2230]/20">
                  {recentMatches.map((match) => (
                    <MatchCard key={match.matchId} match={match} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== RANK KARTI ===== */
function RankCard({ title, data }) {
  if (!data) {
    return (
      <div className="glass rounded-xl p-4 text-center">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-xs text-gray-600">Unranked</p>
      </div>
    );
  }

  const tierName = data.tier.charAt(0) + data.tier.slice(1).toLowerCase();

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>

      <div className="flex items-center gap-3">
        {/* Rank badge — oyunun orijinal görseli */}
        <img
          src={rankBadgeUrl(data.tier)}
          alt={data.tier}
          width={56}
          height={56}
          className="flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-base font-bold text-white">{tierName} {data.rank}</p>
          <p className="text-xs text-gray-400">{data.lp} LP</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-blue-400">{data.wins}W</span>
            <span className="text-[11px] text-red-400">{data.losses}L</span>
            <span className={`text-[11px] font-medium ${getWrColor(data.winRate)}`}>{data.winRate}%</span>
          </div>
        </div>
      </div>

      {/* W/L bar */}
      <div className="mt-2.5 h-1 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-500" style={{ width: `${data.winRate}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - data.winRate}%` }} />
      </div>
    </div>
  );
}
