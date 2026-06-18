"use client";

// "Son N Oyun Performansı" — yüklü maçlardan (client-side) hesaplanır.
// Büyük, okunur, dengeli renkli panel: WR donut + en çok oynanan + KDA/ort. sıra.

function wrColor(wr) {
  if (wr >= 60) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-gray-300";
  return "text-red-400";
}
function kdaColor(k) {
  if (k === "Perfect" || k >= 4) return "text-emerald-400";
  if (k >= 3) return "text-blue-400";
  if (k >= 2) return "text-gray-200";
  return "text-red-400";
}
function rankColor(r) {
  if (r == null) return "text-gray-300";
  if (r <= 3) return "text-emerald-400";
  if (r <= 5) return "text-blue-400";
  if (r <= 7) return "text-gray-200";
  return "text-red-400";
}

function WrGauge({ winRate, wins, losses }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const winFrac = wins + losses > 0 ? wins / (wins + losses) : 0;
  const good = winRate >= 50;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="relative w-[96px] h-[96px] flex items-center justify-center">
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--dpm-bad-team)" strokeWidth="8" opacity="0.35" />
          <circle
            cx="48" cy="48" r={r} fill="none" stroke="var(--dpm-good-team)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - winFrac)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[23px] font-extrabold leading-none ${good ? "text-gray-50" : "text-gray-200"}`}>{winRate}%</span>
          <span className="text-[10px] text-gray-400 mt-0.5">WR</span>
        </div>
      </div>
      <p className="text-[13px]">
        <span className="text-emerald-400 font-bold">{wins}G</span>{" "}
        <span className="text-red-400 font-bold">{losses}M</span>
      </p>
    </div>
  );
}

function StatBlock({ label, children, sub }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1">{children}</div>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Last30Panel({ matches }) {
  const ranked = (matches || []).filter((m) => m.duration >= 300);
  const total = ranked.length;
  if (total === 0) return null;

  const wins = ranked.filter((m) => m.win).length;
  const losses = total - wins;
  const winRate = Math.round((wins / total) * 100);

  let k = 0, d = 0, a = 0;
  ranked.forEach((m) => { k += m.kills; d += m.deaths; a += m.assists; });
  const kdaRatio = d > 0 ? (k + a) / d : (k + a);
  const avgK = (k / total).toFixed(1), avgD = (d / total).toFixed(1), avgA = (a / total).toFixed(1);

  // Şampiyon kırılımı
  const champMap = {};
  ranked.forEach((m) => {
    const id = m.champion.name;
    if (!champMap[id]) champMap[id] = { name: id, image: m.champion.image, games: 0, wins: 0, k: 0, d: 0, a: 0 };
    const c = champMap[id];
    c.games++; if (m.win) c.wins++;
    c.k += m.kills; c.d += m.deaths; c.a += m.assists;
  });
  const champs = Object.values(champMap).sort((x, y) => y.games - x.games).slice(0, 4);

  // ELW sırası + MVP/ACE
  const ranks = ranked.map((m) => m.ranking?.rank).filter((r) => r != null);
  const avgRank = ranks.length ? (ranks.reduce((s, r) => s + r, 0) / ranks.length) : null;
  const mvp = ranked.filter((m) => m.ranking?.rank === 1 && m.win).length;
  const ace = ranked.filter((m) => m.ranking?.rank === 1 && !m.win).length;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-gray-100">Son {total} Oyun Performansı</h3>
        <div className="flex items-center gap-2">
          {mvp > 0 && <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">MVP ×{mvp}</span>}
          {ace > 0 && <span className="text-[10px] font-bold bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded">ACE ×{ace}</span>}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-5">
        {/* WR donut */}
        <WrGauge winRate={winRate} wins={wins} losses={losses} />

        {/* En çok oynanan şampiyonlar */}
        <div className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-2.5 min-w-0 lg:border-l lg:border-edge/50 lg:pl-5">
          {champs.map((c) => {
            const cwr = Math.round((c.wins / c.games) * 100);
            const cKda = c.d > 0 ? ((c.k + c.a) / c.d) : (c.k + c.a);
            return (
              <div key={c.name} className="flex items-center gap-2 min-w-0">
                <img src={c.image} alt={c.name} width={34} height={34} className="rounded-lg flex-shrink-0" title={c.name} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${wrColor(cwr)}`}>{cwr}%</span>
                    <span className="text-[10px] text-gray-400">{c.wins}G {c.games - c.wins}M</span>
                  </div>
                  <span className={`text-[11px] font-medium ${kdaColor(cKda)}`}>{cKda.toFixed(1)} KDA</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* KDA + ort. sıra */}
        <div className="flex items-center gap-5 flex-shrink-0 lg:border-l lg:border-edge/50 lg:pl-5">
          <StatBlock label="KDA" sub={`${avgK} / ${avgD} / ${avgA}`}>
            <p className={`text-2xl font-extrabold leading-none ${kdaColor(kdaRatio)}`}>
              {kdaRatio === "Perfect" ? "∞" : kdaRatio.toFixed(2)}
            </p>
          </StatBlock>
          {avgRank != null && (
            <StatBlock label="Ort. Sıra">
              <p className={`text-2xl font-extrabold leading-none ${rankColor(avgRank)}`}>
                {avgRank.toFixed(1)}<span className="text-xs text-gray-400 font-bold">/10</span>
              </p>
            </StatBlock>
          )}
        </div>
      </div>
    </div>
  );
}
