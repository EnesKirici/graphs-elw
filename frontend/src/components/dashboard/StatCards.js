/*
  StatCards - Dashboard istatistik kartları.

  Analytics dashboard'ların olmazsa olmazı:
  büyük rakam + küçük etiket + trend göstergesi.
*/

export default function StatCards({ data }) {
  // En yüksek win rate ortalaması hesapla
  const avgWinRate = (
    data.topWinRate.reduce((sum, c) => sum + c.winRate, 0) / data.topWinRate.length
  ).toFixed(1);

  // S ve S+ tier sayısı
  const sTierCount = data.champions.filter(
    (c) => c.tier === "S+" || c.tier === "S"
  ).length;

  // En popüler şampiyon
  const mostPicked = data.topPickRate[0];

  const cards = [
    {
      label: "Patch",
      value: data.version,
      sub: "Güncel versiyon",
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "Toplam Şampiyon",
      value: data.count,
      sub: `${sTierCount} adet S/S+ Tier`,
      color: "from-violet-500 to-purple-500",
    },
    {
      label: "Ortalama Win Rate",
      value: `${avgWinRate}%`,
      sub: "Top 10 şampiyon",
      color: "from-emerald-500 to-green-500",
    },
    {
      label: "En Popüler",
      value: mostPicked.name,
      sub: `${mostPicked.pickRate}% pick rate`,
      color: "from-amber-500 to-orange-500",
      icon: mostPicked.image,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="glass rounded-xl p-4 group hover:border-white/10 transition-all duration-300 animate-fade-in-up"
          style={{
            opacity: 0,
            animationDelay: `${i * 80}ms`,
            animationFillMode: "forwards",
          }}
        >
          {/* Üst dekoratif çizgi */}
          <div className={`w-8 h-1 rounded-full bg-gradient-to-r ${card.color} mb-3 group-hover:w-12 transition-all duration-300`} />

          <p className="text-[11px] text-gray-500 uppercase tracking-wider">
            {card.label}
          </p>

          <div className="flex items-center gap-2 mt-1">
            {card.icon && (
              <img src={card.icon} alt="" width={24} height={24} className="rounded-md" />
            )}
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>

          <p className="text-[11px] text-gray-600 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
