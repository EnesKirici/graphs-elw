"use client";

// "Son N Oyun Performansı" — yüklü maçlardan (client-side) hesaplanır.
// Tasarım: ring/bar YOK. Büyük tipografi (WR) + gerçek şampiyon portreleri
// (çerçevesi WR rengine göre) + net stat değerleri. Yeşilsiz/morlu palet.

function wrColor(wr) {
  if (wr >= 60) return "text-cyan-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 44) return "text-purple-400";
  return "text-red-400";
}
function wrHex(wr) {
  if (wr >= 60) return "#22d3ee"; // cyan
  if (wr >= 50) return "#60a5fa"; // mavi
  if (wr >= 44) return "#a855f7"; // mor
  return "#ef4444";               // kırmızı
}
function kdaColor(k) {
  if (k === "Perfect" || k >= 4) return "text-sky-300";
  if (k >= 3) return "text-blue-400";
  if (k >= 2) return "text-gray-200";
  return "text-red-400";
}
function rankColor(r) {
  if (r == null) return "text-gray-300";
  if (r <= 3) return "text-sky-300";
  if (r <= 5) return "text-blue-400";
  if (r <= 7) return "text-gray-200";
  return "text-red-400";
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

  // Şampiyon kırılımı (en çok oynanan)
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
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-100">Son {total} Oyun Performansı</h3>
        <div className="flex items-center gap-1.5">
          {mvp > 0 && <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">MVP ×{mvp}</span>}
          {ace > 0 && <span className="text-[10px] font-bold bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full">ACE ×{ace}</span>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        {/* Özet — WR büyük tipografi + galibiyet/mağlubiyet */}
        <div className="flex-shrink-0 text-center sm:text-left">
          <p className={`text-[44px] font-extrabold leading-none ${wrColor(winRate)}`}>
            {winRate}<span className="text-[24px] align-top">%</span>
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em] mt-2">Kazanma Oranı</p>
          <p className="text-[12.5px] font-semibold mt-1.5">
            <span className="text-blue-400">{wins} Galibiyet</span>
            <span className="text-gray-600"> · </span>
            <span className="text-red-400">{losses} Mağlubiyet</span>
          </p>
        </div>

        <div className="hidden sm:block w-px self-stretch bg-edge/40" />

        {/* En çok oynanan — portreler (çerçeve = WR rengi), altında WR% + KDA */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em] mb-3">En Çok Oynanan</p>
          <div className="flex justify-center sm:justify-start gap-4">
            {champs.map((c) => {
              const cwr = Math.round((c.wins / c.games) * 100);
              const cKda = c.d > 0 ? ((c.k + c.a) / c.d) : (c.k + c.a);
              return (
                <div key={c.name} className="flex flex-col items-center gap-1.5 w-[56px]">
                  <img src={c.image} alt={c.name} width={44} height={44} title={c.name}
                    className="rounded-lg" style={{ boxShadow: `0 0 0 2px ${wrHex(cwr)}, 0 0 0 4px var(--c-card)` }} />
                  <span className={`text-[13px] font-bold leading-none ${wrColor(cwr)}`}>{cwr}%</span>
                  <span className={`text-[10px] leading-none ${kdaColor(cKda)}`}>{cKda.toFixed(1)} KDA</span>
                  <span className="text-[9px] text-gray-500 leading-none">{c.games} oyun</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden sm:block w-px self-stretch bg-edge/40" />

        {/* Sağ — KDA + Ort. Sıra */}
        <div className="flex-shrink-0 flex flex-row sm:flex-col gap-5 sm:gap-3 text-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em]">KDA</p>
            <p className={`text-[22px] font-extrabold leading-none mt-1 ${kdaColor(kdaRatio)}`}>
              {kdaRatio === "Perfect" ? "∞" : kdaRatio.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{avgK} / {avgD} / {avgA}</p>
          </div>
          {avgRank != null && (
            <div className="sm:pt-3 sm:border-t sm:border-edge/40">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em]">Ort. Sıra</p>
              <p className={`text-[22px] font-extrabold leading-none mt-1 ${rankColor(avgRank)}`}>
                {avgRank.toFixed(1)}<span className="text-xs text-gray-500 font-bold">/10</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
