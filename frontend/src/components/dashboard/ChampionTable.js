/*
  ChampionTable - Şampiyon istatistik tablosu.

  Profesyonel bir tablo tasarımı:
  - Sıralama numarası
  - Şampiyon ikonu + isim
  - Win rate bar
  - Pick rate
  - Ban rate
  - Tier badge

  Tailwind notları:
  - table yapısı yerine div + grid kullanıyoruz (daha esnek)
  - hover efektleri ve satır animasyonları var
*/

import Link from "next/link";

export default function ChampionTable({ title, champions, sortBy = "winRate" }) {
  // Tier badge'inin CSS class'ını belirle
  function getTierClass(tier) {
    const classes = {
      "S+": "tier-s-plus",
      "S": "tier-s",
      "A": "tier-a",
      "B": "tier-b",
      "C": "tier-c",
      "D": "tier-d",
    };
    return classes[tier] || "tier-c";
  }

  // Win rate'e göre bar rengi
  function getWinRateColor(rate) {
    if (rate >= 53) return "from-emerald-500 to-emerald-400";
    if (rate >= 51) return "from-blue-500 to-blue-400";
    if (rate >= 49) return "from-yellow-500 to-yellow-400";
    return "from-red-500 to-red-400";
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Tablo başlığı */}
      <div className="px-5 py-4 border-b border-edge/50">
        <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      </div>

      {/* Tablo header */}
      <div className="grid grid-cols-[40px_1fr_130px_70px_70px_50px] gap-2 px-5 py-2 text-[11px] text-gray-500 uppercase tracking-wider border-b border-edge/30">
        <span>#</span>
        <span>Şampiyon</span>
        <span>Win Rate</span>
        <span>Pick</span>
        <span>Ban</span>
        <span>Tier</span>
      </div>

      {/* Satırlar */}
      <div className="divide-y divide-edge/30">
        {champions.map((champ, index) => {
          const insufficient = champ.winRate == null; // "veri yetersiz" (yeterli örneklem yok)
          return (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="grid grid-cols-[40px_1fr_130px_70px_70px_50px] gap-2 items-center px-5 py-3 hover:bg-hover transition-colors duration-200 group animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${index * 50}ms`,
              animationFillMode: "forwards",
            }}
          >
            {/* Sıra numarası */}
            <span className="text-sm text-gray-600 font-mono">
              {index + 1}
            </span>

            {/* Şampiyon bilgisi */}
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={champ.image}
                alt={champ.name}
                width={32}
                height={32}
                className="rounded-md group-hover:ring-1 ring-blue-500/50 transition-all duration-200"
              />
              <div className="min-w-0">
                <p className="text-sm text-gray-200 font-medium truncate group-hover:text-gray-100 transition-colors">
                  {champ.name}
                </p>
                <p className="text-[10px] text-gray-600 truncate">
                  {champ.tags.join(" / ")}
                </p>
              </div>
            </div>

            {/* Win Rate + bar — yeterli veri yoksa "veri yetersiz" */}
            {insufficient ? (
              <span className="text-[11px] text-gray-600 italic">veri yetersiz</span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-edge rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getWinRateColor(champ.winRate)} animate-fill-bar`}
                    style={{
                      width: `${champ.winRate}%`,
                      animationDelay: `${index * 50 + 300}ms`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-300 font-mono w-[42px] text-right">
                  {champ.winRate}%
                </span>
              </div>
            )}

            {/* Pick rate */}
            <span className="text-xs text-gray-400 font-mono">
              {insufficient ? "—" : `${champ.pickRate}%`}
            </span>

            {/* Ban rate */}
            <span className="text-xs text-gray-400 font-mono">
              {insufficient ? "—" : `${champ.banRate}%`}
            </span>

            {/* Tier */}
            <span className={`text-xs font-bold ${insufficient ? "text-gray-600" : getTierClass(champ.tier)}`}>
              {insufficient ? "—" : champ.tier}
            </span>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
