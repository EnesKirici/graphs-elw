import { fetchApi } from "@/lib/api";
import Link from "next/link";
import MatchCard from "@/components/summoner/MatchCard";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  return { title: `${decodeURIComponent(name)}#${decodeURIComponent(tag)} - GRAPHS` };
}

function formatPoints(points) {
  if (points >= 1000000) return (points / 1000000).toFixed(1) + "M";
  if (points >= 1000) return (points / 1000).toFixed(1) + "K";
  return points.toString();
}

function getTierColor(tier) {
  const c = {
    IRON: "text-gray-400 border-gray-500/30 bg-gray-500/10",
    BRONZE: "text-amber-700 border-amber-700/30 bg-amber-700/10",
    SILVER: "text-gray-300 border-gray-400/30 bg-gray-400/10",
    GOLD: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
    PLATINUM: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
    EMERALD: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    DIAMOND: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    MASTER: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    GRANDMASTER: "text-red-400 border-red-400/30 bg-red-400/10",
    CHALLENGER: "text-yellow-300 border-yellow-300/30 bg-yellow-300/10",
  };
  return c[tier] || c.IRON;
}

function getWinRateColor(wr) {
  if (wr >= 60) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}

export default async function SummonerPage({ params }) {
  const { name, tag } = await params;
  const decodedName = decodeURIComponent(name);
  const decodedTag = decodeURIComponent(tag);

  let data = null;
  try {
    data = await fetchApi(`/summoner/search?name=${encodeURIComponent(decodedName)}&tag=${encodeURIComponent(decodedTag)}`);
  } catch (e) {}

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Oyuncu Bulunamadı</h1>
        <p className="text-gray-500">{decodedName}#{decodedTag}</p>
        <Link href="/" className="inline-block mt-6 text-sm text-blue-400 hover:underline">← Ana Sayfa</Link>
      </div>
    );
  }

  const { profile, ranked, masteries, totalScore, bannerSplash } = data;
  const recentMatches = data.recentMatches || [];
  const recentStats = data.recentStats || {};
  const solo = ranked?.solo;
  const flex = ranked?.flex;

  return (
    <div>
      {/* ===== BANNER ===== */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        {bannerSplash && (
          <img
            src={bannerSplash}
            alt=""
            className="w-full h-full object-cover object-[center_20%]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060a10]/60 via-transparent to-transparent" />

        {/* Profil bilgisi */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-4">
            <img
              src={profile.profileIcon}
              alt=""
              width={80}
              height={80}
              className="rounded-xl border-2 border-[#1b2230] shadow-2xl"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold text-white drop-shadow-lg">
                {profile.gameName}
                <span className="text-gray-400 text-lg font-normal ml-1">#{profile.tagLine}</span>
              </h1>
              <p className="text-sm text-blue-400 mt-0.5">Level {profile.summonerLevel}</p>
            </div>
            {/* En çok oynanan şampiyon (son maçlarda) */}
            {recentStats?.mostPlayedChampion && (
              <div className="hidden md:flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
                <img src={recentStats.mostPlayedChampion.image} alt="" width={24} height={24} className="rounded-md" />
                <span className="text-xs text-gray-300">
                  Son {recentStats.totalGames} maçta en çok: <span className="text-white font-medium">{recentStats.mostPlayedChampion.name}</span> ({recentStats.mostPlayedChampion.games})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== BREADCRUMB ===== */}
      <div className="max-w-7xl mx-auto px-6 py-3 border-b border-[#1b2230]/30">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-gray-300">{profile.gameName}#{profile.tagLine}</span>
        </div>
      </div>

      {/* ===== İÇERİK ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ===== SOL KOLON (4 birim) ===== */}
          <div className="lg:col-span-4 space-y-4">
            {/* Solo/Duo Rank */}
            <RankCard title="Solo/Duo" data={solo} />
            {/* Flex Rank */}
            <RankCard title="Flex" data={flex} />
            {/* Mastery puanı */}
            <div className="glass rounded-xl p-4">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Toplam Ustalık</p>
              <p className="text-2xl font-bold text-white">{totalScore.toLocaleString()}</p>
            </div>
          </div>

          {/* ===== SAĞ KOLON (8 birim) ===== */}
          <div className="lg:col-span-8 space-y-5">

            {/* Stat kartlar */}
            {solo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Toplam Maç" value={solo.games} sub={`${solo.wins}G ${solo.losses}M`} />
                <StatCard
                  label="Kazanma Oranı"
                  value={`${solo.winRate}%`}
                  color={getWinRateColor(solo.winRate)}
                  sub={solo.hotStreak ? "Seri devam ediyor!" : null}
                />
                {recentStats?.avgKDA && (
                  <StatCard
                    label="Ort. KDA (Son)"
                    value={typeof recentStats.avgKDA.ratio === 'number' ? recentStats.avgKDA.ratio.toFixed(2) : recentStats.avgKDA.ratio}
                    sub={`${recentStats.avgKDA.kills}/${recentStats.avgKDA.deaths}/${recentStats.avgKDA.assists}`}
                    color={
                      recentStats.avgKDA.ratio >= 3 ? "text-emerald-400" :
                      recentStats.avgKDA.ratio >= 2 ? "text-blue-400" : "text-gray-300"
                    }
                  />
                )}
                <StatCard
                  label="Son Maç WR"
                  value={`${recentStats?.winRate || 0}%`}
                  color={getWinRateColor(recentStats?.winRate || 0)}
                  sub={`Son ${recentStats?.totalGames || 0} maç`}
                />
              </div>
            )}

            {/* En çok oynanan şampiyonlar */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1b2230]/50">
                <h3 className="text-sm font-semibold text-gray-200">En Çok Oynanan Şampiyonlar</h3>
              </div>
              <div className="divide-y divide-[#1b2230]/20">
                {masteries.slice(0, 7).map((m, i) => (
                  <div key={m.championId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <span className="text-[11px] text-gray-600 font-mono w-4 text-right">{i + 1}</span>
                    <img src={m.championImage} alt={m.championName} width={32} height={32} className="rounded-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium">{m.championName}</p>
                      <p className="text-[10px] text-gray-500">Level {m.championLevel}</p>
                    </div>
                    <div className="w-28 h-1.5 bg-[#1b2230] rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                        style={{ width: `${(m.championPoints / masteries[0].championPoints) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono w-14 text-right">{formatPoints(m.championPoints)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Son maçlar */}
            {recentMatches.length > 0 && (
              <div className="glass rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#1b2230]/50 flex items-center justify-between">
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
      <div className="glass rounded-xl p-4">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-sm text-gray-600">Sıralama yapılmamış</p>
      </div>
    );
  }

  const tierColor = getTierColor(data.tier);
  const tierName = data.tier.charAt(0) + data.tier.slice(1).toLowerCase();

  return (
    <div className="glass rounded-xl p-5">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-black text-lg ${tierColor}`}>
          {data.tier.charAt(0)}{data.rank}
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-white">{tierName} {data.rank}</p>
          <p className="text-sm text-gray-400">{data.lp} LP</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-blue-400">{data.wins}W</span>
            <span className="text-xs text-red-400">{data.losses}L</span>
            <span className={`text-xs font-medium ${getWinRateColor(data.winRate)}`}>{data.winRate}%</span>
            {data.hotStreak && (
              <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Seri</span>
            )}
          </div>
        </div>
      </div>
      {/* W/L bar */}
      <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-500" style={{ width: `${data.winRate}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - data.winRate}%` }} />
      </div>
    </div>
  );
}

/* ===== STAT KART ===== */
function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
