"use client";

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

export default function StatsCard({ totalSeasonMatches = 0, seasonChampionsAll = [], matches = [], solo }) {
  // Sezon toplamları — ChampionPool & RoleRadar ile aynı dataset (seasonChampions.all)
  const seasonTotals = (seasonChampionsAll || []).reduce((acc, c) => {
    const g = c.games || 0;
    acc.games   += g;
    acc.wins    += c.wins || 0;
    acc.losses  += c.losses || 0;
    acc.kills   += (c.avgKda?.kills   || 0) * g;
    acc.deaths  += (c.avgKda?.deaths  || 0) * g;
    acc.assists += (c.avgKda?.assists || 0) * g;
    return acc;
  }, { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 });

  // Toplam Maç — Riot'un tüm sezon ID sayımı varsa onu göster (en doğru),
  // yoksa DB'deki seasonChampions toplamı
  const totalGames = totalSeasonMatches > 0 ? totalSeasonMatches : seasonTotals.games;
  const analyzedGames = seasonTotals.games;
  const wins = seasonTotals.wins;
  const losses = seasonTotals.losses;
  const winRate = analyzedGames > 0 ? Math.round(wins / analyzedGames * 100) : 0;
  const avgK = analyzedGames > 0 ? seasonTotals.kills   / analyzedGames : 0;
  const avgD = analyzedGames > 0 ? seasonTotals.deaths  / analyzedGames : 0;
  const avgA = analyzedGames > 0 ? seasonTotals.assists / analyzedGames : 0;
  const kdaRatio = avgD > 0 ? (avgK + avgA) / avgD : (avgK + avgA);
  const hasKda = analyzedGames > 0;

  // Yüklenen maçlardan son-N istatistiği (yüklendikçe genişler)
  const loadedGames = matches.length;
  const loadedWins = matches.filter(m => m.win).length;
  const loadedWinRate = loadedGames > 0 ? Math.round(loadedWins / loadedGames * 100) : 0;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">İstatistikler</h3>
        <span className="text-[11px] text-gray-500">Tüm Sezon</span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-around">
          {totalGames > 0 && <CircleProgress value={totalGames} max={Math.max(totalGames, 100)} label="Toplam Maç" display={totalGames} color="#3b82f6" />}
          {analyzedGames > 0 && <CircleProgress value={winRate} max={100} label="Kazanma Oranı" display={`${winRate}%`} color={winRate >= 51 ? "#10b981" : winRate >= 45 ? "#f59e0b" : "#ef4444"} />}
          {hasKda && <CircleProgress value={kdaRatio} max={6} label="Ort. KDA" display={avgD > 0 ? kdaRatio.toFixed(1) : '∞'} color={kdaRatio >= 3 ? "#10b981" : kdaRatio >= 2 ? "#3b82f6" : "#f59e0b"} />}
          {loadedGames > 0 && <CircleProgress value={loadedWinRate} max={100} label={`Son ${loadedGames} Maç`} display={`${loadedWinRate}%`} color={loadedWinRate >= 51 ? "#10b981" : loadedWinRate >= 45 ? "#f59e0b" : "#ef4444"} />}
        </div>
        {analyzedGames > 0 && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#1b2230]/30">
            <div className="text-center">
              <span className="text-xs text-emerald-400 font-medium">{wins}W</span>
              <span className="text-xs text-gray-600 mx-1">/</span>
              <span className="text-xs text-red-400 font-medium">{losses}L</span>
            </div>
            {hasKda && (
              <span className="text-xs text-gray-300">
                {avgK.toFixed(1)} / {avgD.toFixed(1)} / {avgA.toFixed(1)} <span className="text-[10px] text-gray-500">ort.</span>
              </span>
            )}
            {solo?.hotStreak && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Galibiyet Serisi</span>}
          </div>
        )}
        {totalGames > analyzedGames && analyzedGames > 0 && (
          <p className="text-[10px] text-gray-600 text-center mt-2">
            Winrate / KDA {analyzedGames} maç üzerinden hesaplandı · veri yüklendikçe güncellenir
          </p>
        )}
      </div>
    </div>
  );
}
