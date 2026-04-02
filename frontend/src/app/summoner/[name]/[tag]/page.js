import { fetchApi } from "@/lib/api";
import Link from "next/link";
import MatchList from "@/components/summoner/MatchList";
import RoleRadar from "@/components/summoner/RoleRadar";
import ChampionPool from "@/components/summoner/ChampionPool";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  return { title: `${decodeURIComponent(name)}#${decodeURIComponent(tag)} - GRAPHS` };
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
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-sm text-blue-400">Level {profile.summonerLevel}</p>
                {(data.seasonRoles?.mainRole || recentStats?.mainRole) && (
                  <span className="text-[11px] bg-white/10 backdrop-blur-sm text-gray-300 px-2 py-0.5 rounded-full">
                    {data.seasonRoles?.mainRole || recentStats.mainRole}
                  </span>
                )}
              </div>
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

            {/* Şampiyon havuzu — dropdown ile görünüm değiştir */}
            <ChampionPool
              seasonChampions={data.seasonChampions || []}
              masteries={masteries}
              totalScore={totalScore}
            />

            {/* Koridor İstatistikleri — radar chart + filtreli */}
            <RoleRadar seasonRoles={data.seasonRoles} />
          </div>

          {/* ===== SAĞ KOLON (8 birim) — Analytics + Son Maçlar ===== */}
          <div className="lg:col-span-8 space-y-4">

            {/* ===== İSTATİSTİKLER — eski tasarım (4 daire) ===== */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <h3 className="text-sm font-semibold text-gray-200">İstatistikler</h3>
              </div>

              <div className="p-5">
                {/* 4 daire — Toplam Maç, Kazanma Oranı, Ort KDA, Son 10 WR */}
                <div className="flex items-center justify-around">
                  {solo && (
                    <CircleProgress value={solo.games} max={Math.max(solo.games, 100)}
                      label="Toplam Maç" display={solo.games} color="#3b82f6" />
                  )}
                  {solo && (
                    <CircleProgress value={solo.winRate} max={100}
                      label="Kazanma Oranı" display={`${solo.winRate}%`}
                      color={solo.winRate >= 50 ? "#10b981" : "#ef4444"} />
                  )}
                  {recentStats?.avgKDA && (
                    <CircleProgress
                      value={typeof recentStats.avgKDA.ratio === 'number' ? recentStats.avgKDA.ratio : 10}
                      max={6} label="Ort. KDA"
                      display={typeof recentStats.avgKDA.ratio === 'number' ? recentStats.avgKDA.ratio.toFixed(1) : '∞'}
                      color={(recentStats.avgKDA.ratio >= 3) ? "#10b981" : (recentStats.avgKDA.ratio >= 2) ? "#3b82f6" : "#ef4444"} />
                  )}
                  {recentStats?.winRate !== undefined && (
                    <CircleProgress value={recentStats.winRate || 0} max={100}
                      label={`Son ${recentStats.totalGames || 0} Maç`}
                      display={`${recentStats.winRate || 0}%`}
                      color={(recentStats.winRate || 0) >= 50 ? "#06b6d4" : "#f59e0b"} />
                  )}
                </div>

                {/* W/L + KDA alt satır */}
                {solo && (
                  <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#1b2230]/30">
                    <div className="text-center">
                      <span className="text-xs text-emerald-400 font-medium">{solo.wins}W</span>
                      <span className="text-xs text-gray-600 mx-1">/</span>
                      <span className="text-xs text-red-400 font-medium">{solo.losses}L</span>
                    </div>
                    {recentStats?.avgKDA && (
                      <div className="text-center">
                        <span className="text-xs text-gray-300">
                          {recentStats.avgKDA.kills} / <span className="text-red-400">{recentStats.avgKDA.deaths}</span> / {recentStats.avgKDA.assists}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-1">ort.</span>
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
            </div>

            {/* ===== SON OYNANAN ŞAMPIYONLAR ===== */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <h3 className="text-sm font-semibold text-gray-200">Son Maçlar Özeti</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const cs = {};
                    recentMatches.forEach(m => {
                      const n = m.champion.name;
                      if (!cs[n]) cs[n] = { name: n, image: m.champion.image, wins: 0, losses: 0, kda: [] };
                      m.win ? cs[n].wins++ : cs[n].losses++;
                      if (typeof m.kda === 'number') cs[n].kda.push(m.kda);
                    });
                    return Object.values(cs)
                      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
                      .slice(0, 6)
                      .map(c => {
                        const t = c.wins + c.losses;
                        const wr = Math.round(c.wins / t * 100);
                        const ak = c.kda.length > 0 ? (c.kda.reduce((a,b) => a+b, 0) / c.kda.length).toFixed(1) : '0';
                        return (
                          <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                            <img src={c.image} alt={c.name} width={36} height={36} className="rounded-lg" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200">{c.name}</p>
                              <p className="text-[10px] text-gray-500">
                                <span className="text-emerald-400">{c.wins}W</span>
                                {" "}<span className="text-red-400">{c.losses}L</span>
                                {" · "}{ak} KDA
                              </p>
                            </div>
                            <span className={`text-xs font-bold font-mono ${wr >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                              {wr}%
                            </span>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>
            </div>

            {/* Son Maçlar — sayfalı */}
            <MatchList initialMatches={recentMatches} puuid={profile.puuid} />
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
          width={72}
          height={72}
          className="flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-base font-bold text-white">{tierName} {data.rank}</p>
          <p className="text-xs text-gray-400">{data.lp} LP</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-emerald-400">{data.wins}W</span>
            <span className="text-[11px] text-red-400">{data.losses}L</span>
            <span className={`text-[11px] font-medium ${getWrColor(data.winRate)}`}>{data.winRate}%</span>
          </div>
        </div>
      </div>

      {/* W/L bar — yeşil win, kırmızı loss */}
      <div className="mt-2.5 h-1.5 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${data.winRate}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - data.winRate}%` }} />
      </div>
    </div>
  );
}

