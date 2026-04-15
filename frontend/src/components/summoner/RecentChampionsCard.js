"use client";

export default function RecentChampionsCard({ matches = [] }) {
  if (matches.length === 0) return null;

  const cs = {};
  matches.forEach(m => {
    const n = m.champion.name;
    if (!cs[n]) cs[n] = { name: n, image: m.champion.image, wins: 0, losses: 0, kda: [] };
    m.win ? cs[n].wins++ : cs[n].losses++;
    if (typeof m.kda === "number") cs[n].kda.push(m.kda);
  });

  const items = Object.values(cs)
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 6);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Son Maçlar Özeti</h3>
        <span className="text-[11px] text-gray-500">{matches.length} maç</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          {items.map(c => {
            const t = c.wins + c.losses;
            const wr = Math.round(c.wins / t * 100);
            const ak = c.kda.length > 0 ? (c.kda.reduce((a, b) => a + b, 0) / c.kda.length).toFixed(1) : "0";
            return (
              <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <img src={c.image} alt={c.name} width={36} height={36} className="rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-200">{c.name}</p>
                  <p className="text-[10px] text-gray-500"><span className="text-emerald-400">{c.wins}W</span> <span className="text-red-400">{c.losses}L</span> · {ak} KDA</p>
                </div>
                <span className={`text-xs font-bold font-mono ${wr >= 50 ? "text-emerald-400" : "text-red-400"}`}>{wr}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
